# Space Managers

The 22 November Admin access controls remain in place. The bootstrap email allowlist, Admin password authentication and existing workspace endpoints are unchanged. Space Managers use separate database tables, email links, sessions, cookies and API handlers; they are never provisioned as Admin users.

## Configure email

Set these in the existing Vercel project's Production environment and redeploy:

- `APP_ORIGIN=https://founderslab-orcin.vercel.app` (canonical HTTPS origin).
- `RESEND_API_KEY`: your transactional Resend API key.
- `MANAGER_EMAIL_FROM`: an address on a sender domain verified in Resend, e.g. `Founders Lab <spaces@your-domain>`.

No email provider plan or API subscription was purchased. Configure your own provider account and verify its sending domain. Do not put API keys in source code. A successful API response with an email ID is recorded as provider acceptance, not proof of inbox delivery. Missing configuration, timeouts and provider rejections never report successful sending and invalidate the attempted link. Settings shows whether configuration is present; it does not certify sender-domain verification.

## Workflow

1. Admin Settings → Space Managers. Enter the friend's email, select their weekly Spaces, and send the invitation.
2. The email links to `/manager/spaces` with a 15-minute, single-use token in the fragment. It is removed from browser history on opening; the manager explicitly continues to verify mailbox access. Merely opening the page does not consume the link.
3. Verification issues a separate HTTP-only, production-Secure, SameSite=Strict session lasting eight hours. No password, public signup or founder account is created.
4. The manager sees only assigned session titles/dates, participating founder names/countries and company names, plus exactly four report inputs: listener count, duration (hours/minutes), recording URL and weekly X post URL. Detailed founder/team attendance is not shown or editable. No contacts, private notes, booking approvals, research, reports or awards are returned.
5. Manager edits reuse the existing SpaceData and Session records for listener totals, duration and X links. Founder/team attendance rows, private notes, booking associations and session participants are preserved; managers cannot change them.
6. Admin can replace assignments, resend a new email link, inspect last activity or revoke access. Resending invalidates old links. Revocation is terminal for that manager record: it invalidates sessions and unused links immediately while retaining edits and audit history. Revoked records cannot be silently reactivated by resending.
7. A manager can request another short-lived link from `/manager/spaces` after session expiry. Requests are rate-limited; no link is issued for unknown or revoked emails. Managers can sign out independently of the Admin session.

## Persistence and permissions

Migration `202611220001_space_managers` adds grants, assignments, hashed email tokens and hashed sessions with foreign keys. Run the existing `npm run db:migrate` runner. Production preparation applies it during Vercel deployment; no manual changes to existing founder records are needed.

Every manager save rechecks the active session and assignment under a manager-row transaction lock. Revocation and assignment changes use the same lock, so they serialize against writes. A session lock also serializes existing Space data edits. The save schema explicitly excludes notes, session configuration and booking fields. Unknown payload fields are rejected. Manager cookies cannot authenticate against the Admin APIs, and Admin cookies alone cannot authenticate against manager APIs.

## Verification and limits

Integration tests use an isolated local PostgreSQL database and an HTTP mock of the transactional email provider. They test provider acceptance/rejection, single-use and expired links, session expiry, simultaneous link use, assignment boundaries, contact redaction, browser saving, profile inheritance, Admin rejection, immediate revocation and audit preservation. Screenshots show the light manager workspace at iPhone and desktop sizes.

These tests do not prove real email delivery. Production email sending and the deployed manager journey require working provider configuration and an actual invited mailbox. No real invitations were sent during testing. Existing network/project-access restrictions may prevent this workspace from testing the live site; deployment success is reported separately from live end-to-end verification.

## Four-field report clarification

Managers can submit a completed report after the Space starts with listener count and duration; recording/post URLs can be updated when available. They are not required to enter team counts. A completed report counts once toward the four-Space cycle. The Admin Overview defaults to listener growth so these reports update its primary chart. The manager API rejects team-attendance payloads even if sent directly.
