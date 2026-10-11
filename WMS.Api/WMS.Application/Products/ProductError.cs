namespace WMS.Application.Products;

public enum ProductError
{
    None,
    Validation,
    NotFound,
    CategoryNotFound,
    DuplicateSku,
    DuplicateBarcode,
    HasDependencies
}
