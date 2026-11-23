# TechFix RSMS — hardening and verification report

**Review date:** 22 November 2026  
**Scope:** Source-level review and corrective changes to the generated `rsms-modern` application. The original PHP repository was not modified.

## Executive result

The source has been hardened against the main findings in the previous review. The static source review and six isolated helper/security tests passed. However, a complete project build, full dependency audit, PostgreSQL integration run, browser/E2E suite and penetration test could not be completed in this environment because npm dependency installation timed out and no PostgreSQL/Docker runtime is available.

**This is not a claim that the application is vulnerability-free or production-certified.** Do not use it with real customer or payment data until the blocked checks in this report have been completed in a working deployment/test environment.

## Previous findings — disposition

| Finding | Disposition | Corrective work / remaining caveat |
|---|---|---|
| F01 — Predictable demo administrator | Fixed in source | No demo admin or password is seeded. The first administrator must be explicitly configured via `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`; the account is not reset by later seed runs. |
| F02 — Weak role enforcement | Fixed in source | Admin-only writes for customers/services/payments are enforced on the API, not only hidden in the UI. Technician repair actions are limited by the server-side repair state machine. |
| F03 — Sessions surviving account disable/password rotation | Fixed in source | Every authenticated request checks the active user and current database `token_version`; passwords rotate the token version, and the current session receives a new token. |
| F04 — Public tracking disclosure | Fixed in source | The public DTO exposes only repair reference, status and timestamps. It does not expose names, contact details, remarks, line items or payments. Tracking codes use 128 bits of cryptographic randomness; legacy short references are rotated during migration. |
| F05 — Missing request throttling | Partially fixed | Global API, login and tracking limits are present. The limiter is in-memory and single-process; a shared Redis-backed limiter is still required for multiple workers/replicas and robust distributed abuse protection. |
| F06 — Unrestricted repair status changes/deletion | Fixed in source | Status transitions are validated and row-locked. Repairs cannot be permanently deleted through the API; cancellation is a workflow status. |
| F07 — Manual paid/unpaid boolean | Fixed in source | Payments are append-only ledger rows with idempotency keys; totals and outstanding balances are derived. Partial payments are supported. Refunds/reversals are not implemented. |
| F08 — Floating-point money handling | Fixed in source | Server calculations use integer paise; PostgreSQL uses `NUMERIC(12,2)`. UI currency formatting consistently shows two decimal places. |
| F09 — Unbounded list endpoints | Fixed in source | Customer, service and repair lists use bounded pagination (`pageSize` 1–100), stable sort order, total counts and clamped page numbers. |
| F10 — Missing request validation | Fixed in source | Zod schemas validate IDs, query parameters, pagination, filters, request bodies, money and payment idempotency. Database values use bound SQL parameters; dynamic update columns are allowlisted. |
| F11 — No migrations/tests/consistency controls | Partially fixed | Ordered migration files, migration history and a PostgreSQL advisory lock are implemented. Unit tests exist. Full database-backed migration and concurrency tests remain unrun here. |
| F12 — JWT in localStorage | Fixed in source | The frontend no longer stores JWTs in localStorage. Production uses Secure, HttpOnly, host-only `__Host-` session cookies, signed CSRF double-submit values and exact Origin checks for unsafe requests, including login. |
| F13 — Legacy feature parity gaps | Still open | Staff-account management UI, contact/inquiry management, configurable system settings, repair line-item editing, invoices/receipts and refunds are not all implemented. This is a functional scope gap, not evidence of a security exploit. |
| F14 — Incomplete dashboard status view | Fixed in source | Pipeline totals now include pending, approved, in-progress, checking, completed and cancelled repairs. |
| F15 — Modal/form accessibility and native alerts | Improved in source | Modal now has dialog semantics, initial focus, focus trapping, Escape handling and focus restoration. Form labels are associated with controls; destructive confirmations and error feedback use in-app UI instead of browser `confirm()`/`alert()`. Browser/screen-reader verification remains outstanding. |

An additional connection-pool safety issue was corrected: the repair status update path now releases its transaction connection before querying the updated repair summary, avoiding a potential pool starvation/deadlock under concurrent status updates.

## Verification actually run

