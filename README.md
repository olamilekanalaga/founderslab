# Founders Lab with Ola_Crrypt

A private founder register and X Spaces booking programme, with a no-login fictional demo. The current interface focuses on names, companies, countries, short product descriptions and programme numbers.

## Current screens

- **Overview:** founder, company, country and completed-Space counts; founder growth; country distribution; recorded attendance totals; pending applications and upcoming Spaces.
- **Founders:** searchable cards/table, company links, short descriptions, contact details and Space appearances.
- **Companies:** company name, country, short product description, team size, sector/stage, founders and shared recording links.
- **Founder Spaces:** applications, booking approvals and weekly sessions.
- **Reports:** filtered founder/company records, country/team counts, CSV and PDF exports.
- **Campaigns & awards:** programme cohorts and manually recorded award decisions; no payment automation.
- **Settings:** administrator access, company options and programme configuration.

Research, classification, market-map and opportunity screens have been retired from navigation. Their old URLs redirect to the founder directory. Profiles, editors and reports no longer display research notes, business-need stories or follow-up narratives. Existing database records and the underlying legacy models are preserved; this update does not delete historical data or import posts from X.

## Run the demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000/demo`. No secrets, paid APIs or database are needed. Demo changes persist only in the current browser. **Reset demo** restores fictional fixtures: 50 founders, 50 companies, global country coverage, 10 completed Spaces, twelve upcoming Saturday sessions and two campaigns.

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

Migration uses the checked-in PostgreSQL runner (`npm run db:migrate`), not Prisma's native migration engine. Existing installations must apply the additive Space Data and shared weekly post migrations before serving the current revision. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Founder booking flow

1. Open the 12-week calendar at `/book`.
2. Choose an available Saturday week card at 19:00 UTC.
3. Continue to the founder questions with that session attached.
4. Submit the application and pending booking together.
5. An administrator approves/declines the application, then approves/waitlists/declines the booking under Founder Spaces.

Only future Saturday sessions with an open deadline and remaining approved capacity can be selected. Week cards show approved bookings/capacity (0/5 booked, 3/5 booked, 5/5 Full). Full dates are disabled. Multiple speakers from one project count as one project seat. Pending requests do not reserve confirmed seats. Server-side session row locks protect approval capacity and recheck availability when public submissions arrive.

Confirmation links use random, expiring capabilities and reveal only the submitting project's status. The public calendar exposes no founder identities or private session notes. Automatic email/Telegram notifications are not configured.

## Weekly Spaces inside founder profiles

Open a founder card and use **Weekly Spaces → Edit weekly Space data**. The same editor is available on the weekly session page. Enter actual attendance independently of booked places and expected speakers. Founders plus other team members form total attendance. Blank figures remain unknown; explicit zero is preserved. Edits replace a Space's numbers rather than counting it twice. Charts accumulate recorded activity by Space date. Repeat attendees/listeners across different Spaces count again; totals are not deduplicated unique audience figures.

The weekly X post, live Space URL and recording URL are stored once on the session and inherited by linked founder/company pages. There is no recording upload, transcription or automatic capture of X conversations.

## Access and persistence

The real workspace requires an authenticated, authorised Admin session. Public visitors can book without an account; they cannot access private founder data. Demo Admin is a fictional local preview, not real authentication. Server authorization, CSRF/origin checks, capability expiry, password hashing, rate limits and audit logs protect database-backed commands.

Administrator invitations and public account registration are disabled. Only the active Admin matching BOOTSTRAP_ADMIN_EMAIL can authenticate; keep that email configured after provisioning. MFA, password recovery and SSO are not integrated. Restricted Space Managers use a separate passwordless email flow; see [SPACE-MANAGERS.md](SPACE-MANAGERS.md) for Resend configuration and assignments. Ordinary multi-device sessions are supported. Demo browser storage does not synchronize across devices.

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

## Shared weekly mapping

Space Data is no longer a navigation page; its old route redirects to founders. A founder's Weekly Spaces view resolves their named session participation and recorded company-level attendance. Co-founders sharing a company see the same project row. Within a weekly Space, the X post, Space/recording links, live listeners, duration and recorded session totals are shared. Each company retains its own founders attended, other team members, total attendance and expected speakers. Expected speakers come from approved participation and are not treated as actual attendance.

The same-week table links the other participating founders and companies. Existing booking approvals assign the founder/project to the week; attendance rows also link a project to that week without inventing named individual attendance. Unknown figures remain blank. Global growth charts and Space totals remain on Overview and count each session once, regardless of the number of founder profiles displaying it.

## Connected Neon production setup

Vercel uses `npm run build:vercel` to prepare the connected production database before compiling the app. It applies the checked-in migrations and inserts programme defaults only; no fictional founder records are seeded. Add your chosen `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` as sensitive Production variables and redeploy to create the first administrator. Remove bootstrap variables after provisioning. The password is not printed or reset on subsequent deployments.

Production turns off the public Admin demo and browser-local demo forms. A supported prefixed Neon connection is resolved on the server; connection values never reach the browser. Readiness is available at `/api/health`. See DEPLOYMENT.md for direct versus pooled connections and initial setup.

Booking date eligibility and time display use UTC/GMT throughout the public calendar, selected session, confirmation, weekly profiles and Admin session list. Existing timestamps are preserved; 18:00 Lagos displays as 17:00 UTC. New session editors default to UTC. Empty production databases have no fictional published sessions: the calendar explains that grey dates are unpublished/unavailable, and only real published Saturdays become selectable. UK daylight-saving time is not applied to this explicit UTC schedule.

## Approved recurring Saturday programme

Production preparation publishes a rolling 12-week window of real Saturday sessions at **19:00 UTC**, capacity **five project places**, as requested by the programme host. Booking stays open until the start time; requests still require Admin approval. The publisher uses deterministic date IDs and a transaction lock. It preserves existing sessions on each date, including cancellations and changed capacities, and never resets bookings or reopens full sessions. Every deployment extends the window as needed. The public booking page is titled Founders Lab and labels the time United Kingdom, London — UTC / GMT (fixed UTC).

The booking calendar follows the weekly-card layout in the website’s light theme: three columns, four rows, numbered Week 1–12, selected-week details and a View booking details action leading to the founder questions. Counts mean approved project bookings; a fully booked week has 5/5 and is disabled. The hosted publisher verifies newly created dates through the live public booking API before the release continues.
