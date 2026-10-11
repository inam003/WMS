using WMS.Domain;

namespace WMS.Application.Warehouses;

public interface IWarehouseRepository
{
    Task<IReadOnlyList<Warehouse>> GetAllAsync(CancellationToken cancellationToken);
    Task<Warehouse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> CodeExistsAsync(
        string code,
        Guid? excludingWarehouseId,
        CancellationToken cancellationToken);
    Task<bool> HasLocationsAsync(Guid warehouseId, CancellationToken cancellationToken);
    Task<WarehousePersistenceError> AddAsync(
        Warehouse warehouse,
        CancellationToken cancellationToken);
    Task<WarehousePersistenceError> UpdateAsync(
        Warehouse warehouse,
        CancellationToken cancellationToken);
    Task<WarehousePersistenceError> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken);
}

public enum WarehousePersistenceError
{
    None,
    NotFound,
    DuplicateCode,
    HasLocations
}
