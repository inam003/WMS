using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Reports;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/reports")]
[Authorize]
public sealed class ReportsController(IReportsService reportsService) : ControllerBase
{
    [HttpGet("stock")]
    public Task<ActionResult> GetStock(
        [FromQuery] ReportQuery query,
        CancellationToken cancellationToken) =>
        ExecuteAsync(reportsService.GetStockAsync(query, cancellationToken));

    [HttpGet("movements")]
    public Task<ActionResult> GetMovements(
        [FromQuery] ReportQuery query,
        CancellationToken cancellationToken) =>
        ExecuteAsync(reportsService.GetMovementsAsync(query, cancellationToken));

    [HttpGet("receiving")]
    public Task<ActionResult> GetReceiving(
        [FromQuery] ReportQuery query,
        CancellationToken cancellationToken) =>
        ExecuteAsync(reportsService.GetReceivingAsync(query, cancellationToken));

    [HttpGet("adjustments")]
    public Task<ActionResult> GetAdjustments(
        [FromQuery] ReportQuery query,
        CancellationToken cancellationToken) =>
        ExecuteAsync(reportsService.GetAdjustmentsAsync(query, cancellationToken));

    [HttpGet("transfers")]
    public Task<ActionResult> GetTransfers(
        [FromQuery] ReportQuery query,
        CancellationToken cancellationToken) =>
        ExecuteAsync(reportsService.GetTransfersAsync(query, cancellationToken));

    [HttpGet("orders")]
    public Task<ActionResult> GetOrders(
        [FromQuery] ReportQuery query,
        CancellationToken cancellationToken) =>
        ExecuteAsync(reportsService.GetOrdersAsync(query, cancellationToken));

    private async Task<ActionResult> ExecuteAsync<T>(
        Task<ReportResult<ReportPage<T>>> operation)
    {
        var result = await operation;
        return result.Succeeded
            ? Ok(result.Value)
            : BadRequest(new ValidationProblemDetails(
                result.ValidationErrors!.ToDictionary(error => error.Key, error => error.Value)));
    }
}
