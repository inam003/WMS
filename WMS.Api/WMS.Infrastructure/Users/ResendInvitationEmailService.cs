using System.Net.Mail;
using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;
using Resend;
using WMS.Application.Users;
using WMS.Domain;

namespace WMS.Infrastructure.Users;

public sealed class ResendInvitationEmailService(
    IResend resend,
    IConfiguration configuration) : IInvitationEmailService
{
    private const string ApplicationName = "WMS";

    public async Task<InviteWmsUserResult<InviteWmsUserResponse>> SendInvitationAsync(
        InviteWmsUserRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            !MailAddress.TryCreate(request.Email, out _))
        {
            return InviteWmsUserResult<InviteWmsUserResponse>.Failure(
                InviteWmsUserError.InvalidEmail);
        }

        if (!Enum.TryParse<WmsRole>(request.Role, true, out var role))
        {
            return InviteWmsUserResult<InviteWmsUserResponse>.Failure(
                InviteWmsUserError.InvalidRole);
        }

        var frontendBaseUrl = GetFrontendBaseUrl();
        if (string.IsNullOrWhiteSpace(frontendBaseUrl))
        {
            return InviteWmsUserResult<InviteWmsUserResponse>.Failure(
                InviteWmsUserError.FrontendUrlNotConfigured);
        }

        var fromAddress = configuration["WMS_FROM_EMAIL"] ??
            Environment.GetEnvironmentVariable("WMS_FROM_EMAIL");
        if (string.IsNullOrWhiteSpace(fromAddress))
        {
            return InviteWmsUserResult<InviteWmsUserResponse>.Failure(
                InviteWmsUserError.FromEmailNotConfigured);
        }

        var expiresAt = request.ExpiresAtUtc == default
            ? DateTimeOffset.UtcNow.AddDays(7)
            : request.ExpiresAtUtc;

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

        var acceptUrl = BuildAcceptUrl(frontendBaseUrl, token, request.Email, role, expiresAt);

        var message = new EmailMessage
        {
            From = fromAddress,
            Subject = $"{ApplicationName} Invitation: {request.Email}",
            HtmlBody = BuildHtmlBody(request.Email, role, acceptUrl, expiresAt, frontendBaseUrl)
        };

        message.To.Add(request.Email);

        try
        {
            await resend.EmailSendAsync(message, cancellationToken);
            return InviteWmsUserResult<InviteWmsUserResponse>.Success(
                new InviteWmsUserResponse(request.Email, role.ToString(), acceptUrl, expiresAt));
        }
        catch (Exception)
        {
            return InviteWmsUserResult<InviteWmsUserResponse>.Failure(
                InviteWmsUserError.SendFailed);
        }
    }

    private static string BuildAcceptUrl(
        string frontendBaseUrl,
        string token,
        string email,
        WmsRole role,
        DateTimeOffset expiresAt)
    {
        var normalizedBaseUrl = frontendBaseUrl.TrimEnd('/');
        return $"{normalizedBaseUrl}/accept-invitation?token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(email)}&role={Uri.EscapeDataString(role.ToString())}&expiresAt={Uri.EscapeDataString(expiresAt.ToString("O"))}";
    }

    private static string BuildHtmlBody(
        string email,
        WmsRole role,
        string acceptUrl,
        DateTimeOffset expiresAt,
        string frontendBaseUrl) =>
        $"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
              <h2 style="margin-bottom: 16px;">{ApplicationName} Invitation</h2>
              <p>Hello,</p>
              <p>You have been invited to join <strong>{ApplicationName}</strong> as <strong>{role}</strong>.</p>
              <p><strong>Invited email:</strong> {email}</p>
              <p><strong>Invitation expires:</strong> {expiresAt:yyyy-MM-dd HH:mm 'UTC'}</p>
              <p>
                <a href="{acceptUrl}" style="display:inline-block; background:#2563eb; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:6px;">
                  Accept Invitation
                </a>
              </p>
              <p>Need to sign in? Visit the <a href="{frontendBaseUrl.TrimEnd('/')}/login">WMS login page</a>.</p>
            </div>
          </body>
        </html>
        """;

    private string? GetFrontendBaseUrl() =>
        configuration["WMS_FRONTEND_URL"]
        ?? configuration["WMS_FRONTEND_BASE_URL"]
        ?? Environment.GetEnvironmentVariable("WMS_FRONTEND_URL")
        ?? Environment.GetEnvironmentVariable("WMS_FRONTEND_BASE_URL")
        ?? "http://localhost:5173";
}
