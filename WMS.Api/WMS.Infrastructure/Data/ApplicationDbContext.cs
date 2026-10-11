using Microsoft.EntityFrameworkCore;
using WMS.Domain;

namespace WMS.Infrastructure.Data
{
    public class ApplicationDbContext: DbContext
    {
        public DbSet<Category> Categories => Set<Category>();
        public DbSet<Product> Products => Set<Product>();
        public DbSet<Warehouse> Warehouses => Set<Warehouse>();
        public DbSet<Location> Locations => Set<Location>();
        public DbSet<Inventory> Inventory => Set<Inventory>();
        public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
        public DbSet<CustomerOrder> Orders => Set<CustomerOrder>();
        public DbSet<CustomerOrderLine> OrderLines => Set<CustomerOrderLine>();
        public DbSet<WmsUserAssignment> WmsUserAssignments => Set<WmsUserAssignment>();

        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) 
        { 
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        }
    }
}
