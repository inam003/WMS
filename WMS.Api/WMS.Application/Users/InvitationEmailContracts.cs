using WMS.Domain;

namespace WMS.Application.Users;

public sealed record InviteWmsUserRequest(
    string Email,
    string Role);

public sealed record InvitationEmailRequest(
    string Email,
    WmsRole Role,
    string Token,
    DateTimeOffset ExpiresAt);

public enum InvitationEmailError
{
    None,
    ConfigurationError,
    SendFailed
}

public interface IInvitationEmailService
{
    Task<InvitationEmailError> SendInvitationAsync(
        InvitationEmailRequest request,
        CancellationToken cancellationToken = default);
}
