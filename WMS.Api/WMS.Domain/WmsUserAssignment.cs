namespace WMS.Domain;

public enum WmsRole
{
    Admin,
    WarehouseManager,
    WarehouseOperator,
    Viewer
}

public sealed class WmsUserAssignment
{
    public string Subject { get; set; } = string.Empty;
    public WmsRole Role { get; set; } = WmsRole.Viewer;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
