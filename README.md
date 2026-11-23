# Warehouse Management System (WMS)

A full-stack warehouse management application for managing products, stock,
locations, receiving, transfers, adjustments, orders, dispatch, reports, and
role-based user access.

**Live demo:** https://wms-pi-rose.vercel.app

## Demo account

| Field | Value |
| --- | --- |
| Email | `test@gmail.com` |
| Password | `Test@123` |

> This is a demonstration account. Do not use it to store sensitive or
> production data.

## Features

- Neon Auth sign-in with EdDSA JWT verification through Neon JWKS
- Role-based access for Admin, Warehouse Manager, Warehouse Operator, and Viewer
- Invitation-based WMS user provisioning
- Product, category, warehouse, and location management
- Barcode and QR code support
- Inventory by product, warehouse, and storage location
- Goods receiving with idempotent requests
- Warehouse and location transfers
- Inventory adjustments with required reasons
- Sales order creation and stock dispatch
- Inventory transaction history
- Stock, movement, receiving, adjustment, transfer, and order reports
- Audit history with actor, timestamp, and before/after values
- Negative-stock prevention and transactional inventory updates

## Tech stack

### Frontend

- React 19
- TypeScript
- Vite
- Material UI
- TanStack Query
- React Router
- Neon Auth JavaScript SDK
- JsBarcode

### Backend

- ASP.NET Core 10
- Entity Framework Core 10
- PostgreSQL / Neon
- BouncyCastle Ed25519 verification
- Resend invitation emails
- Clean layered structure

### Deployment

- Vercel Services
- Vite frontend served from `/`
- Dockerized ASP.NET API served from `/api/*`
- Docker multi-stage builds

## Architecture

```text
WMS/
├── WMS.Client/                  # React and Vite frontend
│   ├── src/components/
│   ├── src/pages/
│   ├── src/hooks/
│   └── src/lib/
├── WMS.Api/
│   ├── WMS.Api/                 # Controllers, authentication, authorization
│   ├── WMS.Application/         # Application services and contracts
│   ├── WMS.Domain/              # Domain entities and business types
│   └── WMS.Infrastructure/      # EF Core, repositories, migrations
├── vercel.json                  # Single-project Vercel Services routing
├── DOCKER.md                    # Container and Vercel configuration
└── Features.md                  # Feature inventory
```

The API controllers use routes beneath `/api`, while the Vite frontend uses
same-origin API requests in production. Vercel routes requests so `/api/*`
reaches the ASP.NET service and all other paths reach the React application.

## Prerequisites

- .NET 10 SDK
- Node.js 24
- npm
- A Neon PostgreSQL database
- A Neon Auth project
- Resend credentials if invitation emails are enabled
- Docker, optional, for local container builds

## Local development

### 1. Configure the frontend

Create `WMS.Client/.env`:

```dotenv
VITE_NEON_AUTH_URL=https://<neon-auth-host>/<project-path>/auth
VITE_API_BASE_URL=https://localhost:7215
VITE_NEON_DATA_API_URL=
```

`VITE_API_BASE_URL` is required for local development. It is intentionally
omitted for the single-project Vercel Services deployment.

### 2. Configure the API

Create `WMS.Api/WMS.Api/appsettings.Development.json`:

```json
{
  "NeonAuth": {
    "BaseUrl": "https://<neon-auth-host>/<project-path>/auth"
  },
  "ConnectionStrings": {
    "DefaultConnection": "<Neon PostgreSQL connection string>"
  },
  "RESEND_APITOKEN": "<Resend API token>",
  "WMS_FROM_EMAIL": "<verified sender email>",
  "WMS_FRONTEND_URL": "http://localhost:5173"
}
```

Development configuration and `.env` files are ignored by Git. Never commit
database passwords, API tokens, or other secrets.

### 3. Apply database migrations

From the `WMS.Api` directory:

```powershell
dotnet ef database update --project WMS.Infrastructure --startup-project WMS.Api
```

Migrations are not applied automatically when the API starts.

### 4. Run the API

```powershell
Set-Location WMS.Api\WMS.Api
dotnet run --launch-profile https
```

### 5. Run the frontend

In another terminal:

```powershell
Set-Location WMS.Client
npm ci
npm run dev
```

The frontend runs on `http://localhost:5173` by default, and the HTTPS API
profile uses `https://localhost:7215`.

## Build and validation

```powershell
# Frontend
Set-Location WMS.Client
npm run lint
npm run build

# API, from the repository root
Set-Location ..\WMS.Api
dotnet build WMS.Api.slnx -c Release
```

## Vercel deployment

The repository is configured as one Vercel Services project through the root
`vercel.json`.

Set these Vercel environment variables:

```text
VITE_NEON_AUTH_URL=<Neon Auth base URL>
ConnectionStrings__DefaultConnection=<Neon PostgreSQL connection string>
NEON_AUTH_BASE_URL=<Neon Auth base URL>
Cors__AllowedOrigins__0=https://<production-domain>
WMS_FRONTEND_URL=https://<production-domain>
PORT=8080
```

For invitation emails:

```text
RESEND_APITOKEN=<Resend API token>
WMS_FROM_EMAIL=<verified Resend sender address>
WMS_INVITATION_EXPIRY_DAYS=7
```

Optional:

```text
VITE_NEON_DATA_API_URL=<Neon Data API URL>
```

Do not set `VITE_API_BASE_URL` for the single-project deployment. Add the exact
production frontend origin to Neon Auth's trusted domains and apply database
migrations before use.

See [DOCKER.md](./DOCKER.md) for container build details and the two-project
Vercel fallback.

## API areas

The application exposes authenticated endpoints for:

- `/api/auth`
- `/api/users`
- `/api/invitations`
- `/api/products`
- `/api/categories`
- `/api/warehouses`
- `/api/locations`
- `/api/inventory`
- `/api/inventory-transactions`
- `/api/orders`
- `/api/reports`
- `/api/audit`

## Security

- Bearer tokens are verified against Neon Auth JWKS.
- API permissions are enforced by server-side authorization policies.
- Database and Resend credentials must remain server-side.
- `VITE_*` values are compiled into public frontend assets and must not contain
  secrets.
- Invitation links are tokenized and access is provisioned only from verified
  Neon Auth identities.

## Useful documentation

- [Feature inventory](./Features.md)
- [Container and deployment guide](./DOCKER.md)
- [Frontend notes](./WMS.Client/README.md)
- [Audit retention notes](./WMS.Api/AUDIT-RETENTION.md)
