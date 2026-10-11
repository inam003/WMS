using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Locations;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/locations")]
[Authorize]
public sealed class LocationsController(ILocationService locationService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<LocationResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<LocationResponse>>> GetAll(
        CancellationToken cancellationToken) =>
        Ok(await locationService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LocationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LocationResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var location = await locationService.GetByIdAsync(id, cancellationToken);
        return location is null ? NotFound() : Ok(location);
    }

    [HttpPost]
    [ProducesResponseType(typeof(LocationResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<LocationResponse>> Create(
        CreateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await locationService.CreateAsync(request, cancellationToken);
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
    [ProducesResponseType(typeof(LocationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<LocationResponse>> Update(
        Guid id,
        UpdateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await locationService.UpdateAsync(id, request, cancellationToken);
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
        var result = await locationService.DeleteAsync(id, cancellationToken);
        return result.Succeeded
            ? NoContent()
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    private ActionResult ToErrorResponse(
        LocationError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            LocationError.Validation =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            LocationError.NotFound => NotFound(),
            LocationError.WarehouseNotFound =>
                NotFound(new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "The specified warehouse does not exist."
                }),
            LocationError.DuplicateCode => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "A location with this code already exists in the selected warehouse."
            }),
            LocationError.HasDependencies => Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "The location cannot be deleted while inventory records or transactions reference it."
            }),
            LocationError.None => throw new InvalidOperationException(
                "Successful location operations should not be mapped to an error response."),
            _ => throw new InvalidOperationException($"Unhandled location error: {error}.")
        };
}
