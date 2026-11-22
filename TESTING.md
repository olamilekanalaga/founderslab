# Verification — 22 November 2026

Checks run locally against Node.js 24, PostgreSQL 17, the Next.js production build and Chromium. Public Vercel browser verification is separate from CI deployment status.

| Check | Result |
|---|---|
| TypeScript and ESLint | Passed |
| Domain/validation tests | 21 passed |
| Production build | Passed |
| Browser journeys | 11 passed |
| PostgreSQL/production HTTP | 10 verification groups passed |
| Responsive screenshots | 20 current desktop/mobile captures, plus booking and shared-recording journey captures |
| Accessibility | Axe WCAG A/AA checks on overview, founders/list and profile, companies/list and profile, Spaces, reports, application and booking |

## Current user journeys

- Demo opens without login; add/search founders, persist after refresh and reset the demo.
- Saturday calendar → time → founder questions → submission → application approval → booking approval → shared recording inherited by founder/company.
- Company sector filtering; country-filtered record reports; actual CSV/PDF downloads.
- Manual campaign assessments and award selection without payment execution.
- Native-size iPhone, tablet and desktop navigation/overflow checks.
- Simple founder/company profiles expose short descriptions; edit and reload a company description. No research notes, needs or follow-up stories appear in these profiles. Former Research URLs redirect to founders.
- Short founder answers remain accepted; invalid fields show human-readable messages.
- Weekly Space data is edited from founder profiles. Two founders in one week share listener totals, duration, X post and Space links while their project attendance stays separate; save and refresh preserve values. Overview retains the cumulative growth selector.
- Calendar week cards show 0/5 booked before picking and 5/5 Full on a disabled date. Only Saturdays appear in the rolling 12-week window.

## Database and domain checks

The production HTTP runner creates a random localhost database, applies checked-in migrations, seeds fictional data, provisions a unique administrator and deletes the database after testing. It never resets the main application database.

Coverage includes authentication, CSRF/origin enforcement, public application duplicate prevention, limited confirmation access, concurrent five-project approval capacity, atomic calendar-first submission rollback for full/weekday slots, private Space Data persistence and duplicate-team rejection, many-to-many memberships, shared recording inheritance and Admin-only access. Legacy research/relationship models retain their existing validation/consent tests as data-preservation coverage; those workflows are no longer visible product screens.

Reports derive basic counts and names/descriptions from stored applications and company relationships. Tests check country totals, missing relationships, CSV formula escaping and exclusion of internal stories/follow-up text from record exports.

## Weekly profile inheritance

Domain tests verify a single shared SpaceData record across two founder profiles, independent company counts, co-founder deduplication, company-attendance mapping and no duplicated global listener totals. PostgreSQL tests persist the session-level X post URL alongside weekly statistics. The mobile browser test edits from one founder, reads shared values and different team counts from another, updates that founder's shared listener number, then verifies the first profile and cumulative Overview chart. Former Space Data navigation is absent and its route redirects to founders. Shared weekly profile screenshots are captured at 393×852 and 1536×1024.

## Connected production release

The isolated PostgreSQL integration suite runs the exact production preparation script twice, confirms zero fictional founders and one bootstrap administrator, and then exercises production HTTP with only a prefixed database variable. It checks `/demo` is unavailable, anonymous workspace access is rejected, and the readiness endpoint succeeds. Existing real application submission, capacity, approval and shared weekly data checks run against that initialized schema. Local browser-demo tests retain the non-production environment.

London timezone tests cover late-Friday/late-Saturday boundaries independently of the original stored timezone, both UK DST transitions, summer/winter UTC offsets, and Nigeria conversions. The empty calendar explains unavailability and has no enabled date buttons.

Saturday publishing is tested against both the public eligibility function and isolated PostgreSQL. Production preparation runs repeatedly without duplicate dates; all 12 dates are Saturday 7 PM Europe/London with capacity five for new sessions, and a cancelled date stays cancelled on a subsequent release. In-place legacy alignment preserves booking IDs. Browser tests verify Nigeria summer time and Japan’s next-day conversion.

## Restricted Space Manager regression

The local PostgreSQL integration runner now also uses a mock transactional email endpoint, never real email. It covers Admin-only invitations, email provider rejection, single-use/expired email links, concurrent link redemption, session expiry, assigned-record boundaries, missing CSRF, contact redaction, manager denial from Admin pages/APIs, shared recording/post inheritance, attendance preservation, mobile saving, revocation, audit retention and continued bootstrap Admin access. Manager and Admin Settings screenshots are captured; the manager mobile form is checked with Axe WCAG A/AA. See SPACE-MANAGERS.md for production email configuration and verification limits.
