using WMS.Domain;

namespace WMS.Application.Products;

public sealed class ProductService(IProductRepository repository) : IProductService
{
    private const decimal MaximumMinimumStockLevel = 999_999_999_999_999.999m;

    public async Task<IReadOnlyList<ProductResponse>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        var products = await repository.GetAllAsync(cancellationToken);
        return products.Select(ToResponse).ToArray();
    }

    public async Task<ProductResponse?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        var product = await repository.GetByIdAsync(id, cancellationToken);
        return product is null ? null : ToResponse(product);
    }

    public async Task<ProductOperationResult<ProductResponse>> CreateAsync(
        CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var errors = Validate(
            request.SKU,
            request.Name,
            request.Description,
            request.CategoryId,
            request.Unit,
            request.MinimumStockLevel,
            request.Barcode);
        if (errors.Count > 0)
        {
            return ProductOperationResult<ProductResponse>.Invalid(errors);
        }

        var sku = request.SKU!.Trim();
        var barcode = NormalizeOptional(request.Barcode);
        if (!await repository.CategoryExistsAsync(request.CategoryId, cancellationToken))
        {
            return ProductOperationResult<ProductResponse>.Failure(ProductError.CategoryNotFound);
        }

        if (await repository.SkuExistsAsync(sku, null, cancellationToken))
        {
            return ProductOperationResult<ProductResponse>.Failure(ProductError.DuplicateSku);
        }

        if (barcode is not null &&
            await repository.BarcodeExistsAsync(barcode, null, cancellationToken))
        {
            return ProductOperationResult<ProductResponse>.Failure(ProductError.DuplicateBarcode);
        }

        var product = new Product
        {
            Id = Guid.NewGuid(),
            SKU = sku,
            Name = request.Name!.Trim(),
            Description = NormalizeOptional(request.Description),
            CategoryId = request.CategoryId,
            Unit = request.Unit!.Trim(),
            MinimumStockLevel = request.MinimumStockLevel,
            Barcode = barcode,
            IsActive = request.IsActive
        };

        var persistenceError = await repository.AddAsync(product, cancellationToken);
        if (persistenceError != ProductPersistenceError.None)
        {
            return ProductOperationResult<ProductResponse>.Failure(MapError(persistenceError));
        }

        return ProductOperationResult<ProductResponse>.Success(ToResponse(product));
    }

    public async Task<ProductOperationResult<ProductResponse>> UpdateAsync(
        Guid id,
        UpdateProductRequest request,
        CancellationToken cancellationToken)
    {
        var product = await repository.GetByIdAsync(id, cancellationToken);
        if (product is null)
        {
            return ProductOperationResult<ProductResponse>.Failure(ProductError.NotFound);
        }

        var errors = Validate(
            request.SKU,
            request.Name,
            request.Description,
            request.CategoryId,
            request.Unit,
            request.MinimumStockLevel,
            request.Barcode);
        if (errors.Count > 0)
        {
            return ProductOperationResult<ProductResponse>.Invalid(errors);
        }

        var sku = request.SKU!.Trim();
        var barcode = NormalizeOptional(request.Barcode);
        if (!await repository.CategoryExistsAsync(request.CategoryId, cancellationToken))
        {
            return ProductOperationResult<ProductResponse>.Failure(ProductError.CategoryNotFound);
        }

        if (await repository.SkuExistsAsync(sku, id, cancellationToken))
        {
            return ProductOperationResult<ProductResponse>.Failure(ProductError.DuplicateSku);
        }

        if (barcode is not null &&
            await repository.BarcodeExistsAsync(barcode, id, cancellationToken))
        {
            return ProductOperationResult<ProductResponse>.Failure(ProductError.DuplicateBarcode);
        }

        product.SKU = sku;
        product.Name = request.Name!.Trim();
        product.Description = NormalizeOptional(request.Description);
        product.CategoryId = request.CategoryId;
        product.Unit = request.Unit!.Trim();
        product.MinimumStockLevel = request.MinimumStockLevel;
        product.Barcode = barcode;
        product.IsActive = request.IsActive;

        var persistenceError = await repository.UpdateAsync(product, cancellationToken);
        if (persistenceError != ProductPersistenceError.None)
        {
            return ProductOperationResult<ProductResponse>.Failure(MapError(persistenceError));
        }

        return ProductOperationResult<ProductResponse>.Success(ToResponse(product));
    }

    public async Task<ProductOperationResult<bool>> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (await repository.GetByIdAsync(id, cancellationToken) is null)
        {
            return ProductOperationResult<bool>.Failure(ProductError.NotFound);
        }

        if (await repository.HasDependenciesAsync(id, cancellationToken))
        {
            return ProductOperationResult<bool>.Failure(ProductError.HasDependencies);
        }

        var persistenceError = await repository.DeleteAsync(id, cancellationToken);
        if (persistenceError != ProductPersistenceError.None)
        {
            return ProductOperationResult<bool>.Failure(MapError(persistenceError));
        }

        return ProductOperationResult<bool>.Success(true);
    }

    private static Dictionary<string, string[]> Validate(
        string? sku,
        string? name,
        string? description,
        Guid categoryId,
        string? unit,
        decimal minimumStockLevel,
        string? barcode)
    {
        var errors = new Dictionary<string, string[]>();

        AddRequiredStringError(errors, nameof(Product.SKU), sku, 50);
        AddRequiredStringError(errors, nameof(Product.Name), name, 200);
        AddOptionalStringError(errors, nameof(Product.Description), description, 1000);
        AddRequiredStringError(errors, nameof(Product.Unit), unit, 50);
        AddOptionalStringError(errors, nameof(Product.Barcode), barcode, 100);

        if (categoryId == Guid.Empty)
        {
            errors[nameof(Product.CategoryId)] = ["CategoryId is required."];
        }

        if (minimumStockLevel < 0 || minimumStockLevel > MaximumMinimumStockLevel ||
            decimal.Round(minimumStockLevel, 3) != minimumStockLevel)
        {
            errors[nameof(Product.MinimumStockLevel)] =
                ["MinimumStockLevel must be non-negative and fit the database precision of 18,3."];
        }

        return errors;
    }

    private static void AddRequiredStringError(
        IDictionary<string, string[]> errors,
        string field,
        string? value,
        int maximumLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[field] = [$"{field} is required."];
        }
        else if (value.Trim().Length > maximumLength)
        {
            errors[field] = [$"{field} must be {maximumLength} characters or fewer."];
        }
    }

    private static void AddOptionalStringError(
        IDictionary<string, string[]> errors,
        string field,
        string? value,
        int maximumLength)
    {
        if (value?.Trim().Length > maximumLength)
        {
            errors[field] = [$"{field} must be {maximumLength} characters or fewer."];
        }
    }

    private static string? NormalizeOptional(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    private static ProductError MapError(ProductPersistenceError error) =>
        error switch
        {
            ProductPersistenceError.NotFound => ProductError.NotFound,
            ProductPersistenceError.CategoryNotFound => ProductError.CategoryNotFound,
            ProductPersistenceError.DuplicateSku => ProductError.DuplicateSku,
            ProductPersistenceError.DuplicateBarcode => ProductError.DuplicateBarcode,
            ProductPersistenceError.HasDependencies => ProductError.HasDependencies,
            _ => ProductError.None
        };

    private static ProductResponse ToResponse(Product product) =>
        new(
            product.Id,
            product.SKU,
            product.Name,
            product.Description,
            product.CategoryId,
            product.Unit,
            product.MinimumStockLevel,
            product.Barcode,
            product.IsActive);
}
