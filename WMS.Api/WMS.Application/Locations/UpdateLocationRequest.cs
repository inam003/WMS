namespace WMS.Application.Locations;

public sealed record UpdateLocationRequest
{
    public Guid WarehouseId { get; init; }
    public string? Name { get; init; }
    public string? Code { get; init; }
    public string? Type { get; init; }
    public string? Barcode { get; init; }
    public bool IsActive { get; init; }
}
