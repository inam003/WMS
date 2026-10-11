namespace WMS.Application.Locations;

public sealed record LocationOperationResult<T>(
    LocationError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == LocationError.None;

    public static LocationOperationResult<T> Success(T value) =>
        new(LocationError.None, value);

    public static LocationOperationResult<T> Failure(LocationError error) =>
        new(error);

    public static LocationOperationResult<T> Invalid(
        IReadOnlyDictionary<string, string[]> validationErrors) =>
        new(LocationError.Validation, ValidationErrors: validationErrors);
}
