using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WMS.Application.Audit;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/audit")]
[Authorize(Policy = "WmsAdmin")]
public sealed class AuditController(IAuditRepository repository) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(AuditHistoryPage), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AuditHistoryPage>> Get(
        [FromQuery] DateTimeOffset? startDate,
        [FromQuery] DateTimeOffset? endDate,
        [FromQuery] string? user,
        [FromQuery] string? actionType,
        [FromQuery] string? entityType,
        [FromQuery] string? entityId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string[]>();
        if (startDate.HasValue && endDate.HasValue && startDate > endDate)
        {
            errors[nameof(startDate)] =
                ["Start date must be earlier than or equal to end date."];
        }
        if (page is < 1 or > 1_000_000)
        {
            errors[nameof(page)] = ["Page must be between 1 and 1,000,000."];
        }
        if (pageSize is < 1 or > 100)
        {
            errors[nameof(pageSize)] = ["Page size must be between 1 and 100."];
        }
        AddLengthError(errors, nameof(user), user, 255);
        AddLengthError(errors, nameof(actionType), actionType, 100);
        AddLengthError(errors, nameof(entityType), entityType, 100);
        AddLengthError(errors, nameof(entityId), entityId, 255);
        if (errors.Count > 0)
        {
            return BadRequest(new ValidationProblemDetails(errors));
        }

        return Ok(await repository.GetPageAsync(
            new AuditQuery(
                startDate?.ToUniversalTime(),
                endDate?.ToUniversalTime(),
                user,
                actionType,
                entityType,
                entityId,
                page,
                pageSize),
            cancellationToken));
    }

    private static void AddLengthError(
        IDictionary<string, string[]> errors,
        string field,
        string? value,
        int maximumLength)
    {
        if (value?.Trim().Length > maximumLength)
        {
            errors[field] = [$"{field} must be {maximumLength} characters or fewer."];
        }
    }
}
