using WMS.Domain;

namespace WMS.Application.Categories;

public sealed class CategoryService(ICategoryRepository repository) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var categories = await repository.GetAllAsync(cancellationToken);
        return categories.Select(ToResponse).ToArray();
    }

    public async Task<CategoryResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var category = await repository.GetByIdAsync(id, cancellationToken);
        return category is null ? null : ToResponse(category);
    }

    public async Task<CategoryOperationResult<CategoryResponse>> CreateAsync(
        CreateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(request.Name, request.Description);
        if (errors.Count > 0)
        {
            return CategoryOperationResult<CategoryResponse>.Invalid(errors);
        }

        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = request.Name!.Trim(),
            Description = NormalizeOptional(request.Description)
        };

        await repository.AddAsync(category, cancellationToken);
        return CategoryOperationResult<CategoryResponse>.Success(ToResponse(category));
    }

    public async Task<CategoryOperationResult<CategoryResponse>> UpdateAsync(
        Guid id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken)
    {
        var category = await repository.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return CategoryOperationResult<CategoryResponse>.Failure(CategoryError.NotFound);
        }

        var errors = Validate(request.Name, request.Description);
        if (errors.Count > 0)
        {
            return CategoryOperationResult<CategoryResponse>.Invalid(errors);
        }

        category.Name = request.Name!.Trim();
        category.Description = NormalizeOptional(request.Description);
        await repository.UpdateAsync(category, cancellationToken);

        return CategoryOperationResult<CategoryResponse>.Success(ToResponse(category));
    }

    public async Task<CategoryOperationResult<bool>> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (await repository.GetByIdAsync(id, cancellationToken) is null)
        {
            return CategoryOperationResult<bool>.Failure(CategoryError.NotFound);
        }

        if (await repository.HasProductsAsync(id, cancellationToken))
        {
            return CategoryOperationResult<bool>.Failure(CategoryError.HasProducts);
        }

        await repository.DeleteAsync(id, cancellationToken);
        return CategoryOperationResult<bool>.Success(true);
    }

    private static Dictionary<string, string[]> Validate(string? name, string? description)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(name))
        {
            errors[nameof(Category.Name)] = ["Name is required."];
        }
        else if (name.Trim().Length > 100)
        {
            errors[nameof(Category.Name)] = ["Name must be 100 characters or fewer."];
        }

        if (description?.Trim().Length > 500)
        {
            errors[nameof(Category.Description)] =
                ["Description must be 500 characters or fewer."];
        }

        return errors;
    }

    private static string? NormalizeOptional(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    private static CategoryResponse ToResponse(Category category) =>
        new(category.Id, category.Name, category.Description);
}
