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
