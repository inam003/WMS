using WMS.Domain;

namespace WMS.Application.Users;

public sealed record WmsUserResponse(
    string Subject,
    string Role,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? AccessProvisionedAt,
    string? Email = null);

public sealed record CurrentWmsUserResponse(
    string Subject,
    string Role,
    bool IsActive);

public sealed record UpdateWmsUserRoleRequest(string Role);
public sealed record UpdateWmsUserAccessRequest(bool IsActive);

public enum WmsUserError
{
    None,
    NotFound,
    InvalidRole,
    SelfManagementNotAllowed,
    LastActiveAdmin,
    AccessActive
}

public sealed record WmsUserResult<T>(WmsUserError Error, T? Value = default)
{
    public bool Succeeded => Error == WmsUserError.None;
    public static WmsUserResult<T> Success(T value) => new(WmsUserError.None, value);
    public static WmsUserResult<T> Failure(WmsUserError error) => new(error);
}

public interface IWmsUserRepository
{
    Task<WmsUserAssignment?> GetBySubjectAsync(string subject, CancellationToken cancellationToken);
    Task<IReadOnlyList<WmsUserAssignment>> GetAllAsync(CancellationToken cancellationToken);
    Task<WmsUserUpdateResult> UpdateAsync(
        string subject,
        WmsRole? role,
        bool? isActive,
        CancellationToken cancellationToken);
    Task<WmsUserRemovalResult> RemoveIfInactiveAsync(
        string subject,
        CancellationToken cancellationToken);
}

public sealed record WmsUserUpdateResult(
    WmsUserAssignment? User,
    bool IsLastActiveAdmin = false);

public enum WmsUserRemovalResult
{
    Removed,
    NotFound,
    AccessActive
}

public interface IWmsUserService
{
    Task<WmsUserAssignment?> GetBySubjectAsync(
        string subject,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<WmsUserResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<WmsUserResult<WmsUserResponse>> UpdateRoleAsync(
        string subject,
        string actorSubject,
        string role,
        CancellationToken cancellationToken);
    Task<WmsUserResult<WmsUserResponse>> UpdateAccessAsync(
        string subject,
        string actorSubject,
        bool isActive,
        CancellationToken cancellationToken);
    Task<WmsUserResult<bool>> RemoveAsync(
        string subject,
        string actorSubject,
        CancellationToken cancellationToken);
}
