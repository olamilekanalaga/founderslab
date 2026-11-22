# Founders Lab architecture

This is an incremental reorganisation of the existing Next.js 16 App Router application, not a replacement application. Baseline: `f5b1355`. URLs, page copy/design, API contracts, database models, migration paths/order and environment variable names are preserved.

## Before and after

The full original tree, file classifications, line counts and runtime import dependencies are recorded in [before-inventory.json](architecture/before-inventory.json). The [audit and movement plan](architecture/AUDIT.md) preceded implementation. [Frontend movements](architecture/frontend-moves.json) list the initial screen extractions; [all file changes](architecture/file-changes.json) include server moves and additions.

Full tracked directory trees: [before](architecture/tree-before.txt) and [after](architecture/tree-after.txt). The [after inventory](architecture/after-inventory.json) classifies the new files and records their import graph.

Before:

```text
app/
  (private)/[section]/[id]/page.tsx
  page.tsx, apply/, book/, confirmation/, terms/, signin/
  manager/spaces/, api/, demo/, invite/
components/
  PublicPages.tsx, Directory.tsx, Spaces.tsx
  Workspace.tsx, WorkspaceContext.tsx, PrivateWorkspace.tsx
  AuthScreen.tsx, Campaigns.tsx, Reports.tsx, Settings.tsx
  [other flat screens, editors and UI]
lib/
  auth.ts, db.ts, server-env.ts, http.ts
  domain.ts, validation.ts, seed.ts
  booking.ts, saturday-schedule.ts, programme-window.ts
  selectors.ts, export.ts, space-data.ts, space-managers.ts
  types.ts, catalog.ts, sections.ts, design.ts, form-errors.ts
prisma/, scripts/, tests/, artifacts/
```

After:

```text
app/                             Routing, layouts, route configuration and thin adapters
  (public)/                      /, /apply, /book, /confirmation, /terms
  (admin)/[section]/[id]/         Existing allowlisted private URLs, unchanged
  signin/, manager/spaces/       Independent Admin and manager entry routes
  api/                           Existing method/URL contracts
  demo/, invite/                 Intentional retired-route 404 tombstones
components/
  layout/                        Public header/footer, private gate and workspace shell/context
  shared/                        Brand, visitor-local time, cross-entity record editor
  ui/                            Visual primitives and charts
features/
  auth/components/               Admin sign-in
  bookings/components/, lib/     Booking, application, confirmation and browser request helpers
  founders/components/           Founder profile and permanent-delete interaction
  companies/components/          Company profile
  directory/components/          Shared founder/company browsing
  spaces/components/, lib/       Weekly editors, calendars, shared Space calculations
  campaigns/components/          Existing monthly winner UI
  reports/components/, lib/      Reports, filtering, CSV/PDF exports
  space-managers/components/     Restricted manager form and Admin invitation management
  programme/components/          Overview and programme terms
  settings/components/           Existing Settings screen
server/
  auth/                          Allowlist, sessions, Origin/CSRF, rate limiting and passwords
  config/environment.ts          Server connection resolution, also used by Node tooling
  db/                            Prisma client, state persistence, defaults, CLI seed support
  security/tokens.ts             Random tokens and SHA-256 hashing
  services/                      Programme window and passwordless manager services
  handlers/                      Existing authenticated/public HTTP implementations
  http.ts                        Response, body and error helpers
lib/                             Browser-safe contracts and deterministic domain code
  dates/                         London recurrence, eligibility and display formatting
  domain/                        Errors, queries/redaction and command mutation engine
  validation/                    Primitive, application and command Zod schemas
  types.ts, catalog.ts, sections.ts, design.ts
prisma/                          Original schema and six migrations, byte-identical
scripts/                         Node provisioning/checks; no second backend
tests/                          Unit, architecture, HTTP/PostgreSQL and Playwright tests
  fixtures/application-state.ts  Test-only local submission/viewer helpers
docs/architecture/              Audits, inventories, invariant manifests and verification
artifacts/                       Existing QA assets
```

## Frontend and backend boundaries

`app/` owns routing, runtime/dynamic declarations and route wiring. Route groups change organisation only. The existing dynamic Admin section route remains: creating seven parallel page implementations would duplicate the existing allowlist and shell. A manager route group would add no useful organisation, so `/manager/spaces` remains explicit.

The Server Component `components/layout/PrivateWorkspace.tsx` is the Admin page gate. Feature screens compose inside the original Admin workspace/context. Public booking and the restricted manager view have separate request flows. Shared visual components do not import database or authentication modules.

