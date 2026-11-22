# Pre-refactor audit

Baseline: `f5b1355` on `main`. All 121 tracked files were inventoried, including 83 TypeScript/JavaScript modules. The per-file responsibility classification, line counts and resolved runtime import graph are in [before-inventory.json](before-inventory.json). No runtime import cycles were found. Type-only edges are not runtime dependencies.

## Findings

- `PublicPages.tsx` (676 lines) combines application, booking, confirmation, terms, footer and request utilities; these are distinct screens and reusable layout/API concerns.
- `Directory.tsx` (528 lines) combines browsing/filtering and separate founder/company profiles. `Spaces.tsx` (601 lines) also embeds the booking editor.
- `lib/auth.ts` mixes password hashing, sessions/allowlist, Origin/CSRF and rate limiting. CLI administrator setup imports the same module as cookie-based Next.js routes.
- `lib/db.ts` mixes Prisma construction, token utilities, snapshot persistence, transactional commands and defaults. `programme-window` takes a transaction rather than importing the client: this avoids a cycle and must be preserved.
- Server modules lack explicit `server-only` entry guards. No current client-to-credential-module violation was found; the refactor should make this enforceable rather than relying on naming.
- The domain module (839 lines) mixes the command engine, safe selectors, error identity and test-only local-application helpers. `DomainError` imports currently pull the broader module into other layers. `parseCommand`/`safeUrl` are internal exported helpers with limited consumers; retain their contracts rather than deleting blindly.
- `tests/integration.ts` (1,822 lines) is an ordered, disposable-database scenario. Its shared fixtures and sequential assertions make a mechanical split risky. Keep this scenario intact, update its imports, and add separate architecture/route checks.
- Dates have deliberately different meanings: UTC Admin forms versus London booking/visitor conversion. They are not interchangeable duplicate helpers. Public and private fetch helpers also have different CSRF/contracts; do not merge them indiscriminately.
- Research/Classification/Market Map/Opportunities screens were already removed. Historical models, validation, command cases, exports/reporting data and deletion dependencies remain active/tested. Keep them and all migrations.
- Production preparation applies migrations and provisions defaults during a Vercel production build. This is existing deployment coupling: keep its behaviour and environment names, and never point refactor tests at production.
- Git pushes normally trigger Vercel previews. Disable automatic deployment specifically for `refactor/feature-architecture`; unspecified branches, including `main`, retain their existing behaviour.
- The current product is an eight-Saturday attendance-gated window, not the older 12-week example in the request. Preserve the current eight-week rule and all copy/design.

## Movement plan (before implementation)

1. Move active UI into feature directories and shared UI/layout folders, preserving component bodies. Split only the mixed public screens, founder/company profiles and embedded booking editor.
2. Move pure types/catalog, validation, dates, reports and domain helpers into clearly named browser-safe modules. Extract test-only application helpers to test fixtures; preserve tested legacy commands.
3. Introduce server auth/security/config/database/service/handler modules. Keep thin route adapters and guarded Next.js entry points. CLI-compatible Node cores remain usable by scripts without globally changing React export conditions.
4. Group public pages and rename the private routing group for clarity; preserve URL paths, the dynamic section allowlist, redirects, runtime settings and API handlers.
5. Update all import references, CLI scripts, tests and documentation. Preserve `AGENTS.md`, environment variable names, the schema and every migration byte/path.
6. Run the same baseline checks after each coherent group and compare route contracts. Add import-boundary/cycle, database-file and branch-deployment guards. Open a review PR without merging or deploying.

## Baseline verification

TypeScript, ESLint, 22 unit tests, production build, 16 isolated PostgreSQL/HTTP integration groups, three Playwright browser tests and client-secret leakage checks passed before source refactoring. The HTTP status/redirect/heading contracts of 25 public/private/API routes were captured in [routes-before.json](routes-before.json). Real production credentials/email delivery were not exercised.
