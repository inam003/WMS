using WMS.Application.InventoryTransactions;

namespace WMS.Application.Inventory;

public interface IInventoryRepository
{
    Task<bool> ProductExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> WarehouseExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<InventoryResponse>> GetAllAsync(
        InventoryQuery query,
        CancellationToken cancellationToken);
    Task<InventoryResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken);
    Task<bool?> GetProductActiveAsync(Guid id, CancellationToken cancellationToken);
    Task<bool?> GetLocationActiveAsync(Guid id, CancellationToken cancellationToken);
    Task<InventoryTransactionResponse?> GetTransactionByIdempotencyKeyAsync(
        string createdBy,
        Guid idempotencyKey,
        CancellationToken cancellationToken);
    Task<InventoryMovementPersistenceResult> ApplyInventoryMovementAsync(
        WMS.Domain.InventoryTransaction transaction,
        decimal quantityDelta,
        CancellationToken cancellationToken);
}
