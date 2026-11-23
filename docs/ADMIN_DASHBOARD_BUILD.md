# FoundersLab programme dashboard

Built for Ghost on 2026-11-23 from the approved card composition and wide labelled sidebar. The Admin workspace uses the homepage's violet `#6946d3`, ink `#211b32`, muted text `#6d667c`, light surfaces and glass date tickets. Layout is scoped to `.admin-desk`; public and invited-manager layouts retain their own styles.

Shared dialogs portal into the active workspace root so glass cards cannot contain or obscure confirmation/editor overlays. Nested dialogs balance the body scroll lock and retain keyboard focus, draft guards and the existing theme.

## Source map and retained functionality

| Workflow               | Implementation                                                     | Behaviour retained                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account and navigation | `components/layout/AdminWorkspace.tsx`                             | Permission-filtered routes, current identity, refresh/freshness, search, real CSRF sign-out, mobile drawer, Glass/System/Reduced preference.                                                                                                                                                                           |
| Overview               | `features/programme/components/Overview.tsx`                       | Real founder/project/application counts, next Space, capacity, named review links, upcoming dates, owner access and expandable Saturday/report records.                                                                                                                                                                |
| Saturday roster        | `CurrentSaturdayCard.tsx`                                          | Live refresh, London Saturday, existing capacity, confirmed distinct projects, loading/error/retry, booked company roster and booking link. Open “Saturday roster & programme records”.                                                                                                                                |
| Directories            | `features/directory/components/Directory.tsx`                      | Repeated search, country/sector/stage filters, clear/reset, pagination, card/table layouts, founder/company add/edit/profile/delete and distinct Founder X/Project X.                                                                                                                                                  |
| Application decisions  | `features/spaces/components/ApplicationReview.tsx`                 | Entire submission: chain, sector/stage, description, project links, founder role/country/contact, team countries/size, speakers, focus, hiring, seeking, comments, consent/date/reference. Decline/waitlist/approve, linked profiles, confirmed removal and session assignment.                                        |
| Booking                | `features/bookings/components/BookingEditor.tsx`, `Spaces.tsx`     | Selected-application handoff, pending creation, separate approval, server project-capacity checks, booking status/attendance and session filters. Approval of an application does not reserve a seat.                                                                                                                  |
| Session editing        | `RecordEditor.tsx`, `WeeklySpaceEditor.tsx`                        | UTC inputs/London preview, stored capacity/deadline/status, session/live/post/recording links, listeners, duration, per-project founder/team attendance, notes, draft/submitted result state.                                                                                                                          |
| BD operations          | `features/bd-partners/Operations.tsx`                              | Registration, attended-booking referrals, duplicate-claim prevention, four referrals per reward cycle, earned/paid/outstanding totals, private transfer-detail show/hide, history and payment recording. Recording payment does not transfer funds.                                                                    |
| Owner invitations      | `SpaceManagersSettings.tsx`                                        | Real email configuration and error/retry, single-use invitations, assigned Spaces, save assignments, resend/revoke and manager isolation.                                                                                                                                                                              |
| Founder reports        | `features/reports/components/Reports.tsx`                          | Country/sector/stage/cohort/date filters, reset, actual totals and tables, CSV/PDF and CSV formula protection.                                                                                                                                                                                                         |
| Programme analytics    | `ProgrammeAnalytics.tsx`, `programme-analytics.ts`                 | Six metrics: listeners, team/founder attendance, hours, founder growth and project occupancy. All/7/30/90/custom dates, cumulative/per-date, comparisons when coverage permits, countries/sectors/stages, application/booking pipeline, chart data and scoped CSV. Missing figures remain distinct from recorded zero. |
| Options and activity   | `features/settings/components/Settings.tsx`                        | Existing sector/product-stage taxonomy editing and audit activity.                                                                                                                                                                                                                                                     |
| Retired awards         | `features/campaigns/components/MonthlyWinner.tsx`                  | Read-only archive and existing recorded obligations. No new founder award programme.                                                                                                                                                                                                                                   |
| Forms and protection   | `components/ui/index.tsx`, `WorkspaceContext.tsx`, server handlers | Keyboard/focus return, dirty-draft guard, retained invalid input, inline field errors, authentication, role restrictions, CSRF, audit and permanent deletion confirmation.                                                                                                                                             |

