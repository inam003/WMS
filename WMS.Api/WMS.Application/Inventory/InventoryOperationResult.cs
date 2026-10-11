namespace WMS.Application.Inventory;

public sealed record InventoryOperationResult<T>(
    InventoryError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == InventoryError.None;

    public static InventoryOperationResult<T> Success(T value) =>
        new(InventoryError.None, value);

    public static InventoryOperationResult<T> Failure(InventoryError error) =>
        new(error);

    public static InventoryOperationResult<T> Invalid(
        IReadOnlyDictionary<string, string[]> validationErrors) =>
        new(InventoryError.InvalidFilter, ValidationErrors: validationErrors);

    public static InventoryOperationResult<T> MissingFilters(
        IReadOnlyDictionary<string, string[]> missingFilters) =>
        new(InventoryError.FilterNotFound, ValidationErrors: missingFilters);
}
