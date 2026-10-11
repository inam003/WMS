using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WMS.Application.Audit;
using WMS.Application.Users;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Users;

public sealed class WmsUserRepository(
    ApplicationDbContext dbContext,
    ICurrentAuditActor currentAuditActor) : IWmsUserRepository
{
    public async Task<WmsUserAssignment> GetOrCreateAsync(
        string subject,
        CancellationToken cancellationToken)
    {
        var existingUser = await dbContext.WmsUserAssignments
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.Subject == subject, cancellationToken);
        if (existingUser is not null)
        {
            return existingUser;
        }

        await using var transaction =
            await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var inserted = await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO "WmsUserAssignments" ("Subject", "Role", "IsActive", "CreatedAt", "UpdatedAt")
            VALUES ({subject}, {"Viewer"}, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("Subject") DO NOTHING
            """,
            cancellationToken);
        if (inserted == 1)
        {
            var actor = currentAuditActor.Subject;
            if (string.IsNullOrWhiteSpace(actor))
            {
                throw new InvalidOperationException(
                    "Audited WMS changes require the authenticated subject claim.");
            }

            dbContext.AuditRecords.Add(new AuditRecord
            {
                Id = Guid.NewGuid(),
                ActorSubject = actor,
                ActionType = "User.AccessCreated",
                EntityType = "User",
                EntityId = subject,
                CreatedAt = DateTimeOffset.UtcNow,
                AfterValues = JsonSerializer.Serialize(new
                {
                    Role = WmsRole.Viewer.ToString(),
                    IsActive = true
                })
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);

        return await dbContext.WmsUserAssignments
            .AsNoTracking()
            .SingleAsync(user => user.Subject == subject, cancellationToken);
    }

    public async Task<IReadOnlyList<WmsUserAssignment>> GetAllAsync(
        CancellationToken cancellationToken) =>
        await dbContext.WmsUserAssignments
            .AsNoTracking()
            .OrderBy(user => user.Subject)
            .ToListAsync(cancellationToken);

    public async Task<WmsUserUpdateResult> UpdateAsync(
        string subject,
        WmsRole? role,
        bool? isActive,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);
        await dbContext.Database.ExecuteSqlRawAsync(
            "LOCK TABLE \"WmsUserAssignments\" IN EXCLUSIVE MODE",
            cancellationToken);

        var user = await dbContext.WmsUserAssignments
            .SingleOrDefaultAsync(item => item.Subject == subject, cancellationToken);
        if (user is null)
        {
            return new WmsUserUpdateResult(null);
        }

        var nextRole = role ?? user.Role;
        var nextActive = isActive ?? user.IsActive;
        if (user.Role == WmsRole.Admin &&
            user.IsActive &&
            (nextRole != WmsRole.Admin || !nextActive))
        {
            var activeAdmins = await dbContext.WmsUserAssignments
                .CountAsync(
                    item => item.Role == WmsRole.Admin && item.IsActive,
                    cancellationToken);
            if (activeAdmins <= 1)
            {
                return new WmsUserUpdateResult(null, IsLastActiveAdmin: true);
            }
        }

        user.Role = nextRole;
        user.IsActive = nextActive;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new WmsUserUpdateResult(user);
    }
}
