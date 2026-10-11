using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public sealed class CustomerOrderConfiguration : IEntityTypeConfiguration<CustomerOrder>
{
    public void Configure(EntityTypeBuilder<CustomerOrder> builder)
    {
        builder.HasKey(order => order.Id);

        builder.Property(order => order.OrderNumber)
            .IsRequired()
            .HasMaxLength(40);

        builder.HasIndex(order => order.OrderNumber).IsUnique();

        builder.Property(order => order.CustomerName)
            .HasMaxLength(200)
            .IsRequired(false);

        builder.Property(order => order.ReferenceId).IsRequired(false);

        builder.Property(order => order.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(order => order.CreatedBy)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(order => order.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        builder.Property(order => order.DispatchedBy)
            .HasMaxLength(200)
            .IsRequired(false);

        builder.Property(order => order.DispatchedAt).IsRequired(false);
        builder.Property(order => order.DispatchIdempotencyKey).IsRequired(false);

        builder.HasMany(order => order.Lines)
            .WithOne(line => line.Order)
            .HasForeignKey(line => line.OrderId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
