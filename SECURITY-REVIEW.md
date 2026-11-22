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
