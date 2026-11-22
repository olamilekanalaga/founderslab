# Founders Lab

A private founder-programme workspace with public booking, hosted by **⭕️La_Crrypt💰₿**. The application uses one domain, a light interface, Next.js, TypeScript, Prisma and PostgreSQL.

## What you do next

The application is implemented on the existing Vercel project. A custom website domain is optional; the current `founderslab-orcin.vercel.app` address can be used.

1. Sign in at `/signin` using your pre-provisioned Admin account and confirm you can see Overview, approvals and Reports.
2. Configure or verify transactional email in Vercel: `RESEND_API_KEY`, `MANAGER_EMAIL_FROM` and the canonical HTTPS `APP_ORIGIN`. The sending domain must be verified in Resend. You can use an existing domain you own; you do not need to buy a second domain.
3. In Settings → Space Managers, invite your friend, assign their Spaces, and test one real email link, save and revocation. Real inbox delivery has not been verified by the automated tests.
4. Check one public application → approval → actual attendance submission → Overview/Reports journey on the deployed site.
5. If you later add a custom domain, connect it to this same Vercel project, update `APP_ORIGIN`, redirect the old website address to the canonical one, and redeploy. Keep the same database and Admin allowlist.

Keep `BOOTSTRAP_ADMIN_EMAIL` configured. Do not share passwords or API keys in chat. No new application, server or Supabase project is required.

## Repository layout

```text
app/          Routing: public and Admin groups, manager entry, thin API adapters
features/     Focused screens and browser-safe feature calculations
components/   Shared UI, layout, workspace shell and record editor
server/       Authentication, security, Prisma, services and HTTP handlers
lib/          Browser-safe types/catalog, validation, domain logic and dates
prisma/       Original relational schema and immutable SQL migrations
scripts/      Node provisioning, migrations and verification commands
tests/        Unit, architecture, browser and isolated PostgreSQL integration tests
docs/         Architecture, audit inventories and refactor validation evidence
artifacts/    Existing QA screenshots, not live programme records
```

See [architecture and frontend/backend boundaries](docs/ARCHITECTURE.md), the [pre-refactor audit](docs/architecture/AUDIT.md) and [validation results](docs/architecture/VALIDATION.md). The architecture refactor preserves existing URLs, API contracts, UI and security behaviour; it does not deploy or modify production data.

Removed screens and unused forms are not kept in the frontend. Historical database models/migrations remain so existing records and references are preserved. Test fixtures are server-side testing infrastructure, never a browser demo or production seed.

## Public workflow

`/` opens `/book`. A founder chooses an available Saturday, completes `/apply`, and receives a private, limited-scope `/confirmation#token=…` link. There are no founder accounts or public signup. Every submission is stored in PostgreSQL. Missing database configuration produces an unavailable state, never a fictional fallback. Browser demo routes and mode switches have been removed.

The calendar shows **eight Saturdays as two four-week cycles**, with the number of **slots left**. Full, cancelled and past weeks cannot be booked. All programme sessions start at **7 PM Europe/London**, automatically applying GMT/BST. Booking details and confirmations also show the visitor's browser-local time and date.

## Attendance-gated calendar

Admin and assigned Space Managers can save drafts and explicitly **Submit attendance**. The manager form contains only listener count, duration (hours/minutes), X recording URL and weekly X post URL. A manager’s final report requires listener count and duration; zero counts are valid. Detailed founder/team attendance remains Admin-only and existing records are preserved. Future sessions cannot be submitted. A distinct session counts once regardless of later edits.

When all four Spaces in the oldest cycle have submitted attendance, that cycle leaves the public calendar and the next four Saturdays are opened. The public window remains eight weeks. The calendar does not advance merely because time passes. Completed sessions, submissions, bookings, founders, recording links and audit logs remain in private history; no historical records are deleted. Existing sessions are reused by London date and their bookings/capacities are preserved.

New booking requests outside the active season are rejected by the server, including direct API requests. Pending requests do not reserve seats. Admin approval uses transactional capacity checks and counts founder projects separately from speakers.

## Private access

- `/signin` → `/dashboard`: only the active Admin matching `BOOTSTRAP_ADMIN_EMAIL` can sign in. No default password or public administrator creation endpoint exists.
- `/manager/spaces`: separately invited, passwordless Space Managers can edit only assigned listener totals, duration and X links. They cannot access the Admin dashboard or founder contacts. See [SPACE-MANAGERS.md](SPACE-MANAGERS.md).
- Admin: Founder Spaces → Applications / Bookings to review requests. Founder/company profiles share their associated weekly session data and recording links. Reports and charts derive from stored records.

## Monthly winner and permanent deletion

Open **Monthly winner**, choose a month, select one founder from that month's Space participants, and save. No campaign setup, assessments or selection-criteria form is required. Saving another selection replaces the month's winner; no cryptocurrency payment is sent.

Open a founder profile or an application review and choose **Delete permanently**. Type `DELETE` to confirm. Declined, pending and approved records can be removed. Deleting a linked approved application also deletes its founder record and owned applications/bookings/research/opportunities. Orphaned company records are removed; companies and Spaces shared with other founders remain. Deleted confirmation links stop working. Only the pre-provisioned Admin can delete records.

## Local setup

Use Node.js 24 and PostgreSQL. Copy `.env.example` to `.env`, configure the local database and bootstrap credentials, then run:

```sh
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:admin
npx tsx scripts/publish-saturdays.ts
npm run dev
```

`db:seed` creates programme defaults and taxonomies, not fictional founders. Isolated test fixtures remain available to the integration runner on localhost only and are blocked on hosted Vercel databases.

Keep `BOOTSTRAP_ADMIN_EMAIL` configured: it remains the Admin allowlist after provisioning. Provisioning never overwrites an existing password. Passwords use salted scrypt; sessions use hashed random tokens and HTTP-only cookies. Environment values must never be committed or exposed as `NEXT_PUBLIC_` variables.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run check:client-secrets
npm run test:integration
# Against a running backend-backed local server:
npm run test:e2e
npx tsx scripts/check-route-contracts.ts
npm run screenshots
```

The architecture tests guard client/server boundaries, runtime cycles, original security handler implementations and byte-identical database migrations. Route checks compare status codes, redirects and headings against the captured pre-refactor baseline.

The integration runner creates its own random local PostgreSQL database and password, uses a mock transactional email provider, and removes the database afterward. It verifies applications, approvals, capacity, private access, manager permissions/revocation, shared records, eight-week cycle progression, booking preservation and logout. No real emails or cryptocurrency transfers are sent by tests.

## Deploy and limits

Use the existing Vercel project. `npm run build:vercel` applies checked-in migrations, provisions defaults, ensures the current attendance-gated window, provisions the configured Admin if absent, and compiles the application. No additional project/domain is needed. See [DEPLOYMENT.md](DEPLOYMENT.md).

Manager invitations require a verified Resend sender and configured email variables. MFA, password recovery and automatic award transfers are not implemented. Reports describe programme participants, not the entire industry. A passing deployment is not proof that the deployed authentication journey or real email delivery has been tested. See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for verification scope.
