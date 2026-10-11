namespace WMS.Domain;

public class Location
{
    public Guid Id { get; set; }
    public Guid WarehouseId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public bool IsActive { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public ICollection<Inventory> InventoryRecords { get; set; } = new List<Inventory>();
}
