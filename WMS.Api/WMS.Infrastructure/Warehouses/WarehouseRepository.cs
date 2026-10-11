using Microsoft.EntityFrameworkCore;
using Npgsql;
using WMS.Application.Warehouses;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Warehouses;

public sealed class WarehouseRepository(ApplicationDbContext dbContext) : IWarehouseRepository
{
    public async Task<IReadOnlyList<Warehouse>> GetAllAsync(
        CancellationToken cancellationToken) =>
        await dbContext.Warehouses
            .AsNoTracking()
            .OrderBy(warehouse => warehouse.Name)
            .ThenBy(warehouse => warehouse.Id)
            .ToListAsync(cancellationToken);

    public Task<Warehouse?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Warehouses
            .AsNoTracking()
            .SingleOrDefaultAsync(warehouse => warehouse.Id == id, cancellationToken);

    public Task<bool> CodeExistsAsync(
        string code,
        Guid? excludingWarehouseId,
        CancellationToken cancellationToken) =>
        dbContext.Warehouses.AnyAsync(
            warehouse => warehouse.Code == code &&
                (!excludingWarehouseId.HasValue ||
                 warehouse.Id != excludingWarehouseId.Value),
            cancellationToken);

    public Task<bool> HasLocationsAsync(
        Guid warehouseId,
        CancellationToken cancellationToken) =>
        dbContext.Locations.AnyAsync(
            location => location.WarehouseId == warehouseId,
            cancellationToken);

    public async Task<WarehousePersistenceError> AddAsync(
        Warehouse warehouse,
        CancellationToken cancellationToken)
    {
        dbContext.Warehouses.Add(warehouse);
        return await SaveChangesAsync(cancellationToken);
    }

    public async Task<WarehousePersistenceError> UpdateAsync(
        Warehouse warehouse,
        CancellationToken cancellationToken)
    {
        var existing = await dbContext.Warehouses
            .SingleAsync(candidate => candidate.Id == warehouse.Id, cancellationToken);
        dbContext.Entry(existing).CurrentValues.SetValues(warehouse);
        return await SaveChangesAsync(cancellationToken);
    }

    public async Task<WarehousePersistenceError> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var warehouse = await dbContext.Warehouses
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (warehouse is null)
        {
            return WarehousePersistenceError.NotFound;
        }

        dbContext.Warehouses.Remove(warehouse);
        return await SaveChangesAsync(cancellationToken);
    }

    private async Task<WarehousePersistenceError> SaveChangesAsync(
        CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return WarehousePersistenceError.None;
        }
        catch (DbUpdateException exception)
        {
            var postgresException = exception.GetBaseException() as PostgresException;
            var persistenceError = postgresException switch
            {
                { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_Warehouses_Code" } =>
                    WarehousePersistenceError.DuplicateCode,
                {
                    SqlState: PostgresErrorCodes.ForeignKeyViolation,
                    ConstraintName: "FK_Locations_Warehouses_WarehouseId"
                } => WarehousePersistenceError.HasLocations,
                _ => WarehousePersistenceError.None
            };

            if (persistenceError == WarehousePersistenceError.None)
            {
                throw;
            }

            return persistenceError;
        }
    }
}
