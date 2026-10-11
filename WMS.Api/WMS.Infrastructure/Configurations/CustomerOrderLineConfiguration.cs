using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public sealed class CustomerOrderLineConfiguration : IEntityTypeConfiguration<CustomerOrderLine>
{
    public void Configure(EntityTypeBuilder<CustomerOrderLine> builder)
    {
        builder.HasKey(line => line.Id);

        builder.Property(line => line.Quantity)
            .IsRequired()
            .HasPrecision(18, 3);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_CustomerOrderLines_Quantity_Positive",
            "\"Quantity\" > 0"));

        builder.HasIndex(line => line.OrderId);
        builder.HasIndex(line => line.ProductId);
        builder.HasIndex(line => line.DispatchLocationId);

        builder.HasOne(line => line.Product)
            .WithMany()
            .HasForeignKey(line => line.ProductId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();

        builder.HasOne(line => line.DispatchLocation)
            .WithMany()
            .HasForeignKey(line => line.DispatchLocationId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);
    }
}
