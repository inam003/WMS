using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WMS.Domain;

namespace WMS.Infrastructure.Configurations;

public sealed class AuditRecordConfiguration : IEntityTypeConfiguration<AuditRecord>
{
    public void Configure(EntityTypeBuilder<AuditRecord> builder)
    {
        builder.HasKey(record => record.Id);
        builder.Property(record => record.ActorSubject)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(record => record.ActionType)
            .HasMaxLength(100)
            .IsRequired();
        builder.Property(record => record.EntityType)
            .HasMaxLength(100)
            .IsRequired();
        builder.Property(record => record.EntityId)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(record => record.CreatedAt)
            .IsRequired();
        builder.Property(record => record.BeforeValues).HasColumnType("jsonb");
        builder.Property(record => record.AfterValues).HasColumnType("jsonb");
        builder.HasIndex(record => record.CreatedAt)
            .HasDatabaseName("IX_AuditRecords_CreatedAt");
        builder.HasIndex(record => new { record.ActorSubject, record.CreatedAt });
        builder.HasIndex(record => new { record.ActionType, record.CreatedAt });
        builder.HasIndex(record => new { record.EntityType, record.CreatedAt });
        builder.HasIndex(record => record.ReferenceId);
        builder.HasIndex(record => record.CorrelationId);
    }
}
