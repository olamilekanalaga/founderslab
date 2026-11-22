# Deploy and operate Founders Lab

Use the existing Vercel project connected to `olamilekanalaga/founderslab`, production branch `main`. Keep one project, one PostgreSQL database and one canonical website origin. The current Vercel website address works without buying a custom domain.

## Build configuration

The repository root contains `package.json` and `vercel.json`. Use Next.js and Node.js 24. The checked-in configuration installs with `npm ci`, builds with `npm run build:vercel` and outputs `.next`.

In Vercel Production, the build generates Prisma, applies checked-in SQL migrations using the direct database connection, provisions defaults, ensures the attendance-gated booking window and provisions the configured Admin if absent. Existing passwords are not reset. Preparation failures fail the deployment. Public requests never run bootstrap account creation.

## Production configuration

Set values in the existing project's Production environment, never in public-prefixed variables or Git:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL application connection; Neon pooled connection is supported. |
| `DATABASE_URL_UNPOOLED` | Direct connection for migrations when the application uses Neon's pooler. |
| `APP_ORIGIN` | Exact canonical HTTPS website origin, initially `https://founderslab-orcin.vercel.app`. |
| `BOOTSTRAP_ADMIN_EMAIL` | Sole Admin allowlist. **Keep this configured after provisioning.** |
| `BOOTSTRAP_ADMIN_PASSWORD` | Initial provisioning password, 12–200 characters. No default exists. |
| `BOOTSTRAP_ADMIN_NAME` | Optional Admin display name. |
| `RESEND_API_KEY` | Transactional email provider credential for Space Manager invitations/sign-in. |
| `MANAGER_EMAIL_FROM` | Sender address on a domain verified in Resend. |

`DATABASE_DATABASE_URL` / `STORAGE_DATABASE_URL` and corresponding direct-connection aliases are also supported. Prefer the standard integration variables when available.

The bootstrap password is used only when creating the Admin. After confirming real sign-in, it can be removed from Vercel; do not remove the allowlist email. Existing credentials remain hashed in PostgreSQL. There is no public signup, founder account or administrator invitation acceptance.

Use an existing domain you own for the email sender, or acquire one if needed. A custom website domain and a verified email-sending domain are separate configuration tasks; they may use the same owned domain. No provider subscription or domain purchase is performed by this repository. Provider acceptance of an email is recorded separately from actual inbox delivery.

## Live launch checks

1. `/book` shows eight Saturdays in two four-week cycles, at 7 PM Europe/London with GMT/BST conversion and slots left.
2. A public application creates a pending request and a limited private confirmation link, without login.
3. Anonymous private pages redirect to `/signin`; `/api/workspace` and manager/admin APIs reject unauthorised requests. `/demo`, `/invite` and public signup are unavailable.
4. The real Admin can sign in, approve a booking, assign Spaces, review reports, select a monthly winner and sign out.
5. A real manager email arrives, the single-use link works, assigned Space data saves, and revocation immediately blocks the session and outstanding links.
6. Saved shared links appear on the associated founder/company profiles. Drafts do not complete a cycle. Four distinct explicit attendance submissions advance the public window by four weeks while retaining history.
7. Configure database backups and confirm the programme's actual privacy terms and recovery process before relying on the service operationally.

Do not submit invented production attendance just to move the calendar. Use isolated local tests for cycle progression. Permanent deletion must be intentional: the Admin confirmation removes owned records; shared Spaces remain.

Automated tests use a local production build, an isolated PostgreSQL database and a mock email provider. They do not prove deployed authentication or real inbox delivery. The workspace used for development has been unable to reach the live site through its network proxy, so owner sign-in and real email checks remain owner-side validation steps. See SECURITY-REVIEW.md.

## Optional custom website domain

Add the domain to this same Vercel project's Domains settings and apply Vercel's DNS instructions. Set it as the canonical address, redirect old aliases, change `APP_ORIGIN` to that exact HTTPS origin, and redeploy. Verify the public application and real email links again. Preserve PostgreSQL and `BOOTSTRAP_ADMIN_EMAIL`; no new application or account migration is needed.

## Other environments

Preview/local environments still require PostgreSQL; there is no browser demo. Use an isolated database and a matching origin. Do not let preview deployments mutate production records. Vercel automatic database preparation runs only in Production; prepare isolated environments using the documented migration/default-seed commands.

For a persistent Node host, use the same server environment variables and database, run `npm run db:migrate`, `npm run db:seed`, initial `npm run db:admin`, `npx tsx scripts/publish-saturdays.ts`, then `npm run build` and `npm start`. Serve it behind HTTPS and use a process supervisor.

Applied migrations are immutable. Keep the full migration history, including tables used by existing historical records. See prisma/README.md.
