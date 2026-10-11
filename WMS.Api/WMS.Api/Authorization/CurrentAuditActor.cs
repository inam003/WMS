using System.Security.Claims;
using WMS.Application.Audit;

namespace WMS.Api.Authorization;

public sealed class CurrentAuditActor(IHttpContextAccessor httpContextAccessor)
    : ICurrentAuditActor
{
    public string? Subject =>
        httpContextAccessor.HttpContext?.User.FindFirst("sub")?.Value;
}
