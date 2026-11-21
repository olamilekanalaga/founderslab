# Verification — 21 November 2026

Checks run locally against Node.js 24, PostgreSQL 17, the Next.js production build and Chromium. Public Vercel browser verification is separate from CI deployment status.

| Check | Result |
|---|---|
| TypeScript and ESLint | Passed |
| Domain/validation tests | 16 passed |
| Production build | Passed |
| Browser journeys | 10 passed |
| PostgreSQL/production HTTP | 9 verification groups passed |
| Responsive screenshots | 22 current desktop/mobile captures, plus booking and shared-recording journey captures |
| Accessibility | Axe WCAG A/AA checks on overview, founders/list and profile, companies/list and profile, Spaces, Space Data, reports, application and booking |

## Current user journeys

- Demo opens without login; add/search founders, persist after refresh and reset the demo.
- Saturday calendar → time → founder questions → submission → application approval → booking approval → shared recording inherited by founder/company.
- Company sector filtering; country-filtered record reports; actual CSV/PDF downloads.
- Manual campaign assessments and award selection without payment execution.
- Native-size iPhone, tablet and desktop navigation/overflow checks.
- Simple founder/company profiles expose short descriptions; edit and reload a company description. No research notes, needs or follow-up stories appear in these profiles. Former Research URLs redirect to founders.
- Short founder answers remain accepted; invalid fields show human-readable messages.
- Space Data attendance/listeners/time save and reload; edits replace totals; cumulative chart metrics and multi-Space totals work.
- Calendar capacity labels show 0/5 before picking and 5/5 Full on a disabled date. Weekdays are disabled.

## Database and domain checks

The production HTTP runner creates a random localhost database, applies checked-in migrations, seeds fictional data, provisions a unique administrator and deletes the database after testing. It never resets the main application database.

Coverage includes authentication, CSRF/origin enforcement, public application duplicate prevention, limited confirmation access, concurrent five-project approval capacity, atomic calendar-first submission rollback for full/weekday slots, private Space Data persistence and duplicate-team rejection, many-to-many memberships, shared recording inheritance and Admin-only access. Legacy research/relationship models retain their existing validation/consent tests as data-preservation coverage; those workflows are no longer visible product screens.

Reports derive basic counts and names/descriptions from stored applications and company relationships. Tests check country totals, missing relationships, CSV formula escaping and exclusion of internal stories/follow-up text from record exports.
