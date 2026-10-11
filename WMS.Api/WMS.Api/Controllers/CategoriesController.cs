using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Categories;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/categories")]
[Authorize]
public sealed class CategoriesController(ICategoryService categoryService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryResponse>>> GetAll(
        CancellationToken cancellationToken) =>
        Ok(await categoryService.GetAllAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(CategoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var category = await categoryService.GetByIdAsync(id, cancellationToken);
        return category is null ? NotFound() : Ok(category);
    }

    [HttpPost]
    [Authorize(Policy = "WmsMasterWrite")]
    [ProducesResponseType(typeof(CategoryResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CategoryResponse>> Create(
        CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.CreateAsync(request, cancellationToken);
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
    [Authorize(Policy = "WmsMasterWrite")]
    [ProducesResponseType(typeof(CategoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryResponse>> Update(
        Guid id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var result = await categoryService.UpdateAsync(id, request, cancellationToken);
        return result.Succeeded
            ? Ok(result.Value)
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "WmsMasterWrite")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await categoryService.DeleteAsync(id, cancellationToken);
        return result.Succeeded
            ? NoContent()
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    private ActionResult ToErrorResponse(
        CategoryError error,
        IReadOnlyDictionary<string, string[]>? validationErrors) =>
        error switch
        {
            CategoryError.Validation =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            CategoryError.NotFound => NotFound(),
            CategoryError.HasProducts =>
                Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "The category cannot be deleted while products reference it."
                }),
            CategoryError.None => throw new InvalidOperationException(
                "Successful category operations should not be mapped to an error response."),
            _ => throw new InvalidOperationException($"Unhandled category error: {error}.")
        };
}
