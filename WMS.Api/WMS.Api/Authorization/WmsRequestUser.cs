using WMS.Application.Users;
using WMS.Domain;

namespace WMS.Api.Authorization;

public sealed class WmsRequestUser(
    IWmsUserService userService,
    IWmsInvitationService invitationService,
    IHttpContextAccessor httpContextAccessor,
    ILogger<WmsRequestUser> logger)
{
    private Task<WmsUserAssignment?>? currentUserTask;

    public Task<WmsUserAssignment?> GetCurrentAsync(CancellationToken cancellationToken)
    {
        if (currentUserTask is not null)
        {
            return currentUserTask;
        }

        var subject = httpContextAccessor.HttpContext?.User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            return Task.FromResult<WmsUserAssignment?>(null);
        }

        currentUserTask = GetOrProvisionCurrentAsync(subject, cancellationToken);
        return currentUserTask;
    }

    private async Task<WmsUserAssignment?> GetOrProvisionCurrentAsync(
        string subject,
        CancellationToken cancellationToken)
    {
        var currentUser = await userService.GetBySubjectAsync(subject, cancellationToken);
        if (currentUser is not null)
        {
            return currentUser;
        }

        var principal = httpContextAccessor.HttpContext?.User;
        var verifiedClaim =
            principal?.FindFirst("email_verified")?.Value ??
            principal?.FindFirst("emailVerified")?.Value;
        var emailVerified = string.Equals(
            verifiedClaim, "true", StringComparison.OrdinalIgnoreCase);
        var email = principal?.FindFirst("email")?.Value ?? string.Empty;
        var result = await invitationService.ProvisionClaimedInvitationAsync(
            subject,
            email,
            emailVerified,
            cancellationToken);
        if (result is null)
        {
            logger.LogWarning(
                "WMS invitation provisioning did not apply; emailPresent={EmailPresent}, emailVerifiedClaim={VerifiedClaim}, claimTypes={ClaimTypes}",
                email.Length > 0,
                verifiedClaim ?? "(missing)",
                string.Join(',', principal?.Claims.Select(claim => claim.Type).Distinct() ?? []));
        }

        return result;
    }
}
