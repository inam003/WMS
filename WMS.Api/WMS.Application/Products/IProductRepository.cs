using WMS.Domain;

namespace WMS.Application.Products;

public interface IProductRepository
{
    Task<IReadOnlyList<Product>> GetAllAsync(CancellationToken cancellationToken);
    Task<Product?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> CategoryExistsAsync(Guid categoryId, CancellationToken cancellationToken);
    Task<bool> SkuExistsAsync(
        string sku,
        Guid? excludingProductId,
        CancellationToken cancellationToken);
    Task<bool> BarcodeExistsAsync(
        string barcode,
        Guid? excludingProductId,
        CancellationToken cancellationToken);
    Task<bool> HasDependenciesAsync(Guid productId, CancellationToken cancellationToken);
    Task<ProductPersistenceError> AddAsync(Product product, CancellationToken cancellationToken);
    Task<ProductPersistenceError> UpdateAsync(Product product, CancellationToken cancellationToken);
    Task<ProductPersistenceError> DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public enum ProductPersistenceError
{
    None,
    NotFound,
    CategoryNotFound,
    DuplicateSku,
    DuplicateBarcode,
    HasDependencies
}
