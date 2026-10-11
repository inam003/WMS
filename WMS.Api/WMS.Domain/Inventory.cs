namespace WMS.Domain;

public class Inventory
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid LocationId { get; set; }
    public decimal Quantity { get; set; }
    public Product Product { get; set; } = null!;
    public Location Location { get; set; } = null!;
}
