# Architecture refactor validation

Validated locally on 22 November 2026 against baseline `f5b1355`, using Node 24, a production Next.js build, Chromium and local PostgreSQL. These results do **not** verify a deployed production application.

| Check | Before | After |
| --- | --- | --- |
| TypeScript (`npm run typecheck`) | Pass | Pass |
| ESLint (`npm run lint`) | Pass | Pass, no warnings |
| Unit tests (`npm test`) | 22 pass | 28 pass: same 22 plus six architecture checks |
| Production compilation (`npm run build`) | Pass | Pass |
| Isolated PostgreSQL/production HTTP integration | 16 groups pass | Same 16 groups pass |
| Playwright (`npm run test:e2e`) | 3 pass | Same 3 pass |
| Client-secret leakage check | Pass | Pass |
| Public/private/API route contracts | 25 captured | All 25 match status, redirect and heading |
| Runtime import cycles | None | None |
| Prisma schema and six migration SQL files | Baseline digests captured | Same bytes and original paths/order |

## Coverage

The integration runner uses random credentials, an isolated randomly named localhost database and a mock transactional-email provider. It checks idempotent migration/default/Admin provisioning; anonymous private route/API rejection; invalid credentials; the exact pre-provisioned Admin allowlist; secure sessions, CSRF/Origin handling and logout cookie replay; public submissions and private confirmation scopes; transactional booking approval/capacity; restricted assigned manager access, single-use email authentication, provider rejection and immediate revocation; shared attendance/recording/post data; reporting/publication consent; mobile Admin/manager journeys; four-distinct-submission calendar progression; monthly winner selection and permanent record deletion. Its temporary database is removed afterward. No production database or real inbox is used.

The original unit cases additionally cover both London DST transitions, 19:00 London recurrence, Nigeria conversion, Saturday reconciliation without booking resets, shared profiles/attendance aggregation, safe CSV exports and historical legacy invariants. Browser tests cover light-mode eight-Saturday booking, storage-based privilege/demo tampering and no public signup. Routes checked include the homepage, booking/application/confirmation, sign-in, terms, manager entry, Admin sections/profile, retired routes and private APIs. See [before](routes-before.json) and [after](routes-after.json).

Six new checks enforce transitive client/server boundaries, acyclic runtime imports, explicit server-only Next entry guards, original auth/manager/scheduling/API function implementations, byte-identical schema/migrations and disabled automatic deployment of this refactor branch. [security-invariants.json](security-invariants.json) stores the baseline implementation/database fingerprints. Existing tests did not read implementation files by path; only their imports needed updating. The new invariant tests intentionally use explicit architectural paths.

The browser-bundle scan checks configured database/Admin/email secret values and environment reads, excluded fixture names, and untracked private environment files. It is a targeted leakage check, not a proof that every possible secret or vulnerability is absent.

## Limits and outstanding risks

- No deployment, merge, production migration, production seed or production environment edit was performed. Production PostgreSQL connectivity and the real Admin login were not reverified by this refactor. Production access from this environment was unavailable; local tests must not be described as production verification.
- Real invitation email delivery/inbox receipt still requires the configured verified sender/provider. Tests verify acceptance/failure through a mock provider.
- Existing Vercel build preparation applies migrations and provisions defaults before compilation. That coupling and environment names remain unchanged. Future deployment should follow the existing deployment guide, with database backup/recovery practices managed separately.
- The older request says 12 weeks; current persisted public booking is eight Saturdays with attendance-gated cycles. That existing behaviour was preserved deliberately.
- Historical Research/Classification/Market Map/Opportunities models, exports and command dependencies remain. No historical records were deleted. A separate reviewed product/data migration would be needed to retire those dependencies.
- Large but cohesive mutation/integration/editor modules remain; mechanical splitting would add risk without improving their responsibility boundaries.
- An existing database-unavailable error mentions retired `/demo`. Product/API wording was preserved rather than silently changed during cleanup.
- The application has no new MFA, recovery flow or guarantee against all attacks. This work preserves the existing security controls and adds enforceable architecture boundaries.

## Reproduce

Follow the README's local setup with a localhost database; never use production credentials for integration fixtures. Build first, then run the PostgreSQL suite; do not rebuild while its production server is serving requests. Start `npm run start` separately for Playwright and `npx tsx scripts/check-route-contracts.ts`. Use `PLAYWRIGHT_BASE_URL` for another local port. The route comparison writes `routes-after.json` and fails on differences. The integration suite's screenshots are QA output; incidental regenerated binary differences were excluded from this refactor.
