using System.Text.Json.Serialization;
using WMS.Domain;

namespace WMS.Application.Inventory;

public sealed record CreateInventoryAdjustmentRequest(
    Guid ProductId,
    Guid LocationId,
    [property: JsonConverter(typeof(JsonStringEnumConverter<InventoryAdjustmentType>))]
    InventoryAdjustmentType Type,
    decimal Quantity,
    [property: JsonConverter(typeof(JsonStringEnumConverter<InventoryAdjustmentReason>))]
    InventoryAdjustmentReason Reason,
    string? Explanation);
