namespace WMS.Application.InventoryTransactions;

public interface IInventoryTransactionService
{
    Task<InventoryTransactionOperationResult<IReadOnlyList<InventoryTransactionResponse>>> GetAllAsync(
        InventoryTransactionQuery query,
        CancellationToken cancellationToken);
    Task<InventoryTransactionOperationResult<InventoryTransactionResponse>> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken);
}
