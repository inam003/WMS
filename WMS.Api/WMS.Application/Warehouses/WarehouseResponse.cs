namespace WMS.Application.Warehouses;

public sealed record WarehouseResponse(
    Guid Id,
    string Name,
    string Code,
    string? Address,
    bool IsActive);
