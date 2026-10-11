using Microsoft.EntityFrameworkCore;
using WMS.Application.Audit;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Audit;

public sealed class AuditRepository(ApplicationDbContext dbContext) : IAuditRepository
{
    public async Task<AuditHistoryPage> GetPageAsync(
        AuditQuery query,
        CancellationToken cancellationToken)
    {
        var records = dbContext.AuditRecords.AsNoTracking().AsQueryable();
        if (query.StartDate.HasValue)
        {
            records = records.Where(record => record.CreatedAt >= query.StartDate.Value);
        }
        if (query.EndDate.HasValue)
        {
            records = records.Where(record => record.CreatedAt <= query.EndDate.Value);
        }
        if (!string.IsNullOrWhiteSpace(query.User))
        {
            var user = query.User.Trim();
            records = records.Where(record => record.ActorSubject.Contains(user));
        }
        if (!string.IsNullOrWhiteSpace(query.ActionType))
        {
            var action = query.ActionType.Trim();
            records = records.Where(record => record.ActionType == action);
        }
        if (!string.IsNullOrWhiteSpace(query.EntityType))
        {
            var entityType = query.EntityType.Trim();
            records = records.Where(record => record.EntityType == entityType);
        }
        if (!string.IsNullOrWhiteSpace(query.EntityId))
        {
            var entityId = query.EntityId.Trim();
            records = records.Where(record =>
                record.EntityId.Contains(entityId) ||
                (record.ReferenceId.HasValue &&
                 record.ReferenceId.Value.ToString().Contains(entityId)) ||
                (record.CorrelationId.HasValue &&
                 record.CorrelationId.Value.ToString().Contains(entityId)));
        }

        var totalCount = await records.LongCountAsync(cancellationToken);
        var items = await records
            .OrderByDescending(record => record.CreatedAt)
            .ThenByDescending(record => record.Id)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(record => new AuditHistoryItem(
                record.Id,
                record.ActorSubject,
                record.ActionType,
                record.EntityType,
                record.EntityId,
                record.CreatedAt,
                record.ReferenceId,
                record.CorrelationId,
                record.BeforeValues,
                record.AfterValues))
            .ToListAsync(cancellationToken);
        return new AuditHistoryPage(items, query.Page, query.PageSize, totalCount);
    }

    public async Task<int> DeleteExpiredBatchAsync(
        DateTimeOffset cutoff,
        int batchSize,
        CancellationToken cancellationToken)
    {
        var expiredIds = dbContext.AuditRecords
            .Where(record => record.CreatedAt < cutoff)
            .OrderBy(record => record.CreatedAt)
            .ThenBy(record => record.Id)
            .Select(record => record.Id)
            .Take(batchSize);
        return await dbContext.AuditRecords
            .Where(record => expiredIds.Contains(record.Id))
            .ExecuteDeleteAsync(cancellationToken);
    }
}
