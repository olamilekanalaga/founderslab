# Public SaaS-style UI upgrade

The homepage now explains the founder programme with a short, product-led hero and an interactive preview of real public booking availability. On `/book`, the selected date and continuation are visible beside the dates on desktop and in a persistent action area on mobile. The existing application, approval, confirmation, permissions, eight-week window and London-time rules remain.

The public system includes self-hosted variable Geist, the existing brand mark, scoped light/violet styles, a compact keyboard-accessible menu, earlier upcoming dates, concise programme FAQs and a generated Open Graph image. Application, confirmation and terms inherit the public styling without changing field identifiers or policy text.

`ProgrammeAvailability` shares one availability load between the hero and upcoming cards. Loading, empty, full, cancelled and failed states never create fictional seats. The hero carries its chosen session into the calendar; the calendar checks eligibility before offering the existing application URL. Final approval and capacity remain server-authoritative.

## Source and compatibility

- Existing Next.js16.4.6 / React19.3 / Tailwind4 / Prisma stack and lockfile retained.
- No production migration, authentication implementation or new subscription/customer-account flow.
- `.gitattributes` preserves the existing LF Prisma payloads; the immutable migration test normalises Windows directory separators while retaining original SHA-256 pins.
- Browser integration runner honours `PLAYWRIGHT_CHROMIUM_EXECUTABLE` on Windows.
- Review-branch Git deployment is disabled for `redesign/public-experience`, consistent with the existing review workflow.
- Geist source: Google Fonts `ofl/geist/Geist[wght].ttf`; included `app/fonts/OFL.txt` gives its SIL Open Font License.

## Local verification

The programme preview uses an isolated local PostgreSQL database with default roles/taxonomies and eight published Saturdays. It contains no fictional founders. The public browser tests use actual local availability plus separately mocked full/closed/empty/error boundaries. No real emails, cryptocurrency transfers or hosted database changes are part of this UI verification.

Validation covers the production build, TypeScript, ESLint, 30 existing unit/architecture checks, 10 public Playwright tests, 25 route contracts, phone/tablet/desktop width checks, keyboard/reduced-motion behaviour, Axe and a browser credential scan. Exact current results and remaining limits are recorded in `VALIDATION.md`; earlier V4 evidence remains historical.

Screenshots:

- [Desktop homepage](../../artifacts/saas-homepage-desktop.png)
- [Mobile homepage](../../artifacts/saas-homepage-mobile.png)
- [Mobile calendar](../../artifacts/saas-booking-mobile.png)

Run `npm run build`, `npm run lint`, `npm test`, `npm run check:client-secrets`, then the existing Playwright/route checks against a configured local server. This change is delivered as a review branch/PR; it does not deploy itself.
