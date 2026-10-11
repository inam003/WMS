namespace WMS.Domain;

public class Warehouse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Address { get; set; }
    public bool IsActive { get; set; }
    public ICollection<Location> Locations { get; set; } = new List<Location>();
}
