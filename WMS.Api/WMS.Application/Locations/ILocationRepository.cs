using WMS.Domain;

namespace WMS.Application.Locations;

public interface ILocationRepository
{
    Task<IReadOnlyList<Location>> GetAllAsync(CancellationToken cancellationToken);
    Task<Location?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<Location?> GetByBarcodeAsync(string barcode, CancellationToken cancellationToken);
    Task<bool> WarehouseExistsAsync(Guid warehouseId, CancellationToken cancellationToken);
    Task<bool> BarcodeExistsAsync(
        string barcode,
        Guid? excludingLocationId,
        CancellationToken cancellationToken);
    Task<bool> CodeExistsAsync(
        Guid warehouseId,
        string code,
        Guid? excludingLocationId,
        CancellationToken cancellationToken);
    Task<bool> HasDependenciesAsync(Guid locationId, CancellationToken cancellationToken);
    Task<LocationPersistenceError> AddAsync(
        Location location,
        CancellationToken cancellationToken);
    Task<LocationPersistenceError> UpdateAsync(
        Location location,
        CancellationToken cancellationToken);
    Task<LocationPersistenceError> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken);
}

public enum LocationPersistenceError
{
    None,
    NotFound,
    WarehouseNotFound,
    DuplicateCode,
    DuplicateBarcode,
    HasDependencies
}
