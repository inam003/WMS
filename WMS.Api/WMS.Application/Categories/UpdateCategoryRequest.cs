namespace WMS.Application.Categories;

public sealed record UpdateCategoryRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
}
