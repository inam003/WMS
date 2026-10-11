namespace WMS.Domain;

public sealed class AuditRecord
{
    public Guid Id { get; set; }
    public string ActorSubject { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public Guid? ReferenceId { get; set; }
    public Guid? CorrelationId { get; set; }
    public string? BeforeValues { get; set; }
    public string? AfterValues { get; set; }
}
