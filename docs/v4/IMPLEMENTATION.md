# Founders Lab V4 implementation audit

Starting point: architecture branch `9a9f606` (PR #1, unmerged). V4 is a dependent branch/PR, not a replacement for that refactor. Requested old flat paths now map to `app/(public)/`, `components/layout/`, feature components, `lib/domain/` and `lib/dates/`.

## Inspected before editing

- Public root redirects to `/book`; book/apply/confirmation compose the shared public header/footer. All public navigation currently includes Admin links, including the no-availability calendar state.
- `/signin` and dynamic private sections use the existing server-checked Admin allowlist. `/manager/spaces` has independent passwordless authentication, assigned-resource restrictions and immediate revocation.
- `/api/public/sessions` supplies the current persisted eight-week window and capacity counted by non-cancelled participating company IDs. Pending requests do not reserve approved capacity. Existing four-distinct-attendance progression, Europe/London recurrence, DST and visitor-local conversion must remain unchanged.
- `/api/public/programme` merges stored programme settings (which may contain old award promises), labels and consent-approved research highlights. Application choices depend on this endpoint. V4 must override only the active public policy and omit legacy award defaults, without rewriting stored settings or changing submission/confirmation handlers.
- Campaigns/Monthly Winner are active Admin navigation and write endpoints. Campaign, CampaignParticipant and AwardDecision retain historical amounts, rules, criteria, decisions, reviewer/status, rationale and transaction references. No schema/migration/data deletion is required.
- Terms display database-provided historical award wording; the application includes a non-guarantee referring to awards. Both need current participation-only wording.
- Existing UI uses a light lavender/white visual identity, reusable branding/buttons and `SessionTime` for London/visitor conversion.

## Plan

1. Replace the root redirect with a server-rendered public programme page; add a small live availability client island using the same public sessions endpoint and eligibility helper as booking.
2. Make shared public header/footer exclusively public, with usable mobile navigation. Remove the empty-calendar host login link. Keep direct private entry URLs and all authentication checks.
3. Publish current participation terms independently of stored historical policy; remove future award messaging. Archive the old screen read-only, remove promotion/navigation, block new campaign/award writes through both existing HTTP entry points after authentication/CSRF checks.
4. Keep historical database schema, migrations, records and report filters; add an Admin-only Settings archive link for access to historical decisions. No BD accounts, tables, attribution or payments yet; document a proposal only.
5. Add mobile/desktop, public-navigation, live-capacity and terms regressions; adapt the old winner-write integration scenario to verify archive preservation and write rejection. Preserve all booking/auth/manager scenarios. Run lint/types/unit/build/integration/browser/secret checks and capture real local screenshots.

## Deployment

Disable Git deployment specifically for `feature/v4-public-homepage` as well as the existing refactor branch. Do not merge, deploy, change production environment variables or write production data.

## Changed files

- `app/(public)/page.tsx`, `features/programme/components/HomePage.tsx`, `UpcomingSpaces.tsx`: public root page, requested content, live preview and unavailable states.
- `components/layout/PublicHeader.tsx`, `PublicFooter.tsx`, `app/globals.css`: public-only navigation, accessible mobile menu and scoped light-theme design. `app/layout.tsx` updates public metadata.
- `features/bookings/components/ApplicationForm.tsx`, `PublicBookingCalendar.tsx`, `features/programme/components/Terms.tsx`, `lib/programme-policy.ts`, `lib/catalog.ts`: remove current reward wording/host link and publish current participation policy independently of historical settings.
- `server/handlers/public.ts`: omit award defaults and return current policy. No submission, confirmation or session-capacity logic changes.
- `features/campaigns/components/MonthlyWinner.tsx`, `components/layout/AdminWorkspace.tsx`, `features/settings/components/Settings.tsx`, `components/shared/RecordEditor.tsx`: read-only historical archive, removed award promotion/navigation, private archive access and historical-settings labels.
- `server/handlers/monthly-winner.ts`, `workspace.ts`: reject new founder award/campaign writes while retaining Admin permission and CSRF enforcement.
- `tests/e2e/homepage.spec.ts`, `tests/programme-policy.test.ts`, `tests/integration.ts`, `tests/architecture.test.ts`: homepage/navigation/capacity/policy regressions, archive preservation and explicit reviewed handler changes.
- `scripts/check-route-contracts.ts`, `scripts/screenshots.ts`, `vercel.json`: reviewed V4 route contract, homepage capture and no automatic branch deployment.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/v4/*`, `artifacts/README.md`, `artifacts/v4-*.png`: current documentation, audits, referral proposal, verification evidence and desktop/mobile screenshots.

No dependency, Prisma schema, migration, authentication service, manager service, scheduling utility or production environment variable changed.
