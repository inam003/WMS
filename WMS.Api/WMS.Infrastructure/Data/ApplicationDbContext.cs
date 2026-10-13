using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using WMS.Domain;
using WMS.Application.Audit;

namespace WMS.Infrastructure.Data
{
    public class ApplicationDbContext: DbContext
    {
        private readonly ICurrentAuditActor currentAuditActor;

        public DbSet<Category> Categories => Set<Category>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Warehouse> Warehouses => Set<Warehouse>();
        public DbSet<Location> Locations => Set<Location>();
        public DbSet<Inventory> Inventory => Set<Inventory>();
        public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
        public DbSet<CustomerOrder> Orders => Set<CustomerOrder>();
        public DbSet<CustomerOrderLine> OrderLines => Set<CustomerOrderLine>();
        public DbSet<WmsUserAssignment> WmsUserAssignments => Set<WmsUserAssignment>();
        public DbSet<WmsInvitation> WmsInvitations => Set<WmsInvitation>();
        public DbSet<AuditRecord> AuditRecords => Set<AuditRecord>();

        public ApplicationDbContext(
            DbContextOptions<ApplicationDbContext> options,
            ICurrentAuditActor currentAuditActor) : base(options)
        { 
            this.currentAuditActor = currentAuditActor;
        }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            var auditRecords = AddAuditRecords();
            try
            {
                return base.SaveChanges(acceptAllChangesOnSuccess);
            }
            catch
            {
                DetachAuditRecords(auditRecords);
                throw;
            }
        }

