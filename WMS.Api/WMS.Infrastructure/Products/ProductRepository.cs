using Microsoft.EntityFrameworkCore;
using Npgsql;
using WMS.Application.Products;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Products;

public sealed class ProductRepository(ApplicationDbContext dbContext) : IProductRepository
{
    public async Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken cancellationToken) =>
        await dbContext.Products
            .AsNoTracking()
            .OrderBy(product => product.Name)
            .ThenBy(product => product.Id)
            .ToListAsync(cancellationToken);

    public Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Products
            .AsNoTracking()
            .SingleOrDefaultAsync(product => product.Id == id, cancellationToken);

    public Task<Product?> GetByBarcodeAsync(
        string barcode,
        CancellationToken cancellationToken) =>
        dbContext.Products
            .AsNoTracking()
            .SingleOrDefaultAsync(product => product.Barcode == barcode, cancellationToken);

    public Task<bool> CategoryExistsAsync(Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.Categories.AnyAsync(category => category.Id == categoryId, cancellationToken);

    public Task<bool> SkuExistsAsync(
        string sku,
        Guid? excludingProductId,
        CancellationToken cancellationToken) =>
        dbContext.Products.AnyAsync(
            product => product.SKU == sku &&
                (!excludingProductId.HasValue || product.Id != excludingProductId.Value),
            cancellationToken);

    public Task<bool> BarcodeExistsAsync(
        string barcode,
        Guid? excludingProductId,
        CancellationToken cancellationToken) =>
        dbContext.Products.AnyAsync(
            product => product.Barcode == barcode &&
                (!excludingProductId.HasValue || product.Id != excludingProductId.Value),
            cancellationToken);

    public async Task<bool> HasDependenciesAsync(
        Guid productId,
        CancellationToken cancellationToken) =>
        await dbContext.Inventory.AnyAsync(
            inventory => inventory.ProductId == productId,
            cancellationToken) ||
        await dbContext.InventoryTransactions.AnyAsync(
            transaction => transaction.ProductId == productId,
            cancellationToken);

    public async Task<ProductPersistenceError> AddAsync(
        Product product,
        CancellationToken cancellationToken)
    {
        dbContext.Products.Add(product);
        return await SaveChangesAsync(cancellationToken);
    }

    public async Task<ProductPersistenceError> UpdateAsync(
        Product product,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.Products
            .SingleAsync(candidate => candidate.Id == product.Id, cancellationToken);
        dbContext.Entry(existing).CurrentValues.SetValues(product);
        return await SaveChangesAsync(cancellationToken);
    }

    public async Task<ProductPersistenceError> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var product = await dbContext.Products
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (product is null)
        {
            return ProductPersistenceError.NotFound;
        }

        dbContext.Products.Remove(product);
        return await SaveChangesAsync(cancellationToken);
    }

    private async Task<ProductPersistenceError> SaveChangesAsync(
        CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return ProductPersistenceError.None;
        }
        catch (DbUpdateException exception)
        {
            var persistenceError = exception.GetBaseException() is PostgresException postgresException
                ? postgresException switch
                {
                    { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_Products_SKU" } =>
                        ProductPersistenceError.DuplicateSku,
                    { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_Products_Barcode" } =>
                        ProductPersistenceError.DuplicateBarcode,
                    {
                        SqlState: PostgresErrorCodes.ForeignKeyViolation,
                        ConstraintName: "FK_Products_Categories_CategoryId"
                    } => ProductPersistenceError.CategoryNotFound,
                    {
                        SqlState: PostgresErrorCodes.ForeignKeyViolation,
                        ConstraintName: "FK_Inventory_Products_ProductId" or
                            "FK_InventoryTransactions_Products_ProductId"
                    } => ProductPersistenceError.HasDependencies,
                    _ => ProductPersistenceError.None
                }
                : ProductPersistenceError.None;

            if (persistenceError == ProductPersistenceError.None)
            {
                throw;
            }

            return persistenceError;
        }
    }
}
