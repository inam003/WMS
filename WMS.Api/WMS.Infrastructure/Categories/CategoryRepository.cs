using Microsoft.EntityFrameworkCore;
using WMS.Application.Categories;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Categories;

public sealed class CategoryRepository(ApplicationDbContext dbContext) : ICategoryRepository
{
    public async Task<IReadOnlyList<Category>> GetAllAsync(
        CancellationToken cancellationToken) =>
        await dbContext.Categories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .ThenBy(category => category.Id)
            .ToListAsync(cancellationToken);

    public Task<Category?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Categories
            .AsNoTracking()
            .SingleOrDefaultAsync(category => category.Id == id, cancellationToken);

    public Task<bool> HasProductsAsync(Guid categoryId, CancellationToken cancellationToken) =>
        dbContext.Products.AnyAsync(
            product => product.CategoryId == categoryId,
            cancellationToken);

    public async Task AddAsync(Category category, CancellationToken cancellationToken)
    {
        dbContext.Categories.Add(category);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Category category, CancellationToken cancellationToken)
    {
        dbContext.Categories.Update(category);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await dbContext.Categories
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (category is null)
        {
            return;
        }

        dbContext.Categories.Remove(category);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