API routes export their original methods from `server/handlers/`. Those handlers retain their authentication, permission, Origin/CSRF and input checks. Moving checks into a folder does not replace request-level authorisation. Managers still use independent cookies/tokens and assigned-resource checks; they cannot satisfy the Admin allowlist.

Next-facing auth/database entry points, HTTP helpers, manager services and request handlers use `import "server-only"`. Prisma construction and persistence, password hashing, environment resolution and the transaction-only programme service also run in Node CLI tools. These explicitly named Node-compatible leaves intentionally omit the React marker so migrations/provisioning/tests work without globally forcing `react-server` conditions. CLI scripts import `server/db/node.ts`; Next code imports guarded `server/db/index.ts`. The architecture test follows every client runtime import transitively and rejects **all** `server/` modules, Node/Prisma access and test fixtures, including unmarked CLI leaves.

`lib/` contains serialisable contracts, browser-safe validation and pure domain calculations, not sessions or credentials. The command engine remains shared, deterministic and permission-aware; HTTP handlers still enforce server identity before invoking it. Date display formatting is separate from report aggregation. UTC Admin form conventions and London booking conversion are deliberately preserved rather than conflated.

## Data and scheduling

Prisma remains the only database layer. Shared weekly Space records are still associated with existing participants/bookings. Reports and profiles derive their data from those same records; no duplicate data store was introduced. The programme-window service accepts a Prisma transaction and does not import the database entry point, avoiding a persistence/service cycle.

The actual current product shows **eight Saturdays, two four-week cycles** and advances after four distinct final attendance submissions. The request's older 12-week example does not override the explicit requirement to preserve current business rules. The low-level Saturday generator still supports its existing 12-week default; the persisted programme window governs public booking. Every recurring session remains at 19:00 `Europe/London`, accounting for GMT/BST and visitor-local conversion.

## Retained legacy code

Research, Market Map, Classification and Opportunities screens were already removed before this refactor. Their historical Prisma models/migrations, `DataState` types, schema definitions, permissions, command cases, deletion dependencies and reporting/export calculations remain. Active snapshot persistence still loads historical records; existing tests exercise their relationships, redaction and evidence rules. Deleting these branches would be a product/data migration, not safe file cleanup.

`/demo` and `/invite` deliberately return not-found; they are security tombstones, not working demo/signup routes. An existing unconfigured-database error still mentions the retired demo workspace. Its wording was left untouched because this change does not alter product/API text.

The fictional dataset builder remains `server/db/seed-data.ts` for the localhost-only integration fixture path. Production taxonomy defaults are now isolated in `taxonomy-defaults.ts`, and normal provisioning does not construct fictional founders. The existing hosted-database and empty-database guards still apply before fixture construction. Pure local application/viewer helpers moved out of production domain exports into `tests/fixtures/`.

## Changes intentionally deferred

`lib/domain/commands.ts` is still a substantial mutation engine: splitting individual switch cases would change an interdependent permission/audit/transaction workflow. `tests/integration.ts` remains an ordered disposable-database journey whose steps share records. The shared `RecordEditor` still handles active founder/company/session/taxonomy forms. These are cohesive responsibilities; size alone does not justify another layer.

No duplicate date/fetch utilities were merged merely because their names looked similar. Public fetch, private CSRF fetch and visitor/Admin time conventions have different contracts. No public export was removed without checking callers; the three local fixture helpers are the deliberate test-only relocation. Existing unit/integration imports were updated to canonical aliases. New architecture invariants intentionally reference file paths; product tests otherwise exercise exports and HTTP contracts.

## Verification and deployment

See [validation evidence and limits](architecture/VALIDATION.md). The security invariant manifest captures original function implementations, not merely method names, and verifies that auth, manager checks, schedule transactions and HTTP handler bodies remain identical after formatting/import movement. Schema/migration digests are checked as well. When a future **intentional behaviour change** is reviewed, update the corresponding invariant and add behaviour coverage rather than silently bypassing the test.

The existing Vercel production build still applies migrations/provisions defaults before compilation. This deployment coupling is retained and documented; refactor verification uses only local disposable PostgreSQL. No production database reset, migration or provisioning was run.

This branch disables Vercel Git deployment **only for `refactor/feature-architecture`** to avoid an automatic preview while the user has prohibited deployment. Other branches keep their existing behaviour. Do not deploy or merge this PR automatically.
