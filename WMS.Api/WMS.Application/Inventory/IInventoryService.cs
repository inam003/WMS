namespace WMS.Application.Inventory;

public interface IInventoryService
{
    Task<InventoryOperationResult<IReadOnlyList<InventoryResponse>>> GetAllAsync(
        InventoryQuery query,
        CancellationToken cancellationToken);
    Task<InventoryOperationResult<InventoryResponse>> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken);
    Task<InventoryOperationResult<InventoryMovementResult>> ReceiveAsync(
        CreateReceiptRequest request,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken);
    Task<InventoryOperationResult<InventoryMovementResult>> AdjustAsync(
        CreateInventoryAdjustmentRequest request,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken);
    Task<InventoryOperationResult<InventoryMovementResult>> TransferAsync(
        CreateInventoryTransferRequest request,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken);
}
