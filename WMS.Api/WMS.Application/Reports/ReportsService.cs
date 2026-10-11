namespace WMS.Application.Reports;

public sealed class ReportsService(IReportsRepository repository) : IReportsService
{
    private static readonly HashSet<string> MovementTypes = new(StringComparer.Ordinal)
    {
        "Receipt",
        "AdjustmentIncrease",
        "AdjustmentDecrease",
        "TransferIn",
        "TransferOut",
        "Dispatch"
    };

    public async Task<ReportResult<ReportPage<StockReportRow>>> GetStockAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var errors = Validate(query, allowTransactionType: false, allowDates: false);
        return errors.Count > 0
            ? ReportResult<ReportPage<StockReportRow>>.Invalid(errors)
            : ReportResult<ReportPage<StockReportRow>>.Success(
                await repository.GetStockAsync(query, cancellationToken));
    }

    public async Task<ReportResult<ReportPage<MovementReportRow>>> GetMovementsAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var errors = Validate(query);
        if (query.TransactionType is not null &&
            !MovementTypes.Contains(query.TransactionType.Trim()))
        {
            errors[nameof(query.TransactionType)] = ["Select a supported inventory transaction type."];
        }

        return errors.Count > 0
            ? ReportResult<ReportPage<MovementReportRow>>.Invalid(errors)
            : ReportResult<ReportPage<MovementReportRow>>.Success(
                await repository.GetMovementsAsync(
                    query,
                    NormalizeType(query.TransactionType),
                    cancellationToken));
    }

    public async Task<ReportResult<ReportPage<MovementReportRow>>> GetReceivingAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var errors = Validate(query, allowTransactionType: false);
        return errors.Count > 0
            ? ReportResult<ReportPage<MovementReportRow>>.Invalid(errors)
            : ReportResult<ReportPage<MovementReportRow>>.Success(
                await repository.GetMovementsAsync(query, "Receipt", cancellationToken));
    }

    public async Task<ReportResult<ReportPage<MovementReportRow>>> GetAdjustmentsAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var errors = Validate(query, allowTransactionType: false);
        return errors.Count > 0
            ? ReportResult<ReportPage<MovementReportRow>>.Invalid(errors)
            : ReportResult<ReportPage<MovementReportRow>>.Success(
                await repository.GetMovementsAsync(query, "Adjustment", cancellationToken));
    }

    public async Task<ReportResult<ReportPage<TransferReportRow>>> GetTransfersAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var errors = Validate(query, allowTransactionType: false);
        return errors.Count > 0
            ? ReportResult<ReportPage<TransferReportRow>>.Invalid(errors)
            : ReportResult<ReportPage<TransferReportRow>>.Success(
                await repository.GetTransfersAsync(query, cancellationToken));
    }

    public async Task<ReportResult<ReportPage<OrderReportRow>>> GetOrdersAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var errors = Validate(query, allowTransactionType: false);
        return errors.Count > 0
            ? ReportResult<ReportPage<OrderReportRow>>.Invalid(errors)
            : ReportResult<ReportPage<OrderReportRow>>.Success(
                await repository.GetOrdersAsync(query, cancellationToken));
    }

    private static Dictionary<string, string[]> Validate(
        ReportQuery query,
        bool allowTransactionType = true,
        bool allowDates = true)
    {
        var errors = new Dictionary<string, string[]>();
        if (query.ProductId == Guid.Empty)
        {
            errors[nameof(query.ProductId)] = ["ProductId must not be empty."];
        }

        if (query.WarehouseId == Guid.Empty)
        {
            errors[nameof(query.WarehouseId)] = ["WarehouseId must not be empty."];
        }

        if (query.LocationId == Guid.Empty)
        {
            errors[nameof(query.LocationId)] = ["LocationId must not be empty."];
        }

        if (query.Keyword?.Trim().Length > 100)
        {
            errors[nameof(query.Keyword)] = ["Keyword must be 100 characters or fewer."];
        }

        if (query.Page < 1 || query.Page > 1_000_000)
        {
            errors[nameof(query.Page)] = ["Page must be between 1 and 1,000,000."];
        }

        if (query.PageSize is < 1 or > 100)
        {
            errors[nameof(query.PageSize)] = ["PageSize must be between 1 and 100."];
        }

        if (!allowDates && (query.StartDate.HasValue || query.EndDate.HasValue))
        {
            errors[nameof(query.StartDate)] = ["Date filters are not supported for this report."];
        }
        else if (query.StartDate.HasValue &&
                 query.EndDate.HasValue &&
                 query.StartDate.Value > query.EndDate.Value)
        {
            errors[nameof(query.StartDate)] =
                ["StartDate must be earlier than or equal to EndDate."];
        }

        if (!allowTransactionType && !string.IsNullOrWhiteSpace(query.TransactionType))
        {
            errors[nameof(query.TransactionType)] =
                ["TransactionType is not supported for this report."];
        }

        return errors;
    }

    private static string? NormalizeType(string? type) =>
        string.IsNullOrWhiteSpace(type) ? null : type.Trim();
}
