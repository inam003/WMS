namespace WMS.Application.Warehouses;

public sealed record WarehouseOperationResult<T>(
    WarehouseError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == WarehouseError.None;

    public static WarehouseOperationResult<T> Success(T value) =>
        new(WarehouseError.None, value);

    public static WarehouseOperationResult<T> Failure(WarehouseError error) =>
        new(error);

    public static WarehouseOperationResult<T> Invalid(
        IReadOnlyDictionary<string, string[]> validationErrors) =>
        new(WarehouseError.Validation, ValidationErrors: validationErrors);
}
