# Verification — 21 November 2026

Verified locally against Node.js 24, PostgreSQL 17, Next.js 16.4.6 and Chromium. These are local production-build results, not a claim of a public deployment.

| Check                             | Result                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run typecheck`               | Passed                                                                        |
| `npm run lint`                    | Passed, no errors or warnings                                                 |
| `npm test`                        | 10 domain tests passed                                                        |
| `npm run build`                   | Passed; client generation and Next production compilation                     |
| Build with `DATABASE_URL` empty   | Passed; `/demo` does not require a database                                   |
| `npm run test:e2e -- --workers=1` | 7 browser tests passed against `next start`                                   |
| `npm run test:integration`        | 7 PostgreSQL/production HTTP verification groups passed                       |
| Mobile accessibility              | No Axe WCAG A/AA violations found on the nine checked routes                  |
| Screenshots                       | 26 desktop/mobile captures plus shared-recording and private-profile captures |

## Browser journeys

1. No-login demo opens; add/search a founder; refresh preserves changes; reset restores 50 founders.
2. Submit fictional application → limited confirmation → admin approval → request booking → approve project → edit one recording → recording inherited by founder and company → document all twelve research sections → add a business need → create an opportunity → report contains 51 founders.
3. Company classification filter, market-map network/type filter, opportunity board/list/status changes, country-filtered report counts, real CSV/PDF downloads, and removal of role switching from the Admin preview. Public booking has no workspace navigation.
4. Research edits, campaign eligibility assessment and a manual award selection without a transfer.
5. Navigation and document overflow at 375×812, 393×852, 834×1112 and 1440×1000 across overview, founder directory, Spaces, market map, reports and application.
6. Automated accessibility checks at 393×852 for overview, founder directory/profile, Spaces, classification, research, reports, public application and booking.
7. Founder-card search and navigation, saved classification labels after refresh, month navigation and research Notes/Actions tabs.

## PostgreSQL and production HTTP

The integration runner creates a randomly named local test database, runs the checked-in SQL migration, seeds fictional records, provisions a unique administrator, starts the production app on port 3100 and deletes the test database after completion. It never clears the main application database.

- Anonymous private API rejected; private pages redirect to sign-in; invalid passwords rejected; authenticated writes require CSRF and matching origin.
- Public applications validate, normalised duplicates return 409, approval creates the correct founder/company membership, and confirmation returns only limited project/status/session data. A reference alone cannot retrieve it.
- Six simultaneous approvals into a five-project session produce five successes and one capacity rejection. Five seats can represent fifteen speakers. Capacity cannot be reduced below occupancy. Public session responses omit internal notes/participants.
- Company classification saves preserve typed company data and persist label relationships; the authenticated classification route renders correctly. A recording persists in exactly one database column, `Session.recordingUrl`, and resolves on every connected founder/company timeline.
- Admin invitations are accepted once. Invitations for removed roles are rejected. A retired-role account cannot sign in, reuse an existing session, accept an old invitation or access private workspace pages/APIs. Public booking remains anonymous.
- Reports derive 51 founders/21 Nigeria founders after a new application. A public research record is withheld without matching promotional consent and appears after consent exists for the exact founder/company.
- Mobile production sign-in → private dashboard → newly approved founder profile has no page runtime errors or document overflow.

## Visual inspection

The supplied Founders Lab design is the new visual reference: navy navigation, a geometric violet mark, light surfaces, compact eight-metric overview, founder cards, violet area/donut/bar charts, a calendar-led session agenda, split-view research, company classification, campaign sidebar and tabbed settings. Table grid lines and all existing workflows remain.

Captured 26 screenshots from actual 1536×1024 and 393×852 browser viewports. Inspected overview, founder cards, research, classification and reports; corrected contrast, tab spacing and long directory scrolling with pagination. Automated screenshot capture found no page runtime errors or horizontal document overflow. Chart data is derived from records, with region percentages and complete sector groups. The original no-database build check was completed on 20 November; database infrastructure is unchanged by this design pass.

Automated checks do not establish full WCAG conformance, every assistive-technology interaction, load capacity or external service availability. No real applicant data, payment, external message or production deployment was used in verification. See README for V1 operational limits.
