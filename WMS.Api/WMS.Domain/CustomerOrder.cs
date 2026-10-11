namespace WMS.Domain;

public class CustomerOrder
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public Guid? ReferenceId { get; set; }
    public CustomerOrderStatus Status { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public string? DispatchedBy { get; set; }
    public DateTimeOffset? DispatchedAt { get; set; }
    public Guid? DispatchIdempotencyKey { get; set; }
    public ICollection<CustomerOrderLine> Lines { get; set; } = new List<CustomerOrderLine>();
}
