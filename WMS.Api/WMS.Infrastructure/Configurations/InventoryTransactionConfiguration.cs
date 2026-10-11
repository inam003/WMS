using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> builder)
    {
        builder.HasKey(transaction => transaction.Id);

        builder.Property(transaction => transaction.Quantity)
            .IsRequired()
            .HasPrecision(18, 3);

        builder.ToTable(table => table.HasCheckConstraint(
            "CK_InventoryTransaction_Quantity_NonNegative",
            "\"Quantity\" >= 0"));

        builder.Property(transaction => transaction.Type)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(transaction => transaction.ReferenceId)
            .IsRequired(false);

        builder.Property(transaction => transaction.IdempotencyKey)
            .IsRequired(false);

        builder.Property(transaction => transaction.TransferId)
            .IsRequired(false);

        builder.Property(transaction => transaction.OrderId)
            .IsRequired(false);

        builder.Property(transaction => transaction.OrderLineId)
            .IsRequired(false);

        builder.HasIndex(transaction => transaction.OrderId);
        builder.HasIndex(transaction => transaction.OrderLineId);

        builder.Property(transaction => transaction.AdjustmentReason)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired(false);

        builder.Property(transaction => transaction.AdjustmentExplanation)
            .HasMaxLength(500)
            .IsRequired(false);

        builder.Property(transaction => transaction.CreatedBy)
            .IsRequired()
            .HasMaxLength(200);

        builder.HasIndex(transaction => new
            {
                transaction.CreatedBy,
                transaction.IdempotencyKey
            })
            .IsUnique()
            .HasDatabaseName("IX_InventoryTransactions_CreatedBy_IdempotencyKey");

        builder.Property(transaction => transaction.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.HasOne(transaction => transaction.Product)
            .WithMany()
            .HasForeignKey(transaction => transaction.ProductId)
            .IsRequired();

        builder.HasOne(transaction => transaction.Location)
            .WithMany()
            .HasForeignKey(transaction => transaction.LocationId)
            .IsRequired();

        builder.HasOne<CustomerOrder>()
            .WithMany()
            .HasForeignKey(transaction => transaction.OrderId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        builder.HasOne<CustomerOrderLine>()
            .WithMany()
            .HasForeignKey(transaction => transaction.OrderLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);
    }
}
