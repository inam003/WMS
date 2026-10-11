namespace WMS.Application.Categories;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryResponse>> GetAllAsync(CancellationToken cancellationToken);
    Task<CategoryResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken);
    Task<CategoryOperationResult<CategoryResponse>> CreateAsync(
        CreateCategoryRequest request,
        CancellationToken cancellationToken);
    Task<CategoryOperationResult<CategoryResponse>> UpdateAsync(
        Guid id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken);
    Task<CategoryOperationResult<bool>> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken);
}
