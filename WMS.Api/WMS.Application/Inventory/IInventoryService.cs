namespace WMS.Application.Inventory;

public interface IInventoryService
{
    Task<InventoryOperationResult<IReadOnlyList<InventoryResponse>>> GetAllAsync(
        InventoryQuery query,
        CancellationToken cancellationToken);
    Task<InventoryOperationResult<InventoryResponse>> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken);
}
