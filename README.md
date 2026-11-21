# Founders Lab with Ola_Crrypt

A working, mobile-first founder programme and private research workspace. The supplied navy-and-violet Founders Lab reference defines the visual system: dark navigation, compact cards, violet charts and a light research workspace. SiteFlow informed the initial workflow structure. Built with Next.js App Router, React, TypeScript, Tailwind/CSS, Lucide, Recharts, PostgreSQL, Prisma and Zod.

**Open `/demo` without an account.** It contains 50 fictional founders, 50 companies, 53 founder/company memberships, 10 completed Spaces plus four upcoming examples, interview records, needs, relationship hypotheses, opportunities and two monthly campaigns. All names, contacts, businesses, evidence and recording links in this dataset are fictional. `.invalid` links intentionally do not resolve.

## Quick start: no database or login

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000/demo**. No environment variables or paid APIs are necessary. Without a database, public application/booking forms default to the clearly labelled browser-local demonstration. The private workspace requires a database and real authentication.

Demo changes persist in this browser. **Reset demo** restores the fixture; **Walkthrough** guides the application → approval → session → research → opportunity → report sequence. The role selector previews collaborator access only in the fictional demo. It does not grant server permissions. Public demo forms are `/apply?mode=demo` and `/book?mode=demo`.

## Database and private workspace

1. Copy `.env.example` to `.env`; replace both local password placeholders with the same strong database password. Set the bootstrap email and a distinct administrator password of at least 12 characters.
2. Start PostgreSQL, migrate and initialise programme defaults:

```sh
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:admin
npm run dev
```

3. Sign in at **http://localhost:3000/signin** with the account you provisioned. `/dashboard` and all private pages enforce authentication. Provisioning again preserves an existing password; it does not reset it.
4. Remove bootstrap credentials from the runtime environment after provisioning. Never commit `.env`.

`db:seed` normally creates roles, permissions, editable taxonomy labels and programme defaults only. **For an isolated development database**, `npm run db:seed -- --demo` additionally inserts the fictional programme and sets a persistent fictional-dataset banner. It refuses to mix demo founders into a database that already contains founders. The browser `/demo` is independent of this database.

Migrations live under `prisma/migrations/`. `db:migrate` applies SQL transactionally with a PostgreSQL advisory lock and checksum ledger. This project deliberately uses its own `pg` migration runner, not `prisma migrate deploy`; do not mix migration ledgers. See [database notes](prisma/README.md).

## Implemented journeys

- Public founder application: searchable worldwide country input, standardised stage/sector/team size, optional details, separate privacy/promotional consents, normalised duplicate protection and a private confirmation capability.
- Public Space request: dates with IANA timezones, deadlines, available project seats, host and approval status. Speakers are counted separately from project seats.
- Admin approval: create/link founder and company profiles, assign a Space, approve/waitlist/decline/cancel, mark attendance/no-show, and preserve application history.
- Shared recording: paste one URL on a session. Founder appearances and company timelines derive their recording links from that session. No recording upload or transcription.
- Founder/company directory: paginated founder cards with a table alternative, search, country/sector/stage filters, many-to-many memberships, relationship status, source/evidence, contacts, follow-up actions and company classifications.
- Research: split-view interview reader with Summary/Notes/Actions, a table alternative and twelve structured sections, manual/pasted notes, classification, researcher/date/confidence, evidence, verification and private/public review. Publishing requires administrator review; public highlights also require promotional consent for that exact founder/company.
- Classification: a dedicated company workspace for multi-label editing; existing company-save permissions and persistence apply. Geographic market labels remain independent of operating-country records.
- Spaces calendar: month/day navigation with an agenda, project-seat counts and shared recording links.
- Market map: explicit company relationships in list and network modes, with reason, evidence, reviewer, confidence and review date. Matches remain hypotheses; a shared sector does not imply competition.
- Opportunities: editable board/list pipeline, documented company need, related founder, owner, budget/unknown, next action, follow-up, outcome and change history. Hiring claims require supporting evidence.
- Reports: stored-record-derived counts, charts, date/country/cohort/sector/stage filters, coverage/missing responses, sources/limitations, CSV and actual PDF download.
- Monthly campaigns: target 20 founders by default, eligibility assessments, published rules, manual winner selection and 1 SOL award record. Recording an external transfer requires a reference. The app never executes a cryptocurrency payment.
- Team/settings: manually shared expiring one-use invitations, six role templates, per-user permission grants, enabled countries, taxonomy labels, session capacity, campaign defaults, published terms, retention policy and audit trail.

