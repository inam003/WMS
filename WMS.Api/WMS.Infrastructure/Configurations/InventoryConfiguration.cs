using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public class InventoryConfiguration : IEntityTypeConfiguration<Inventory>
{
    public void Configure(EntityTypeBuilder<Inventory> builder)
    {
        builder.HasKey(inventory => inventory.Id);

        builder.Property(inventory => inventory.Quantity)
            .IsRequired()
            .HasPrecision(18, 3);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Inventory_Quantity_NonNegative",
            "\"Quantity\" >= 0"));

        builder.HasIndex(inventory => new { inventory.ProductId, inventory.LocationId })
            .IsUnique();

        builder.HasOne(inventory => inventory.Product)
            .WithMany(product => product.InventoryRecords)
            .HasForeignKey(inventory => inventory.ProductId)
            .IsRequired();

        builder.HasOne(inventory => inventory.Location)
            .WithMany(location => location.InventoryRecords)
            .HasForeignKey(inventory => inventory.LocationId)
            .IsRequired();
    }
}
