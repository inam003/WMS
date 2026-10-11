namespace WMS.Domain;

public class Product
{
    public Guid Id { get; set; }
    public string SKU { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid CategoryId { get; set; }
    public string Unit { get; set; } = string.Empty;
    public decimal MinimumStockLevel { get; set; }
    public string? Barcode { get; set; }
    public bool IsActive { get; set; }
    public Category Category { get; set; } = null!;
    public ICollection<Inventory> InventoryRecords { get; set; } = new List<Inventory>();
}
