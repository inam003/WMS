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
        var rowsUpdated = await dbContext.Orders
            .Where(order =>
                order.Id == updatedOrder.Id &&
                order.Status == CustomerOrderStatus.Draft)
            .ExecuteUpdateAsync(
                updates => updates
                    .SetProperty(order => order.CustomerName, updatedOrder.CustomerName)
                    .SetProperty(order => order.ReferenceId, updatedOrder.ReferenceId),
                cancellationToken);
        if (rowsUpdated != 1)
        {
            return false;
        }

        await dbContext.OrderLines
            .Where(line => line.OrderId == updatedOrder.Id)
            .ExecuteDeleteAsync(cancellationToken);
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
        var rowsUpdated = await dbContext.Orders
            .Where(order => order.Id == orderId && order.Status == currentStatus)
            .ExecuteUpdateAsync(
                updates => updates.SetProperty(order => order.Status, nextStatus),
                cancellationToken);
        return rowsUpdated == 1;
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
