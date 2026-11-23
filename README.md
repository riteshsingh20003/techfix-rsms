# TechFix — Repair & Service Management System

A modern rebuild of the repository's RSMS (Repair & Service Management System) using React, TypeScript, Tailwind CSS, Node.js, Express and PostgreSQL.

This repository contains the source application, not a claim of production certification. The test section below separates checks that can run locally from checks that require a working PostgreSQL instance and browser.

## Features

- Admin and technician accounts with server-enforced role permissions.
- HttpOnly session cookie containing a short-lived JWT; no JWT in localStorage.
- CSRF token on authenticated write operations and strict origin allowlisting.
- Password change, sign-out revocation and server-side account/token-version checks. Bcrypt input is capped at 72 UTF-8 bytes to avoid silent bcrypt truncation.
- Login, API and public tracking rate limits (per process; see production notes).
- Customer and service management with bounded, searchable pagination.
- Repair creation, secure high-entropy repair codes and controlled repair-status transitions.
- Paginated repair lists and dashboard counts for all six repair statuses.
- Keyboard-aware accessible dialogs with focus trapping, Escape handling and focus restoration.
- Repair-status audit history.
- Payment ledger with partial payments, supported payment methods, references and remaining-balance calculations.
- Public repair tracking intentionally returns only reference, status and timestamps. It does not disclose a customer name, phone number, address, remarks, itemized costs or payment details.
- Parameterized SQL, Zod validation, payload limits, centralized error handling, Helmet, CORS allowlisting and graceful server shutdown.
- Responsive frontend with loading, error and empty states.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- Docker Desktop (recommended for local PostgreSQL) or PostgreSQL 14+

## Local setup

1. Extract the archive and open the `rsms-modern` folder in VS Code.
2. Start the local database:

   ```bash
   docker compose up -d postgres
   ```

   The database is bound to `127.0.0.1:5432` and uses a development-only password. Do not reuse these local credentials in a deployed environment.

3. Copy the backend environment file:

   ```bash
   cp server/.env.example server/.env
   ```

   On Windows PowerShell, use:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

4. Edit `server/.env`. Generate a unique JWT key by running:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

   Paste the output as `JWT_SECRET`. For the first database setup only, also set an administrator username and a unique password of at least 14 characters containing uppercase, lowercase, a number and a symbol:

   ```env
   INITIAL_ADMIN_USERNAME=your-admin-name
   INITIAL_ADMIN_PASSWORD=your-own-long-unique-password
   ```

   Do not publish `server/.env` or share its contents. `.env` files are excluded by `.gitignore`.

5. Install packages:

   ```bash
   npm install
   npm install --prefix server
   npm install --prefix client
   ```

6. Apply database migrations and create the starter services / initial administrator:

   ```bash
   npm run db:setup
   ```

   The setup command deliberately does not create a predictable demo administrator or password. Once an active administrator exists, subsequent setup runs will not reset that account's password.

7. Start the API and frontend:

   ```bash
   npm run dev
   ```

8. Open `http://localhost:5173` and sign in with the administrator credentials you configured in step 4.

## Validation and tests

See [`QUALITY_ASSURANCE.md`](./QUALITY_ASSURANCE.md) for the verification record and the tests that still require a local PostgreSQL / npm environment.

Run the available local checks from the project root:

```bash
npm run check:static
npm test
```

The static check transpiles all TS/TSX sources to detect syntax issues, validates JSON configuration, checks relative imports and scans for a few known-risk patterns. The unit tests cover repair-workflow transitions, decimal calculations, input validation and password rules.

Run the TypeScript / frontend production-build checks after installing dependencies:

```bash
npm run typecheck
npm run build
```

Run dependency vulnerability checks when the npm registry is available:

```bash
npm audit --prefix server
npm audit --prefix client
```

The migration runner is idempotent and records applied SQL filenames in `schema_migrations`. New schema changes should be added as a new, ordered SQL file in `server/src/db/migrations`; do not edit an already-applied migration on an existing installation.

## Roles and permissions

| Capability | Admin | Technician |
|---|---:|---:|
| View dashboard, customers, services and repair jobs | Yes | Yes |
| Create repair jobs and move a job through the workflow | Yes | Yes |
| Create, edit or delete customer records | Yes | No |
| Create, edit or archive service catalogue entries | Yes | No |
| Record payments | Yes | No |
| Change own password / sign out | Yes | Yes |
| Permanently delete repair history | No API endpoint | No API endpoint |

Repair history is intentionally retained. Use the cancelled status for a job that will not proceed. Allowed transitions are `pending → approved → in_progress → checking → done`, with cancellation available before completion and a `checking → in_progress` loop for rework. Completed and cancelled jobs are terminal.

## Payment rules

Payments are append-only ledger entries. A payment can be recorded only for a completed repair, must be positive, and cannot exceed the remaining balance. Requests include a UUID idempotency key; exact retries return the existing repair result, while reusing a key with different details is rejected. The API calculates `unpaid`, `partial` or `paid` from the payment ledger. A repair with recorded payments cannot be cancelled; refunds are not implemented in this version. Monetary arithmetic on the server uses integer paise while PostgreSQL stores amounts as `NUMERIC(12,2)`.

