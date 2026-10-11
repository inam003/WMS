namespace WMS.Application.Warehouses;

public interface IWarehouseService
{
    Task<IReadOnlyList<WarehouseResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<WarehouseResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<WarehouseOperationResult<WarehouseResponse>> CreateAsync(
        CreateWarehouseRequest request,
        CancellationToken cancellationToken);
    Task<WarehouseOperationResult<WarehouseResponse>> UpdateAsync(
        Guid id,
        UpdateWarehouseRequest request,
        CancellationToken cancellationToken);
    Task<WarehouseOperationResult<bool>> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken);
}
