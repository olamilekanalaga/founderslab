# V4 verification and delivery

V4 is on `feature/v4-public-homepage`, based on unmerged architecture PR #1 (`refactor/feature-architecture`, `9a9f606`). Its PR targets that branch to keep the product diff separate; it depends on PR #1. Nothing is merged or deployed automatically. Vercel Git deployment is disabled for both review branches only.

## Results

Local verification on 22 November 2026, Node 24, Next.js 16.4.6 production build, localhost PostgreSQL and Chromium:

| Check | Result |
| --- | --- |
| Starting baseline | TypeScript, ESLint, all 28 unit tests and production build passed |
| TypeScript | Pass |
| ESLint | Pass, no warnings |
| Unit + architecture tests | 30 pass, including London DST/Nigeria conversion and unchanged schema/migration checks |
| Production build | Pass; `/` is a rendered public homepage |
| PostgreSQL + production-server integration | 16 groups pass |
| Playwright | 7 pass (3 existing, 4 new) |
| Accessibility | Homepage mobile/desktop and existing booking WCAG A/AA Axe checks have zero violations |
| Route contract comparison | 25 pass against reviewed V4 contracts: `/` changes from 307 to 200 with the new heading; other route contracts unchanged |
| Client-secret scan | Pass for configured secret values/environment reads, excluded fixture names and untracked environment files |
| Schema, migrations, auth, manager services and scheduling | No implementation changes; original fingerprint checks remain |

The only reviewed handler fingerprint changes are public programme GET (current policy), workspace POST (retired award command guard) and monthly winner POST (authenticated retirement response). [security-changes.json](security-changes.json) documents each reason and pins its original and current hash; all other original fingerprints remain in force. These are explicit V4 behaviour changes, not blanket updates to security expectations.

## Journey coverage

- Public `/` returns the requested headline, programme steps, participation benefits, live upcoming capacity and invitation-only ecosystem information. Header/footer contain public links only; desktop and mobile CTAs enter `/book`. Mobile menu expands/collapses correctly without overflow.
- Preview cards are matched against the real local `/api/public/sessions` response. Separate mocked boundary tests cover full/closed/empty/provider-unavailable cases without inventing availability or showing host sign-in links. The checked-in homepage screenshots use real backend responses, not those mocks.
- Existing application API validation/submission, calendar-first pending booking, review/approval, concurrent five-project capacity, private confirmation tokens and shared links pass.
- The eight-Saturday/two-cycle window, four distinct final attendance submissions, draft/repeated-save exclusion and booking preservation pass. 7 PM Europe/London and both GMT/BST conversions remain covered by unchanged scheduling tests.
- Direct Admin sign-in, bad credentials, anonymous/forged session rejection, Admin allowlist, Origin/CSRF, private API checks and logout replay rejection pass.
- Invited manager single-use authentication, assigned-resource limits, contact redaction, saving data, assignment removal and immediate revocation pass with a mock transactional email provider. Managers remain unable to access Admin APIs.
- Retired award writes reject anonymous/manager callers and reject Admin writes after CSRF checks. Historical campaign, participant and award rows, including payment reference and timestamps, compare identically before/after. Stale award terms remain stored while current public terms exclude them. Existing Admin deletion and reports remain covered.

## Screenshots

Captured against the local production build:

- [Desktop homepage — 1440 × 1024 viewport](../../artifacts/v4-homepage-desktop.png)
- [Mobile homepage — 393 × 852 viewport](../../artifacts/v4-homepage-mobile.png)
- [Private read-only award archive — isolated test data](../../artifacts/v4-award-archive-mobile.png)

Homepage images were visually inspected. They contain actual local published sessions/capacity and no fictional founder profiles or decorative dashboard screenshots. The archive uses isolated fictional historical fixtures, never production account records.

## React/UX review

The main homepage is server-rendered; only mobile navigation and live availability require client state. Availability uses the existing no-store public request helper with cleanup on unmount. Secrets and Prisma stay behind the unchanged server boundary. Existing SessionTime handles London/visitor conversion. No dependency, animation library, second backend or public account flow was added. Semantic section headings, an ordered process list, accessible menu state, visible focus styles, responsive layouts and no horizontal overflow were checked.

## Limitations and remaining decisions

- These are **local production-build tests**, not verification of the deployed `founderslab-orcin.vercel.app` application. This branch has not been deployed. Production environment values, database connectivity and real inbox delivery were not inspected or changed.
- The existing verified transactional email provider remains required for actual manager invitations. The integration suite uses a provider mock and disposable localhost database, then removes only that test database.
- The homepage uses current availability at load time; final submissions/approvals remain protected by existing server capacity and season checks if availability changes afterward.
- Public participation terms are now code-versioned independently of historical Admin settings. Editing retained historical terms does not replace the active public policy; the Admin editor labels this distinction. Future policy changes need a reviewed code change or a separately designed versioned policy workflow.
- BD qualification, duplicate/competing attribution, individual attendance evidence, agreement/compensation and payment rules remain unapproved. The [referral proposal](BD-REFERRAL-PROPOSAL.md) is documentation only; no partner accounts, migrations, payout engine or crypto transfers exist.
- Existing historical award obligations require separate operational handling. The archive preserves evidence and does not cancel or automatically settle them.
- PR #1 must be reviewed as a dependency. After it is merged by the owner, this PR can be retargeted to main; do not merge or deploy either automatically.
