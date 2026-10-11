using Microsoft.EntityFrameworkCore;
using WMS.Application.InventoryTransactions;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.InventoryTransactions;

public sealed class InventoryTransactionRepository(
    ApplicationDbContext dbContext) : IInventoryTransactionRepository
{
    public Task<bool> ProductExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Products.AnyAsync(product => product.Id == id, cancellationToken);

    public Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations.AnyAsync(location => location.Id == id, cancellationToken);

    public Task<bool> WarehouseExistsAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Warehouses.AnyAsync(warehouse => warehouse.Id == id, cancellationToken);

    public async Task<IReadOnlyList<InventoryTransactionResponse>> GetAllAsync(
        InventoryTransactionQuery query,
        CancellationToken cancellationToken)
    {
        var transactions = dbContext.InventoryTransactions
            .AsNoTracking()
            .AsQueryable();

        if (query.ProductId.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.ProductId == query.ProductId.Value);
        }

        if (query.LocationId.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.LocationId == query.LocationId.Value);
        }

        if (query.WarehouseId.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.Location.WarehouseId == query.WarehouseId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            var type = query.Type.Trim();
            transactions = transactions.Where(transaction => transaction.Type == type);
        }

        if (query.CreatedFrom.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.CreatedAt >= query.CreatedFrom.Value);
        }

        if (query.CreatedTo.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.CreatedAt <= query.CreatedTo.Value);
        }

        return await transactions
            .OrderByDescending(transaction => transaction.CreatedAt)
            .ThenByDescending(transaction => transaction.Id)
            .Select(ToResponse)
            .ToListAsync(cancellationToken);
    }

    public Task<InventoryTransactionResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        dbContext.InventoryTransactions
            .AsNoTracking()
            .Where(transaction => transaction.Id == id)
            .Select(ToResponse)
            .SingleOrDefaultAsync(cancellationToken);

    private static System.Linq.Expressions.Expression<
        Func<WMS.Domain.InventoryTransaction, InventoryTransactionResponse>> ToResponse =>
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
