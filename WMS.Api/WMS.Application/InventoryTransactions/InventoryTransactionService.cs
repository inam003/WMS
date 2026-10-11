namespace WMS.Application.InventoryTransactions;

public sealed class InventoryTransactionService(
    IInventoryTransactionRepository repository) : IInventoryTransactionService
{
    public async Task<InventoryTransactionOperationResult<IReadOnlyList<InventoryTransactionResponse>>>
        GetAllAsync(
            InventoryTransactionQuery query,
            CancellationToken cancellationToken)
    {
        var validationErrors = Validate(query);
        if (validationErrors.Count > 0)
        {
            return InventoryTransactionOperationResult<
                IReadOnlyList<InventoryTransactionResponse>>.Invalid(validationErrors);
        }

        var missingFilters = new Dictionary<string, string[]>();
        if (query.ProductId.HasValue &&
            !await repository.ProductExistsAsync(query.ProductId.Value, cancellationToken))
        {
            missingFilters[nameof(query.ProductId)] =
                ["The specified product was not found."];
        }

        if (query.LocationId.HasValue &&
            !await repository.LocationExistsAsync(query.LocationId.Value, cancellationToken))
        {
            missingFilters[nameof(query.LocationId)] =
                ["The specified location was not found."];
        }

        if (query.WarehouseId.HasValue &&
            !await repository.WarehouseExistsAsync(query.WarehouseId.Value, cancellationToken))
        {
            missingFilters[nameof(query.WarehouseId)] =
                ["The specified warehouse was not found."];
        }

        if (missingFilters.Count > 0)
        {
            return InventoryTransactionOperationResult<
                IReadOnlyList<InventoryTransactionResponse>>.MissingFilters(missingFilters);
        }

        var transactions = await repository.GetAllAsync(query, cancellationToken);
        return InventoryTransactionOperationResult<
            IReadOnlyList<InventoryTransactionResponse>>.Success(transactions);
    }

    public async Task<InventoryTransactionOperationResult<InventoryTransactionResponse>>
        GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
        {
            return InventoryTransactionOperationResult<InventoryTransactionResponse>.Invalid(
                new Dictionary<string, string[]>
                {
                    ["id"] = ["Transaction ID must not be empty."]
                });
        }

        var transaction = await repository.GetByIdAsync(id, cancellationToken);
        return transaction is null
            ? InventoryTransactionOperationResult<InventoryTransactionResponse>.Failure(
                InventoryTransactionError.NotFound)
            : InventoryTransactionOperationResult<InventoryTransactionResponse>.Success(
                transaction);
    }

    private static Dictionary<string, string[]> Validate(InventoryTransactionQuery query)
    {
        var errors = new Dictionary<string, string[]>();
        if (query.ProductId == Guid.Empty)
        {
            errors[nameof(query.ProductId)] = ["ProductId must not be empty."];
        }

        if (query.LocationId == Guid.Empty)
        {
            errors[nameof(query.LocationId)] = ["LocationId must not be empty."];
        }

        if (query.WarehouseId == Guid.Empty)
        {
            errors[nameof(query.WarehouseId)] = ["WarehouseId must not be empty."];
        }

        if (query.Type?.Trim().Length > 50)
        {
            errors[nameof(query.Type)] = ["Type must be 50 characters or fewer."];
        }

        if (query.CreatedFrom.HasValue &&
            query.CreatedTo.HasValue &&
            query.CreatedFrom.Value > query.CreatedTo.Value)
        {
            errors[nameof(query.CreatedFrom)] =
                ["CreatedFrom must be earlier than or equal to CreatedTo."];
        }

        return errors;
    }
}
