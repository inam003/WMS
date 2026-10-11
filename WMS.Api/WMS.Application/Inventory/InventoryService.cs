using WMS.Application.InventoryTransactions;
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
            request.Quantity,
            [(request.LocationId, ReceiptTransactionType)],
            [new InventoryQuantityChange(request.ProductId, request.LocationId, request.Quantity)],
            request.ReferenceId,
            null,
            null,
            idempotencyKey,
            createdBy,
            null,
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
            request.Quantity,
            [(request.LocationId, isIncrease ? "AdjustmentIncrease" : "AdjustmentDecrease")],
            [
                new InventoryQuantityChange(
                    request.ProductId,
                    request.LocationId,
                    request.Quantity * (isIncrease ? 1 : -1))
            ],
            null,
            request.Reason,
            explanation,
            idempotencyKey,
            createdBy,
            null,
            cancellationToken);
    }

    public async Task<InventoryOperationResult<InventoryMovementResult>> TransferAsync(
        CreateInventoryTransferRequest request,
        string? idempotencyKey,
        string? createdBy,
        CancellationToken cancellationToken)
    {
        if (request.SourceLocationId == request.DestinationLocationId)
        {
            return InventoryOperationResult<InventoryMovementResult>.InvalidRequest(
                new Dictionary<string, string[]>
                {
                    [nameof(request.DestinationLocationId)] =
                        ["Source and destination locations must be different."]
                });
        }

        var transferId = Guid.NewGuid();
        return await ApplyMovementAsync(
            request.ProductId,
            request.Quantity,
            [
                (request.SourceLocationId, "TransferOut"),
                (request.DestinationLocationId, "TransferIn")
            ],
            [
                new InventoryQuantityChange(
                    request.ProductId,
                    request.SourceLocationId,
                    -request.Quantity),
                new InventoryQuantityChange(
                    request.ProductId,
                    request.DestinationLocationId,
                    request.Quantity)
            ],
            request.ReferenceId,
            null,
            null,
            idempotencyKey,
            createdBy,
            transferId,
            cancellationToken);
    }

    private async Task<InventoryOperationResult<InventoryMovementResult>> ApplyMovementAsync(
        Guid productId,
        decimal quantity,
        IReadOnlyList<(Guid LocationId, string Type)> movements,
        IReadOnlyList<InventoryQuantityChange> quantityChanges,
        Guid? referenceId,
        InventoryAdjustmentReason? adjustmentReason,
        string? adjustmentExplanation,
        string? idempotencyKey,
        string? createdBy,
        Guid? transferId,
        CancellationToken cancellationToken)
    {
        var validationErrors = new Dictionary<string, string[]>();
        if (productId == Guid.Empty)
        {
            validationErrors["ProductId"] = ["ProductId must not be empty."];
        }

        for (var index = 0; index < movements.Count; index++)
        {
            if (movements[index].LocationId == Guid.Empty)
            {
                validationErrors[index == 0 ? "SourceLocationId" : "DestinationLocationId"] =
                    ["Location ID must not be empty."];
            }
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

        var transactions = movements.Select((movement, index) =>
            new WMS.Domain.InventoryTransaction
            {
                Id = Guid.NewGuid(),
                ProductId = productId,
                LocationId = movement.LocationId,
                Quantity = quantity,
                Type = movement.Type,
                ReferenceId = referenceId,
                IdempotencyKey = index == 0 ? parsedIdempotencyKey : null,
                TransferId = transferId,
                AdjustmentReason = adjustmentReason,
                AdjustmentExplanation = adjustmentExplanation,
                CreatedBy = createdBy!
            }).ToArray();

        var existingTransactions = await repository.GetTransactionsByIdempotencyKeyAsync(
            createdBy!,
            parsedIdempotencyKey,
            cancellationToken);
        if (existingTransactions.Count > 0)
        {
            if (!AreSameMovement(transactions, existingTransactions))
            {
                return InventoryOperationResult<InventoryMovementResult>.Failure(
                    InventoryError.IdempotencyConflict);
            }

            return InventoryOperationResult<InventoryMovementResult>.Success(
                new InventoryMovementResult(existingTransactions, true));
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

        foreach (var locationId in movements.Select(movement => movement.LocationId).Distinct())
        {
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
        }

        var persistenceResult = await repository.ApplyInventoryMovementAsync(
            transactions,
            quantityChanges,
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

        var savedTransactions = persistenceResult.Transactions
            ?? throw new InvalidOperationException(
                "A successful inventory movement must include transaction history.");
        return InventoryOperationResult<InventoryMovementResult>.Success(
            new InventoryMovementResult(
                savedTransactions,
                persistenceResult.Status == InventoryMovementPersistenceStatus.Replayed));
    }

    private static bool AreSameMovement(
        IReadOnlyList<WMS.Domain.InventoryTransaction> expected,
        IReadOnlyList<InventoryTransactionResponse> actual) =>
        expected.Count == actual.Count &&
        expected.All(candidate => actual.Any(existing =>
            existing.Type == candidate.Type &&
            existing.ProductId == candidate.ProductId &&
            existing.LocationId == candidate.LocationId &&
            existing.Quantity == candidate.Quantity &&
            existing.ReferenceId == candidate.ReferenceId &&
            existing.AdjustmentReason == candidate.AdjustmentReason &&
            existing.AdjustmentExplanation == candidate.AdjustmentExplanation));

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
