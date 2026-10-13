using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WMS.Api.Authorization;
using WMS.Application.Users;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController(
    IWmsUserService userService,
    IWmsInvitationService invitationService,
    WmsRequestUser requestUser) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<CurrentWmsUserResponse>> GetCurrent(
        CancellationToken cancellationToken)
    {
        var user = await requestUser.GetCurrentAsync(cancellationToken);
        if (user is null)
        {
            return InvitationRequired();
        }

        return Ok(new CurrentWmsUserResponse(
            user.Subject, user.Role.ToString(), user.IsActive));
    }

    [HttpGet]
    [Authorize(Policy = "WmsAdmin")]
    public async Task<ActionResult<IReadOnlyList<WmsUserResponse>>> GetAll(
        CancellationToken cancellationToken) =>
        Ok(await userService.GetAllAsync(cancellationToken));

    [HttpPut("{subject}/role")]
    [Authorize(Policy = "WmsAdmin")]
    public async Task<ActionResult<WmsUserResponse>> UpdateRole(
        string subject,
        UpdateWmsUserRoleRequest request,
        CancellationToken cancellationToken)
    {
        var result = await userService.UpdateRoleAsync(
            subject,
            User.FindFirst("sub")!.Value,
            request.Role,
            cancellationToken);
        return result.Succeeded ? Ok(result.Value) : UserError(result.Error);
    }

    [HttpGet("invitations")]
    [Authorize(Policy = "WmsAdmin")]
    public async Task<ActionResult<IReadOnlyList<WmsInvitationResponse>>> GetInvitations(
        CancellationToken cancellationToken) =>
        Ok(await invitationService.GetAllAsync(cancellationToken));

    [HttpPost("invitations")]
    [Authorize(Policy = "WmsAdmin")]
    [EnableRateLimiting("invitation-management")]
    public async Task<ActionResult<WmsInvitationResponse>> InviteUser(
        InviteWmsUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await invitationService.CreateInvitationAsync(
            request,
            User.FindFirst("sub")!.Value,
            User.FindFirst("email")?.Value ?? string.Empty,
            cancellationToken);

        return result.Succeeded ? Ok(result.Value) : InvitationError(result.Error);
    }

    [HttpPost("invitations/{id:guid}/resend")]
    [Authorize(Policy = "WmsAdmin")]
    [EnableRateLimiting("invitation-management")]
    public async Task<ActionResult<WmsInvitationResponse>> ResendInvitation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await invitationService.ResendInvitationAsync(
            id,
            User.FindFirst("sub")!.Value,
            cancellationToken);
        return result.Succeeded ? Ok(result.Value) : InvitationError(result.Error);
    }

    [HttpPost("invitations/{id:guid}/revoke")]
    [Authorize(Policy = "WmsAdmin")]
    public async Task<ActionResult<WmsInvitationResponse>> RevokeInvitation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await invitationService.RevokeInvitationAsync(id, cancellationToken);
        return result.Succeeded ? Ok(result.Value) : InvitationError(result.Error);
    }

    [HttpPut("{subject}/access")]
    [Authorize(Policy = "WmsAdmin")]
    public async Task<ActionResult<WmsUserResponse>> UpdateAccess(
        string subject,
        UpdateWmsUserAccessRequest request,
        CancellationToken cancellationToken)
    {
        var result = await userService.UpdateAccessAsync(
            subject,
            User.FindFirst("sub")!.Value,
            request.IsActive,
            cancellationToken);
        return result.Succeeded ? Ok(result.Value) : UserError(result.Error);
    }

    [HttpDelete("{subject}")]
    [Authorize(Policy = "WmsAdmin")]
    public async Task<IActionResult> RemoveUser(
        string subject,
        CancellationToken cancellationToken)
    {
        var result = await userService.RemoveAsync(
            subject,
            User.FindFirst("sub")!.Value,
            cancellationToken);
        return result.Succeeded ? NoContent() : UserError(result.Error);
    }

    private ActionResult InvitationError(WmsInvitationError error) =>
        error switch
        {
            WmsInvitationError.InvalidEmail => BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Provide a valid email address to invite."
            }),
            WmsInvitationError.InvalidRole => BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Select Warehouse Manager, Warehouse Operator, or Viewer."
            }),
            WmsInvitationError.ConfigurationError => StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Invitation email is not configured. Contact your system administrator."
            }),
            WmsInvitationError.SendFailed => StatusCode(
                StatusCodes.Status502BadGateway,
                new ProblemDetails
            {
                Status = StatusCodes.Status502BadGateway,
                Title = "The invitation email could not be sent."
            }),
            WmsInvitationError.InvitationNotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "The invitation was not found."
            }),
            WmsInvitationError.AlreadyAccepted => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The invitation has already been accepted."
            }),
            WmsInvitationError.Revoked => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The invitation has been revoked."
            }),
            WmsInvitationError.Expired => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The invitation has expired."
            }),
            WmsInvitationError.ActiveInvitationExists => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "An active invitation already exists for this email."
            }),
            WmsInvitationError.AccountAlreadyActive => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "This email already has active WMS access. No invitation was sent."
            }),
            _ => throw new InvalidOperationException($"Unhandled invitation error: {error}.")
        };

    private ObjectResult InvitationRequired() =>
        StatusCode(StatusCodes.Status403Forbidden, new
        {
            code = "WMS_INVITATION_REQUIRED",
            message = "WMS access requires an accepted invitation. Contact your WMS Admin."
        });

    private ActionResult UserError(WmsUserError error) =>
        error switch
        {
            WmsUserError.InvalidRole => BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Select a supported WMS role."
            }),
            WmsUserError.SelfManagementNotAllowed => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Administrators cannot change their own role or access status."
            }),
            WmsUserError.LastActiveAdmin => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The last active Admin cannot be demoted or deactivated."
            }),
            WmsUserError.NotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "The WMS user was not found."
            }),
            WmsUserError.AccessActive => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Deactivate WMS access before removing this user."
            }),
            _ => throw new InvalidOperationException($"Unhandled WMS user error: {error}.")
        };
}
