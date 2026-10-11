using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public class LocationConfiguration : IEntityTypeConfiguration<Location>
{
    public void Configure(EntityTypeBuilder<Location> builder)
    {
        builder.HasKey(location => location.Id);

        builder.Property(location => location.Name)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(location => location.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(location => new { location.WarehouseId, location.Code })
            .IsUnique();

        builder.Property(location => location.Type)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(location => location.Barcode)
            .HasMaxLength(100);

        builder.HasIndex(location => location.Barcode)
            .IsUnique()
            .HasFilter("\"Barcode\" IS NOT NULL");

        builder.Property(location => location.IsActive)
            .IsRequired();

        builder.HasOne(location => location.Warehouse)
            .WithMany(warehouse => warehouse.Locations)
            .HasForeignKey(location => location.WarehouseId)
            .IsRequired();

        builder.HasMany(location => location.InventoryRecords)
            .WithOne(inventory => inventory.Location)
            .HasForeignKey(inventory => inventory.LocationId)
            .IsRequired();
    }
}
