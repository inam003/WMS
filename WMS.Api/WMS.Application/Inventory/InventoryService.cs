using WMS.Domain;

namespace WMS.Application.Inventory;

public sealed class InventoryService(IInventoryRepository repository) : IInventoryService
{
    private const string ReceiptTransactionType = "Receipt";
    private const int MaximumQuantityPrecision = 3;
    private const decimal MaximumQuantity = 999999999999999.999m;

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

    public async Task<InventoryOperationResult<InventoryMovementResult>> ReceiveAsync(
        CreateReceiptRequest request,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken) =>
        await ApplyMovementAsync(
            request.ProductId,
            request.LocationId,
            request.Quantity,
            ReceiptTransactionType,
            request.ReferenceId,
            null,
            null,
            1,
            idempotencyKey,
            createdBy,
            cancellationToken);

    public async Task<InventoryOperationResult<InventoryMovementResult>> AdjustAsync(
        CreateInventoryAdjustmentRequest request,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (request.Type is not InventoryAdjustmentType.Increase and
            not InventoryAdjustmentType.Decrease)
        {
            validationErrors[nameof(request.Type)] = ["Select Increase or Decrease."];
        }

        if (request.Reason is InventoryAdjustmentReason.Unspecified ||
            !Enum.IsDefined(request.Reason))
        {
            validationErrors[nameof(request.Reason)] = ["Select a valid adjustment reason."];
        }

        var explanation = request.Explanation?.Trim();
        if (request.Reason == InventoryAdjustmentReason.Other &&
            string.IsNullOrWhiteSpace(explanation))
        {
            validationErrors[nameof(request.Explanation)] =
                ["An explanation is required when the reason is Other."];
        }
        else if (explanation?.Length > 500)
        {
            validationErrors[nameof(request.Explanation)] =
                ["Explanation must be 500 characters or fewer."];
        }

        if (validationErrors.Count > 0)
        {
            return InventoryOperationResult<InventoryMovementResult>.InvalidRequest(validationErrors);
        }

        var isIncrease = request.Type == InventoryAdjustmentType.Increase;
        return await ApplyMovementAsync(
            request.ProductId,
            request.LocationId,
            request.Quantity,
            isIncrease ? "AdjustmentIncrease" : "AdjustmentDecrease",
            null,
            request.Reason,
            explanation,
            isIncrease ? 1 : -1,
            idempotencyKey,
            createdBy,
            cancellationToken);
    }

    private async Task<InventoryOperationResult<InventoryMovementResult>> ApplyMovementAsync(
        Guid productId,
        Guid locationId,
        decimal quantity,
        string transactionType,
        Guid? referenceId,
        InventoryAdjustmentReason? adjustmentReason,
        string? adjustmentExplanation,
        int direction,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (productId == Guid.Empty)
        {
            validationErrors["ProductId"] = ["ProductId must not be empty."];
        }

        if (locationId == Guid.Empty)
        {
            validationErrors["LocationId"] = ["LocationId must not be empty."];
        }

        if (quantity <= 0 ||
            quantity > MaximumQuantity ||
            decimal.Round(quantity, MaximumQuantityPrecision) != quantity)
        {
            validationErrors["Quantity"] =
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
            return InventoryOperationResult<InventoryMovementResult>.InvalidRequest(validationErrors);
        }

        var existingTransaction = await repository.GetTransactionByIdempotencyKeyAsync(
            createdBy!,
            parsedIdempotencyKey,
            cancellationToken);
        if (existingTransaction is not null)
        {
            var isReplay =
                existingTransaction.Type == transactionType &&
                existingTransaction.ProductId == productId &&
                existingTransaction.LocationId == locationId &&
                existingTransaction.Quantity == quantity &&
                existingTransaction.ReferenceId == referenceId &&
                existingTransaction.AdjustmentReason == adjustmentReason &&
                existingTransaction.AdjustmentExplanation == adjustmentExplanation;
            if (!isReplay)
            {
                return InventoryOperationResult<InventoryMovementResult>.Failure(
                    InventoryError.IdempotencyConflict);
            }

            return InventoryOperationResult<InventoryMovementResult>.Success(
                new InventoryMovementResult(existingTransaction, true));
        }

        var productIsActive = await repository.GetProductActiveAsync(
            productId,
            cancellationToken);
        if (!productIsActive.HasValue)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.ProductNotFound);
        }

        if (!productIsActive.Value)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.InactiveProduct);
        }

        var locationIsActive = await repository.GetLocationActiveAsync(
            locationId,
            cancellationToken);
        if (!locationIsActive.HasValue)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.LocationNotFound);
        }

        if (!locationIsActive.Value)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.InactiveLocation);
        }

        var persistenceResult = await repository.ApplyInventoryMovementAsync(
            new WMS.Domain.InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = productId,
                LocationId = locationId,
                Quantity = quantity,
                Type = transactionType,
                ReferenceId = referenceId,
                IdempotencyKey = parsedIdempotencyKey,
                AdjustmentReason = adjustmentReason,
                AdjustmentExplanation = adjustmentExplanation,
                CreatedBy = createdBy!
            },
            quantity * direction,
            cancellationToken);

        if (persistenceResult.Status == InventoryMovementPersistenceStatus.IdempotencyConflict)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.IdempotencyConflict);
        }

        if (persistenceResult.Status == InventoryMovementPersistenceStatus.QuantityLimitExceeded)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.QuantityLimitExceeded);
        }

        if (persistenceResult.Status == InventoryMovementPersistenceStatus.InsufficientInventory)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.InsufficientInventory);
        }

        var savedTransaction = persistenceResult.Transaction
            ?? throw new InvalidOperationException(
                "A successful inventory movement must include its transaction.");
        return InventoryOperationResult<InventoryMovementResult>.Success(
            new InventoryMovementResult(
                savedTransaction,
                persistenceResult.Status == InventoryMovementPersistenceStatus.Replayed));
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
