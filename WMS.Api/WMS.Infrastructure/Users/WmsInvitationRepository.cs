using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using WMS.Application.Users;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Users;

public sealed class WmsInvitationRepository(
    ApplicationDbContext dbContext,
    TimeProvider timeProvider) : IWmsInvitationRepository
{
    private const string ActiveInvitationIndex =
        "IX_WmsInvitations_OnePendingPerEmail";

    public async Task<IReadOnlyList<WmsInvitation>> GetAllAsync(
        CancellationToken cancellationToken) =>
        await dbContext.WmsInvitations
            .AsNoTracking()
            .OrderByDescending(invitation => invitation.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<string, string>> GetAcceptedEmailsAsync(
        CancellationToken cancellationToken)
    {
        var invitations = await dbContext.WmsInvitations
            .AsNoTracking()
            .Where(invitation =>
                invitation.Status == WmsInvitationStatus.Accepted &&
                invitation.AcceptedSubject != null)
            .OrderByDescending(invitation => invitation.AcceptedAt)
            .Select(invitation => new
            {
                Subject = invitation.AcceptedSubject!,
                invitation.Email
            })
            .ToListAsync(cancellationToken);
        return invitations
            .GroupBy(invitation => invitation.Subject, StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => group.First().Email,
                StringComparer.Ordinal);
    }

    public async Task<WmsInvitation?> GetActiveByEmailAsync(
        string normalizedEmail,
        CancellationToken cancellationToken) =>
        await dbContext.WmsInvitations
            .AsNoTracking()
            .Where(invitation => invitation.NormalizedEmail == normalizedEmail &&
                                 invitation.Status == WmsInvitationStatus.Pending &&
                                 invitation.ExpiresAt > timeProvider.GetUtcNow())
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<WmsInvitation?> GetByTokenHashAsync(
        string tokenHash,
        CancellationToken cancellationToken) =>
        await dbContext.WmsInvitations
            .AsNoTracking()
            .FirstOrDefaultAsync(
                invitation => invitation.TokenHash == tokenHash,
                cancellationToken);

    public async Task<WmsInvitation?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        await dbContext.WmsInvitations
            .AsNoTracking()
            .FirstOrDefaultAsync(invitation => invitation.Id == id, cancellationToken);

    public async Task<bool> CreateAsync(
        WmsInvitation invitation,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.ReadCommitted,
                cancellationToken);

            var expiredInvitations = await dbContext.WmsInvitations
                .FromSqlInterpolated(
                    $"""
                    SELECT * FROM "WmsInvitations"
                    WHERE "NormalizedEmail" = {invitation.NormalizedEmail}
                      AND "Status" = 'Pending'
                      AND "ExpiresAt" <= {invitation.CreatedAt}
                    FOR UPDATE
                    """)
                .ToListAsync(cancellationToken);
            foreach (var expiredInvitation in expiredInvitations)
            {
                expiredInvitation.Status = WmsInvitationStatus.Expired;
            }

            dbContext.WmsInvitations.Add(invitation);
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception) when (IsActiveInvitationConflict(exception))
        {
            return false;
        }
    }

    public async Task DeleteUnsentAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var invitation = await dbContext.WmsInvitations
            .SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (invitation is null)
        {
            return;
        }

        dbContext.WmsInvitations.Remove(invitation);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<WmsInvitationResult<WmsInvitation>> RotateTokenAsync(
        Guid id,
        string tokenHash,
        string inviterSubject,
        DateTimeOffset expiresAt,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);

        var invitation = await dbContext.WmsInvitations
            .FromSqlInterpolated(
                $"SELECT * FROM \"WmsInvitations\" WHERE \"Id\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);
        if (invitation is null)
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        if (invitation.Status == WmsInvitationStatus.Accepted)
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.AlreadyAccepted);
        }

        if (invitation.Status == WmsInvitationStatus.Revoked)
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.Revoked);
        }

        invitation.TokenHash = tokenHash;
        invitation.Status = WmsInvitationStatus.Pending;
        invitation.ExpiresAt = expiresAt;
        invitation.InviterSubject = inviterSubject;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return WmsInvitationResult<WmsInvitation>.Success(invitation);
        }
        catch (DbUpdateException exception) when (IsActiveInvitationConflict(exception))
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.ActiveInvitationExists);
        }
    }

    public async Task<WmsInvitationResult<WmsInvitation>> RevokeAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);

        var invitation = await dbContext.WmsInvitations
            .FromSqlInterpolated(
                $"SELECT * FROM \"WmsInvitations\" WHERE \"Id\" = {id} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);
        if (invitation is null)
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        if (invitation.Status == WmsInvitationStatus.Accepted)
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.AlreadyAccepted);
        }

        if (invitation.Status == WmsInvitationStatus.Revoked)
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.Revoked);
        }

        invitation.Status = WmsInvitationStatus.Revoked;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return WmsInvitationResult<WmsInvitation>.Success(invitation);
    }

    public async Task<WmsInvitationResult<WmsInvitation>> ClaimAsync(
        string tokenHash,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);

        var invitation = await dbContext.WmsInvitations
            .FromSqlInterpolated(
                $"SELECT * FROM \"WmsInvitations\" WHERE \"TokenHash\" = {tokenHash} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

        if (invitation is null ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(invitation.TokenHash),
                Encoding.ASCII.GetBytes(tokenHash)))
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        if (invitation.Status == WmsInvitationStatus.Accepted)
        {
            if (invitation.AcceptedSubject is null)
            {
                return WmsInvitationResult<WmsInvitation>.Success(invitation);
            }

            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.AlreadyAccepted);
        }

        if (invitation.Status == WmsInvitationStatus.Revoked)
        {
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.Revoked);
        }

        var now = timeProvider.GetUtcNow();
        if (invitation.Status == WmsInvitationStatus.Expired ||
            invitation.ExpiresAt <= now)
        {
            invitation.Status = WmsInvitationStatus.Expired;
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return WmsInvitationResult<WmsInvitation>.Failure(
                WmsInvitationError.Expired);
        }

        invitation.Status = WmsInvitationStatus.Accepted;
        invitation.AcceptedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return WmsInvitationResult<WmsInvitation>.Success(invitation);
    }

    public async Task<WmsInvitationResult<WmsUserAssignment>> ProvisionClaimedInvitationAsync(
        string subject,
        string normalizedEmail,
        CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(
            IsolationLevel.ReadCommitted,
            cancellationToken);
        var invitation = await dbContext.WmsInvitations
            .FromSqlInterpolated(
                $"""
                SELECT * FROM "WmsInvitations"
                WHERE "NormalizedEmail" = {normalizedEmail}
                  AND "Status" = 'Accepted'
                  AND "AcceptedSubject" IS NULL
                FOR UPDATE
                """)
            .SingleOrDefaultAsync(cancellationToken);
        if (invitation is null)
        {
            return WmsInvitationResult<WmsUserAssignment>.Failure(
                WmsInvitationError.InvitationNotFound);
        }

        var existingUser = await dbContext.WmsUserAssignments
            .SingleOrDefaultAsync(user => user.Subject == subject, cancellationToken);
        if (existingUser?.Role == WmsRole.Admin ||
            existingUser is { IsActive: true, AccessProvisionedAt: not null })
        {
            return WmsInvitationResult<WmsUserAssignment>.Failure(
                WmsInvitationError.AccountAlreadyActive);
        }

        invitation.AcceptedSubject = subject;
        var now = timeProvider.GetUtcNow();

        WmsUserAssignment userAssignment;
        if (existingUser is null)
        {
            userAssignment = new WmsUserAssignment
            {
                Subject = subject,
                Role = invitation.Role,
                IsActive = true,
                AccessProvisionedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };
            dbContext.WmsUserAssignments.Add(userAssignment);
        }
        else
        {
            existingUser.Role = invitation.Role;
            existingUser.IsActive = true;
            existingUser.AccessProvisionedAt = now;
            existingUser.UpdatedAt = now;
            userAssignment = existingUser;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return WmsInvitationResult<WmsUserAssignment>.Success(userAssignment);
    }

    private static bool IsActiveInvitationConflict(DbUpdateException exception) =>
        exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: ActiveInvitationIndex
        };
}
