using Microsoft.AspNetCore.Authorization;
using WMS.Domain;

namespace WMS.Api.Authorization;

public sealed class WmsPermissionRequirement(params WmsRole[] allowedRoles)
    : IAuthorizationRequirement
{
    public IReadOnlySet<WmsRole> AllowedRoles { get; } = allowedRoles.ToHashSet();
}
