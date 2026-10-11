namespace WMS.Application.Inventory;

public sealed record CreateReceiptRequest(
    Guid ProductId,
    Guid LocationId,
    decimal Quantity,
    Guid? ReferenceId);