## API overview

All responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "message": "...", "errors": ... }`. List endpoints `GET /api/clients`, `GET /api/services` and `GET /api/repairs` accept `search`, `page` and `pageSize` (1–100) and return `{ items, page, pageSize, total, totalPages }` within `data`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health/live` | Public | Process liveness |
| GET | `/api/health/ready` | Public | Database readiness |
| POST | `/api/auth/login` | Public, rate limited | Sign in and set HttpOnly session cookie |
| GET | `/api/auth/me` | Session | Current active user |
| POST | `/api/auth/logout` | Session + CSRF | Revoke current account sessions and clear cookies |
| POST | `/api/auth/change-password` | Session + CSRF | Change password and rotate session |
| GET | `/api/dashboard/summary` | Session | Dashboard metrics |
| GET/POST | `/api/clients` | Session / Admin + CSRF | List / create customers |
| GET/PATCH/DELETE | `/api/clients/:id` | Session / Admin + CSRF for writes | Read / update / delete customers |
| GET/POST | `/api/services` | Session / Admin + CSRF for writes | List / create services |
| GET/PATCH/DELETE | `/api/services/:id` | Session / Admin + CSRF for writes | Read / update / archive services |
| GET/POST | `/api/repairs` | Session / Session + CSRF | List / create repairs |
| GET | `/api/repairs/:id` | Session | Repair details, payments and status history |
| PATCH | `/api/repairs/:id/status` | Session + CSRF | Enforce a valid workflow transition / update remarks |
| POST | `/api/repairs/:id/payments` | Admin + CSRF | Record a payment against the outstanding balance |
| GET | `/api/repairs/track/:code` | Public, rate limited | Return minimal public status information |

Browser API requests use same-site cookies and an `X-CSRF-Token` header for state-changing operations. The frontend and API must be deployed under the same origin (for example, `https://app.example.com` with the API reverse-proxied at `https://app.example.com/api`) with HTTPS. Do not deploy the API on a separate subdomain in this configuration: the CSRF cookie is intentionally host-only so the browser can read it safely from the frontend origin. Production cookies use the `__Host-` prefix, are `Secure`, `HttpOnly` for the session cookie, `Path=/`, host-only and `SameSite=Strict`; the CSRF double-submit value is HMAC-signed, and the backend validates request Origin and the CSRF token. Configure `CLIENT_ORIGIN` as an explicit comma-separated allowlist of exact frontend origins.

## Project structure

```text
rsms-modern/
├── client/                 # React + TypeScript + Tailwind UI
│   └── src/
│       ├── components/      # Layout, protected routes, reusable UI
│       ├── context/         # Session/auth state
│       ├── lib/             # Axios client and shared types
│       └── pages/           # Dashboard, customers, services, repairs, tracking, account
├── server/                 # Express REST API
│   └── src/
│       ├── config/          # Environment validation
│       ├── controllers/     # HTTP handlers
│       ├── db/              # PostgreSQL pool, migrations and seed script
│       ├── middleware/      # Auth, CSRF, rate limits, validation, errors
│       ├── models/          # Parameterized database operations
│       ├── routes/          # REST route definitions
│       ├── test/            # Node test-runner unit tests
│       ├── utils/           # API errors, JWT and repair workflow helpers
│       └── validators/      # Zod request schemas
├── docker-compose.yml
└── package.json
```

## Known scope gaps and production hardening still required

The current rebuild is not a complete feature-for-feature replacement for every page in the legacy PHP project. Staff-account management, inquiry/message administration, configurable system settings, editing repair line items after creation, invoice/receipt generation and refunds are still backlog items. Do not simulate refunds by editing payment rows or status values directly.


This application has meaningful security improvements, but a source review cannot certify that a system has no vulnerabilities. Before handling real customer data:

- Replace the in-memory rate limiter with a shared Redis-backed store when running multiple API instances.
- Use managed PostgreSQL with TLS, least-privilege database credentials, private networking, backups and tested restore procedures.
- Use a deployment secrets manager; never commit `.env` files, JWT secrets or database credentials.
- Run `npm audit` and a current dependency / container scan in CI and keep dependencies patched.
- Add PostgreSQL-backed integration tests, browser end-to-end tests, load tests and an independent security assessment.
- Add an audited refund/reversal workflow, payment reconciliation, receipt/invoice generation and immutable audit actor metadata before processing real payments.
- Add staff-account management (create, disable, role assignment, forced password reset) and MFA for administrators.
- Add contact/inquiry management, configurable system settings and repair line-item edit controls if the original RSMS feature set must be fully matched.
- Configure monitoring, alerting, log retention and incident-response procedures. Keep repair codes out of request logs; this API redacts them from its access log.

Database migrations use a PostgreSQL advisory lock to prevent two deployment processes from applying the same migration concurrently. The custom in-memory rate limiter is suitable only for a single server process. It does not share counters across workers or replicas and its limits reset when the process restarts. The application has not been penetration-tested or certified against a formal security standard.
