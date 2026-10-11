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

    public Task<InventoryTransactionResponse?> GetReceiptByIdempotencyKeyAsync(
        string createdBy,
        Guid idempotencyKey,
        CancellationToken cancellationToken) =>
        FindByIdempotencyKeyAsync(createdBy, idempotencyKey, cancellationToken);

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

    public async Task<ReceiptPersistenceResult> ReceiveAsync(
        WMS.Domain.InventoryTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var databaseTransaction =
            await dbContext.Database.BeginTransactionAsync(cancellationToken);
        dbContext.InventoryTransactions.Add(transaction);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsIdempotencyKeyViolation(exception))
        {
            await databaseTransaction.RollbackAsync(cancellationToken);
            await databaseTransaction.DisposeAsync();
            dbContext.Entry(transaction).State = EntityState.Detached;

            var existing = await FindByIdempotencyKeyAsync(
                transaction.CreatedBy,
                transaction.IdempotencyKey!.Value,
                cancellationToken);
            if (existing is null)
            {
                throw new InvalidOperationException(
                    "An idempotency key collision occurred, but the original receipt could not be loaded.",
                    exception);
            }

            var isReplay =
                existing.ProductId == transaction.ProductId &&
                existing.LocationId == transaction.LocationId &&
                existing.Quantity == transaction.Quantity &&
                existing.ReferenceId == transaction.ReferenceId;

            return new ReceiptPersistenceResult(
                isReplay
                    ? ReceiptPersistenceStatus.Replayed
                    : ReceiptPersistenceStatus.IdempotencyConflict,
                existing);
        }

        try
        {
            await dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO "Inventory" ("Id", "ProductId", "LocationId", "Quantity")
                VALUES ({Guid.NewGuid()}, {transaction.ProductId}, {transaction.LocationId}, {transaction.Quantity})
                ON CONFLICT ("ProductId", "LocationId")
                DO UPDATE SET "Quantity" = "Inventory"."Quantity" + EXCLUDED."Quantity"
                """,
                cancellationToken);
        }
        catch (PostgresException exception) when (
            exception.SqlState == PostgresErrorCodes.NumericValueOutOfRange)
        {
            await databaseTransaction.RollbackAsync(cancellationToken);
            dbContext.Entry(transaction).State = EntityState.Detached;
            return new ReceiptPersistenceResult(
                ReceiptPersistenceStatus.QuantityLimitExceeded,
                null);
        }

        await databaseTransaction.CommitAsync(cancellationToken);
        await databaseTransaction.DisposeAsync();

        var created = await GetTransactionResponseByIdAsync(
            transaction.Id,
            cancellationToken);
        if (created is null)
        {
            throw new InvalidOperationException(
                "The receipt was committed, but its transaction record could not be loaded.");
        }

        return new ReceiptPersistenceResult(ReceiptPersistenceStatus.Created, created);
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

    private Task<InventoryTransactionResponse?> GetTransactionResponseByIdAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        dbContext.InventoryTransactions
            .AsNoTracking()
            .Where(transaction => transaction.Id == id)
            .Select(ToTransactionResponse)
            .SingleOrDefaultAsync(cancellationToken);

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
            transaction.CreatedAt);
}
