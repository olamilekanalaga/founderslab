# Founders Lab access review — 22 November 2026

## Scope
Existing Next.js app and PostgreSQL-backed authentication; no application rebuild or founder accounts. Public and private routes remain on the existing domain.

## Existing protections confirmed in code and local HTTP tests
- Public landing, application, calendar and confirmation shell need no login.
- Private workspace pages resolve sessions on the server and redirect anonymous visitors to /signin. Workspace API checks authentication and action permissions before reading/writing private records.
- Random session tokens are hashed in PostgreSQL, expire after seven days and are checked against active accounts. Passwords use salted scrypt and constant-time comparisons. No default provisioning password exists.
- Cookies are HttpOnly, Secure in production, SameSite=Strict and scoped to /. Mutation endpoints require Origin; private commands and logout also require a session CSRF token.
- Public session responses use an explicit field allowlist without participant identities or notes. Random, hashed, expiring confirmation capabilities return only that application's reference, project, status and bookings. References alone do not authorize access.
- API responses are private/no-store; referrer suppression, clickjacking protection and content-type protection exist. Production /demo is disabled.

## Fixes
- Login and every session lookup now require the active Admin matching BOOTSTRAP_ADMIN_EMAIL. Other Admin records and retired-role sessions cannot authenticate. Missing allowlist configuration fails closed.
- Disabled invitation creation and acceptance; /invite returns 404. Removed invitation controls and invitation signup content. No public signup/register API was introduced.
- Added account-wide login throttling alongside the existing email/IP throttle.
- Corrected CSRF byte-length comparison to reject multibyte invalid tokens safely.
- Added HSTS and disabled unused camera, microphone and geolocation permissions.

## Verification
- Production compilation and TypeScript check passed; lint and 21 domain/unit tests passed.
- Isolated local PostgreSQL plus a Next production server passed 11 integration groups, including public routes, all active private route redirects, anonymous/forged-cookie API rejection, wrong credentials, bootstrap provisioning/sign-in, another Admin rejection, retired-role and inactive-session rejection, missing-permission 403, CSRF/origin checks, Secure/HttpOnly/SameSite cookie attributes, disabled account-creation routes, limited confirmations, booking approval/capacity, reporting and browser sign-in.
- Logout rejects missing CSRF, deletes the database session and rejects replay of the previous cookie.
- The integration runner uses a random local-only database and password and removes that database. It does not alter production records.

## Production verification limit
Live HTTP requests from this workspace were blocked by the network proxy (CONNECT 403). The connected Vercel API returned project-not-found for the existing team/project. Therefore production environment-variable values, current PostgreSQL connectivity, actual administrator credentials and deployed login/logout were NOT verified. A successful Vercel deployment status is not an end-to-end security test.

Keep BOOTSTRAP_ADMIN_EMAIL configured in Production: it is the continuing allowlist. Provisioning also requires BOOTSTRAP_ADMIN_PASSWORD (12–200 characters); it never replaces an existing password. Do not send credentials in chat. Production must be tested with the owner's credentials in a trusted browser before calling this review production-verified.

## Remaining limits
No MFA, password recovery or automatic security monitoring is integrated. This is an access-control review and regression suite, not a penetration-test certification.

## Restricted Space Manager extension

The later Space Manager implementation preserves the Admin allowlist and Admin authentication handlers above. It adds independent, passwordless email grants, assignment-scoped APIs, hashed one-time links and separate manager sessions. It does not reopen Admin invitations or public signup. See SPACE-MANAGERS.md for the workflow, email configuration, revocation model and verification scope. Real provider delivery and deployed end-to-end manager access remain distinct from the mock-provider local integration results.

## Backend-only eight-week release audit

- Removed browser demo storage, mode switches, fictional confirmations and the interactive demo workspace. `/demo` is unavailable in every environment, including Preview. The public form and calendar use PostgreSQL APIs only; a missing service is shown as unavailable.
- Added a persistent eight-week programme window. Public booking APIs reject sessions outside that window. Only authenticated Admins or separately authenticated, assigned managers can submit attendance. Four distinct submissions in the oldest cycle advance the window; draft saves and repeated submissions do not. Old sessions, bookings and audit history are retained.
- The Admin email allowlist and password authentication remain unchanged. Account email is stored in the private User table; passwords are stored as salted scrypt hashes, not plaintext. Bootstrap secrets reside in server environment configuration. The workspace query now explicitly excludes password hashes from its selected user fields.
- A browser-build check found no checked credential values, server environment dereferences or removed fixture dataset in compiled static JavaScript. Private environment files are not tracked in Git. Variable names listed in setup help are not credentials.
- The production dependency audit initially reported five high-severity entries in Prisma configuration dependencies. Compatible overrides to deepmerge-ts 8.0.2 and effect 3.22.5 cleared those findings; the subsequent `npm audit --omit=dev` reported zero known vulnerabilities. Prisma generation, migrations, compilation and database-backed regression checks were rerun.
- Local tests cover anonymous/forged-cookie requests, invalid credentials, active Admin sign-in, disabled public registration, CSRF, secure cookies, logout replay, manager boundaries/revocation, limited confirmation data, out-of-season bookings and attendance-gated progression. These are checks of the source and local production build, not a penetration-test certification.
- Direct deployed requests were again blocked by this workspace's proxy (CONNECT 403 before reaching the application). Actual production configuration, deployed assets, real email delivery and owner login have not been independently verified here. A successful Vercel deployment does not remove that limitation.

Knowing neither an email address nor password is not a guarantee against compromise: an application bug, stolen session or compromised hosting/mail account can still create risk. No site can honestly be promised unhackable. MFA and password recovery remain outside the implemented application; the existing server-side controls reduce risk without claiming complete protection.

## Monthly winner and deletion controls

Monthly winner selection and permanent record deletion require the existing Admin session, the appropriate permission and CSRF/origin checks. Managers and anonymous requests are rejected. A winner must belong to a Space in the selected London-calendar month; the unique monthly campaign/award relationship permits one winner. No payments are executed. Deletion requires the literal DELETE confirmation, runs transactionally, removes owned linked records and confirmation capabilities, and preserves shared sessions and companies used by other founders. The deletion audit records only an anonymised operation without retaining the removed founder's personal fields. These protections are covered by local database and mobile browser tests.

## Manager report scope narrowed

Following the owner's clarification, managers can now edit only listeners, duration, recording URL and weekly post URL. Team-attendance fields are removed from the manager response and form, and direct team-edit payloads are rejected by the strict server schema. Existing attendance and private notes are preserved. Final manager reports can complete a programme week without detailed team counts. Admin authentication/allowlist and assigned-session/revocation controls are unchanged.
