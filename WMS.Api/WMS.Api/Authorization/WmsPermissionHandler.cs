using Microsoft.AspNetCore.Authorization;

namespace WMS.Api.Authorization;

public sealed class WmsPermissionHandler(WmsRequestUser requestUser)
    : AuthorizationHandler<WmsPermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        WmsPermissionRequirement requirement)
    {
        var user = await requestUser.GetCurrentAsync(
            context.Resource is HttpContext httpContext
                ? httpContext.RequestAborted
                : CancellationToken.None);
        if (user is { IsActive: true, AccessProvisionedAt: not null } &&
            (requirement.AllowedRoles.Count == 0 ||
             requirement.AllowedRoles.Contains(user.Role)))
        {
            context.Succeed(requirement);
        }
    }
}
