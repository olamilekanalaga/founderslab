# Founders Lab with Ola_Crrypt

A private founder register and X Spaces booking programme, with a no-login fictional demo. The current interface focuses on names, companies, countries, short product descriptions and programme numbers.

## Current screens

- **Overview:** founder, company, country and completed-Space counts; founder growth; country distribution; recorded attendance totals; pending applications and upcoming Spaces.
- **Founders:** searchable cards/table, company links, short descriptions, contact details and Space appearances.
- **Companies:** company name, country, short product description, team size, sector/stage, founders and shared recording links.
- **Founder Spaces:** applications, booking approvals and weekly sessions.
- **Space Data:** actual founders/team members per project, live listeners, hours/minutes, and cumulative charts.
- **Reports:** filtered founder/company records, country/team counts, CSV and PDF exports.
- **Campaigns & awards:** programme cohorts and manually recorded award decisions; no payment automation.
- **Settings:** administrator access, company options and programme configuration.

Research, classification, market-map and opportunity screens have been retired from navigation. Their old URLs redirect to the founder directory. Profiles, editors and reports no longer display research notes, business-need stories or follow-up narratives. Existing database records and the underlying legacy models are preserved; this update does not delete historical data or import posts from X.

## Run the demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000/demo`. No secrets, paid APIs or database are needed. Demo changes persist only in the current browser. **Reset demo** restores fictional fixtures: 50 founders, 50 companies, global country coverage, 10 completed Spaces, four upcoming Saturday sessions and two campaigns.

Public booking: `/book?mode=demo`. Private demo approvals: `/demo/spaces?tab=applications` and `/demo/spaces?tab=bookings`.

## Database-backed workspace

Node.js 24 and PostgreSQL are required for private records. Copy `.env.example` to `.env` and configure `DATABASE_URL`, `APP_ORIGIN` and bootstrap administrator credentials. Keep secrets outside Git.

```bash
npm run db:generate
npm run db:migrate
npm run db:admin
npm run dev
```

Sign in at `/signin`. To seed fictional records into a development database, run `npm run db:seed -- --demo`; inspect the script before using it against an existing database. Never seed a production founder database just to test the interface.

Migration uses the checked-in PostgreSQL runner (`npm run db:migrate`), not Prisma's native migration engine. Existing installations must apply the additive Space Data migration before serving the current revision. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Founder booking flow

1. Open the month calendar at `/book`.
2. Choose an available published Saturday, then a time.
3. Continue to the founder questions with that session attached.
4. Submit the application and pending booking together.
5. An administrator approves/declines the application, then approves/waitlists/declines the booking under Founder Spaces.

Only future Saturday sessions with an open deadline and remaining approved capacity can be selected. Date cells show booked project places/capacity (0/5, 3/5, 5/5 Full). Full dates are disabled. Multiple speakers from one project count as one project seat. Pending requests do not reserve confirmed seats. Server-side session row locks protect approval capacity and recheck availability when public submissions arrive.

Confirmation links use random, expiring capabilities and reveal only the submitting project's status. The public calendar exposes no founder identities or private session notes. Automatic email/Telegram notifications are not configured.

## Space numbers

Enter actual attendance in **Space Data**, independently of booked places and expected speakers. Founders plus other team members form total attendance. Blank figures remain unknown; explicit zero is preserved. Edits replace a Space's numbers rather than counting it twice. Charts accumulate recorded activity by Space date. Repeat attendees/listeners across different Spaces count again; totals are not deduplicated unique audience figures.

A recording URL is stored once on the session and inherited by linked founder/company pages. There is no recording upload, transcription or automatic capture of X conversations.

## Access and persistence

The real workspace requires an authenticated, authorised Admin session. Public visitors can book without an account; they cannot access private founder data. Demo Admin is a fictional local preview, not real authentication. Server authorization, CSRF/origin checks, capability expiry, password hashing, rate limits and audit logs protect database-backed commands.

Administrator invitations are generated for manual secure sharing. MFA, password recovery, email delivery and SSO are not integrated. Ordinary multi-device sessions are supported. Demo browser storage does not synchronize across devices.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
# In another terminal:
npm run test:e2e -- --workers=1
npm run screenshots
# Local PostgreSQL with CREATE DATABASE privileges:
npm run test:integration
```

Playwright uses `/usr/bin/chromium` here; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and `PLAYWRIGHT_BASE_URL` override the browser/server. The integration runner creates and drops an isolated random localhost database, never the configured application database. See [TESTING.md](TESTING.md) and [screenshots](artifacts/README.md).

## Deployment and limits

The existing Vercel project is linked to `olamilekanalaga/founderslab`, production branch `main`, at `https://founderslab-orcin.vercel.app`. Deployment success alone does not verify the public browser flow. All data shown without live database configuration is fictional browser-local demonstration data.

The initial programme uses an authorised snapshot rather than server pagination. General concurrent field edits use last committed values; booking capacity and Space Data updates serialize per session. Retention settings record policy but do not schedule automatic deletion. Reports describe programme participants, not the entire Web3 industry. No external X ingestion, automated research, cryptocurrency payments or paid integrations run in this version.
