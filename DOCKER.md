# Docker / Azure App Service deployment notes

Two images, one per Azure Web App (Linux, "Docker Container"). Both listen on **port 8080**.
Set `WEBSITES_PORT=8080` on both Web Apps.

## Backend (`WMS.Api/Dockerfile`, context `WMS.Api`)

```
docker build -t wms-api:latest WMS.Api
docker run --rm -p 8080:8080 --env-file api.env wms-api:latest
```

Runs as non-root (`app`), .NET 10 `aspnet` runtime, `ASPNETCORE_HTTP_PORTS=8080`.
No secrets or `appsettings.Development.json` are in the image. No migrations run at startup
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
  --build-arg VITE_API_BASE_URL=https://<api-app>.azurewebsites.net ^
  --build-arg VITE_NEON_AUTH_URL=<neon auth url> ^
  --build-arg VITE_NEON_DATA_API_URL=<neon data api url, optional> WMS.Client
docker run --rm -p 8081:8080 wms-client:latest
```

- `VITE_API_BASE_URL`: backend origin without a trailing slash and without `/api` (the client appends the paths).
- VITE_API_BASE_URL and VITE_NEON_AUTH_URL are required; the build fails if either is empty.
- VITE_NEON_DATA_API_URL is **optional**. It is passed to the Neon client in src/lib/neon.ts (dataApi.url), but the app only uses 
eon.auth and never queries the Data API, so the client works without it. Take it from the Neon console (Data API / REST URL, ends in /rest/v1) only if Data API use is added.
- **`VITE_` values are compiled into the public JavaScript. Never put secrets in them.**
- Changing a URL means rebuilding the image.

## Before deploying

- Add the frontend origin to Neon Auth trusted origins, and make sure the Neon Auth session works cross-site (frontend and API are on different hosts).
- Apply EF migrations manually.
- CORS only allows GET/POST/PUT/DELETE with `Authorization`, `Content-Type`, `Idempotency-Key`.
