# Docker and deployment notes

Two images, one per Azure Web App (Linux, "Docker Container"). Both listen on **port 8080**.
Set `WEBSITES_PORT=8080` on both Web Apps.

## Backend (`WMS.Api/Dockerfile`, context `WMS.Api`)

```
docker build -t wms-api:latest WMS.Api
docker run --rm -p 8080:8080 --env-file api.env wms-api:latest
```

Runs as non-root (`app`) on the .NET 10 `aspnet` runtime. Production listens on
`0.0.0.0` using `PORT` when supplied, otherwise port `8080`. No secrets or
`appsettings.Development.json` are in the image. No migrations run at startup
(apply them separately). The API has no unauthenticated health endpoint (all routes require auth),
so do not enable App Service Health Check until one is added.

### App settings (Azure -> Configuration)

| Setting | Notes |
| --- | --- |
| `NeonAuth__BaseUrl` (or `NEON_AUTH_BASE_URL`) | Neon Auth base URL, must be HTTPS |
| `ConnectionStrings__DefaultConnection` | Postgres connection string |
| `RESEND_APITOKEN` | Resend API token |
| `WMS_FROM_EMAIL` | Verified sender address |
| `WMS_FRONTEND_URL` | Deployed frontend origin, e.g. `https://<frontend>.azurewebsites.net` |
| `Cors__AllowedOrigins__0` | Same frontend origin, **required in Production** (app throws at startup if missing) |
| `WEBSITES_PORT` | `8080` |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` (TLS is terminated by App Service; the app has no forwarded-headers code) |

Use Key Vault references for the token and connection string.

## Frontend (`WMS.Client/Dockerfile`, context `WMS.Client`)

Multi-stage: Node 24 build (`npm ci`, `npm run build`) -> unprivileged Nginx serving `dist` with SPA fallback.
Node 24 is used because the lockfile is not accepted by `npm ci` on Node 22's npm.

```
docker build -t wms-client:latest ^
  --build-arg VITE_NEON_AUTH_URL=<neon auth url> ^
  --build-arg VITE_NEON_DATA_API_URL=<neon data api url, optional> WMS.Client
docker run --rm -p 8081:8080 wms-client:latest
```

- `VITE_NEON_AUTH_URL` is required.
- `VITE_API_BASE_URL` is optional for a same-origin deployment. Set it to the
  backend origin for local development or a separately deployed API, without a
  trailing slash or `/api`.
- `VITE_NEON_DATA_API_URL` is **optional**. It is passed to the Neon client in
  `src/lib/neon.ts`, but the app only uses `neon.auth` and never queries the
  Data API. Take it from the Neon console (Data API / REST URL, ends in
  `/rest/v1`) only if Data API use is added.
- **`VITE_` values are compiled into the public JavaScript. Never put secrets in them.**
- Changing a URL means rebuilding the image.

## Vercel Services

Import the repository as one Vercel project and keep the repository root at the
repository root. The root `vercel.json` defines a Vite `frontend` service from
`WMS.Client` and a container `api` service from `WMS.Api`. Public requests under
`/api/*` go to the API with their path unchanged; all other requests go to the
React service.

Set these project environment variables for Production and Preview as
appropriate:

| Service configuration | Variable | Required | Value |
| --- | --- | --- | --- |
| Frontend build | `VITE_NEON_AUTH_URL` | Yes | Neon Auth base URL |
| Frontend build | `VITE_NEON_DATA_API_URL` | No | Neon Data API URL, if needed |
| API | `ConnectionStrings__DefaultConnection` | Yes | Neon PostgreSQL connection string |
| API | `NEON_AUTH_BASE_URL` | Yes | Neon Auth base URL |
| API | `Cors__AllowedOrigins__0` | Yes | Exact frontend origin, including `https://` |
| API | `WMS_FRONTEND_URL` | Yes | Exact frontend origin used for invitation links |
| API | `RESEND_APITOKEN` | Yes for invitations | Resend API token |
| API | `WMS_FROM_EMAIL` | Yes for invitations | Verified Resend sender address |
| API | `WMS_INVITATION_EXPIRY_DAYS` | No | Invitation lifetime, 1-90 days; default 7 |
| Container runtime | `PORT` | Recommended | Set to `8080` if Vercel does not inject it |

Do not define `VITE_API_BASE_URL` for the single-project Services deployment.
The production frontend then uses same-origin `/api/...` requests. The API's
Neon Auth base URL continues to provide its JWKS endpoint at
`/.well-known/jwks.json`; no separate JWKS variable is required.

If Services is not offered by the Vercel import flow, deploy two Vercel
projects from the same repository. Use `WMS.Client` as the Vite frontend Root
Directory (`npm ci`, `npm run build`, output `dist`) and `WMS.Api` as the
Container backend Root Directory. The frontend project also contains a
`vercel.json` SPA fallback. For the frontend, additionally set
`VITE_API_BASE_URL` to the API project's HTTPS origin; leave it unset in the
single-project Services deployment.

## Before deploying

- Add the exact frontend origin to Neon Auth trusted domains. For Services this
  is the shared Vercel production origin; add preview origins separately if
  previews will be used for authentication.
- Apply EF migrations manually.
- CORS only allows GET/POST/PUT/DELETE with `Authorization`, `Content-Type`, `Idempotency-Key`.
