using WMS.Domain;
using WMS.Application.Inventory;

namespace WMS.Application.Orders;

public sealed record OrderLineRequest(Guid ProductId, decimal Quantity);

public sealed record CreateOrderRequest(
    string? CustomerName,
    Guid? ReferenceId,
    IReadOnlyList<OrderLineRequest>? Lines);

public sealed record UpdateOrderRequest(
    string? CustomerName,
    Guid? ReferenceId,
    IReadOnlyList<OrderLineRequest>? Lines);

public sealed record DispatchOrderLineRequest(Guid OrderLineId, Guid LocationId);

public sealed record DispatchOrderRequest(IReadOnlyList<DispatchOrderLineRequest>? Lines);

public sealed record OrderLineResponse(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string SKU,
    decimal Quantity,
    Guid? DispatchLocationId,
    string? DispatchLocationName,
    string? DispatchWarehouseName);

public sealed record OrderResponse(
    Guid Id,
    string OrderNumber,
    string? CustomerName,
    Guid? ReferenceId,
    CustomerOrderStatus Status,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    string? DispatchedBy,
    DateTimeOffset? DispatchedAt,
    IReadOnlyList<OrderLineResponse> Lines);

public enum OrderError
{
    None,
    NotFound,
    InvalidRequest,
    ProductNotFound,
    InactiveProduct,
    InvalidTransition,
    NotReady,
    InvalidDispatch
}

public sealed record OrderResult<T>(
    OrderError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == OrderError.None;

    public static OrderResult<T> Success(T value) => new(OrderError.None, value);
    public static OrderResult<T> Failure(OrderError error) => new(error);
    public static OrderResult<T> Invalid(IReadOnlyDictionary<string, string[]> errors) =>
        new(OrderError.InvalidRequest, ValidationErrors: errors);
}

public sealed record OrderDispatchMovement(
    Guid OrderId,
    Guid? ReferenceId,
    IReadOnlyList<OrderDispatchLineMovement> Lines);

public sealed record OrderDispatchLineMovement(
    Guid OrderLineId,
    Guid ProductId,
    Guid LocationId,
    decimal Quantity);

public interface IOrderRepository
{
    Task<IReadOnlyList<OrderResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<OrderResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<CustomerOrder?> GetAggregateByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyDictionary<Guid, bool?>> GetProductActiveStatesAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken);
    Task AddAsync(CustomerOrder order, CancellationToken cancellationToken);
    Task<bool> ReplaceDraftAsync(CustomerOrder updatedOrder, CancellationToken cancellationToken);
    Task<bool> ChangeStatusAsync(
        Guid orderId,
        CustomerOrderStatus currentStatus,
        CustomerOrderStatus nextStatus,
        CancellationToken cancellationToken);
}

public interface IOrderService
{
    Task<OrderResult<IReadOnlyList<OrderResponse>>> GetAllAsync(CancellationToken cancellationToken);
    Task<OrderResult<OrderResponse>> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<OrderResult<OrderResponse>> CreateAsync(
        CreateOrderRequest request,
        string? createdBy,
        CancellationToken cancellationToken);
    Task<OrderResult<OrderResponse>> UpdateAsync(
        Guid id,
        UpdateOrderRequest request,
        CancellationToken cancellationToken);
    Task<OrderResult<OrderResponse>> MarkReadyAsync(Guid id, CancellationToken cancellationToken);
    Task<OrderResult<OrderResponse>> CancelAsync(Guid id, CancellationToken cancellationToken);
    Task<InventoryOperationResult<InventoryMovementResult>> DispatchAsync(
        Guid id,
        DispatchOrderRequest request,
        string? idempotencyKey,
        string? dispatchedBy,
        CancellationToken cancellationToken);
}
