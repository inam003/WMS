using WMS.Domain;

namespace WMS.Application.Users;

public sealed class WmsUserService(
    IWmsUserRepository repository,
    IWmsInvitationRepository invitationRepository) : IWmsUserService
{
    public Task<WmsUserAssignment?> GetBySubjectAsync(
        string subject,
        CancellationToken cancellationToken) =>
        repository.GetBySubjectAsync(subject, cancellationToken);

    public async Task<IReadOnlyList<WmsUserResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var users = await repository.GetAllAsync(cancellationToken);
        var acceptedEmails = await invitationRepository.GetAcceptedEmailsAsync(
            cancellationToken);
        return users
            .Select(user => ToResponse(
                user,
                acceptedEmails.GetValueOrDefault(user.Subject)))
            .ToArray();
    }

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

    public async Task<WmsUserResult<bool>> RemoveAsync(
        string subject,
        string actorSubject,
        CancellationToken cancellationToken)
    {
        if (string.Equals(subject, actorSubject, StringComparison.Ordinal))
        {
            return WmsUserResult<bool>.Failure(WmsUserError.SelfManagementNotAllowed);
        }

        return await repository.RemoveIfInactiveAsync(subject, cancellationToken) switch
        {
            WmsUserRemovalResult.Removed => WmsUserResult<bool>.Success(true),
            WmsUserRemovalResult.NotFound =>
                WmsUserResult<bool>.Failure(WmsUserError.NotFound),
            WmsUserRemovalResult.AccessActive =>
                WmsUserResult<bool>.Failure(WmsUserError.AccessActive),
            _ => throw new InvalidOperationException("Unexpected WMS user removal result.")
        };
    }

    private static WmsUserResponse ToResponse(
        WmsUserAssignment user,
        string? email = null) =>
        new(
            user.Subject,
            user.Role.ToString(),
            user.IsActive,
            user.CreatedAt,
            user.UpdatedAt,
            user.AccessProvisionedAt,
            email);
}
