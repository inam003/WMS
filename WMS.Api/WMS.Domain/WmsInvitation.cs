namespace WMS.Domain;

public enum WmsInvitationStatus
{
    Pending,
    Accepted,
    Expired,
    Revoked
}

public sealed class WmsInvitation
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string NormalizedEmail { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public WmsRole Role { get; set; } = WmsRole.Viewer;
    public WmsInvitationStatus Status { get; set; } = WmsInvitationStatus.Pending;
    public string InviterSubject { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public string? AcceptedSubject { get; set; }
}
