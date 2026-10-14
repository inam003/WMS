using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Inventory;
using WMS.Application.InventoryTransactions;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize]
public sealed class InventoryController(IInventoryService inventoryService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<InventoryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<InventoryResponse>>> GetAll(
        [FromQuery] Guid? productId,
        [FromQuery] Guid? locationId,
        [FromQuery] Guid? warehouseId,
        CancellationToken cancellationToken)
    {
        var result = await inventoryService.GetAllAsync(
            new InventoryQuery(productId, locationId, warehouseId),
            cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(InventoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await inventoryService.GetByIdAsync(id, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    [HttpPost("receipts")]
    [Authorize(Policy = "WmsOperationalWrite")]
    [ProducesResponseType(typeof(InventoryTransactionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(InventoryTransactionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<InventoryTransactionResponse>> Receive(
        CreateReceiptRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await inventoryService.ReceiveAsync(
            request,
            idempotencyKey,
            User.FindFirst("sub")?.Value,
            cancellationToken);
        if (!result.Succeeded)
        {
            return ToErrorResponse(result.Error, result.ValidationErrors);
        }

        if (result.Value!.IsReplay)
        {
            return Ok(result.Value.Transaction);
        }

        return Created(
            $"/api/inventory-transactions/{result.Value.Transaction.Id}",
            result.Value.Transaction);
    }

    [HttpPost("adjustments")]
    [Authorize(Policy = "WmsOperationalWrite")]
    [ProducesResponseType(typeof(InventoryTransactionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(InventoryTransactionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<InventoryTransactionResponse>> Adjust(
        CreateInventoryAdjustmentRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await inventoryService.AdjustAsync(
            request,
            idempotencyKey,
            User.FindFirst("sub")?.Value,
            cancellationToken);
        if (!result.Succeeded)
        {
            return ToErrorResponse(result.Error, result.ValidationErrors);
        }

        if (result.Value!.IsReplay)
        {
            return Ok(result.Value.Transaction);
        }

        return Created(
            $"/api/inventory-transactions/{result.Value.Transaction.Id}",
            result.Value.Transaction);
    }

    [HttpPost("transfers")]
    [Authorize(Policy = "WmsOperationalWrite")]
    [ProducesResponseType(
        typeof(IReadOnlyList<InventoryTransactionResponse>),
        StatusCodes.Status201Created)]
    [ProducesResponseType(
        typeof(IReadOnlyList<InventoryTransactionResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<IReadOnlyList<InventoryTransactionResponse>>> Transfer(
        CreateInventoryTransferRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var result = await inventoryService.TransferAsync(
            request,
            idempotencyKey,
            User.FindFirst("sub")?.Value,
            cancellationToken);
        if (!result.Succeeded)
        {
            return ToErrorResponse(result.Error, result.ValidationErrors);
        }

        return result.Value!.IsReplay
            ? Ok(result.Value.Transactions)
            : StatusCode(StatusCodes.Status201Created, result.Value.Transactions);
    }

    private ActionResult ToErrorResponse(
        InventoryError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            InventoryError.InvalidFilter =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            InventoryError.InvalidRequest =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            InventoryError.FilterNotFound =>
                NotFound(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "One or more filter identifiers were not found."
                }),
            InventoryError.ProductNotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "The specified product was not found."
            }),
            InventoryError.LocationNotFound => NotFound(new ProblemDetails
            {
                Status = StatusCodes.Status404NotFound,
                Title = "The specified location was not found."
            }),
            InventoryError.InactiveProduct => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The specified product is inactive."
            }),
            InventoryError.InactiveLocation => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The specified location or its warehouse is inactive."
            }),
            InventoryError.IdempotencyConflict => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The idempotency key was already used for a different inventory movement."
            }),
            InventoryError.QuantityLimitExceeded => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The resulting inventory quantity exceeds the supported limit."
            }),
            InventoryError.InsufficientInventory => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Not enough stock at this location. The quantity you entered is more than what is currently available."
            }),
            InventoryError.OrderNotReady => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The order is no longer Ready for dispatch."
            }),
            InventoryError.NotFound => NotFound(),
            InventoryError.None => throw new InvalidOperationException(
                "Successful inventory operations should not be mapped to an error response."),
            _ => throw new InvalidOperationException($"Unhandled inventory error: {error}.")
        };
}
