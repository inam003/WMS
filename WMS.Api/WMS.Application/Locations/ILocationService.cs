namespace WMS.Application.Locations;

public interface ILocationService
{
    Task<IReadOnlyList<LocationResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<LocationResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<LocationResponse?> GetByBarcodeAsync(
        string barcode,
        CancellationToken cancellationToken);
    Task<LocationOperationResult<LocationResponse>> CreateAsync(
        CreateLocationRequest request,
        CancellationToken cancellationToken);
    Task<LocationOperationResult<LocationResponse>> UpdateAsync(
        Guid id,
        UpdateLocationRequest request,
        CancellationToken cancellationToken);
    Task<LocationOperationResult<bool>> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken);
}
