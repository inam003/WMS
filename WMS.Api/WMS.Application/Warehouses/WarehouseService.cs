using WMS.Domain;

namespace WMS.Application.Warehouses;

public sealed class WarehouseService(IWarehouseRepository repository) : IWarehouseService
{
    public async Task<IReadOnlyList<WarehouseResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var warehouses = await repository.GetAllAsync(cancellationToken);
        return warehouses.Select(ToResponse).ToArray();
    }

    public async Task<WarehouseResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var warehouse = await repository.GetByIdAsync(id, cancellationToken);
        return warehouse is null ? null : ToResponse(warehouse);
    }

    public async Task<WarehouseOperationResult<WarehouseResponse>> CreateAsync(
        CreateWarehouseRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request.Name, request.Code, request.Address);
        if (errors.Count > 0)
        {
            return WarehouseOperationResult<WarehouseResponse>.Invalid(errors);
        }

        var code = request.Code!.Trim();
        if (await repository.CodeExistsAsync(code, null, cancellationToken))
        {
            return WarehouseOperationResult<WarehouseResponse>.Failure(
                WarehouseError.DuplicateCode);
        }

        var warehouse = new Warehouse
        {
            Id = Guid.NewGuid(),
            Name = request.Name!.Trim(),
            Code = code,
            Address = NormalizeOptional(request.Address),
            IsActive = request.IsActive
        };

        var persistenceError = await repository.AddAsync(warehouse, cancellationToken);
        if (persistenceError != WarehousePersistenceError.None)
        {
            return WarehouseOperationResult<WarehouseResponse>.Failure(
                MapError(persistenceError));
        }

        return WarehouseOperationResult<WarehouseResponse>.Success(ToResponse(warehouse));
    }

    public async Task<WarehouseOperationResult<WarehouseResponse>> UpdateAsync(
        Guid id,
        UpdateWarehouseRequest request,
        CancellationToken cancellationToken)
    {
        var warehouse = await repository.GetByIdAsync(id, cancellationToken);
        if (warehouse is null)
        {
            return WarehouseOperationResult<WarehouseResponse>.Failure(
                WarehouseError.NotFound);
        }

        var errors = Validate(request.Name, request.Code, request.Address);
        if (errors.Count > 0)
        {
            return WarehouseOperationResult<WarehouseResponse>.Invalid(errors);
        }

        var code = request.Code!.Trim();
        if (await repository.CodeExistsAsync(code, id, cancellationToken))
        {
            return WarehouseOperationResult<WarehouseResponse>.Failure(
                WarehouseError.DuplicateCode);
        }

        warehouse.Name = request.Name!.Trim();
        warehouse.Code = code;
        warehouse.Address = NormalizeOptional(request.Address);
        warehouse.IsActive = request.IsActive;

        var persistenceError = await repository.UpdateAsync(warehouse, cancellationToken);
        if (persistenceError != WarehousePersistenceError.None)
        {
            return WarehouseOperationResult<WarehouseResponse>.Failure(
                MapError(persistenceError));
        }

        return WarehouseOperationResult<WarehouseResponse>.Success(ToResponse(warehouse));
    }

    public async Task<WarehouseOperationResult<bool>> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (await repository.GetByIdAsync(id, cancellationToken) is null)
        {
            return WarehouseOperationResult<bool>.Failure(WarehouseError.NotFound);
        }

        if (await repository.HasLocationsAsync(id, cancellationToken))
        {
            return WarehouseOperationResult<bool>.Failure(WarehouseError.HasLocations);
        }

        var persistenceError = await repository.DeleteAsync(id, cancellationToken);
        if (persistenceError != WarehousePersistenceError.None)
        {
            return WarehouseOperationResult<bool>.Failure(MapError(persistenceError));
        }

        return WarehouseOperationResult<bool>.Success(true);
    }

    private static Dictionary<string, string[]> Validate(
        string? name,
        string? code,
        string? address)
    {
        var errors = new Dictionary<string, string[]>();
        AddRequiredStringError(errors, nameof(Warehouse.Name), name, 200);
        AddRequiredStringError(errors, nameof(Warehouse.Code), code, 50);
        AddOptionalStringError(errors, nameof(Warehouse.Address), address, 500);
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

    private static void AddOptionalStringError(
        IDictionary<string, string[]> errors,
        string field,
        string? value,
        int maximumLength)
    {
        if (value?.Trim().Length > maximumLength)
        {
            errors[field] = [$"{field} must be {maximumLength} characters or fewer."];
        }
    }

    private static string? NormalizeOptional(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    private static WarehouseError MapError(WarehousePersistenceError error) =>
        error switch
        {
            WarehousePersistenceError.NotFound => WarehouseError.NotFound,
            WarehousePersistenceError.DuplicateCode => WarehouseError.DuplicateCode,
            WarehousePersistenceError.HasLocations => WarehouseError.HasLocations,
            _ => WarehouseError.None
        };

    private static WarehouseResponse ToResponse(Warehouse warehouse) =>
        new(
            warehouse.Id,
            warehouse.Name,
            warehouse.Code,
            warehouse.Address,
            warehouse.IsActive);
}
