using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public class WarehouseConfiguration : IEntityTypeConfiguration<Warehouse>
{
    public void Configure(EntityTypeBuilder<Warehouse> builder)
    {
        builder.HasKey(warehouse => warehouse.Id);

        builder.Property(warehouse => warehouse.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(warehouse => warehouse.Code)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(warehouse => warehouse.Code)
            .IsUnique();

        builder.Property(warehouse => warehouse.Address)
            .HasMaxLength(500);

        builder.Property(warehouse => warehouse.IsActive)
            .IsRequired();

        builder.HasMany(warehouse => warehouse.Locations)
            .WithOne(location => location.Warehouse)
            .HasForeignKey(location => location.WarehouseId)
            .IsRequired();
    }
}
