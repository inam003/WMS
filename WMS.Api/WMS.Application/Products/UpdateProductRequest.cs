namespace WMS.Application.Products;

public sealed record UpdateProductRequest
{
    public string? SKU { get; init; }
    public string? Name { get; init; }
    public string? Description { get; init; }
    public Guid CategoryId { get; init; }
    public string? Unit { get; init; }
    public decimal MinimumStockLevel { get; init; }
    public string? Barcode { get; init; }
    public bool IsActive { get; init; }
}
