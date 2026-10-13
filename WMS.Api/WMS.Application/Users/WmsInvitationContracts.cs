using WMS.Domain;

namespace WMS.Application.Users;

public sealed record WmsInvitationResponse(
    Guid Id,
    string Email,
    string Role,
    string Status,
    string InviterSubject,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? AcceptedAt,
    string? AcceptedSubject);

public sealed record ValidateInvitationResponse(
    string Email,
    string Role,
    DateTimeOffset ExpiresAt);

public sealed record AcceptInvitationRequest(string Token);

public enum WmsInvitationError
{
    None,
    InvalidEmail,
    InvalidRole,
    InvitationNotFound,
    AlreadyAccepted,
    Expired,
    Revoked,
    AccountAlreadyActive,
    ActiveInvitationExists,
    EmailMismatch,
    EmailNotVerified,
    SendFailed,
    ConfigurationError
}

public sealed record WmsInvitationResult<T>(WmsInvitationError Error, T? Value = default)
{
    public bool Succeeded => Error == WmsInvitationError.None;
    public static WmsInvitationResult<T> Success(T value) => new(WmsInvitationError.None, value);
    public static WmsInvitationResult<T> Failure(WmsInvitationError error) => new(error);
}

public interface IWmsInvitationRepository
{
    Task<IReadOnlyList<WmsInvitation>> GetAllAsync(CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<string, string>> GetAcceptedEmailsAsync(
        CancellationToken cancellationToken);
    Task<WmsInvitation?> GetActiveByEmailAsync(string normalizedEmail, CancellationToken cancellationToken);
    Task<WmsInvitation?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);
    Task<WmsInvitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> CreateAsync(WmsInvitation invitation, CancellationToken cancellationToken);
    Task DeleteUnsentAsync(Guid id, CancellationToken cancellationToken);
    Task<WmsInvitationResult<WmsInvitation>> ClaimAsync(
        string tokenHash,
        CancellationToken cancellationToken);
    Task<WmsInvitationResult<WmsUserAssignment>> ProvisionClaimedInvitationAsync(
        string subject,
        string normalizedEmail,
        CancellationToken cancellationToken);
    Task<WmsInvitationResult<WmsInvitation>> RotateTokenAsync(
        Guid id,
        string tokenHash,
        string inviterSubject,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken);
    Task<WmsInvitationResult<WmsInvitation>> RevokeAsync(
        Guid id,
        CancellationToken cancellationToken);
}

public interface IWmsInvitationService
{
    Task<IReadOnlyList<WmsInvitationResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<WmsInvitationResult<WmsInvitationResponse>> CreateInvitationAsync(
        InviteWmsUserRequest request,
        string inviterSubject,
        string inviterEmail,
        CancellationToken cancellationToken);
    Task<WmsInvitationResult<WmsInvitationResponse>> ResendInvitationAsync(
        Guid id,
        string inviterSubject,
        CancellationToken cancellationToken);
    Task<WmsInvitationResult<WmsInvitationResponse>> RevokeInvitationAsync(
        Guid id,
        CancellationToken cancellationToken);
    Task<WmsInvitationResult<ValidateInvitationResponse>> ValidateTokenAsync(
        string token,
        CancellationToken cancellationToken);
    Task<WmsInvitationResult<ValidateInvitationResponse>> ClaimInvitationAsync(
        string token,
        CancellationToken cancellationToken);
    Task<WmsUserAssignment?> ProvisionClaimedInvitationAsync(
        string authenticatedSubject,
        string authenticatedEmail,
        bool emailVerified,
        CancellationToken cancellationToken);
}
