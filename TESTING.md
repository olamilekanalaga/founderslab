# Verification

Current checks use Node.js 24, PostgreSQL and a Next.js production build.

- TypeScript, ESLint and production compilation.
- 23 unit/domain checks: validation, capacity, shared records, reports, permissions, London GMT/BST offsets, Nigeria time conversion and duplicate-free schedule planning.
- 16 isolated PostgreSQL/HTTP groups: public application, duplicate rejection, approval, booking capacity, profile inheritance, Admin allowlist, protected routes, credentials, CSRF/cookies, manager invitations and resource scope, expiry/revocation, reporting, mobile browser saving and logout.
- Attendance-cycle checks: eight published weeks, drafts excluded, repeated submission of one week counted once, advancement only after four distinct oldest-cycle submissions, eight active weeks after rollover, archived sessions retained, existing booking IDs unchanged and out-of-season public booking rejected.
- Three backend-backed browser checks: an eight-date light calendar with slots left, anonymous/storage-forged access denial, no public signup/demo controls, and Axe WCAG A/AA on the public calendar. Manager mobile forms also receive Axe checks in integration tests.
- `npm run check:client-secrets`: compiled browser files checked for configured server credential values and removed browser fixtures; private environment files must not be tracked.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities after compatible transitive dependency updates.

The integration runner creates a random local-only PostgreSQL database and password, uses a mock transactional email provider, and removes that database when complete. Fictional fixtures are test infrastructure only and are blocked from hosted databases. No production records or real inboxes are used by these tests.

Screenshots are captured at iPhone (393 × 852) and desktop dimensions. No claim of production end-to-end security or real email delivery is made: this workspace's direct live requests are blocked by its network proxy. See SECURITY-REVIEW.md.

Monthly winner tests cover month-scoped participants, one winner after reselection, no assessment requirement and Admin-only CSRF checks. Deletion tests exercise the mobile confirmation flow, declined applications, approved founders, revoked confirmation links, removal of owned company/application/booking data and preservation of shared sessions.
