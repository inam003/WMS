# React + TypeScript + Vite

## Neon Auth API verification

The signed-in home page includes a **Verify API access** action. It obtains a short-lived JWT with the Neon Auth SDK's `neon.auth.token()` method and sends it as a bearer token to `GET /api/auth/me`. The API verifies the EdDSA signature against Neon Auth's JWKS and checks the issuer, audience, and expiration.

Configure `VITE_API_BASE_URL` in the client environment (for the supplied HTTPS API launch profile, use `https://localhost:7215`). Configure `NEON_AUTH_BASE_URL` for the API with the Neon Auth base URL. In production, also configure `Cors:AllowedOrigins` (or `Cors__AllowedOrigins`) with the exact frontend origin. Development allows `http://localhost:5173` by default.

To run the API locally, use the API project directory (not the solution root):

```powershell
Set-Location A:\WMS\WMS.Api\WMS.Api
$authLine = Get-Content ..\..\WMS.Client\.env | Where-Object { $_ -match '^VITE_NEON_AUTH_URL=' } | Select-Object -First 1
$env:NEON_AUTH_BASE_URL = ($authLine -replace '^VITE_NEON_AUTH_URL=', '').Trim().Trim('"')
dotnet run --launch-profile https
```

If the browser reports a certificate error for the local HTTPS API, trust the ASP.NET development certificate with `dotnet dev-certs https --trust`.

Neon Auth JWTs expire after 15 minutes; the client requests a fresh token each time the API action is used.

## Invitation-based WMS access

Neon Auth sign-in alone does not grant WMS access. An Admin sends invitations from
**Users & access**. The recipient opens the email link to accept the invitation,
then creates an account with that same email address. WMS access is provisioned
after Neon Auth signs the account in with a verified email. The API uses the
signed JWT `sub`, `email`, and `email_verified: true` claims for provisioning;
an email address supplied by the browser is never used to grant access.

Configure these values in the API environment:

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_APITOKEN` | Yes for invitations | Resend API token; keep it in a secret store and never in client configuration. |
| `WMS_FROM_EMAIL` | Yes for invitations | Sender address belonging to a verified Resend domain. |
| `WMS_FRONTEND_URL` | Yes for invitations | Trusted absolute frontend URL used to build accept links. HTTPS is required except for loopback URLs in Development. |
| `WMS_INVITATION_EXPIRY_DAYS` | No | Invitation lifetime from 1 to 90 days; defaults to 7. |

Resend requires a verified sending domain for production. Do not use
`onboarding@resend.dev` as a production sender; configure `WMS_FROM_EMAIL` with
an address on a domain verified in Resend.

The `AddInvitationBasedWmsAccess` EF Core migration creates invitation storage
and backfills `AccessProvisionedAt` only for existing Admin assignments. This
explicitly preserves the current Admin access without grandfathering Viewer or
other legacy first-seen assignments that may have been created automatically.
Existing non-Admin role assignments remain in the database, but have no WMS
access until an Admin invites them and the invitation is accepted by opening its
email link; the matching verified account receives the invitation's role when it
signs in. The API does not apply migrations
at startup. Review and apply migrations using the project's existing EF Core
deployment workflow before deploying this version.

Admin invitation routes are `GET/POST /api/users/invitations`,
`POST /api/users/invitations/{id}/resend`, and
`POST /api/users/invitations/{id}/revoke`. Public invitation acceptance is
`POST /api/invitations/claim`; token validation and claiming are rate-limited.
WMS users can be removed only after their access has been deactivated.

No automated invitation integration-test project is currently configured.
Before production, verify the complete signup/acceptance flow, email mismatch,
unverified email, expired/revoked/reused tokens, Resend failures, concurrent
acceptance, and preservation of the existing Admin after applying the migration.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
