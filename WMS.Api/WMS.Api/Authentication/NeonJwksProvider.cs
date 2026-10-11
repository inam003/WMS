using System.Text.Json;

namespace WMS.Api.Authentication;

public sealed class NeonJwksProvider(
    HttpClient httpClient,
    NeonJwtSettings settings)
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1);
    private static readonly TimeSpan UnknownKeyRefreshInterval = TimeSpan.FromMinutes(1);
    private readonly SemaphoreSlim refreshLock = new(1, 1);
    private IReadOnlyDictionary<string, byte[]>? signingKeys;
    private DateTimeOffset cacheExpiresAt;
    private DateTimeOffset lastRefreshAt;

    public async Task<byte[]?> GetSigningKeyAsync(
        string keyId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        if (signingKeys is not null && now < cacheExpiresAt &&
            signingKeys.TryGetValue(keyId, out var cachedKey))
        {
            return cachedKey;
        }

        await refreshLock.WaitAsync(cancellationToken);
        try
        {
            now = DateTimeOffset.UtcNow;
            if (signingKeys is not null && now < cacheExpiresAt)
            {
                if (signingKeys.TryGetValue(keyId, out cachedKey))
                {
                    return cachedKey;
                }

                if (now - lastRefreshAt < UnknownKeyRefreshInterval)
                {
                    return null;
                }
            }

            signingKeys = await FetchSigningKeysAsync(cancellationToken);
            cacheExpiresAt = DateTimeOffset.UtcNow + CacheDuration;
            lastRefreshAt = DateTimeOffset.UtcNow;

            return signingKeys.TryGetValue(keyId, out var signingKey)
                ? signingKey
                : null;
        }
        finally
        {
            refreshLock.Release();
        }
    }

    private async Task<IReadOnlyDictionary<string, byte[]>> FetchSigningKeysAsync(
        CancellationToken cancellationToken)
    {
        using var response = await httpClient.GetAsync(
            settings.JwksUri,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
        response.EnsureSuccessStatusCode();

        if (response.Content.Headers.ContentLength is > 1_048_576)
        {
            throw new InvalidDataException("The Neon JWKS response is too large.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(
            stream,
            new JsonDocumentOptions { MaxDepth = 8 },
            cancellationToken);

        if (!document.RootElement.TryGetProperty("keys", out var keys) ||
            keys.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException("The Neon JWKS response has no keys array.");
        }

        var signingKeys = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        foreach (var key in keys.EnumerateArray())
        {
            if (!IsEd25519SigningKey(key))
            {
                continue;
            }

            var keyId = key.GetProperty("kid").GetString();
            var encodedKey = key.GetProperty("x").GetString();
            if (string.IsNullOrWhiteSpace(keyId) ||
                string.IsNullOrWhiteSpace(encodedKey))
            {
                continue;
            }

            var publicKey = Base64Url.Decode(encodedKey);
            if (publicKey.Length != 32)
            {
                continue;
            }

            if (!signingKeys.TryAdd(keyId, publicKey))
            {
                throw new InvalidDataException("The Neon JWKS contains duplicate key IDs.");
            }
        }

        return signingKeys;
    }

    private static bool IsEd25519SigningKey(JsonElement key)
    {
        return key.ValueKind == JsonValueKind.Object &&
               HasStringProperty(key, "kty", "OKP") &&
               HasStringProperty(key, "crv", "Ed25519") &&
               IsOptionalStringProperty(key, "alg", "EdDSA") &&
               IsOptionalStringProperty(key, "use", "sig") &&
               HasStringProperty(key, "kid") &&
               HasStringProperty(key, "x");
    }

    private static bool IsOptionalStringProperty(
        JsonElement element,
        string name,
        string expectedValue)
    {
        return !element.TryGetProperty(name, out var property) ||
               (property.ValueKind == JsonValueKind.String &&
                property.GetString() == expectedValue);
    }

    private static bool HasStringProperty(JsonElement element, string name)
    {
        return element.TryGetProperty(name, out var property) &&
               property.ValueKind == JsonValueKind.String;
    }

    private static bool HasStringProperty(JsonElement element, string name, string value)
    {
        return element.TryGetProperty(name, out var property) &&
               property.ValueKind == JsonValueKind.String &&
               property.GetString() == value;
    }

}
