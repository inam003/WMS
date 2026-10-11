namespace WMS.Domain;

public class InventoryTransaction
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid LocationId { get; set; }
    public decimal Quantity { get; set; }
    public string Type { get; set; } = string.Empty;
    public Guid? ReferenceId { get; set; }
    public Guid? IdempotencyKey { get; set; }
    public InventoryAdjustmentReason? AdjustmentReason { get; set; }
    public string? AdjustmentExplanation { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public Product Product { get; set; } = null!;
    public Location Location { get; set; } = null!;
}
