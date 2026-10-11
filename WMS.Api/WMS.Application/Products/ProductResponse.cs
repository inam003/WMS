namespace WMS.Application.Products;

public sealed record ProductResponse(
    Guid Id,
    string SKU,
    string Name,
    string? Description,
    Guid CategoryId,
    string Unit,
    decimal MinimumStockLevel,
    string? Barcode,
    bool IsActive);
