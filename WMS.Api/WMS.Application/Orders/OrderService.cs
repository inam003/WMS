using WMS.Application.Inventory;
using WMS.Domain;

namespace WMS.Application.Orders;

public sealed class OrderService(
    IOrderRepository repository,
    IInventoryService inventoryService) : IOrderService
{
    private const decimal MaximumQuantity = 999999999999999.999m;

    public async Task<OrderResult<IReadOnlyList<OrderResponse>>> GetAllAsync(
        CancellationToken cancellationToken) =>
        OrderResult<IReadOnlyList<OrderResponse>>.Success(
            await repository.GetAllAsync(cancellationToken));

    public async Task<OrderResult<OrderResponse>> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (id == Guid.Empty)
        {
            return OrderResult<OrderResponse>.Invalid(new Dictionary<string, string[]>
            {
                ["id"] = ["Order ID must not be empty."]
            });
        }

        var order = await repository.GetByIdAsync(id, cancellationToken);
        return order is null
            ? OrderResult<OrderResponse>.Failure(OrderError.NotFound)
            : OrderResult<OrderResponse>.Success(order);
    }

    public async Task<OrderResult<OrderResponse>> CreateAsync(
        CreateOrderRequest request,
        string? createdBy,
        CancellationToken cancellationToken)
    {
        var errors = ValidateOrder(request.CustomerName, request.Lines);
        if (string.IsNullOrWhiteSpace(createdBy) || createdBy.Length > 200)
        {
            errors["CreatedBy"] = ["The authenticated subject is missing or too long."];
        }

        if (errors.Count > 0)
        {
            return OrderResult<OrderResponse>.Invalid(errors);
        }

        var productsError = await ValidateProductsAsync(
            request.Lines!,
            cancellationToken);
        if (productsError is not null)
        {
            return productsError;
        }

        var order = new CustomerOrder
        {
            Id = Guid.NewGuid(),
            OrderNumber = $"ORD-{Guid.NewGuid():N}",
            CustomerName = request.CustomerName?.Trim(),
            ReferenceId = request.ReferenceId,
            Status = CustomerOrderStatus.Draft,
            CreatedBy = createdBy!,
            CreatedAt = DateTimeOffset.UtcNow,
            Lines = request.Lines!.Select(line => new CustomerOrderLine
            {
                Id = Guid.NewGuid(),
                ProductId = line.ProductId,
                Quantity = line.Quantity
            }).ToList()
        };

        await repository.AddAsync(order, cancellationToken);
        return await GetByIdAsync(order.Id, cancellationToken);
    }

    public async Task<OrderResult<OrderResponse>> UpdateAsync(
        Guid id,
        UpdateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var errors = ValidateOrder(request.CustomerName, request.Lines);
        if (errors.Count > 0)
        {
            return OrderResult<OrderResponse>.Invalid(errors);
        }

        var order = await repository.GetAggregateByIdAsync(id, cancellationToken);
        if (order is null)
        {
            return OrderResult<OrderResponse>.Failure(OrderError.NotFound);
        }

        if (order.Status != CustomerOrderStatus.Draft)
        {
            return OrderResult<OrderResponse>.Failure(OrderError.InvalidTransition);
        }

        var productsError = await ValidateProductsAsync(request.Lines!, cancellationToken);
        if (productsError is not null)
        {
            return productsError;
        }

        order.CustomerName = request.CustomerName?.Trim();
        order.ReferenceId = request.ReferenceId;
        order.Lines = request.Lines!.Select(line => new CustomerOrderLine
        {
            Id = Guid.NewGuid(),
            OrderId = id,
            ProductId = line.ProductId,
            Quantity = line.Quantity
        }).ToList();

        if (!await repository.ReplaceDraftAsync(order, cancellationToken))
        {
            return OrderResult<OrderResponse>.Failure(OrderError.InvalidTransition);
        }

        return await GetByIdAsync(id, cancellationToken);
    }

    public async Task<OrderResult<OrderResponse>> MarkReadyAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var order = await repository.GetAggregateByIdAsync(id, cancellationToken);
        if (order is null)
        {
            return OrderResult<OrderResponse>.Failure(OrderError.NotFound);
        }

        if (order.Status != CustomerOrderStatus.Draft ||
            order.Lines.Count == 0)
        {
            return OrderResult<OrderResponse>.Failure(OrderError.InvalidTransition);
        }

        var productsError = await ValidateProductsAsync(
            order.Lines.Select(line => new OrderLineRequest(line.ProductId, line.Quantity)).ToArray(),
            cancellationToken);
        if (productsError is not null)
        {
            return productsError;
        }

        return await ChangeStatusAndReloadAsync(
            id,
            CustomerOrderStatus.Draft,
            CustomerOrderStatus.Ready,
            cancellationToken);
    }

    public async Task<OrderResult<OrderResponse>> CancelAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var order = await repository.GetAggregateByIdAsync(id, cancellationToken);
        if (order is null)
        {
            return OrderResult<OrderResponse>.Failure(OrderError.NotFound);
        }

        if (order.Status is not CustomerOrderStatus.Draft and not CustomerOrderStatus.Ready)
        {
            return OrderResult<OrderResponse>.Failure(OrderError.InvalidTransition);
        }

        return await ChangeStatusAndReloadAsync(
            id,
            order.Status,
            CustomerOrderStatus.Cancelled,
            cancellationToken);
    }

    public async Task<InventoryOperationResult<InventoryMovementResult>> DispatchAsync(
        Guid id,
        DispatchOrderRequest request,
        string? idempotencyKey,
        string? dispatchedBy,
        CancellationToken cancellationToken)
    {
        var order = await repository.GetAggregateByIdAsync(id, cancellationToken);
        if (order is null)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.NotFound);
        }

        if (order.Status is not CustomerOrderStatus.Ready and
            not CustomerOrderStatus.Dispatched)
        {
            return InventoryOperationResult<InventoryMovementResult>.Failure(
                InventoryError.OrderNotReady);
        }

        var requestLines = request.Lines ?? [];
        var validationErrors = ValidateDispatchLines(order, requestLines);
        if (validationErrors.Count > 0)
        {
            return InventoryOperationResult<InventoryMovementResult>.InvalidRequest(validationErrors);
        }

        var lineById = order.Lines.ToDictionary(line => line.Id);
        var movement = new OrderDispatchMovement(
            order.Id,
            order.ReferenceId,
            requestLines.Select(line =>
            {
                var orderLine = lineById[line.OrderLineId];
                return new OrderDispatchLineMovement(
                    orderLine.Id,
                    orderLine.ProductId,
                    line.LocationId,
                    orderLine.Quantity);
            }).ToArray());

        return await inventoryService.DispatchOrderAsync(
            movement,
            idempotencyKey,
            dispatchedBy,
            cancellationToken);
    }

    private async Task<OrderResult<OrderResponse>> ChangeStatusAndReloadAsync(
        Guid id,
        CustomerOrderStatus currentStatus,
        CustomerOrderStatus nextStatus,
        CancellationToken cancellationToken)
    {
        if (!await repository.ChangeStatusAsync(id, currentStatus, nextStatus, cancellationToken))
        {
            return OrderResult<OrderResponse>.Failure(OrderError.InvalidTransition);
        }

        return await GetByIdAsync(id, cancellationToken);
    }

    private async Task<OrderResult<OrderResponse>?> ValidateProductsAsync(
        IReadOnlyList<OrderLineRequest> lines,
        CancellationToken cancellationToken)
    {
        var states = await repository.GetProductActiveStatesAsync(
            lines.Select(line => line.ProductId).Distinct().ToArray(),
            cancellationToken);
        foreach (var productId in lines.Select(line => line.ProductId).Distinct())
        {
            if (!states.TryGetValue(productId, out var isActive))
            {
                return OrderResult<OrderResponse>.Failure(OrderError.ProductNotFound);
            }

            if (isActive != true)
            {
                return OrderResult<OrderResponse>.Failure(OrderError.InactiveProduct);
            }
        }

        return null;
    }

    private static Dictionary<string, string[]> ValidateOrder(
        string? customerName,
        IReadOnlyList<OrderLineRequest>? lines)
    {
        var errors = new Dictionary<string, string[]>();
        if (customerName?.Trim().Length > 200)
        {
            errors[nameof(customerName)] = ["Customer name must be 200 characters or fewer."];
        }

        if (lines is null || lines.Count == 0)
        {
            errors["Lines"] = ["An order must contain at least one product line."];
            return errors;
        }

        if (lines.Any(line => line.ProductId == Guid.Empty))
        {
            errors["Lines"] = ["Each line must identify a product."];
        }

        if (lines.Any(line =>
            line.Quantity <= 0 ||
            line.Quantity > MaximumQuantity ||
            decimal.Round(line.Quantity, 3) != line.Quantity))
        {
            errors["Lines"] = ["Each quantity must be positive and have no more than three decimal places."];
        }

        if (lines.Select(line => line.ProductId).Distinct().Count() != lines.Count)
        {
            errors["Lines"] = ["A product can only appear once in an order."];
        }

        return errors;
    }

    private static Dictionary<string, string[]> ValidateDispatchLines(
        CustomerOrder order,
        IReadOnlyList<DispatchOrderLineRequest> lines)
    {
        var errors = new Dictionary<string, string[]>();
        if (lines.Count != order.Lines.Count ||
            lines.Select(line => line.OrderLineId).Distinct().Count() != order.Lines.Count ||
            order.Lines.Any(orderLine => lines.All(line => line.OrderLineId != orderLine.Id)))
        {
            errors["Lines"] = ["Select exactly one source location for each order line."];
        }

        if (lines.Any(line =>
            line.OrderLineId == Guid.Empty ||
            line.LocationId == Guid.Empty))
        {
            errors["Lines"] = ["Each dispatch line must identify an order line and a location."];
        }

        return errors;
    }
}
