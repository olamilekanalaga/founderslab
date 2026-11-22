# UI delivery validation - 2026-11-22

Verified against a local Next.js16.4.6 production build with actual isolated PostgreSQL programme defaults. These are local browser results, not verification of a newly deployed Vercel release.

| Check | Result |
| --- | --- |
| Production build and TypeScript | Pass |
| ESLint | Pass |
| Existing unit/architecture tests | 30/30 pass |
| Public Playwright journeys | 10/10 pass |
| Route status/redirect/headline contracts | 25/25 pass |
| Home/book width sweep | 320,375,393,768,820,1024,1440px; no overflow |
| Selected booking continuation | Visible at all seven widths |
| Application phone widths | Fits320/375/393px |
| Axe WCAG A/AA | Homepage/calendar desktop/mobile and mobile application/confirmation/terms: zero violations |
| Keyboard navigation | Menu/Escape/focus and date → application query verified |
| Reduced motion | Hero entrance disabled correctly |
| Browser credential/fixture scan | Pass; private environment files not tracked |
| Source diff validation | Pass; no Prisma schema/migration or auth-handler changes |

The hero session selection test waits for the actual availability response and DOM readiness. Earlier five-second failures were timing assumptions, not missing UI. Original generic booking screenshot is preserved; new screenshots are stored with the `saas-` prefix.

Phone entrance animations and header/action backdrop blur were removed to reduce rendering work. Final standard mobile Lighthouse on this PC: performance67, accessibility100, best practices100, SEO100; LCP1.0s, CLS0, TBT4.84s. Earlier runs varied44-62 before this refinement. Rendering/interaction profiling on physical phones and further main-thread performance work remain follow-ups; no field INP claim is made.

The browser suite exercises real local dates and separate mocked full/closed/empty/503 boundaries. It verifies public navigation and rejection of forged Admin/demo/signup access. The preview database has no fictional founders. Full PostgreSQL integration/provider-email acceptance was not rerun in this UI delivery, and no real emails or payments were sent.

The review branch is pushed for review with automatic branch deployment disabled. Production merge/deployment and real inbox/device verification are separate from these checks.
