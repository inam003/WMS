namespace WMS.Application.Inventory;

public sealed class InventoryService(IInventoryRepository repository) : IInventoryService
{
    private const string ReceiptTransactionType = "Receipt";

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

    public async Task<InventoryOperationResult<ReceiptResult>> ReceiveAsync(
        CreateReceiptRequest request,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (request.ProductId == Guid.Empty)
        {
            validationErrors[nameof(request.ProductId)] = ["ProductId must not be empty."];
        }

        if (request.LocationId == Guid.Empty)
        {
            validationErrors[nameof(request.LocationId)] = ["LocationId must not be empty."];
        }

        if (request.Quantity <= 0 ||
            request.Quantity > 999999999999999.999m ||
            decimal.Round(request.Quantity, 3) != request.Quantity)
        {
            validationErrors[nameof(request.Quantity)] =
                ["Quantity must be greater than zero and support no more than three decimal places."];
        }

        if (!Guid.TryParse(idempotencyKey, out var parsedIdempotencyKey) ||
            parsedIdempotencyKey == Guid.Empty)
        {
            validationErrors["Idempotency-Key"] = ["A non-empty GUID idempotency key is required."];
        }

        if (string.IsNullOrWhiteSpace(createdBy) || createdBy.Length > 200)
        {
            validationErrors["CreatedBy"] = ["The authenticated subject is missing or too long."];
        }

        if (validationErrors.Count > 0)
        {
            return InventoryOperationResult<ReceiptResult>.InvalidRequest(validationErrors);
        }

        var existingReceipt = await repository.GetReceiptByIdempotencyKeyAsync(
            createdBy!,
            parsedIdempotencyKey,
            cancellationToken);
        if (existingReceipt is not null)
        {
            var isReplay =
                existingReceipt.Type == ReceiptTransactionType &&
                existingReceipt.ProductId == request.ProductId &&
                existingReceipt.LocationId == request.LocationId &&
                existingReceipt.Quantity == request.Quantity &&
                existingReceipt.ReferenceId == request.ReferenceId;
            if (!isReplay)
            {
                return InventoryOperationResult<ReceiptResult>.Failure(
                    InventoryError.IdempotencyConflict);
            }

            return InventoryOperationResult<ReceiptResult>.Success(
                new ReceiptResult(existingReceipt, true));
        }

        var productIsActive = await repository.GetProductActiveAsync(
            request.ProductId,
            cancellationToken);
        if (!productIsActive.HasValue)
        {
            return InventoryOperationResult<ReceiptResult>.Failure(
                InventoryError.ProductNotFound);
        }

        if (!productIsActive.Value)
        {
            return InventoryOperationResult<ReceiptResult>.Failure(
                InventoryError.InactiveProduct);
        }

        var locationIsActive = await repository.GetLocationActiveAsync(
            request.LocationId,
            cancellationToken);
        if (!locationIsActive.HasValue)
        {
            return InventoryOperationResult<ReceiptResult>.Failure(
                InventoryError.LocationNotFound);
        }

        if (!locationIsActive.Value)
        {
            return InventoryOperationResult<ReceiptResult>.Failure(
                InventoryError.InactiveLocation);
        }

        var persistenceResult = await repository.ReceiveAsync(
            new WMS.Domain.InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = request.ProductId,
                LocationId = request.LocationId,
                Quantity = request.Quantity,
                Type = ReceiptTransactionType,
                ReferenceId = request.ReferenceId,
                IdempotencyKey = parsedIdempotencyKey,
                CreatedBy = createdBy!
            },
            cancellationToken);

        if (persistenceResult.Status == ReceiptPersistenceStatus.IdempotencyConflict)
        {
            return InventoryOperationResult<ReceiptResult>.Failure(
                InventoryError.IdempotencyConflict);
        }

        if (persistenceResult.Status == ReceiptPersistenceStatus.QuantityLimitExceeded)
        {
            return InventoryOperationResult<ReceiptResult>.Failure(
                InventoryError.QuantityLimitExceeded);
        }

        var savedTransaction = persistenceResult.Transaction
            ?? throw new InvalidOperationException(
                "A successful receipt persistence result must include its transaction.");
        return InventoryOperationResult<ReceiptResult>.Success(
            new ReceiptResult(
                savedTransaction,
                persistenceResult.Status == ReceiptPersistenceStatus.Replayed));
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
