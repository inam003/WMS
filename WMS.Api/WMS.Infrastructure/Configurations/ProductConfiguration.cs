using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(product => product.Id);

        builder.Property(product => product.SKU)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(product => product.SKU)
            .IsUnique();

        builder.Property(product => product.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(product => product.Description)
            .HasMaxLength(1000);

        builder.Property(product => product.Unit)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(product => product.MinimumStockLevel)
            .IsRequired()
            .HasPrecision(18, 3);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_Product_MinimumStockLevel_NonNegative",
            "\"MinimumStockLevel\" >= 0"));

        builder.Property(product => product.Barcode)
            .HasMaxLength(100);

        builder.HasIndex(product => product.Barcode)
            .IsUnique();

        builder.Property(product => product.IsActive)
            .IsRequired();

        builder.HasOne(product => product.Category)
            .WithMany(category => category.Products)
            .HasForeignKey(product => product.CategoryId)
            .IsRequired();

        builder.HasMany(product => product.InventoryRecords)
            .WithOne(inventory => inventory.Product)
            .HasForeignKey(inventory => inventory.ProductId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();

        builder.HasMany<InventoryTransaction>()
            .WithOne(transaction => transaction.Product)
            .HasForeignKey(transaction => transaction.ProductId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
