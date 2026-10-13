using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using Resend;
using System.Threading.RateLimiting;
using WMS.Api.Authentication;
using WMS.Api.Authorization;
using WMS.Application.Categories;
using WMS.Application.Audit;
using WMS.Application.Inventory;
using WMS.Application.InventoryTransactions;
using WMS.Application.Products;
using WMS.Application.Orders;
using WMS.Application.Reports;
using WMS.Application.Users;
using WMS.Infrastructure.Categories;
using WMS.Infrastructure.Data;
using WMS.Infrastructure.Audit;
using WMS.Infrastructure.InventoryData;
using WMS.Infrastructure.InventoryTransactions;
using WMS.Application.Locations;
using WMS.Application.Warehouses;
using WMS.Infrastructure.Locations;
using WMS.Infrastructure.Products;
using WMS.Infrastructure.Orders;
using WMS.Infrastructure.Reports;
using WMS.Infrastructure.Users;
using WMS.Infrastructure.Warehouses;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var resendApiToken = builder.Configuration["RESEND_APITOKEN"] ?? string.Empty;
builder.Services.AddOptions();
builder.Services.AddHttpClient<ResendClient>();
builder.Services.Configure<ResendClientOptions>(options =>
    options.ApiToken = resendApiToken);
builder.Services.AddTransient<IResend, ResendClient>();

builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<IAuditRepository, AuditRepository>();
builder.Services.AddScoped<ICurrentAuditActor, CurrentAuditActor>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHostedService<AuditRetentionService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<IInventoryTransactionService, InventoryTransactionService>();
builder.Services.AddScoped<IInventoryTransactionRepository, InventoryTransactionRepository>();
builder.Services.AddScoped<IWarehouseService, WarehouseService>();
builder.Services.AddScoped<IWarehouseRepository, WarehouseRepository>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddScoped<ILocationRepository, LocationRepository>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IReportsService, ReportsService>();
builder.Services.AddScoped<IReportsRepository, ReportsRepository>();
builder.Services.AddScoped<IWmsUserService, WmsUserService>();
builder.Services.AddScoped<IWmsUserRepository, WmsUserRepository>();
builder.Services.AddScoped<IInvitationEmailService, ResendInvitationEmailService>();
builder.Services.AddScoped<IWmsInvitationService, WmsInvitationService>();
builder.Services.AddScoped<IWmsInvitationRepository, WmsInvitationRepository>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<WmsRequestUser>();
builder.Services.AddScoped<IAuthorizationHandler, WmsPermissionHandler>();
builder.Services.AddSingleton<IAuthorizationMiddlewareResultHandler,
    WmsAuthorizationMiddlewareResultHandler>();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("invitation-validation", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("invitation-acceptance", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("invitation-management", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.User.FindFirst("sub")?.Value ??
                context.Connection.RemoteIpAddress?.ToString() ??
                "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var neonAuthBaseUrl = builder.Configuration["NEON_AUTH_BASE_URL"]
    ?? builder.Configuration["NeonAuth:BaseUrl"];
if (!Uri.TryCreate(neonAuthBaseUrl, UriKind.Absolute, out var neonAuthUri) ||
    (neonAuthUri.Scheme != Uri.UriSchemeHttps &&
     !(builder.Environment.IsDevelopment() && neonAuthUri.IsLoopback &&
       neonAuthUri.Scheme == Uri.UriSchemeHttp)) ||
    !string.IsNullOrEmpty(neonAuthUri.Query) ||
    !string.IsNullOrEmpty(neonAuthUri.Fragment) ||
    !string.IsNullOrEmpty(neonAuthUri.UserInfo))
{
    throw new InvalidOperationException(
        "Configure NEON_AUTH_BASE_URL with the Neon Auth base URL over HTTPS.");
}

var neonIssuer = neonAuthUri.GetLeftPart(UriPartial.Authority);
var neonJwksUri = new Uri(
    $"{neonAuthUri.ToString().TrimEnd('/')}/.well-known/jwks.json");

builder.Services.AddSingleton(new NeonJwtSettings(neonIssuer, neonJwksUri));
builder.Services.AddHttpClient<NeonJwksProvider>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});
builder.Services
    .AddAuthentication("Neon")
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions,
        NeonJwtAuthenticationHandler>("Neon", _ => { });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("NeonAuthenticated", policy =>
        policy.RequireAuthenticatedUser());
    options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .AddRequirements(new WmsPermissionRequirement())
        .Build();
    options.FallbackPolicy = options.DefaultPolicy;
    AddRolePolicy(options, "WmsAdmin", WMS.Domain.WmsRole.Admin);
    AddRolePolicy(options, "WmsMasterWrite",
        WMS.Domain.WmsRole.Admin,
        WMS.Domain.WmsRole.WarehouseManager);
    AddRolePolicy(options, "WmsOperationalWrite",
        WMS.Domain.WmsRole.Admin,
        WMS.Domain.WmsRole.WarehouseManager,
        WMS.Domain.WmsRole.WarehouseOperator);
    AddRolePolicy(options, "WmsOrderManage",
        WMS.Domain.WmsRole.Admin,
        WMS.Domain.WmsRole.WarehouseManager);
    AddRolePolicy(options, "WmsDispatch",
        WMS.Domain.WmsRole.Admin,
        WMS.Domain.WmsRole.WarehouseManager,
        WMS.Domain.WmsRole.WarehouseOperator);
});

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];
if (builder.Environment.IsDevelopment() && allowedOrigins.Length == 0)
{
    allowedOrigins = ["http://localhost:5173"];
}
else if (allowedOrigins.Length == 0)
{
    throw new InvalidOperationException(
        "Configure Cors:AllowedOrigins with the frontend origin.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigins)
            .WithMethods("GET", "POST", "PUT", "DELETE")
            .WithHeaders("Authorization", "Content-Type", "Idempotency-Key"));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

app.Run();

static void AddRolePolicy(
    Microsoft.AspNetCore.Authorization.AuthorizationOptions options,
    string name,
    params WMS.Domain.WmsRole[] roles) =>
    options.AddPolicy(name, policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.AddRequirements(new WmsPermissionRequirement(roles));
    });
