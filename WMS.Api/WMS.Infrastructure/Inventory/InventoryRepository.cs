using Microsoft.EntityFrameworkCore;
using Npgsql;
using WMS.Application.Inventory;
using WMS.Application.InventoryTransactions;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.InventoryData;

public sealed class InventoryRepository(ApplicationDbContext dbContext) : IInventoryRepository
{
    public Task<bool> ProductExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Products.AnyAsync(product => product.Id == id, cancellationToken);

    public Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations.AnyAsync(location => location.Id == id, cancellationToken);

    public Task<bool> WarehouseExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Warehouses.AnyAsync(warehouse => warehouse.Id == id, cancellationToken);

    public Task<bool?> GetProductActiveAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Products
            .Where(product => product.Id == id)
            .Select(product => (bool?)product.IsActive)
            .SingleOrDefaultAsync(cancellationToken);

    public Task<bool?> GetLocationActiveAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations
            .Where(location => location.Id == id)
            .Select(location => (bool?)(location.IsActive && location.Warehouse.IsActive))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<InventoryTransactionResponse>> GetTransactionsByIdempotencyKeyAsync(
        string createdBy,
        Guid idempotencyKey,
        CancellationToken cancellationToken)
    {
        var original = await FindByIdempotencyKeyAsync(
            createdBy,
            idempotencyKey,
            cancellationToken);
        if (original is null)
        {
            return [];
        }

        if (!original.TransferId.HasValue)
        {
            return [original];
        }

        return await dbContext.InventoryTransactions
            .AsNoTracking()
            .Where(transaction => transaction.TransferId == original.TransferId)
            .OrderBy(transaction => transaction.Type)
            .Select(ToTransactionResponse)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<InventoryResponse>> GetAllAsync(
        InventoryQuery query,
        CancellationToken cancellationToken)
    {
        var inventory = dbContext.Inventory
            .AsNoTracking()
            .AsQueryable();

        if (query.ProductId.HasValue)
        {
            inventory = inventory.Where(item => item.ProductId == query.ProductId.Value);
        }

        if (query.LocationId.HasValue)
        {
            inventory = inventory.Where(item => item.LocationId == query.LocationId.Value);
        }

        if (query.WarehouseId.HasValue)
        {
            inventory = inventory.Where(
                item => item.Location.WarehouseId == query.WarehouseId.Value);
        }

        return await inventory
            .OrderBy(item => item.Product.Name)
            .ThenBy(item => item.Location.Warehouse.Name)
            .ThenBy(item => item.Location.Code)
            .Select(ToResponse)
            .ToListAsync(cancellationToken);
    }

    public Task<InventoryResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        dbContext.Inventory
            .AsNoTracking()
            .Where(item => item.Id == id)
            .Select(ToResponse)
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<InventoryMovementPersistenceResult> ApplyInventoryMovementAsync(
        IReadOnlyList<WMS.Domain.InventoryTransaction> transactions,
        IReadOnlyList<InventoryQuantityChange> quantityChanges,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction =
            await dbContext.Database.BeginTransactionAsync(cancellationToken);
        dbContext.InventoryTransactions.AddRange(transactions);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsIdempotencyKeyViolation(exception))
        {
            await databaseTransaction.RollbackAsync(cancellationToken);
            await databaseTransaction.DisposeAsync();
            foreach (var transaction in transactions)
            {
                dbContext.Entry(transaction).State = EntityState.Detached;
            }

            var existing = await FindByIdempotencyKeyAsync(
                transactions[0].CreatedBy,
                transactions[0].IdempotencyKey!.Value,
                cancellationToken);
            if (existing is null)
            {
                throw new InvalidOperationException(
                    "An idempotency key collision occurred, but the original movement could not be loaded.",
                    exception);
            }

            var existingTransactions = existing.TransferId.HasValue
                ? await dbContext.InventoryTransactions
                    .AsNoTracking()
                    .Where(transaction => transaction.TransferId == existing.TransferId)
                    .OrderBy(transaction => transaction.Type)
                    .Select(ToTransactionResponse)
                    .ToListAsync(cancellationToken)
                : [existing];
            var isReplay = AreSameMovement(transactions, existingTransactions);

            return new InventoryMovementPersistenceResult(
                isReplay
                    ? InventoryMovementPersistenceStatus.Replayed
                    : InventoryMovementPersistenceStatus.IdempotencyConflict,
                existingTransactions);
        }

        try
        {
            foreach (var change in quantityChanges
                .OrderBy(change => change.ProductId)
                .ThenBy(change => change.LocationId))
            {
                if (change.QuantityDelta > 0)
                {
                    await dbContext.Database.ExecuteSqlInterpolatedAsync(
                        $"""
                        INSERT INTO "Inventory" ("Id", "ProductId", "LocationId", "Quantity")
                        VALUES ({Guid.NewGuid()}, {change.ProductId}, {change.LocationId}, {change.QuantityDelta})
                        ON CONFLICT ("ProductId", "LocationId")
                        DO UPDATE SET "Quantity" = "Inventory"."Quantity" + EXCLUDED."Quantity"
                        """,
                        cancellationToken);
                    continue;
                }

                var rowsUpdated = await dbContext.Database.ExecuteSqlInterpolatedAsync(
                    $"""
                    UPDATE "Inventory"
                    SET "Quantity" = "Quantity" + {change.QuantityDelta}
                    WHERE "ProductId" = {change.ProductId}
                      AND "LocationId" = {change.LocationId}
                      AND "Quantity" >= {-change.QuantityDelta}
                    """,
                    cancellationToken);
                if (rowsUpdated == 0)
                {
                    await databaseTransaction.RollbackAsync(cancellationToken);
                    foreach (var transaction in transactions)
                    {
                        dbContext.Entry(transaction).State = EntityState.Detached;
                    }

                    return new InventoryMovementPersistenceResult(
                        InventoryMovementPersistenceStatus.InsufficientInventory,
                        null);
                }
            }
        }
        catch (PostgresException exception) when (
            exception.SqlState == PostgresErrorCodes.NumericValueOutOfRange)
        {
            await databaseTransaction.RollbackAsync(cancellationToken);
            foreach (var transaction in transactions)
            {
                dbContext.Entry(transaction).State = EntityState.Detached;
            }
            return new InventoryMovementPersistenceResult(
                InventoryMovementPersistenceStatus.QuantityLimitExceeded,
                null);
        }

        await databaseTransaction.CommitAsync(cancellationToken);
        await databaseTransaction.DisposeAsync();

        var transactionIds = transactions.Select(transaction => transaction.Id).ToArray();
        var created = await dbContext.InventoryTransactions
            .AsNoTracking()
            .Where(transaction => transactionIds.Contains(transaction.Id))
            .Select(ToTransactionResponse)
            .ToListAsync(cancellationToken);
        if (created.Count != transactions.Count)
        {
            throw new InvalidOperationException(
                "The inventory movement was committed, but its transaction records could not be loaded.");
        }

        return new InventoryMovementPersistenceResult(
            InventoryMovementPersistenceStatus.Created,
            transactions
                .Select(transaction => created.Single(response => response.Id == transaction.Id))
                .ToArray());
    }

