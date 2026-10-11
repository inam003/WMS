using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Inventory;

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

    private ActionResult ToErrorResponse(
        InventoryError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            InventoryError.InvalidFilter =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            InventoryError.FilterNotFound =>
                NotFound(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "One or more filter identifiers were not found."
                }),
            InventoryError.NotFound => NotFound(),
            InventoryError.None => throw new InvalidOperationException(
                "Successful inventory queries should not be mapped to an error response."),
            _ => throw new InvalidOperationException($"Unhandled inventory error: {error}.")
        };
}
