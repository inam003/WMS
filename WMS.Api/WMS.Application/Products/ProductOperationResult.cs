namespace WMS.Application.Products;

public sealed record ProductOperationResult<T>(
    ProductError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == ProductError.None;

    public static ProductOperationResult<T> Success(T value) =>
        new(ProductError.None, value);

    public static ProductOperationResult<T> Failure(ProductError error) =>
        new(error);

    public static ProductOperationResult<T> Invalid(
        IReadOnlyDictionary<string, string[]> validationErrors) =>
        new(ProductError.Validation, ValidationErrors: validationErrors);
}
