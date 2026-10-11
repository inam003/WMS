using WMS.Domain;

namespace WMS.Application.Reports;

public sealed record ReportQuery(
    Guid? ProductId,
    Guid? WarehouseId,
    Guid? LocationId,
    string? Keyword,
    string? TransactionType,
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    int Page = 1,
    int PageSize = 50);

public sealed record ReportPage<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    long TotalCount);

public sealed record StockReportRow(
    Guid ProductId,
    string ProductName,
    string SKU,
    string? Barcode,
    Guid WarehouseId,
    string WarehouseName,
    Guid LocationId,
    string LocationName,
    string LocationCode,
    decimal Quantity);

public sealed record MovementReportRow(
    Guid TransactionId,
    Guid ProductId,
    string ProductName,
    string SKU,
    string? Barcode,
    string Type,
    decimal Quantity,
    Guid WarehouseId,
    string WarehouseName,
    Guid LocationId,
    string LocationName,
    string LocationCode,
    Guid? ReferenceId,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    InventoryAdjustmentReason? AdjustmentReason,
    string? AdjustmentExplanation,
    Guid? TransferId,
    Guid? OrderId);

public sealed record TransferReportRow(
    Guid TransferId,
    Guid ProductId,
    string ProductName,
    string SKU,
    decimal Quantity,
    Guid SourceWarehouseId,
    string SourceWarehouseName,
    Guid SourceLocationId,
    string SourceLocationName,
    string SourceLocationCode,
    Guid DestinationWarehouseId,
    string DestinationWarehouseName,
    Guid DestinationLocationId,
    string DestinationLocationName,
    string DestinationLocationCode,
    Guid? ReferenceId,
    string CreatedBy,
    DateTimeOffset CreatedAt);

public sealed record OrderReportRow(
    Guid OrderId,
    string OrderNumber,
    CustomerOrderStatus Status,
    string? CustomerName,
    Guid? ReferenceId,
    Guid ProductId,
    string ProductName,
    string SKU,
    decimal RequestedQuantity,
    decimal DispatchedQuantity,
    Guid? DispatchLocationId,
    string? DispatchLocationName,
    string? DispatchLocationCode,
    Guid? DispatchWarehouseId,
    string? DispatchWarehouseName,
    string CreatedBy,
    DateTimeOffset CreatedAt,
    string? DispatchedBy,
    DateTimeOffset? DispatchedAt);

public enum ReportError
{
    None,
    Validation
}

public sealed record ReportResult<T>(
    ReportError Error,
    T? Value = default,
    IReadOnlyDictionary<string, string[]>? ValidationErrors = null)
{
    public bool Succeeded => Error == ReportError.None;

    public static ReportResult<T> Success(T value) => new(ReportError.None, value);
    public static ReportResult<T> Invalid(IReadOnlyDictionary<string, string[]> errors) =>
        new(ReportError.Validation, ValidationErrors: errors);
}

public interface IReportsRepository
{
    Task<ReportPage<StockReportRow>> GetStockAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
    Task<ReportPage<MovementReportRow>> GetMovementsAsync(
        ReportQuery query,
        string? type,
        CancellationToken cancellationToken);
    Task<ReportPage<TransferReportRow>> GetTransfersAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
    Task<ReportPage<OrderReportRow>> GetOrdersAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
}

public interface IReportsService
{
    Task<ReportResult<ReportPage<StockReportRow>>> GetStockAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
    Task<ReportResult<ReportPage<MovementReportRow>>> GetMovementsAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
    Task<ReportResult<ReportPage<MovementReportRow>>> GetReceivingAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
    Task<ReportResult<ReportPage<MovementReportRow>>> GetAdjustmentsAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
    Task<ReportResult<ReportPage<TransferReportRow>>> GetTransfersAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
    Task<ReportResult<ReportPage<OrderReportRow>>> GetOrdersAsync(
        ReportQuery query,
        CancellationToken cancellationToken);
}
