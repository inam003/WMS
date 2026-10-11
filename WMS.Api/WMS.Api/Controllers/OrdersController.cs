using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Inventory;
using WMS.Application.InventoryTransactions;
using WMS.Application.Orders;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public sealed class OrdersController(IOrderService orderService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<OrderResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<OrderResponse>>> GetAll(
        CancellationToken cancellationToken)
    {
        var result = await orderService.GetAllAsync(cancellationToken);
        return Ok(result.Value);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await orderService.GetByIdAsync(id, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToOrderError(result.Error, result.ValidationErrors);
    }

    [HttpPost]
    [Authorize(Policy = "WmsOrderManage")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderResponse>> Create(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await orderService.CreateAsync(
            request,
            User.FindFirst("sub")?.Value,
            cancellationToken);
        if (!result.Succeeded)
        {
            return ToOrderError(result.Error, result.ValidationErrors);
        }

        return CreatedAtAction(nameof(GetById), new { id = result.Value!.Id }, result.Value);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "WmsOrderManage")]
    [ProducesResponseType(typeof(OrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderResponse>> Update(
        Guid id,
        UpdateOrderRequest request,
        CancellationToken cancellationToken)
    {
        var result = await orderService.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToOrderError(result.Error, result.ValidationErrors);
    }

    [HttpPost("{id:guid}/ready")]
    [Authorize(Policy = "WmsOrderManage")]
    public async Task<ActionResult<OrderResponse>> MarkReady(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await orderService.MarkReadyAsync(id, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToOrderError(result.Error, result.ValidationErrors);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = "WmsOrderManage")]
    public async Task<ActionResult<OrderResponse>> Cancel(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await orderService.CancelAsync(id, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToOrderError(result.Error, result.ValidationErrors);
    }

    [HttpPost("{id:guid}/dispatch")]
    [Authorize(Policy = "WmsDispatch")]
    [ProducesResponseType(typeof(IReadOnlyList<InventoryTransactionResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(IReadOnlyList<InventoryTransactionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult> Dispatch(
        Guid id,
        DispatchOrderRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await orderService.DispatchAsync(
            id,
            request,
            idempotencyKey,
            User.FindFirst("sub")?.Value,
            cancellationToken);
        if (!result.Succeeded)
        {
            return ToInventoryError(result.Error, result.ValidationErrors);
        }

        return result.Value!.IsReplay
            ? Ok(result.Value.Transactions)
            : StatusCode(StatusCodes.Status201Created, result.Value.Transactions);
    }

    private ActionResult ToOrderError(
        OrderError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            OrderError.InvalidRequest => BadRequest(new ValidationProblemDetails(
                validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            OrderError.NotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "The specified order was not found."
            }),
            OrderError.ProductNotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "One or more specified products were not found."
            }),
            OrderError.InactiveProduct => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "One or more specified products are inactive."
            }),
            OrderError.InvalidTransition or OrderError.NotReady or OrderError.InvalidDispatch =>
                Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "The requested order operation is not valid for its current state."
                }),
            _ => throw new InvalidOperationException($"Unhandled order error: {error}.")
        };

    private ActionResult ToInventoryError(
        InventoryError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            InventoryError.InvalidRequest => BadRequest(new ValidationProblemDetails(
                validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            InventoryError.ProductNotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "One or more order products were not found."
            }),
            InventoryError.LocationNotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "One or more dispatch locations were not found."
            }),
            InventoryError.InactiveProduct => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "One or more order products are inactive."
            }),
            InventoryError.InactiveLocation => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "One or more dispatch locations or their warehouses are inactive."
            }),
            InventoryError.IdempotencyConflict or InventoryError.InsufficientInventory or
                InventoryError.QuantityLimitExceeded or InventoryError.OrderNotReady =>
                Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = error == InventoryError.IdempotencyConflict
                        ? "The idempotency key was already used for a different dispatch."
                        : "The order could not be dispatched because its state or inventory changed."
                }),
            InventoryError.NotFound => NotFound(),
            _ => throw new InvalidOperationException($"Unhandled inventory error: {error}.")
        };
}
