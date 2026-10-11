using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Warehouses;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/warehouses")]
[Authorize]
public sealed class WarehousesController(IWarehouseService warehouseService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<WarehouseResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<WarehouseResponse>>> GetAll(
        CancellationToken cancellationToken) =>
        Ok(await warehouseService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WarehouseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<WarehouseResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var warehouse = await warehouseService.GetByIdAsync(id, cancellationToken);
        return warehouse is null ? NotFound() : Ok(warehouse);
    }

    [HttpPost]
    [ProducesResponseType(typeof(WarehouseResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<WarehouseResponse>> Create(
        CreateWarehouseRequest request,
        CancellationToken cancellationToken)
    {
        var result = await warehouseService.CreateAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            return ToErrorResponse(result.Error, result.ValidationErrors);
        }

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Value!.Id },
            result.Value);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(WarehouseResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<WarehouseResponse>> Update(
        Guid id,
        UpdateWarehouseRequest request,
        CancellationToken cancellationToken)
    {
        var result = await warehouseService.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await warehouseService.DeleteAsync(id, cancellationToken);
        return result.Succeeded
            ? NoContent()
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    private ActionResult ToErrorResponse(
        WarehouseError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            WarehouseError.Validation =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            WarehouseError.NotFound => NotFound(),
            WarehouseError.DuplicateCode => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "A warehouse with this code already exists."
            }),
            WarehouseError.HasLocations => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The warehouse cannot be deleted while locations reference it."
            }),
            WarehouseError.None => throw new InvalidOperationException(
                "Successful warehouse operations should not be mapped to an error response."),
            _ => throw new InvalidOperationException($"Unhandled warehouse error: {error}.")
        };
}
