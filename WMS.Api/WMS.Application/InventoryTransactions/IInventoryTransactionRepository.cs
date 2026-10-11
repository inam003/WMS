namespace WMS.Application.InventoryTransactions;

public interface IInventoryTransactionRepository
{
    Task<bool> ProductExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> LocationExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> WarehouseExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<InventoryTransactionResponse>> GetAllAsync(
        InventoryTransactionQuery query,
        CancellationToken cancellationToken);
    Task<InventoryTransactionResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken);
}
