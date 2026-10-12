using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Api.Authorization;
using WMS.Application.Users;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public sealed class UsersController(
    IWmsUserService userService,
    IInvitationEmailService invitationEmailService,
    WmsRequestUser requestUser) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<CurrentWmsUserResponse>> GetCurrent(
        CancellationToken cancellationToken)
    {
        var user = await requestUser.GetCurrentAsync(cancellationToken);
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

    [HttpPost("invite")]
    [Authorize(Policy = "WmsAdmin")]
    public async Task<ActionResult<InviteWmsUserResponse>> InviteUser(
        InviteWmsUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await invitationEmailService.SendInvitationAsync(
            request,
            cancellationToken);

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

    private ActionResult InvitationError(InviteWmsUserError error) =>
        error switch
        {
            InviteWmsUserError.InvalidEmail => BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Provide a valid email address to invite."
            }),
            InviteWmsUserError.InvalidRole => BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Select a supported WMS role."
            }),
            InviteWmsUserError.FrontendUrlNotConfigured => BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Configure WMS_FRONTEND_URL to build the invitation URL."
            }),
            InviteWmsUserError.FromEmailNotConfigured => BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Configure WMS_FROM_EMAIL to send invitation emails."
            }),
            InviteWmsUserError.SendFailed => StatusCode(StatusCodes.Status502BadGateway, new ProblemDetails
            {
                Status = StatusCodes.Status502BadGateway,
                Title = "The invitation email could not be sent."
            }),
            _ => throw new InvalidOperationException($"Unhandled invitation error: {error}.")
        };

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
            _ => throw new InvalidOperationException($"Unhandled WMS user error: {error}.")
        };
}