| Check | Result | Evidence / limits |
|---|---|---|
| TypeScript/TSX syntax transpilation | **PASS** | `npm run check:static` transpiled 54 source files with no syntax diagnostics. This is syntax transpilation, not full semantic type-checking. |
| JSON configuration parsing | **PASS** | Root/server/client package and TypeScript configuration files parsed. |
| Relative import resolution | **PASS** | All relative imports found matching source files. |
| Static risky-pattern scan | **PASS** | No flagged demo password, `Math.random`, localStorage JWT write, repair hard-delete SQL, manual paid-state assertion, raw HTML injection, `eval`, document.write, browser alert or browser confirm patterns. |
| Required-guard scan | **PASS** | Checks found token-version auth, signed CSRF, exact Origin policy, payment ledger/idempotency, tracking DTO, migrations, bounded pagination and accessible modal/pagination guards. |
| CSRF unit tests | **PASS** | Two Node test-runner tests passed: valid token verification, wrong-secret rejection, tampering rejection and malformed-token rejection. |
| Pagination/origin/workflow/money helper tests | **PASS** | Four isolated Node tests passed for page clamping and page-size bounds, production Origin policy, allowed/blocked repair transitions and integer minor-unit calculations. |
| Strict TypeScript check for isolated helpers/tests | **PASS** | Global TypeScript compiler checked `csrf`, `origin-policy`, `pagination`, `repair-workflow` and their dependency-free tests with strict mode. Not a full app type-check. |
| Full dependency install | **BLOCKED** | `npm install --ignore-scripts --no-audit --no-fund` timed out after 180 seconds. No complete installed dependency tree or reproducible lockfile was produced. |
| Full backend tests | **BLOCKED** | Requires installed packages (`tsx`, `zod`, etc.); the full suite was not rerun successfully after these changes. |
| Full backend type-check / frontend production build | **BLOCKED** | Cannot perform reliable semantic checks or production bundling without the project dependencies. |
| PostgreSQL migration / CRUD / concurrency integration | **NOT RUN** | No PostgreSQL server, `psql` or Docker runtime is available here. |
| npm dependency vulnerability audit | **NOT RUN** | npm install did not complete and no lockfile exists. A clean `npm audit` and container scan must be run in CI or a network-enabled environment. |
| Browser, keyboard and responsive E2E tests | **NOT RUN** | No browser automation session was available. Modal focus and screen-reader behavior still need browser verification. |
| Independent penetration test | **NOT RUN** | The source/static checks are not a penetration test or formal security certification. |

## Important implementation notes

### Authentication and browser security

- Production deployment must serve the frontend and API under one HTTPS origin, normally using a reverse proxy at `/api`.
- Set `CLIENT_ORIGIN` to the exact HTTPS frontend origin(s), without wildcards or trailing slash.
- Generate a unique high-entropy `JWT_SECRET`; never use the example value.
- Configure `TRUST_PROXY_HOPS` to the actual trusted reverse-proxy count. Do not enable broad proxy trust without verifying the proxy chain.
- Configure a secrets manager and least-privilege database credentials. Keep `.env` out of Git.

### Rate limiting

The in-memory limiter does not coordinate across processes and resets on restart. Replace it with a shared Redis-backed limiter before horizontally scaling or exposing the service to sustained internet traffic. The public tracking code is a bearer secret; do not share it in logs, analytics or screenshots.

### Pagination and search

List endpoints return `{ items, page, pageSize, total, totalPages }`. The API enforces `pageSize <= 100`. Search uses parameterized substring predicates; for very large datasets, profile query plans and add suitable PostgreSQL trigram/full-text indexes after confirming `pg_trgm` availability and deployment permissions.

### Outstanding feature work

F13 remains an explicit backlog item: staff account provisioning/deactivation and role administration, contact/inquiry management, configurable business/system settings, editing repair line items after creation, tax/discount policy if needed, printable receipts/invoices, and a properly audited refund/reversal workflow. Avoid direct database edits to simulate refunds or change payment status.

## Required verification before production

Run the following from the project root in a network-enabled environment with Docker Desktop or PostgreSQL available:

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run check:static
npm run typecheck
npm test
npm run build
npm audit --prefix server
npm audit --prefix client
docker compose up -d postgres
npm run db:setup
npm run dev
```

Also run database-backed tests for clean install and upgrade, concurrent migration execution, concurrent idempotent payment submissions, duplicate idempotency keys with mismatched payloads, payment overrun attempts, role bypass attempts, disabled-account session invalidation, invalid/missing Origin and CSRF requests, public tracking data leakage, rate-limit behavior behind the actual reverse proxy, backup/restore, and browser keyboard/accessibility flows.

Do not treat a passing static scan as proof that all vulnerabilities are absent. Re-run dependency audits after every dependency update and arrange an independent security review before production use.
