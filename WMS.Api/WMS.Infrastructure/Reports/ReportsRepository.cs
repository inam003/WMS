using Microsoft.EntityFrameworkCore;
using WMS.Application.Reports;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Reports;

public sealed class ReportsRepository(ApplicationDbContext dbContext) : IReportsRepository
{
    public async Task<ReportPage<StockReportRow>> GetStockAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var stock = dbContext.Inventory.AsNoTracking().AsQueryable();
        if (query.ProductId.HasValue)
        {
            stock = stock.Where(row => row.ProductId == query.ProductId.Value);
        }

        if (query.WarehouseId.HasValue)
        {
            stock = stock.Where(row => row.Location.WarehouseId == query.WarehouseId.Value);
        }

        if (query.LocationId.HasValue)
        {
            stock = stock.Where(row => row.LocationId == query.LocationId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            stock = stock.Where(row =>
                row.Product.Name.Contains(keyword) ||
                row.Product.SKU.Contains(keyword) ||
                (row.Product.Barcode != null && row.Product.Barcode.Contains(keyword)) ||
                row.Location.Name.Contains(keyword) ||
                row.Location.Code.Contains(keyword) ||
                row.Location.Warehouse.Name.Contains(keyword));
        }

        return await PaginateAsync(
            stock.OrderBy(row => row.Product.Name)
                .ThenBy(row => row.Location.Warehouse.Name)
                .ThenBy(row => row.Location.Code)
                .Select(row => new StockReportRow(
                    row.ProductId,
                    row.Product.Name,
                    row.Product.SKU,
                    row.Product.Barcode,
                    row.Location.WarehouseId,
                    row.Location.Warehouse.Name,
                    row.LocationId,
                    row.Location.Name,
                    row.Location.Code,
                    row.Quantity)),
            query,
            cancellationToken);
    }

    public async Task<ReportPage<MovementReportRow>> GetMovementsAsync(
        ReportQuery query,
        string? type,
        CancellationToken cancellationToken)
    {
        var transactions = FilterTransactions(query);
        if (type == "Adjustment")
        {
            transactions = transactions.Where(transaction =>
                transaction.Type == "AdjustmentIncrease" ||
                transaction.Type == "AdjustmentDecrease");
        }
        else if (type is not null)
        {
            transactions = transactions.Where(transaction => transaction.Type == type);
        }

        return await PaginateAsync(
            transactions.OrderByDescending(transaction => transaction.CreatedAt)
                .ThenByDescending(transaction => transaction.Id)
                .Select(transaction => new MovementReportRow(
                    transaction.Id,
                    transaction.ProductId,
                    transaction.Product.Name,
                    transaction.Product.SKU,
                    transaction.Product.Barcode,
                    transaction.Type,
                    transaction.Quantity,
                    transaction.Location.WarehouseId,
                    transaction.Location.Warehouse.Name,
                    transaction.LocationId,
                    transaction.Location.Name,
                    transaction.Location.Code,
                    transaction.ReferenceId,
                    transaction.CreatedBy,
                    transaction.CreatedAt,
                    transaction.AdjustmentReason,
                    transaction.AdjustmentExplanation,
                    transaction.TransferId,
                    transaction.OrderId)),
            query,
            cancellationToken);
    }

    public async Task<ReportPage<TransferReportRow>> GetTransfersAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var outgoing = dbContext.InventoryTransactions
            .AsNoTracking()
            .Where(transaction => transaction.Type == "TransferOut" &&
                transaction.TransferId.HasValue);
        var incoming = dbContext.InventoryTransactions
            .AsNoTracking()
            .Where(transaction => transaction.Type == "TransferIn");

        IQueryable<TransferReportRow> transfers =
            from source in outgoing
            join destination in incoming
                on source.TransferId equals destination.TransferId
            select new TransferReportRow(
                source.TransferId!.Value,
                source.ProductId,
                source.Product.Name,
                source.Product.SKU,
                source.Quantity,
                source.Location.WarehouseId,
                source.Location.Warehouse.Name,
                source.LocationId,
                source.Location.Name,
                source.Location.Code,
                destination.Location.WarehouseId,
                destination.Location.Warehouse.Name,
                destination.LocationId,
                destination.Location.Name,
                destination.Location.Code,
                source.ReferenceId,
                source.CreatedBy,
                source.CreatedAt);

        if (query.ProductId.HasValue)
        {
            transfers = transfers.Where(row => row.ProductId == query.ProductId.Value);
        }

        if (query.WarehouseId.HasValue && query.LocationId.HasValue)
        {
            transfers = transfers.Where(row =>
                (row.SourceWarehouseId == query.WarehouseId.Value &&
                 row.SourceLocationId == query.LocationId.Value) ||
                (row.DestinationWarehouseId == query.WarehouseId.Value &&
                 row.DestinationLocationId == query.LocationId.Value));
        }
        else if (query.WarehouseId.HasValue)
        {
            transfers = transfers.Where(row =>
                row.SourceWarehouseId == query.WarehouseId.Value ||
                row.DestinationWarehouseId == query.WarehouseId.Value);
        }
        else if (query.LocationId.HasValue)
        {
            transfers = transfers.Where(row =>
                row.SourceLocationId == query.LocationId.Value ||
                row.DestinationLocationId == query.LocationId.Value);
        }

