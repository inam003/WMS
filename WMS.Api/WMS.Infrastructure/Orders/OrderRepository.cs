using Microsoft.EntityFrameworkCore;
using WMS.Application.Orders;
using WMS.Domain;
using WMS.Infrastructure.Data;

namespace WMS.Infrastructure.Orders;

public sealed class OrderRepository(ApplicationDbContext dbContext) : IOrderRepository
{
    public async Task<IReadOnlyList<OrderResponse>> GetAllAsync(
        CancellationToken cancellationToken) =>
        await dbContext.Orders
            .AsNoTracking()
            .OrderByDescending(order => order.CreatedAt)
            .Select(ToResponse)
            .ToListAsync(cancellationToken);

    public Task<OrderResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Orders
            .AsNoTracking()
            .Where(order => order.Id == id)
            .Select(ToResponse)
            .SingleOrDefaultAsync(cancellationToken);

    public Task<CustomerOrder?> GetAggregateByIdAsync(
        Guid id,
        CancellationToken cancellationToken) =>
        dbContext.Orders
            .AsNoTracking()
            .Include(order => order.Lines)
            .SingleOrDefaultAsync(order => order.Id == id, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, bool?>> GetProductActiveStatesAsync(
        IReadOnlyCollection<Guid> productIds,
        CancellationToken cancellationToken) =>
        await dbContext.Products
            .AsNoTracking()
            .Where(product => productIds.Contains(product.Id))
            .ToDictionaryAsync(
                product => product.Id,
                product => (bool?)product.IsActive,
                cancellationToken);

    public async Task AddAsync(CustomerOrder order, CancellationToken cancellationToken)
    {
        dbContext.Orders.Add(order);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> ReplaceDraftAsync(
        CustomerOrder updatedOrder,
        CancellationToken cancellationToken)
    {
        await using var transaction =
            await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var order = await dbContext.Orders
            .FromSqlInterpolated(
                $"SELECT * FROM \"Orders\" WHERE \"Id\" = {updatedOrder.Id} FOR UPDATE")
            .Include(item => item.Lines)
            .SingleOrDefaultAsync(
                item => item.Status == CustomerOrderStatus.Draft,
                cancellationToken);
        if (order is null)
        {
            return false;
        }

        order.CustomerName = updatedOrder.CustomerName;
        order.ReferenceId = updatedOrder.ReferenceId;
        dbContext.OrderLines.RemoveRange(order.Lines);
        order.Lines = updatedOrder.Lines;
        dbContext.OrderLines.AddRange(updatedOrder.Lines);
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<bool> ChangeStatusAsync(
        Guid orderId,
        CustomerOrderStatus currentStatus,
        CustomerOrderStatus nextStatus,
        CancellationToken cancellationToken)
    {
        await using var transaction =
            await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var order = await dbContext.Orders
            .FromSqlInterpolated(
                $"SELECT * FROM \"Orders\" WHERE \"Id\" = {orderId} FOR UPDATE")
            .SingleOrDefaultAsync(
                candidate => candidate.Status == currentStatus,
                cancellationToken);
        if (order is null)
        {
            return false;
        }

        order.Status = nextStatus;
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    private static System.Linq.Expressions.Expression<Func<CustomerOrder, OrderResponse>>
        ToResponse =>
        order => new OrderResponse(
            order.Id,
            order.OrderNumber,
            order.CustomerName,
            order.ReferenceId,
            order.Status,
            order.CreatedBy,
            order.CreatedAt,
            order.DispatchedBy,
            order.DispatchedAt,
            order.Lines
                .OrderBy(line => line.Id)
                .Select(line => new OrderLineResponse(
                    line.Id,
                    line.ProductId,
                    line.Product.Name,
                    line.Product.SKU,
                    line.Quantity,
                    line.DispatchLocationId,
                    line.DispatchLocation == null ? null : line.DispatchLocation.Name,
                    line.DispatchLocation == null ? null : line.DispatchLocation.Warehouse.Name))
                .ToArray());
}
