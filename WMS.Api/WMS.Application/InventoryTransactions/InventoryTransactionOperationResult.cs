namespace WMS.Application.InventoryTransactions;

public sealed record InventoryTransactionOperationResult<T>(
    InventoryTransactionError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == InventoryTransactionError.None;

    public static InventoryTransactionOperationResult<T> Success(T value) =>
        new(InventoryTransactionError.None, value);

    public static InventoryTransactionOperationResult<T> Failure(
        InventoryTransactionError error) =>
        new(error);

    public static InventoryTransactionOperationResult<T> Invalid(
        IReadOnlyDictionary<string, string[]> validationErrors) =>
        new(InventoryTransactionError.Validation, ValidationErrors: validationErrors);

    public static InventoryTransactionOperationResult<T> MissingFilters(
        IReadOnlyDictionary<string, string[]> missingFilters) =>
        new(InventoryTransactionError.FilterNotFound, ValidationErrors: missingFilters);
}
