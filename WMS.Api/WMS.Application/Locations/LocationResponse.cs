namespace WMS.Application.Locations;

public sealed record LocationResponse(
    Guid Id,
    Guid WarehouseId,
    string Name,
    string Code,
    string Type,
    bool IsActive,
    string? Barcode);
