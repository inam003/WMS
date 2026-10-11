namespace WMS.Application.Audit;

public interface ICurrentAuditActor
{
    string? Subject { get; }
}

public sealed record AuditQuery(
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    string? User,
    string? ActionType,
    string? EntityType,
    string? EntityId,
    int Page = 1,
    int PageSize = 50);

public sealed record AuditHistoryItem(
    Guid Id,
    string ActorSubject,
    string ActionType,
    string EntityType,
    string EntityId,
    DateTimeOffset CreatedAt,
    Guid? ReferenceId,
    Guid? CorrelationId,
    string? BeforeValues,
    string? AfterValues);

public sealed record AuditHistoryPage(
    IReadOnlyList<AuditHistoryItem> Items,
    int Page,
    int PageSize,
    long TotalCount);

public interface IAuditRepository
{
    Task<AuditHistoryPage> GetPageAsync(AuditQuery query, CancellationToken cancellationToken);
    Task<int> DeleteExpiredBatchAsync(
        DateTimeOffset cutoff,
        int batchSize,
        CancellationToken cancellationToken);
}
