using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public sealed class WmsInvitationConfiguration : IEntityTypeConfiguration<WmsInvitation>
{
    public void Configure(EntityTypeBuilder<WmsInvitation> builder)
    {
        builder.HasKey(invitation => invitation.Id);

        builder.Property(invitation => invitation.Email)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(invitation => invitation.NormalizedEmail)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(invitation => invitation.TokenHash)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(invitation => invitation.Role)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(invitation => invitation.Status)
            .HasConversion<string>()
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(invitation => invitation.InviterSubject)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(invitation => invitation.AcceptedSubject)
            .HasMaxLength(255);

        builder.Property(invitation => invitation.CreatedAt)
            .IsRequired();

        builder.Property(invitation => invitation.ExpiresAt)
            .IsRequired();

        builder.HasIndex(invitation => invitation.TokenHash)
            .IsUnique();

        builder.HasIndex(invitation => invitation.NormalizedEmail)
            .IsUnique()
            .HasDatabaseName("IX_WmsInvitations_OnePendingPerEmail")
            .HasFilter("\"Status\" = 'Pending'");

        builder.ToTable(table =>
        {
            table.HasCheckConstraint(
                "CK_WmsInvitations_Role",
                "\"Role\" IN ('WarehouseManager', 'WarehouseOperator', 'Viewer')");
            table.HasCheckConstraint(
                "CK_WmsInvitations_Status",
                "\"Status\" IN ('Pending', 'Accepted', 'Expired', 'Revoked')");
        });
    }
}
