using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.InventoryTransactions;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/inventory-transactions")]
[Authorize]
public sealed class InventoryTransactionsController(
    IInventoryTransactionService transactionService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(
        typeof(IReadOnlyList<InventoryTransactionResponse>),
        StatusCodes.Status200OK)]
    [ProducesResponseType(
        typeof(ValidationProblemDetails),
        StatusCodes.Status400BadRequest)]
    [ProducesResponseType(
        typeof(ValidationProblemDetails),
        StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<InventoryTransactionResponse>>> GetAll(
        [FromQuery] Guid? productId,
        [FromQuery] Guid? locationId,
        [FromQuery] Guid? warehouseId,
        [FromQuery] string? type,
        [FromQuery] DateTimeOffset? createdFrom,
        [FromQuery] DateTimeOffset? createdTo,
        CancellationToken cancellationToken)
    {
        var result = await transactionService.GetAllAsync(
            new InventoryTransactionQuery(
                productId,
                locationId,
                warehouseId,
                type,
                createdFrom,
                createdTo),
            cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(InventoryTransactionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InventoryTransactionResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await transactionService.GetByIdAsync(id, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    private ActionResult ToErrorResponse(
        InventoryTransactionError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            InventoryTransactionError.Validation =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            InventoryTransactionError.FilterNotFound =>
                NotFound(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "One or more filter identifiers were not found."
                }),
            InventoryTransactionError.NotFound => NotFound(),
            InventoryTransactionError.None => throw new InvalidOperationException(
                "Successful transaction queries should not be mapped to an error response."),
            _ => throw new InvalidOperationException(
                $"Unhandled inventory transaction error: {error}.")
        };
}