        public override async Task<int> SaveChangesAsync(
            bool acceptAllChangesOnSuccess,
            CancellationToken cancellationToken = default)
        {
            var auditRecords = AddAuditRecords();
            try
            {
                return await base.SaveChangesAsync(
                    acceptAllChangesOnSuccess, cancellationToken);
            }
            catch
            {
                DetachAuditRecords(auditRecords);
                throw;
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        }

        private List<AuditRecord> AddAuditRecords()
        {
            ChangeTracker.DetectChanges();
            var entries = ChangeTracker.Entries()
                .Where(entry =>
                    entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
                .Where(entry => entry.Entity is Category or Product or Warehouse or Location or
                    CustomerOrder or CustomerOrderLine or InventoryTransaction or WmsUserAssignment or WmsInvitation)
                .ToArray();
            if (entries.Length == 0)
            {
                return [];
            }

            var actor = currentAuditActor.Subject;
            if (string.IsNullOrWhiteSpace(actor) &&
                entries.All(entry => entry.Entity is WmsInvitation))
            {
                actor = "system:invitation-claim";
            }

            if (string.IsNullOrWhiteSpace(actor))
            {
                throw new InvalidOperationException(
                    "Audited WMS changes require the authenticated subject claim.");
            }

            var createdAt = DateTimeOffset.UtcNow;
            var records = new List<AuditRecord>();
            var transactionEntries = entries
                .Where(entry => entry.Entity is InventoryTransaction transaction &&
                    !transaction.OrderId.HasValue)
                .ToArray();
            foreach (var group in transactionEntries.GroupBy(GetMovementGroupKey))
            {
                var transactions = group
                    .Select(entry => (InventoryTransaction)entry.Entity)
                    .ToArray();
                var first = transactions[0];
                var (action, entityType, entityId) = first.TransferId.HasValue
                    ? ("Inventory.Transfer", "Transfer", first.TransferId.Value.ToString())
                    : first.Type switch
                        {
                            "Receipt" => ("Inventory.Received", "InventoryTransaction", first.Id.ToString()),
                            "AdjustmentIncrease" or "AdjustmentDecrease" =>
                                ($"Inventory.{first.Type}", "InventoryTransaction", first.Id.ToString()),
                            _ => ($"Inventory.{first.Type}", "InventoryTransaction", first.Id.ToString())
                        };
                records.Add(new AuditRecord
                {
                    Id = Guid.NewGuid(),
                    ActorSubject = actor,
                    ActionType = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    CreatedAt = createdAt,
                    ReferenceId = first.ReferenceId,
                    CorrelationId = first.IdempotencyKey,
                    AfterValues = JsonSerializer.Serialize(new
                    {
                        transactions = transactions.Select(transaction => new
                        {
                            transaction.Id,
                            transaction.ProductId,
                            transaction.LocationId,
                            transaction.Quantity,
                            transaction.Type,
                            transaction.AdjustmentReason,
                            transaction.AdjustmentExplanation,
                            transaction.ReferenceId
                        })
                    })
                });
            }

            foreach (var entry in entries.Where(entry => entry.Entity is not InventoryTransaction))
            {
                var entityName = GetEntityName(entry.Entity);
                var id = GetEntityId(entry);
                var action = entry.Entity switch
                {
                    CustomerOrder when entry.State == EntityState.Added => "Order.Created",
                    CustomerOrder when entry.State == EntityState.Modified &&
                        entry.Property(nameof(CustomerOrder.Status)).IsModified =>
                        ((CustomerOrderStatus)entry.Property(
                            nameof(CustomerOrder.Status)).CurrentValue!) switch
                        {
                            CustomerOrderStatus.Ready => "Order.Ready",
                            CustomerOrderStatus.Cancelled => "Order.Cancelled",
                            CustomerOrderStatus.Dispatched => "Order.Dispatched",
                            _ => "Order.StatusChanged"
                        },
                    CustomerOrder when entry.State == EntityState.Modified => "Order.Updated",
                    WmsUserAssignment user when entry.State == EntityState.Modified &&
                        entry.Property(nameof(WmsUserAssignment.Role)).IsModified &&
                        entry.Property(nameof(WmsUserAssignment.IsActive)).IsModified =>
                        "User.RoleAndAccessChanged",
                    WmsUserAssignment user when entry.State == EntityState.Modified &&
                        entry.Property(nameof(WmsUserAssignment.Role)).IsModified =>
                        "User.RoleChanged",
                    WmsUserAssignment when entry.State == EntityState.Modified =>
                        "User.AccessChanged",
                    WmsInvitation invitation when entry.State == EntityState.Added =>
                        "Invitation.Created",
                    WmsInvitation invitation when entry.State == EntityState.Modified &&
                        entry.Property(nameof(WmsInvitation.Status)).IsModified =>
                        $"Invitation.{invitation.Status}",
                    _ => $"{entityName}.{entry.State switch
                    {
                        EntityState.Added => "Created",
                        EntityState.Modified => "Updated",
                        EntityState.Deleted => "Deleted",
                        _ => "Changed"
                    }}"
                };

                var before = entry.State is EntityState.Modified or EntityState.Deleted
                    ? GetValues(entry, useOriginalValues: true)
                    : null;
                var after = entry.State is EntityState.Added or EntityState.Modified
                    ? GetValues(entry, useOriginalValues: false)
                    : null;
                records.Add(new AuditRecord
                {
                    Id = Guid.NewGuid(),
                    ActorSubject = actor,
                    ActionType = action,
                    EntityType = entityName,
                    EntityId = id,
                    CreatedAt = createdAt,
                    ReferenceId = entry.Entity is CustomerOrder order
                        ? order.ReferenceId
                        : null,
                    CorrelationId = entry.Entity is CustomerOrder trackedOrder
                        ? trackedOrder.DispatchIdempotencyKey
                        : null,
                    BeforeValues = before is null ? null : JsonSerializer.Serialize(before),
                    AfterValues = after is null ? null : JsonSerializer.Serialize(after)
                });
            }

            AuditRecords.AddRange(records);
            return records;
        }

        private void DetachAuditRecords(IEnumerable<AuditRecord> records)
        {
            foreach (var record in records)
            {
                Entry(record).State = EntityState.Detached;
            }
        }

        private static string GetMovementGroupKey(EntityEntry entry)
        {
            var transaction = (InventoryTransaction)entry.Entity;
            if (transaction.TransferId.HasValue) return $"transfer:{transaction.TransferId}";
            if (transaction.OrderId.HasValue) return $"order:{transaction.OrderId}";
            return $"movement:{transaction.Id}";
        }

        private static string GetEntityName(object entity) => entity switch
        {
            CustomerOrderLine => "OrderLine",
            WmsUserAssignment => "User",
            WmsInvitation => "Invitation",
            _ => entity.GetType().Name
        };

        private static string GetEntityId(EntityEntry entry) => entry.Entity switch
        {
            WmsUserAssignment user => user.Subject,
            WmsInvitation invitation => invitation.Id.ToString(),
            CustomerOrderLine line => line.Id.ToString(),
            _ => Convert.ToString(
                entry.Property("Id").CurrentValue,
                System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty
        };

        private static Dictionary<string, object?> GetValues(
            EntityEntry entry,
            bool useOriginalValues) =>
            entry.Properties
                .Where(property => !property.Metadata.IsShadowProperty())
                .Where(property => entry.Entity is not WmsInvitation ||
                    property.Metadata.Name != nameof(WmsInvitation.TokenHash))
                .ToDictionary(
                    property => property.Metadata.Name,
                    property => useOriginalValues
                        ? property.OriginalValue
                        : property.CurrentValue);
    }
}
