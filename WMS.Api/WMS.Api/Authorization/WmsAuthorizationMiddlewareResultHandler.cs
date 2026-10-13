using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace WMS.Api.Authorization;

public sealed class WmsAuthorizationMiddlewareResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler defaultHandler = new();

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Forbidden &&
            context.User.Identity?.IsAuthenticated == true &&
            policy.Requirements.Any(requirement => requirement is WmsPermissionRequirement))
        {
            var requestUser = context.RequestServices.GetRequiredService<WmsRequestUser>();
            var user = await requestUser.GetCurrentAsync(context.RequestAborted);
            if (user is null || user.AccessProvisionedAt is null)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "WMS_INVITATION_REQUIRED",
                    message = "WMS access requires an accepted invitation. Contact your WMS Admin."
                });
                return;
            }

            if (!user.IsActive)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "WMS_ACCESS_INACTIVE",
                    message = "Your WMS account is inactive. Contact your WMS Admin."
                });
                return;
            }
        }

        await defaultHandler.HandleAsync(next, context, policy, authorizeResult);
    }
}