    private Task<InventoryTransactionResponse?> FindByIdempotencyKeyAsync(
        string createdBy,
        Guid idempotencyKey,
        CancellationToken cancellationToken) =>
        dbContext.InventoryTransactions
            .AsNoTracking()
            .Where(transaction =>
                transaction.CreatedBy == createdBy &&
                transaction.IdempotencyKey == idempotencyKey)
            .Select(ToTransactionResponse)
            .SingleOrDefaultAsync(cancellationToken);

    private static bool AreSameMovement(
        IReadOnlyList<WMS.Domain.InventoryTransaction> expected,
        IReadOnlyList<InventoryTransactionResponse> existing) =>
        expected.Count == existing.Count &&
        expected.All(candidate => existing.Any(transaction =>
            transaction.Type == candidate.Type &&
            transaction.ProductId == candidate.ProductId &&
            transaction.LocationId == candidate.LocationId &&
            transaction.Quantity == candidate.Quantity &&
            transaction.ReferenceId == candidate.ReferenceId &&
            transaction.AdjustmentReason == candidate.AdjustmentReason &&
            transaction.AdjustmentExplanation == candidate.AdjustmentExplanation));

    private static bool IsIdempotencyKeyViolation(DbUpdateException exception) =>
        exception.GetBaseException() is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "IX_InventoryTransactions_CreatedBy_IdempotencyKey"
        };

    private static System.Linq.Expressions.Expression<Func<WMS.Domain.Inventory, InventoryResponse>>
        ToResponse =>
        item => new InventoryResponse(
            item.Id,
            item.ProductId,
            item.Product.Name,
            item.Product.SKU,
            item.LocationId,
            item.Location.Name,
            item.Location.Code,
            item.Location.WarehouseId,
            item.Location.Warehouse.Name,
            item.Quantity);

    private static System.Linq.Expressions.Expression<
        Func<WMS.Domain.InventoryTransaction, InventoryTransactionResponse>>
        ToTransactionResponse =>
        transaction => new InventoryTransactionResponse(
            transaction.Id,
            transaction.ProductId,
            transaction.Product.Name,
            transaction.Product.SKU,
            transaction.LocationId,
            transaction.Location.Name,
            transaction.Location.Code,
            transaction.Location.WarehouseId,
            transaction.Location.Warehouse.Name,
            transaction.Quantity,
            transaction.Type,
            transaction.ReferenceId,
            transaction.CreatedBy,
            transaction.CreatedAt,
            transaction.AdjustmentReason,
            transaction.AdjustmentExplanation,
            transaction.TransferId);
}
