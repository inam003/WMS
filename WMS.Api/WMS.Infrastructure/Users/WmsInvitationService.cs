using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using WMS.Application.Users;
using WMS.Domain;

namespace WMS.Infrastructure.Users;

public sealed class WmsInvitationService(
    IWmsInvitationRepository invitationRepository,
    IWmsUserService userService,
    IInvitationEmailService emailService,
    IConfiguration configuration,
    TimeProvider timeProvider) : IWmsInvitationService
{
    private const int DefaultExpiryDays = 7;
    private const int MaximumTokenLength = 256;

    public async Task<IReadOnlyList<WmsInvitationResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var invitations = await invitationRepository.GetAllAsync(cancellationToken);
        return invitations.Select(invitation => ToResponse(invitation, now)).ToArray();
    }

    public async Task<WmsInvitationResult<WmsInvitationResponse>> CreateInvitationAsync(
        InviteWmsUserRequest request,
        string inviterSubject,
        string inviterEmail,
        CancellationToken cancellationToken)
    {
        if (!MailAddress.TryCreate(request.Email?.Trim(), out var mailAddress))
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                WmsInvitationError.InvalidEmail);
        }

        if (!TryParseInviteRole(request.Role, out var role))
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                WmsInvitationError.InvalidRole);
        }

        if (!TryGetExpiryDays(out var expiryDays))
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                WmsInvitationError.ConfigurationError);
        }

        var email = mailAddress.Address.Trim();
        var normalizedEmail = email.ToLowerInvariant();
        var token = TokenSecurity.GenerateSecureToken();
        var existingUsers = await userService.GetAllAsync(cancellationToken);
        if (existingUsers.Any(user =>
                user.IsActive &&
                string.Equals(
                    user.Email?.Trim(),
                    normalizedEmail,
                    StringComparison.OrdinalIgnoreCase)) ||
            string.Equals(
                inviterEmail.Trim(),
                normalizedEmail,
                StringComparison.OrdinalIgnoreCase))
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                WmsInvitationError.AccountAlreadyActive);
        }

        if (await invitationRepository.GetActiveByEmailAsync(
                normalizedEmail,
                cancellationToken) is not null)
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                WmsInvitationError.ActiveInvitationExists);
        }

        var now = timeProvider.GetUtcNow();
        var invitation = new WmsInvitation
        {
            Id = Guid.NewGuid(),
            Email = email,
            NormalizedEmail = normalizedEmail,
            TokenHash = TokenSecurity.HashToken(token),
            Role = role,
            Status = WmsInvitationStatus.Pending,
            InviterSubject = inviterSubject,
            CreatedAt = now,
            ExpiresAt = now.AddDays(expiryDays)
        };

        if (!await invitationRepository.CreateAsync(invitation, cancellationToken))
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                WmsInvitationError.ActiveInvitationExists);
        }

        InvitationEmailError sendResult;
        try
        {
            sendResult = await emailService.SendInvitationAsync(
                new InvitationEmailRequest(email, role, token, invitation.ExpiresAt),
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            await invitationRepository.RevokeAsync(invitation.Id, CancellationToken.None);
            throw;
        }

        if (sendResult != InvitationEmailError.None)
        {
            await invitationRepository.DeleteUnsentAsync(invitation.Id, CancellationToken.None);
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                sendResult == InvitationEmailError.ConfigurationError
                    ? WmsInvitationError.ConfigurationError
                    : WmsInvitationError.SendFailed);
        }

        var currentInvitation = await invitationRepository.GetByIdAsync(
            invitation.Id,
            cancellationToken);
        return WmsInvitationResult<WmsInvitationResponse>.Success(
            ToResponse(currentInvitation ?? invitation, timeProvider.GetUtcNow()));
    }

    public async Task<WmsInvitationResult<WmsInvitationResponse>> ResendInvitationAsync(
        Guid id,
        string inviterSubject,
        CancellationToken cancellationToken)
    {
        if (!TryGetExpiryDays(out var expiryDays))
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                WmsInvitationError.ConfigurationError);
        }

        var now = timeProvider.GetUtcNow();
        var token = TokenSecurity.GenerateSecureToken();
        var expiresAt = now.AddDays(expiryDays);
        var result = await invitationRepository.RotateTokenAsync(
            id,
            TokenSecurity.HashToken(token),
            inviterSubject,
            expiresAt,
            cancellationToken);
        if (!result.Succeeded || result.Value is null)
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(result.Error);
        }

        var invitation = result.Value;
        var sendResult = await emailService.SendInvitationAsync(
            new InvitationEmailRequest(
                invitation.Email,
                invitation.Role,
                token,
                invitation.ExpiresAt),
            cancellationToken);
        if (sendResult != InvitationEmailError.None)
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(
                sendResult == InvitationEmailError.ConfigurationError
                    ? WmsInvitationError.ConfigurationError
                    : WmsInvitationError.SendFailed);
        }

        var currentInvitation = await invitationRepository.GetByIdAsync(id, cancellationToken);
        return WmsInvitationResult<WmsInvitationResponse>.Success(
            ToResponse(currentInvitation ?? invitation, timeProvider.GetUtcNow()));
    }

    public async Task<WmsInvitationResult<WmsInvitationResponse>> RevokeInvitationAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await invitationRepository.RevokeAsync(id, cancellationToken);
        if (!result.Succeeded || result.Value is null)
        {
            return WmsInvitationResult<WmsInvitationResponse>.Failure(result.Error);
        }

        return WmsInvitationResult<WmsInvitationResponse>.Success(
            ToResponse(result.Value, timeProvider.GetUtcNow()));
    }

    public async Task<WmsInvitationResult<ValidateInvitationResponse>> ValidateTokenAsync(
        string token,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > MaximumTokenLength)
        {
            return WmsInvitationResult<ValidateInvitationResponse>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        var tokenHash = TokenSecurity.HashToken(token);
        var invitation = await invitationRepository.GetByTokenHashAsync(
            tokenHash,
            cancellationToken);
        if (invitation is null ||
            !TokenSecurity.HashesMatch(invitation.TokenHash, tokenHash))
        {
            return WmsInvitationResult<ValidateInvitationResponse>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        var statusError = GetUnavailableError(invitation, timeProvider.GetUtcNow());
        if (statusError is not null)
        {
            return WmsInvitationResult<ValidateInvitationResponse>.Failure(statusError.Value);
        }

        return WmsInvitationResult<ValidateInvitationResponse>.Success(
            new ValidateInvitationResponse(
                invitation.Email,
                invitation.Role.ToString(),
                invitation.ExpiresAt));
    }

    public async Task<WmsInvitationResult<ValidateInvitationResponse>> ClaimInvitationAsync(
        string token,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > MaximumTokenLength)
        {
            return WmsInvitationResult<ValidateInvitationResponse>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        var tokenHash = TokenSecurity.HashToken(token);
        var invitation = await invitationRepository.GetByTokenHashAsync(
            tokenHash,
            cancellationToken);
        if (invitation is null ||
            !TokenSecurity.HashesMatch(invitation.TokenHash, tokenHash))
        {
            return WmsInvitationResult<ValidateInvitationResponse>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        var statusError = GetUnavailableError(invitation, timeProvider.GetUtcNow());
        if (statusError is not null &&
            !(statusError == WmsInvitationError.AlreadyAccepted &&
              invitation.AcceptedSubject is null))
        {
            return WmsInvitationResult<ValidateInvitationResponse>.Failure(statusError.Value);
        }

        var result = await invitationRepository.ClaimAsync(tokenHash, cancellationToken);
        if (!result.Succeeded || result.Value is null)
        {
            return WmsInvitationResult<ValidateInvitationResponse>.Failure(result.Error);
        }

        return WmsInvitationResult<ValidateInvitationResponse>.Success(
            new ValidateInvitationResponse(
                result.Value.Email,
                result.Value.Role.ToString(),
                result.Value.ExpiresAt));
    }

    public async Task<WmsUserAssignment?> ProvisionClaimedInvitationAsync(
        string authenticatedSubject,
        string authenticatedEmail,
        bool emailVerified,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(authenticatedSubject) ||
            !MailAddress.TryCreate(authenticatedEmail, out var mailAddress))
        {
            return null;
        }

        var result = await invitationRepository.ProvisionClaimedInvitationAsync(
            authenticatedSubject,
            mailAddress.Address.Trim().ToLowerInvariant(),
            cancellationToken);
        return result.Succeeded ? result.Value : null;
    }

    private bool TryGetExpiryDays(out int expiryDays)
    {
        var configuredDays = configuration["WMS_INVITATION_EXPIRY_DAYS"];
        if (string.IsNullOrWhiteSpace(configuredDays))
        {
            expiryDays = DefaultExpiryDays;
            return true;
        }

        return int.TryParse(configuredDays, out expiryDays) &&
               expiryDays is >= 1 and <= 90;
    }

    private static bool TryParseInviteRole(string value, out WmsRole role)
    {
        if (!Enum.TryParse(value, true, out role) ||
            !Enum.IsDefined(role) ||
            role == WmsRole.Admin ||
            !string.Equals(
                Enum.GetName(role),
                value,
                StringComparison.OrdinalIgnoreCase))
        {
            role = default;
            return false;
        }

        return true;
    }

    private static WmsInvitationError? GetUnavailableError(
        WmsInvitation invitation,
        DateTimeOffset now) =>
        invitation.Status switch
        {
            WmsInvitationStatus.Accepted => WmsInvitationError.AlreadyAccepted,
            WmsInvitationStatus.Revoked => WmsInvitationError.Revoked,
            WmsInvitationStatus.Expired => WmsInvitationError.Expired,
            WmsInvitationStatus.Pending when invitation.ExpiresAt <= now =>
                WmsInvitationError.Expired,
            _ => null
        };

    private static WmsInvitationResponse ToResponse(
        WmsInvitation invitation,
        DateTimeOffset now)
    {
        var status = invitation.Status == WmsInvitationStatus.Pending &&
                     invitation.ExpiresAt <= now
            ? WmsInvitationStatus.Expired
            : invitation.Status;
        return new WmsInvitationResponse(
            invitation.Id,
            invitation.Email,
            invitation.Role.ToString(),
            status.ToString(),
            invitation.InviterSubject,
            invitation.CreatedAt,
            invitation.ExpiresAt,
            invitation.AcceptedAt,
            invitation.AcceptedSubject);
    }
}