        if (query.StartDate.HasValue)
        {
            transfers = transfers.Where(row => row.CreatedAt >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            transfers = transfers.Where(row => row.CreatedAt <= query.EndDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            transfers = transfers.Where(row =>
                row.ProductName.Contains(keyword) ||
                row.SKU.Contains(keyword) ||
                row.SourceLocationName.Contains(keyword) ||
                row.SourceLocationCode.Contains(keyword) ||
                row.SourceWarehouseName.Contains(keyword) ||
                row.DestinationLocationName.Contains(keyword) ||
                row.DestinationLocationCode.Contains(keyword) ||
                row.DestinationWarehouseName.Contains(keyword) ||
                row.CreatedBy.Contains(keyword) ||
                (row.ReferenceId != null && row.ReferenceId.ToString()!.Contains(keyword)));
        }

        transfers = transfers
            .OrderByDescending(row => row.CreatedAt)
            .ThenByDescending(row => row.TransferId);

        return await PaginateAsync(transfers, query, cancellationToken);
    }

    public async Task<ReportPage<OrderReportRow>> GetOrdersAsync(
        ReportQuery query,
        CancellationToken cancellationToken)
    {
        var lines = dbContext.OrderLines
            .AsNoTracking()
            .AsQueryable();

        if (query.ProductId.HasValue)
        {
            lines = lines.Where(line => line.ProductId == query.ProductId.Value);
        }

        if (query.WarehouseId.HasValue)
        {
            lines = lines.Where(line =>
                line.DispatchLocation != null &&
                line.DispatchLocation.WarehouseId == query.WarehouseId.Value);
        }

        if (query.LocationId.HasValue)
        {
            lines = lines.Where(line => line.DispatchLocationId == query.LocationId.Value);
        }

        if (query.StartDate.HasValue)
        {
            lines = lines.Where(line => line.Order.CreatedAt >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            lines = lines.Where(line => line.Order.CreatedAt <= query.EndDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            lines = lines.Where(line =>
                line.Order.OrderNumber.Contains(keyword) ||
                (line.Order.CustomerName != null && line.Order.CustomerName.Contains(keyword)) ||
                (line.Order.ReferenceId != null &&
                    line.Order.ReferenceId.ToString()!.Contains(keyword)) ||
                line.Product.Name.Contains(keyword) ||
                line.Product.SKU.Contains(keyword) ||
                line.Order.CreatedBy.Contains(keyword));
        }

        var report = lines
            .OrderByDescending(line => line.Order.CreatedAt)
            .ThenByDescending(line => line.Order.Id)
            .ThenBy(line => line.Id)
            .Select(line => new OrderReportRow(
                line.OrderId,
                line.Order.OrderNumber,
                line.Order.Status,
                line.Order.CustomerName,
                line.Order.ReferenceId,
                line.ProductId,
                line.Product.Name,
                line.Product.SKU,
                line.Quantity,
                line.Order.Status == CustomerOrderStatus.Dispatched ? line.Quantity : 0m,
                line.DispatchLocationId,
                line.DispatchLocation == null ? null : line.DispatchLocation.Name,
                line.DispatchLocation == null ? null : line.DispatchLocation.Code,
                line.DispatchLocation == null ? null : (Guid?)line.DispatchLocation.WarehouseId,
                line.DispatchLocation == null ? null : line.DispatchLocation.Warehouse.Name,
                line.Order.CreatedBy,
                line.Order.CreatedAt,
                line.Order.DispatchedBy,
                line.Order.DispatchedAt));

        return await PaginateAsync(report, query, cancellationToken);
    }

    private IQueryable<InventoryTransaction> FilterTransactions(ReportQuery query)
    {
        var transactions = dbContext.InventoryTransactions
            .AsNoTracking()
            .AsQueryable();

        if (query.ProductId.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.ProductId == query.ProductId.Value);
        }

        if (query.WarehouseId.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.Location.WarehouseId == query.WarehouseId.Value);
        }

        if (query.LocationId.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.LocationId == query.LocationId.Value);
        }

        if (query.StartDate.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.CreatedAt >= query.StartDate.Value);
        }

        if (query.EndDate.HasValue)
        {
            transactions = transactions.Where(
                transaction => transaction.CreatedAt <= query.EndDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            transactions = transactions.Where(transaction =>
                transaction.Product.Name.Contains(keyword) ||
                transaction.Product.SKU.Contains(keyword) ||
                (transaction.Product.Barcode != null &&
                    transaction.Product.Barcode.Contains(keyword)) ||
                transaction.Location.Name.Contains(keyword) ||
                transaction.Location.Code.Contains(keyword) ||
                transaction.Location.Warehouse.Name.Contains(keyword) ||
                transaction.CreatedBy.Contains(keyword) ||
                (transaction.ReferenceId != null &&
                    transaction.ReferenceId.ToString()!.Contains(keyword)));
        }

        if (!string.IsNullOrWhiteSpace(query.TransactionType))
        {
            transactions = transactions.Where(
                transaction => transaction.Type == query.TransactionType.Trim());
        }

        return transactions;
    }

    private static async Task<ReportPage<T>> PaginateAsync<T>(
        IQueryable<T> query,
        ReportQuery filters,
        CancellationToken cancellationToken)
    {
        var totalCount = await query.LongCountAsync(cancellationToken);
        var items = await query
            .Skip((filters.Page - 1) * filters.PageSize)
            .Take(filters.PageSize)
            .ToListAsync(cancellationToken);
        return new ReportPage<T>(items, filters.Page, filters.PageSize, totalCount);
    }
}
