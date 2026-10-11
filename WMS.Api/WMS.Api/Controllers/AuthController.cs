using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WMS.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Authorize]
public sealed class AuthController : ControllerBase
{
    [HttpGet("me")]
    public IActionResult GetCurrentUser()
    {
        return Ok(new { subject = User.FindFirst("sub")?.Value });
    }
}
