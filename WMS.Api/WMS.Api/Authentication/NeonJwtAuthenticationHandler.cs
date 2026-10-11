using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Org.BouncyCastle.Math.EC.Rfc8032;

namespace WMS.Api.Authentication;

public sealed class NeonJwtAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    System.Text.Encodings.Web.UrlEncoder encoder,
    NeonJwksProvider jwksProvider,
    NeonJwtSettings settings)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    private static readonly TimeSpan ClockSkew = TimeSpan.FromSeconds(60);
    private const int MaximumTokenLength = 16_384;

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!AuthenticationHeaderValue.TryParse(
                Request.Headers.Authorization,
                out var authorization) ||
            !string.Equals(authorization.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase))
        {
            Logger.LogInformation("Neon bearer authentication attempted; tokenPresent=false.");
            return AuthenticateResult.NoResult();
        }

        if (string.IsNullOrWhiteSpace(authorization.Parameter))
        {
            Logger.LogWarning("Neon bearer authentication attempted; tokenPresent=false.");
            return AuthenticateResult.Fail("The bearer token is missing.");
        }

        try
        {
            var principal = await ValidateTokenAsync(authorization.Parameter, Context.RequestAborted);
            Logger.LogInformation(
                "Neon JWT accepted; tokenPresent=true, algorithm=EdDSA, keyIdPresent=true, issuerValid=true, audienceValid=true, subjectPresent=true, expirationValid=true.");
            return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
        }
        catch (Exception exception) when (
            exception is JsonException or FormatException or InvalidDataException)
        {
            var failure = exception switch
            {
                InvalidDataException => exception.Message,
                FormatException => "Malformed JWT encoding.",
                JsonException => "Malformed JWT JSON.",
                _ => "Invalid JWT.",
            };
            Logger.LogWarning(
                "Neon JWT rejected; tokenPresent=true, failure={Failure}",
                failure);
            return AuthenticateResult.Fail("The bearer token is invalid.");
        }
        catch (HttpRequestException exception)
        {
            Logger.LogError(
                "Could not retrieve Neon signing keys; tokenPresent=true, failureType={FailureType}, statusCode={StatusCode}",
                exception.GetType().Name,
                exception.StatusCode);
            return AuthenticateResult.Fail("Neon signing keys are temporarily unavailable.");
        }
    }

    private async Task<ClaimsPrincipal> ValidateTokenAsync(
        string token,
        CancellationToken cancellationToken)
    {
        if (token.Length > MaximumTokenLength)
        {
            throw new InvalidDataException("The bearer token is too large.");
        }

        var segments = token.Split('.');
        if (segments.Length != 3)
        {
            throw new FormatException("The bearer token is not a compact JWT.");
        }

        var headerBytes = Base64Url.Decode(segments[0]);
        var payloadBytes = Base64Url.Decode(segments[1]);
        var signature = Base64Url.Decode(segments[2]);

        using var header = JsonDocument.Parse(headerBytes, new JsonDocumentOptions { MaxDepth = 8 });
        using var payload = JsonDocument.Parse(payloadBytes, new JsonDocumentOptions { MaxDepth = 8 });

        if (header.RootElement.ValueKind != JsonValueKind.Object ||
            !header.RootElement.TryGetProperty("alg", out var algorithm) ||
            algorithm.ValueKind != JsonValueKind.String ||
            algorithm.GetString() != "EdDSA" ||
            !header.RootElement.TryGetProperty("kid", out var keyIdProperty) ||
            keyIdProperty.ValueKind != JsonValueKind.String)
        {
            throw new InvalidDataException("The JWT algorithm or key ID is invalid.");
        }

        var keyId = keyIdProperty.GetString();
        if (string.IsNullOrWhiteSpace(keyId))
        {
            throw new InvalidDataException("The JWT key ID is missing.");
        }

        var publicKey = await jwksProvider.GetSigningKeyAsync(keyId, cancellationToken);
        if (publicKey is null)
        {
            throw new InvalidDataException("No matching JWKS signing key was found.");
        }

        if (signature.Length != Ed25519.SignatureSize)
        {
            throw new InvalidDataException("The JWT signature length is invalid.");
        }

        if (!Ed25519.Verify(
                signature,
                0,
                publicKey,
                0,
                Encoding.ASCII.GetBytes($"{segments[0]}.{segments[1]}"),
                0,
                segments[0].Length + 1 + segments[1].Length))
        {
            throw new InvalidDataException("The JWT signature verification failed.");
        }

        ValidateClaims(payload.RootElement);
        return CreatePrincipal(payload.RootElement);
    }

    private void ValidateClaims(JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty("iss", out var issuer) ||
            issuer.ValueKind != JsonValueKind.String ||
            issuer.GetString() != settings.Issuer ||
            !payload.TryGetProperty("sub", out var subject) ||
            subject.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(subject.GetString()))
        {
            throw new InvalidDataException("Required JWT issuer or subject claims are invalid.");
        }

        if (!payload.TryGetProperty("aud", out var audience) ||
            !ContainsAudience(audience, settings.Issuer))
        {
            throw new InvalidDataException("The JWT audience is invalid.");
        }

        var now = DateTimeOffset.UtcNow;
        if (!payload.TryGetProperty("exp", out var expiration) ||
            !TryGetUnixTime(expiration, out var expiresAt) ||
            expiresAt <= now - ClockSkew)
        {
            throw new InvalidDataException("The JWT has expired or has no valid expiration.");
        }

        if (payload.TryGetProperty("nbf", out var notBefore) &&
            (!TryGetUnixTime(notBefore, out var validFrom) || validFrom > now + ClockSkew))
        {
            throw new InvalidDataException("The JWT is not yet valid.");
        }
    }

    private static ClaimsPrincipal CreatePrincipal(JsonElement payload)
    {
        var claims = new List<Claim>();
        foreach (var property in payload.EnumerateObject())
        {
            AddClaims(claims, property.Name, property.Value);
        }

        return new ClaimsPrincipal(
            new ClaimsIdentity(claims, "Neon", "name", "role"));
    }

    private static void AddClaims(List<Claim> claims, string type, JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in value.EnumerateArray())
            {
                AddScalarClaim(claims, type, item);
            }

            return;
        }

        AddScalarClaim(claims, type, value);
    }

    private static void AddScalarClaim(List<Claim> claims, string type, JsonElement value)
    {
        var claimValue = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => value.GetRawText(),
            _ => null,
        };

        if (claimValue is not null)
        {
            claims.Add(new Claim(type, claimValue));
        }
    }

    private static bool ContainsAudience(JsonElement audience, string expectedAudience)
    {
        return audience.ValueKind switch
        {
            JsonValueKind.String => audience.GetString() == expectedAudience,
            JsonValueKind.Array => audience.EnumerateArray().Any(
                item => item.ValueKind == JsonValueKind.String &&
                        item.GetString() == expectedAudience),
            _ => false,
        };
    }

    private static bool TryGetUnixTime(JsonElement claim, out DateTimeOffset value)
    {
        if (claim.ValueKind == JsonValueKind.Number && claim.TryGetInt64(out var seconds))
        {
            try
            {
                value = DateTimeOffset.FromUnixTimeSeconds(seconds);
                return true;
            }
            catch (ArgumentOutOfRangeException)
            {
            }
        }

        value = default;
        return false;
    }

}
