namespace WMS.Application.Products;

public interface IProductService
{
    Task<IReadOnlyList<ProductResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<ProductResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<ProductResponse?> GetByBarcodeAsync(
        string barcode,
        CancellationToken cancellationToken);
    Task<ProductOperationResult<ProductResponse>> CreateAsync(
        CreateProductRequest request,
        CancellationToken cancellationToken);
    Task<ProductOperationResult<ProductResponse>> UpdateAsync(
        Guid id,
        UpdateProductRequest request,
        CancellationToken cancellationToken);
    Task<ProductOperationResult<bool>> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
