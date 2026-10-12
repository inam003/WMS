using WMS.Domain;

namespace WMS.Application.Users;

public sealed record InviteWmsUserRequest(
    string Email,
    string Role,
    DateTimeOffset ExpiresAtUtc = default);

public sealed record InviteWmsUserResponse(
    string Email,
    string Role,
    string AcceptUrl,
    DateTimeOffset ExpiresAtUtc);

public enum InviteWmsUserError
{
    None,
    InvalidEmail,
    InvalidRole,
    FrontendUrlNotConfigured,
    FromEmailNotConfigured,
    SendFailed
}

public sealed record InviteWmsUserResult<T>(InviteWmsUserError Error, T? Value = default)
{
    public bool Succeeded => Error == InviteWmsUserError.None;

    public static InviteWmsUserResult<T> Success(T value) =>
        new(InviteWmsUserError.None, value);

    public static InviteWmsUserResult<T> Failure(InviteWmsUserError error) =>
        new(error);
}

public interface IInvitationEmailService
{
    Task<InviteWmsUserResult<InviteWmsUserResponse>> SendInvitationAsync(
        InviteWmsUserRequest request,
        CancellationToken cancellationToken = default);
}