## Access and security boundaries

Public routes: `/`, `/apply`, `/book`, `/confirmation`, `/terms`, `/demo`, `/signin`, `/invite`.

Private routes: `/dashboard`, `/founders`, `/companies`, `/spaces`, `/research`, `/classification`, `/market-map`, `/opportunities`, `/reports`, `/campaigns`, `/settings` and entity details. Private data is not embedded in public pages.

| Role                 | Default scope                                                |
| -------------------- | ------------------------------------------------------------ |
| Administrator        | Full programme, commercial and team management               |
| Researcher           | Founder/company and research editing, sessions, reports      |
| Booking coordinator  | Directory and booking/session management                     |
| Interview host       | Sessions, research and directory access                      |
| Business development | Directory, commercial opportunities and reports              |
| Read-only analyst    | Directory/research/report reading; no commercial/team access |

The server resolves current permissions on every authenticated request, checks writes and redacts unavailable datasets before returning them. The demo applies the same domain permissions locally, but contains no real private data. Sessions use random opaque tokens, server-side hashed storage, HttpOnly/SameSite cookies, production Secure cookies, expiry, origin/CSRF checks and durable request limits. Passwords use salted scrypt. Multiple normal sessions are supported.

Application references are not credentials. Confirmation access uses a random 30-day capability in the URL fragment, never an enumerable reference query. Confirmation responses expose only project/reference/status/session information. Invitation tokens expire after seven days and can be accepted once. Share these links privately.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
# In a second terminal, with the server running on port 3000:
npm run test:e2e
# Requires a local PostgreSQL server with CREATE DATABASE permission and a build:
npm run test:integration
```

Playwright defaults to `/usr/bin/chromium` on this development environment. Elsewhere install Chromium with `npx playwright install chromium`, then set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable, or omit that variable and use an installed system Chromium at the default path. `PLAYWRIGHT_BASE_URL` optionally selects an already running server. The integration runner only connects to localhost and creates/drops a new random database; it never clears the configured application database. Port 3100 must be free.

See [verification results](TESTING.md), [deployment instructions](DEPLOYMENT.md), and [screenshots](artifacts/README.md).

## Architecture

- `app/`: public pages, authenticated server pages and JSON endpoints.
- `components/`: responsive workspace, forms, entity views, charts and public flows.
- `lib/domain.ts`: validated, permission-checked state transitions shared by demo/server.
- `lib/db.ts`: typed relational persistence, scoped loading and transactional commands.
- `lib/auth.ts`: sessions, passwords, CSRF/origin and rate limits.
- `lib/seed.ts`: deterministic fictional fixture; `demo-store.ts`: versioned local persistence.
- `lib/selectors.ts`, `lib/export.ts`: derived reports, CSV/PDF and provenance.
- `prisma/`: relational schema, foreign keys, uniqueness constraints and SQL migration.
- `tests/`: domain rules, browser journeys/accessibility, isolated PostgreSQL/production HTTP tests.

## V1 limitations

This is an implementable MVP, not an externally verified founder database. Research is manually entered; confidence and verification states record a human review, not independent certification. Reporting uses a convenience programme sample and cannot represent the whole Web3 industry. Historical fictional upcoming sessions have fixed dates and can be edited/reset.

Invitations are generated for manual secure sharing; email delivery, forgotten-password recovery, MFA and identity-provider SSO are not integrated. Bootstrap access is configured by the operator. Retention settings record policy; scheduled deletion/anonymisation and subject-access tooling require an operational process. Audit logs record commands, not full reversible revisions. Taxonomy labels can be added or archived; existing meanings are preserved by archiving and creating a new label.

The workspace loads its authorised dataset as a single snapshot, appropriate for this initial programme size; large deployments need server pagination, narrower queries and concurrent-edit conflict handling. Session approval capacity is protected by PostgreSQL row locks. More general simultaneous edits currently use last committed field values. No audio processing, automated research, messaging, external analytics, token trading or award payments run in V1.

The dedicated Vercel project is connected to `olamilekanalaga/founderslab`, production branch `main`. Follow `DEPLOYMENT.md` for environment and database setup. Browser and database checks are run locally against the production build; a successful deployment status alone does not verify every live flow.
