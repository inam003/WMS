namespace WMS.Domain;

public class CustomerOrderLine
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
    public Guid? DispatchLocationId { get; set; }
    public CustomerOrder Order { get; set; } = null!;
    public Product Product { get; set; } = null!;
    public Location? DispatchLocation { get; set; }
}
