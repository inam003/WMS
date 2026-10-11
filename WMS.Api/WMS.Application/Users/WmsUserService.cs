using WMS.Domain;

namespace WMS.Application.Users;

public sealed class WmsUserService(IWmsUserRepository repository) : IWmsUserService
{
    public Task<WmsUserAssignment> GetOrCreateAsync(
        string subject,
        CancellationToken cancellationToken) =>
        repository.GetOrCreateAsync(subject, cancellationToken);

    public async Task<IReadOnlyList<WmsUserResponse>> GetAllAsync(
        CancellationToken cancellationToken) =>
        (await repository.GetAllAsync(cancellationToken))
        .Select(ToResponse)
        .ToArray();

    public async Task<WmsUserResult<WmsUserResponse>> UpdateRoleAsync(
        string subject,
        string actorSubject,
        string role,
        CancellationToken cancellationToken)
    {
        if (string.Equals(subject, actorSubject, StringComparison.Ordinal))
        {
            return WmsUserResult<WmsUserResponse>.Failure(
                WmsUserError.SelfManagementNotAllowed);
        }

        var validRole = Enum.GetNames<WmsRole>()
            .FirstOrDefault(name => string.Equals(name, role, StringComparison.Ordinal));
        if (validRole is null)
        {
            return WmsUserResult<WmsUserResponse>.Failure(WmsUserError.InvalidRole);
        }
        var parsedRole = Enum.Parse<WmsRole>(validRole);

        var update = await repository.UpdateAsync(
            subject, parsedRole, null, cancellationToken);
        if (update.IsLastActiveAdmin)
        {
            return WmsUserResult<WmsUserResponse>.Failure(WmsUserError.LastActiveAdmin);
        }
        return update.User is null
            ? WmsUserResult<WmsUserResponse>.Failure(WmsUserError.NotFound)
            : WmsUserResult<WmsUserResponse>.Success(ToResponse(update.User));
    }

    public async Task<WmsUserResult<WmsUserResponse>> UpdateAccessAsync(
        string subject,
        string actorSubject,
        bool isActive,
        CancellationToken cancellationToken)
    {
        if (string.Equals(subject, actorSubject, StringComparison.Ordinal))
        {
            return WmsUserResult<WmsUserResponse>.Failure(
                WmsUserError.SelfManagementNotAllowed);
        }

        var update = await repository.UpdateAsync(
            subject, null, isActive, cancellationToken);
        if (update.IsLastActiveAdmin)
        {
            return WmsUserResult<WmsUserResponse>.Failure(WmsUserError.LastActiveAdmin);
        }
        return update.User is null
            ? WmsUserResult<WmsUserResponse>.Failure(WmsUserError.NotFound)
            : WmsUserResult<WmsUserResponse>.Success(ToResponse(update.User));
    }

    private static WmsUserResponse ToResponse(WmsUserAssignment user) =>
        new(user.Subject, user.Role.ToString(), user.IsActive, user.CreatedAt, user.UpdatedAt);
}
