using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Products;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/products")]
[Authorize]
public sealed class ProductsController(IProductService productService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ProductResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> GetAll(
        CancellationToken cancellationToken) =>
        Ok(await productService.GetAllAsync(cancellationToken));

    [HttpGet("barcode/{barcode}")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> GetByBarcode(
        string barcode,
        CancellationToken cancellationToken)
    {
        var product = await productService.GetByBarcodeAsync(barcode, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductResponse>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var product = await productService.GetByIdAsync(id, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpPost]
    [Authorize(Policy = "WmsMasterWrite")]
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductResponse>> Create(
        CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var result = await productService.CreateAsync(request, cancellationToken);
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
    [ProducesResponseType(typeof(ProductResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductResponse>> Update(
        Guid id,
        UpdateProductRequest request,
        CancellationToken cancellationToken)
    {
        var result = await productService.UpdateAsync(id, request, cancellationToken);
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
        var result = await productService.DeleteAsync(id, cancellationToken);
        return result.Succeeded
            ? NoContent()
            : ToErrorResponse(result.Error, result.ValidationErrors);
    }

    private ActionResult ToErrorResponse(
        ProductError error,
        IReadOnlyDictionary<string, string[]>? validationErrors)
    {
        return error switch
        {
            ProductError.Validation =>
                BadRequest(new ValidationProblemDetails(
                    validationErrors!.ToDictionary(error => error.Key, error => error.Value))),
            ProductError.NotFound => NotFound(),
            ProductError.CategoryNotFound =>
                Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "The specified category does not exist."
                }),
            ProductError.DuplicateSku =>
                Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "A product with this SKU already exists."
                }),
            ProductError.DuplicateBarcode =>
                Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "A product with this barcode already exists."
                }),
            ProductError.HasDependencies =>
                Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "The product cannot be deleted while inventory records or transactions reference it."
                }),
            _ => throw new InvalidOperationException($"Unhandled product error: {error}.")
        };
    }
}
