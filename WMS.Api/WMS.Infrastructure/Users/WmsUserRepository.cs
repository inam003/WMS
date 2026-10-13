using System.Data;
using Microsoft.EntityFrameworkCore;
using WMS.Application.Users;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Users;

public sealed class WmsUserRepository(ApplicationDbContext dbContext) : IWmsUserRepository
{
    public async Task<WmsUserAssignment?> GetBySubjectAsync(
        string subject,
        CancellationToken cancellationToken) =>
        await dbContext.WmsUserAssignments
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.Subject == subject, cancellationToken);

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

    public async Task<WmsUserRemovalResult> RemoveIfInactiveAsync(
        string subject,
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
            return WmsUserRemovalResult.NotFound;
        }

        if (user.IsActive)
        {
            return WmsUserRemovalResult.AccessActive;
        }

        dbContext.WmsUserAssignments.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return WmsUserRemovalResult.Removed;
    }
}
