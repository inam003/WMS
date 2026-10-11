namespace WMS.Application.Warehouses;

public sealed record UpdateWarehouseRequest
{
    public string? Name { get; init; }
    public string? Code { get; init; }
    public string? Address { get; init; }
    public bool IsActive { get; init; }
}
