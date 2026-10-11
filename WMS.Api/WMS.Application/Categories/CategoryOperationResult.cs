namespace WMS.Application.Categories;

public sealed record CategoryOperationResult<T>(
    CategoryError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == CategoryError.None;

    public static CategoryOperationResult<T> Success(T value) =>
        new(CategoryError.None, value);

    public static CategoryOperationResult<T> Failure(CategoryError error) =>
        new(error);

    public static CategoryOperationResult<T> Invalid(
        IReadOnlyDictionary<string, string[]> validationErrors) =>
        new(CategoryError.Validation, ValidationErrors: validationErrors);
}
