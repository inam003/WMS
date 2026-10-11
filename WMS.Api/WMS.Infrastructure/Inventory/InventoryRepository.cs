using Microsoft.EntityFrameworkCore;
using WMS.Application.Inventory;
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
}
