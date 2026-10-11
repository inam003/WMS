using WMS.Application.Users;
using WMS.Domain;

namespace WMS.Api.Authorization;

public sealed class WmsRequestUser(
    IWmsUserService userService,
    IHttpContextAccessor httpContextAccessor)
{
    private Task<WmsUserAssignment>? currentUserTask;

    public Task<WmsUserAssignment> GetCurrentAsync(CancellationToken cancellationToken)
    {
        if (currentUserTask is not null)
        {
            return currentUserTask;
        }

        var subject = httpContextAccessor.HttpContext?.User.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(subject))
        {
            throw new InvalidOperationException(
                "A validated authenticated request must have a subject claim.");
        }

        currentUserTask = userService.GetOrCreateAsync(subject, cancellationToken);
        return currentUserTask;
    }
}
