using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public sealed class WmsUserAssignmentConfiguration :
    IEntityTypeConfiguration<WmsUserAssignment>
{
    public void Configure(EntityTypeBuilder<WmsUserAssignment> builder)
    {
        builder.HasKey(user => user.Subject);
        builder.Property(user => user.Subject)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(user => user.Role)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();
        builder.Property(user => user.IsActive)
            .IsRequired()
            .HasDefaultValue(true);
        builder.Property(user => user.CreatedAt)
            .IsRequired()
            .HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.Property(user => user.UpdatedAt)
            .IsRequired()
            .HasDefaultValueSql("CURRENT_TIMESTAMP");
        builder.ToTable(table => table.HasCheckConstraint(
            "CK_WmsUserAssignments_Role",
            "\"Role\" IN ('Admin', 'WarehouseManager', 'WarehouseOperator', 'Viewer')"));
    }
}
