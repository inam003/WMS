using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WMS.Application.Users;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/invitations")]
public sealed class InvitationsController(IWmsInvitationService invitationService)
    : ControllerBase
{
    [HttpPost("validate")]
    [AllowAnonymous]
    [EnableRateLimiting("invitation-validation")]
    public async Task<ActionResult<ValidateInvitationResponse>> Validate(
        AcceptInvitationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await invitationService.ValidateTokenAsync(
            request.Token,
            cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : InvitationError(result.Error);
    }

    [HttpPost("claim")]
    [AllowAnonymous]
    [EnableRateLimiting("invitation-acceptance")]
    public async Task<ActionResult<ValidateInvitationResponse>> Claim(
        AcceptInvitationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await invitationService.ClaimInvitationAsync(
            request.Token,
            cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : InvitationError(result.Error);
    }

    private ActionResult InvitationError(WmsInvitationError error) =>
        error switch
        {
            WmsInvitationError.InvalidEmail or WmsInvitationError.InvalidRole =>
                BadRequest(Error("INVITATION_INVALID", "The invitation details are invalid.")),
            WmsInvitationError.InvitationNotFound =>
                NotFound(Error("INVITATION_INVALID", "This invitation link is invalid.")),
            WmsInvitationError.AlreadyAccepted =>
                Conflict(Error("INVITATION_ALREADY_USED", "This invitation has already been accepted.")),
            WmsInvitationError.Expired =>
                Conflict(Error("INVITATION_EXPIRED", "This invitation has expired. Ask your WMS Admin to resend it.")),
            WmsInvitationError.Revoked =>
                Conflict(Error("INVITATION_REVOKED", "This invitation has been revoked. Contact your WMS Admin.")),
            WmsInvitationError.AccountAlreadyActive =>
                Conflict(Error("WMS_ACCOUNT_ALREADY_ACTIVE", "This account already has active WMS access.")),
            WmsInvitationError.ActiveInvitationExists =>
                Conflict(Error("INVITATION_ALREADY_ACTIVE", "An active invitation already exists.")),
            WmsInvitationError.ConfigurationError or WmsInvitationError.SendFailed =>
                StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    Error("INVITATION_UNAVAILABLE", "The invitation service is temporarily unavailable.")),
            _ => throw new InvalidOperationException($"Unhandled invitation error: {error}.")
        };

    private static ProblemDetails Error(string code, string message) =>
        new()
        {
            Title = message,
            Extensions = { ["code"] = code }
        };
}
