namespace WMS.Application.Locations;

public enum LocationError
{
    None,
    Validation,
    NotFound,
    WarehouseNotFound,
    DuplicateCode,
    DuplicateBarcode,
    HasDependencies
}
