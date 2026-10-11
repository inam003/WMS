namespace WMS.Application.Inventory;

public sealed class InventoryService(IInventoryRepository repository) : IInventoryService
{
    public async Task<InventoryOperationResult<IReadOnlyList<InventoryResponse>>> GetAllAsync(
        InventoryQuery query,
        CancellationToken cancellationToken)
    {
        var errors = ValidateQuery(query);
        if (errors.Count > 0)
        {
            return InventoryOperationResult<IReadOnlyList<InventoryResponse>>.Invalid(errors);
        }

        var missingFilters = new Dictionary<string, string[]>();
        if (query.ProductId.HasValue &&
            !await repository.ProductExistsAsync(query.ProductId.Value, cancellationToken))
        {
            missingFilters[nameof(query.ProductId)] = ["The specified product was not found."];
        }

        if (query.LocationId.HasValue &&
            !await repository.LocationExistsAsync(query.LocationId.Value, cancellationToken))
        {
            missingFilters[nameof(query.LocationId)] = ["The specified location was not found."];
        }

        if (query.WarehouseId.HasValue &&
            !await repository.WarehouseExistsAsync(query.WarehouseId.Value, cancellationToken))
        {
            missingFilters[nameof(query.WarehouseId)] = ["The specified warehouse was not found."];
        }

        if (missingFilters.Count > 0)
        {
            return InventoryOperationResult<IReadOnlyList<InventoryResponse>>
                .MissingFilters(missingFilters);
        }

        var inventory = await repository.GetAllAsync(query, cancellationToken);
        return InventoryOperationResult<IReadOnlyList<InventoryResponse>>.Success(inventory);
    }

    public async Task<InventoryOperationResult<InventoryResponse>> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
        {
            return InventoryOperationResult<InventoryResponse>.Invalid(
                new Dictionary<string, string[]>
                {
                    ["id"] = ["Inventory ID must not be empty."]
                });
        }

        var inventory = await repository.GetByIdAsync(id, cancellationToken);
        return inventory is null
            ? InventoryOperationResult<InventoryResponse>.Failure(InventoryError.NotFound)
            : InventoryOperationResult<InventoryResponse>.Success(inventory);
    }

    private static Dictionary<string, string[]> ValidateQuery(InventoryQuery query)
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

        return errors;
    }
}
