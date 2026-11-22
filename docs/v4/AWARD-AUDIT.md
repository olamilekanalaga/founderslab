# Founder award retirement audit

The former founder 1 SOL award model is retired for new participation. A BD introduction model is not a renamed founder award: recipients, attribution, verified outcomes and qualification rules are different. No BD compensation is implemented.

| Surface | Before V4 | V4 |
| --- | --- | --- |
| Root homepage | Redirect to booking | Programme introduction, no award promotion |
| Public application | Non-guarantee mentioned an award | Speaking-slot non-guarantee only |
| Public programme terms | Monthly award heading, stored 1 SOL promise | Current participation-only policy, acknowledgement that prior obligations remain applicable |
| Public programme API | Returned legacy award defaults and stored terms | Omits `awardAmount`/`campaignTarget`; publishes current policy regardless of historical stored text |
| Booking/confirmation | No active prize promotion found | Existing submission/confirmation flow unchanged; shared public navigation cleaned |
| Admin navigation/sidebar | Monthly Winner and cohort/award promotion | Removed from main navigation and sidebar |
| `/campaigns` | Choose month/founder and save winner | Admin-protected, read-only award archive |
| Admin Settings | Editable default award and programme terms | Historical award amount labelled inactive; no award amount editor; historical terms labelled separately; protected archive link |
| `/api/monthly-winner` | Authenticated winner upsert | Existing Admin permission and CSRF/Origin checks retained, then HTTP 410; no writes |
| `/api/workspace` | `campaign.save`, `campaign.assess`, `award.save` could mutate | All three return HTTP 410 after existing identity, permission and CSRF checks |
| Reports | Historical campaign/cohort filtering | Preserved for existing records |

## Historical data

No Prisma schema, SQL migration, database table or production record changed. Campaign stores recorded amounts, periods, rules and criteria; CampaignParticipant stores historical assessment/eligibility; AwardDecision stores founder, reviewer, rationale, decision date/status and transaction reference. Existing audit history, reporting, relationships and explicit Admin permanent-deletion behaviour remain intact. This upgrade does not run deletion or backfill jobs.

The archive displays recorded periods, amounts, winner names, statuses and payment references. It makes no new payment or promise. Existing obligations are neither cancelled nor settled by changing the website. Their operational resolution remains a separate Admin process; the read-only archive introduces no new settlement workflow.

The old pure domain cases and validation schemas remain to preserve historical compatibility and tests. They are not reachable as new award operations through the workspace HTTP boundary. They should not be reused by future server actions without respecting the retirement policy. The private settings shape retains its legacy fields and values for compatibility; they are not published as a current offer. The database fixture builder retains historical award examples in its already guarded localhost-only path.

## Regression evidence

The isolated PostgreSQL suite starts with historical campaign/participant/decision rows, including a non-empty payment reference. It snapshots every column, calls the retired endpoints as anonymous, manager and Admin callers, verifies CSRF rejection and Admin HTTP 410, and compares all historical rows before/after. The protected archive renders the recorded payment reference and has no Save Winner button. Production data is not used for these tests.

A stale stored terms fixture containing the old 1 SOL wording is retained unchanged in PostgreSQL while `/api/public/programme` returns current participation terms. Browser tests check all founder routes for old reward messaging and workspace links. The schema and ordered migration fingerprint checks still pass.
