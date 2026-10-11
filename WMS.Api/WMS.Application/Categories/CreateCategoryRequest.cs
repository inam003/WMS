namespace WMS.Application.Categories;

public sealed record CreateCategoryRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
}
