using WMS.Domain;

namespace WMS.Application.Locations;

public sealed class LocationService(ILocationRepository repository) : ILocationService
{
    public async Task<IReadOnlyList<LocationResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var locations = await repository.GetAllAsync(cancellationToken);
        return locations.Select(ToResponse).ToArray();
    }

    public async Task<LocationResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var location = await repository.GetByIdAsync(id, cancellationToken);
        return location is null ? null : ToResponse(location);
    }

    public async Task<LocationOperationResult<LocationResponse>> CreateAsync(
        CreateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(
            request.WarehouseId,
            request.Name,
            request.Code,
            request.Type);
        if (errors.Count > 0)
        {
            return LocationOperationResult<LocationResponse>.Invalid(errors);
        }

        if (!await repository.WarehouseExistsAsync(request.WarehouseId, cancellationToken))
        {
            return LocationOperationResult<LocationResponse>.Failure(
                LocationError.WarehouseNotFound);
        }

        var code = request.Code!.Trim();
        if (await repository.CodeExistsAsync(
                request.WarehouseId,
                code,
                null,
                cancellationToken))
        {
            return LocationOperationResult<LocationResponse>.Failure(
                LocationError.DuplicateCode);
        }

        var location = new Location
        {
            Id = Guid.NewGuid(),
            WarehouseId = request.WarehouseId,
            Name = request.Name!.Trim(),
            Code = code,
            Type = request.Type!.Trim(),
            IsActive = request.IsActive
        };

        var persistenceError = await repository.AddAsync(location, cancellationToken);
        if (persistenceError != LocationPersistenceError.None)
        {
            return LocationOperationResult<LocationResponse>.Failure(
                MapError(persistenceError));
        }

        return LocationOperationResult<LocationResponse>.Success(ToResponse(location));
    }

    public async Task<LocationOperationResult<LocationResponse>> UpdateAsync(
        Guid id,
        UpdateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var location = await repository.GetByIdAsync(id, cancellationToken);
        if (location is null)
        {
            return LocationOperationResult<LocationResponse>.Failure(LocationError.NotFound);
        }

        var errors = Validate(
            request.WarehouseId,
            request.Name,
            request.Code,
            request.Type);
        if (errors.Count > 0)
        {
            return LocationOperationResult<LocationResponse>.Invalid(errors);
        }

        if (!await repository.WarehouseExistsAsync(request.WarehouseId, cancellationToken))
        {
            return LocationOperationResult<LocationResponse>.Failure(
                LocationError.WarehouseNotFound);
        }

        var code = request.Code!.Trim();
        if (await repository.CodeExistsAsync(
                request.WarehouseId,
                code,
                id,
                cancellationToken))
        {
            return LocationOperationResult<LocationResponse>.Failure(
                LocationError.DuplicateCode);
        }

        location.WarehouseId = request.WarehouseId;
        location.Name = request.Name!.Trim();
        location.Code = code;
        location.Type = request.Type!.Trim();
        location.IsActive = request.IsActive;

        var persistenceError = await repository.UpdateAsync(location, cancellationToken);
        if (persistenceError != LocationPersistenceError.None)
        {
            return LocationOperationResult<LocationResponse>.Failure(
                MapError(persistenceError));
        }

        return LocationOperationResult<LocationResponse>.Success(ToResponse(location));
    }

    public async Task<LocationOperationResult<bool>> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (await repository.GetByIdAsync(id, cancellationToken) is null)
        {
            return LocationOperationResult<bool>.Failure(LocationError.NotFound);
        }

        if (await repository.HasDependenciesAsync(id, cancellationToken))
        {
            return LocationOperationResult<bool>.Failure(LocationError.HasDependencies);
        }

        var persistenceError = await repository.DeleteAsync(id, cancellationToken);
        if (persistenceError != LocationPersistenceError.None)
        {
            return LocationOperationResult<bool>.Failure(MapError(persistenceError));
        }

        return LocationOperationResult<bool>.Success(true);
    }

    private static Dictionary<string, string[]> Validate(
        Guid warehouseId,
        string? name,
        string? code,
        string? type)
    {
        var errors = new Dictionary<string, string[]>();
        if (warehouseId == Guid.Empty)
        {
            errors[nameof(Location.WarehouseId)] = ["WarehouseId is required."];
        }

        AddRequiredStringError(errors, nameof(Location.Name), name, 100);
        AddRequiredStringError(errors, nameof(Location.Code), code, 50);
        AddRequiredStringError(errors, nameof(Location.Type), type, 50);
        return errors;
    }

    private static void AddRequiredStringError(
        IDictionary<string, string[]> errors,
        string field,
        string? value,
        int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[field] = [$"{field} is required."];
        }
        else if (value.Trim().Length > maximumLength)
        {
            errors[field] = [$"{field} must be {maximumLength} characters or fewer."];
        }
    }

    private static LocationError MapError(LocationPersistenceError error) =>
        error switch
        {
            LocationPersistenceError.NotFound => LocationError.NotFound,
            LocationPersistenceError.WarehouseNotFound => LocationError.WarehouseNotFound,
            LocationPersistenceError.DuplicateCode => LocationError.DuplicateCode,
            LocationPersistenceError.HasDependencies => LocationError.HasDependencies,
            _ => LocationError.None
        };

    private static LocationResponse ToResponse(Location location) =>
        new(
            location.Id,
            location.WarehouseId,
            location.Name,
            location.Code,
            location.Type,
            location.IsActive);
}
