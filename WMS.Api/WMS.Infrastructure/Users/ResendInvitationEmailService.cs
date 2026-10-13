using System.Net.Mail;
using System.Text.Encodings.Web;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Resend;
using WMS.Application.Users;

namespace WMS.Infrastructure.Users;

public sealed class ResendInvitationEmailService(
    IResend resend,
    IConfiguration configuration,
    ILogger<ResendInvitationEmailService> logger) : IInvitationEmailService
{
    private const string ApplicationName = "WMS";

    public async Task<InvitationEmailError> SendInvitationAsync(
        InvitationEmailRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(configuration["RESEND_APITOKEN"]) ||
            !TryGetFrontendBaseUrl(out var frontendBaseUrl) ||
            !MailAddress.TryCreate(configuration["WMS_FROM_EMAIL"], out var fromAddress))
        {
            return InvitationEmailError.ConfigurationError;
        }

        var acceptUrl = BuildAcceptUrl(frontendBaseUrl!, request.Token);
        var message = new EmailMessage
        {
            From = fromAddress.ToString(),
            Subject = $"{ApplicationName} Invitation",
            HtmlBody = BuildHtmlBody(
                request.Email,
                request.Role.ToString(),
                acceptUrl,
                request.ExpiresAt)
        };
        message.To.Add(request.Email);

        try
        {
            await resend.EmailSendAsync(message, cancellationToken);
            return InvitationEmailError.None;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is ResendException or HttpRequestException or OperationCanceledException)
        {
            logger.LogWarning(
                "Resend could not deliver a WMS invitation; failureType={FailureType}, reason={Reason}, statusCode={StatusCode}",
                exception.GetType().Name,
                exception.Message,
                (exception as ResendException)?.StatusCode ??
                    (exception as HttpRequestException)?.StatusCode);
            return InvitationEmailError.SendFailed;
        }
    }

    private bool TryGetFrontendBaseUrl(out Uri? frontendBaseUrl)
    {
        frontendBaseUrl = null;
        var configuredUrl = configuration["WMS_FRONTEND_URL"];
        if (!Uri.TryCreate(configuredUrl, UriKind.Absolute, out var parsedUrl) ||
            !string.IsNullOrEmpty(parsedUrl.Query) ||
            !string.IsNullOrEmpty(parsedUrl.Fragment) ||
            !string.IsNullOrEmpty(parsedUrl.UserInfo))
        {
            return false;
        }

        frontendBaseUrl = parsedUrl;
        return parsedUrl.Scheme == Uri.UriSchemeHttps ||
               (string.Equals(
                    configuration["ASPNETCORE_ENVIRONMENT"],
                    "Development",
                    StringComparison.OrdinalIgnoreCase) &&
                parsedUrl.Scheme == Uri.UriSchemeHttp &&
                parsedUrl.IsLoopback);
    }

    private static string BuildAcceptUrl(Uri frontendBaseUrl, string token) =>
        $"{frontendBaseUrl.ToString().TrimEnd('/')}/accept-invitation#token={Uri.EscapeDataString(token)}";

    private static string BuildHtmlBody(
        string email,
        string role,
        string acceptUrl,
        DateTimeOffset expiresAt)
    {
        var safeEmail = HtmlEncoder.Default.Encode(email);
        var safeRole = HtmlEncoder.Default.Encode(role);
        var safeAcceptUrl = HtmlEncoder.Default.Encode(acceptUrl);
        var safeDate = HtmlEncoder.Default.Encode(
            expiresAt.ToString("yyyy-MM-dd HH:mm"));

        return $"""
            <!doctype html>
            <html lang="en">
              <body style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;background:#f9fafb;padding:24px">
                <main style="max-width:600px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:32px">
                  <h1 style="font-size:24px">You are invited to {ApplicationName}</h1>
                  <p>A WMS Admin invited you to join the WMS as <strong>{safeRole}</strong>.</p>
                  <p><strong>Invited email:</strong> {safeEmail}</p>
                  <p><strong>Expires:</strong> {safeDate} UTC</p>
                  <p><a href="{safeAcceptUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Accept Invitation</a></p>
                  <p>This invitation is intended only for {safeEmail}. Open the link above to accept it, then create your WMS account using this email address and verify it to activate your access.</p>
                  <p>If you did not expect this invitation, ignore this email.</p>
                </main>
              </body>
            </html>
            """;
    }
}