The founder removed the calendar and Admin/Programme settings panels upstream. They remain removed. Stored session capacities are authoritative; new recurring Spaces default to four project seats. Research/commercial section types are not active current Admin pages and are not revived by this UI change.

Operations accepts `?tab=applications`, `?tab=bookings`, `?tab=sessions` or `?tab=bd`. Application links can include `&review=<application-id>`; booking links can include `&session=<session-id>`. Browser back/forward follows the URL rather than a stale tab state.

## Local development

1. Use Node 24 and the existing lockfile: `npm ci --no-fund --no-audit`.
2. Configure ignored local `.env` using `.env.example` as the field reference. Keep real credentials out of Git and logs. Use an isolated local PostgreSQL database for testing.
3. Run `npm run db:generate`, then the existing migration helper (`npm run db:migrate`). Migration approval and deployment policy apply to a hosted database separately.
4. Provision an explicitly authorised local admin with the existing `npm run db:admin` helper and its documented environment inputs. Avoid seeding the real preview with fictional records; `db:seed` belongs only to a disposable fixture database.
5. Run `npm run dev -- --port 4376`, or bind locally with `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 4376`. `APP_ORIGIN` must agree with the actual origin.

On Ghost's existing PC, the private loopback PostgreSQL runtime is `C:/Users/USER/founderslab-local-runtime`; its connection files, passwords and browser profiles stay there. `C:/Users/USER/founderslab-redesign-preview/admin-studio/start-preview.cjs` starts the owned low-memory preview on 4376. Verify the listener before launching a duplicate. `FOUNDERSLAB_LOCAL_PREVIEW=1` limits workers and disables Webpack's disk cache only in local preview mode.

## Build and validation

Run source tests, typecheck and lint, then the production build:

```text
npm test
npm run typecheck
npm run lint
npm run build
npm run check:client-secrets
```

On a constrained local Windows machine use `FOUNDERSLAB_LOCAL_PREVIEW=1` and `node node_modules/next/dist/bin/next build --webpack` after Prisma generation. Stop only the verified owned development server before a production build if memory is insufficient. Normal hosted builds retain their standard configuration.

Browser tests require `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` on Windows, and explicitly configured isolated `FOUNDERSLAB_TEST_ADMIN_EMAIL`/`FOUNDERSLAB_TEST_ADMIN_PASSWORD`. Supply those privately rather than embedding them in commands or reports. `npm run test:integration` requires local database-creation privileges and a completed production build; it creates and drops its own fresh fixture database and uses mock mail endpoints. Do not direct these tests at production.

Verify native 1358×644 laptop content at 100% zoom, 1440 desktop, 1024/820/768 tablets and 393/375/320 phones. Data cards must not clip labels/actions, all routes must avoid document overflow, keyboard focus must remain visible, and long records need a full readable detail view. Check opaque/reduced-motion modes and Axe on overview, full review, populated directory/operations/invitation forms and analytics. Physical-phone and actual hosted-provider results are separate from local browser emulation.

## Release and recovery

The existing application targets Vercel with PostgreSQL/Prisma. Preserve its existing `build:vercel` preparation, environment mappings, mail configuration, authenticated API routes and review-branch deployment guard. No new service, billing provider or auth system is needed for this redesign.

Push the reviewed `redesign/admin-studio` branch and open a PR against `main`; do not force-push or merge `main` as part of a visual review. A local pass or a PR is not a production deployment. The owner can merge after review, then verify deployed home/booking/sign-in/private workspaces and actual provider delivery with authorised accounts. Keep environment changes and migrations in a separately reviewed release record.

Pre-build recovery: `C:/Users/USER/founderslab-backups/20261123-admin-reference-build/source-before.zip`, SHA-256 `B050996328EB8E278020B2217EC3AB47963A5B760DFB138B8A0C04D6B375C796` (227 verified source payloads, including paused edits). The paused complete-history bundle remains `C:/Users/USER/founderslab-backups/20261123-admin-studio-paused/history-paused.bundle`. Restore into a fresh unused checkout and expand the source checkpoint; retain ignored runtime environment/profile files privately. Final delivery hashes and actual results belong in the shared vault handoff.
