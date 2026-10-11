namespace WMS.Application.Inventory;

public enum InventoryError
{
    None,
    InvalidFilter,
    InvalidRequest,
    FilterNotFound,
    NotFound,
    ProductNotFound,
    LocationNotFound,
    InactiveProduct,
    InactiveLocation,
    IdempotencyConflict,
    QuantityLimitExceeded
}
