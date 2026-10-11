using Microsoft.EntityFrameworkCore;
using Npgsql;
using WMS.Application.Locations;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Locations;

public sealed class LocationRepository(ApplicationDbContext dbContext) : ILocationRepository
{
    public async Task<IReadOnlyList<Location>> GetAllAsync(
        CancellationToken cancellationToken) =>
        await dbContext.Locations
            .AsNoTracking()
            .OrderBy(location => location.Name)
            .ThenBy(location => location.Id)
            .ToListAsync(cancellationToken);

    public Task<Location?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Locations
            .AsNoTracking()
            .SingleOrDefaultAsync(location => location.Id == id, cancellationToken);

    public Task<bool> WarehouseExistsAsync(
        Guid warehouseId,
        CancellationToken cancellationToken) =>
        dbContext.Warehouses.AnyAsync(
            warehouse => warehouse.Id == warehouseId,
            cancellationToken);

    public Task<bool> CodeExistsAsync(
        Guid warehouseId,
        string code,
        Guid? excludingLocationId,
        CancellationToken cancellationToken) =>
        dbContext.Locations.AnyAsync(
            location => location.WarehouseId == warehouseId &&
                location.Code == code &&
                (!excludingLocationId.HasValue ||
                 location.Id != excludingLocationId.Value),
            cancellationToken);

    public async Task<bool> HasDependenciesAsync(
        Guid locationId,
        CancellationToken cancellationToken) =>
        await dbContext.Inventory.AnyAsync(
            inventory => inventory.LocationId == locationId,
            cancellationToken) ||
        await dbContext.InventoryTransactions.AnyAsync(
            transaction => transaction.LocationId == locationId,
            cancellationToken);

    public async Task<LocationPersistenceError> AddAsync(
        Location location,
        CancellationToken cancellationToken)
    {
        dbContext.Locations.Add(location);
        return await SaveChangesAsync(cancellationToken);
    }

    public async Task<LocationPersistenceError> UpdateAsync(
        Location location,
        CancellationToken cancellationToken)
    {
        dbContext.Locations.Update(location);
        return await SaveChangesAsync(cancellationToken);
    }

    public async Task<LocationPersistenceError> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var location = await dbContext.Locations
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (location is null)
        {
            return LocationPersistenceError.NotFound;
        }

        dbContext.Locations.Remove(location);
        return await SaveChangesAsync(cancellationToken);
    }

    private async Task<LocationPersistenceError> SaveChangesAsync(
        CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return LocationPersistenceError.None;
        }
        catch (DbUpdateException exception)
        {
            var postgresException = exception.GetBaseException() as PostgresException;
            var persistenceError = postgresException switch
            {
                {
                    SqlState: PostgresErrorCodes.UniqueViolation,
                    ConstraintName: "IX_Locations_WarehouseId_Code"
                } => LocationPersistenceError.DuplicateCode,
                {
                    SqlState: PostgresErrorCodes.ForeignKeyViolation,
                    ConstraintName: "FK_Locations_Warehouses_WarehouseId"
                } => LocationPersistenceError.WarehouseNotFound,
                {
                    SqlState: PostgresErrorCodes.ForeignKeyViolation,
                    ConstraintName: "FK_Inventory_Locations_LocationId" or
                        "FK_InventoryTransactions_Locations_LocationId"
                } => LocationPersistenceError.HasDependencies,
                _ => LocationPersistenceError.None
            };

            if (persistenceError == LocationPersistenceError.None)
            {
                throw;
            }

            return persistenceError;
        }
    }
}
