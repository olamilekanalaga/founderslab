# Verification — founder/project identities

Validated locally against the existing Next.js production build, Chromium and localhost PostgreSQL on 22 November 2026.

| Check | Result |
| --- | --- |
| TypeScript | Pass |
| ESLint | Pass, no warnings |
| Unit + architecture | 35 pass |
| Production build | Pass |
| PostgreSQL/HTTP integration | 17 groups pass |
| Playwright | 12 pass |
| Route status/redirect/headings | 25 pass; reviewed root headline updated |
| Client-secret scan | Pass |
| Application desktop/mobile | No overflow; zero Axe WCAG A/AA violations |

## Evidence

- [Desktop homepage](../../artifacts/identity-homepage-desktop.png), [mobile homepage](../../artifacts/identity-homepage-mobile.png)
- [Desktop application](../../artifacts/identity-application-desktop.png), [mobile application](../../artifacts/identity-application-mobile.png)
- The new migration is exercised on **populated pre-change tables** in a disposable database: every existing founder/company/application column, including personal handles, private contact and confirmation data, compares identically afterward; the new fields are NULL. Re-running the migration is a no-op.
- Public API submission normalizes founder/project usernames separately and persists them on Application. Approval copies the project identity into Company and the personal identity into Founder. A fresh submission missing Project X is rejected after the owner's explicit “only email is optional” clarification. Stored legacy applications remain valid without it.
- Existing Admin browser journeys edit **Founder X** and **Project X** independently; database-backed responses confirm neither edit changes the other's identity. Unit coverage also protects later corrections from repeated approval and preserves a company handle when an old edit payload omits it.
- Browser tests leave email blank, focus a missing required field, enter mixed case/extra spaces, submit all required programme answers and check the normalized request. Separate field assertions verify email is explicitly Optional and Project X is required. “None” is valid for non-applicable business details.
- Existing integration scenarios still pass for Admin login/logout/allowlist, concurrent capacity, confirmation scope, recording/post associations, manager restrictions/revocation, calendar progression, reporting and historical award retention. Test email uses a mock provider. No real emails or payments are sent.
- The transitive client/server boundary, original authentication/manager implementations and all historical migration checksums remain guarded. Only the new nullable schema lines and its two ALTER statements are allowed by the extended database invariant test.

## Release and limitations

The existing production preparation script applies pending checked-in migrations before compilation; no separate backend, database, environment variable or credential changes are needed. The feature review branch has automatic Git deployment disabled. The user has previously authorised publishing application updates; release occurs only after these checks pass through a merge to main.

All listed journey results are **local tests**, not live-production login or database inspection. Deployed verification and real inbox delivery remain limited by the existing Vercel team-access grant. Do not claim that historical production rows were inspected based on disposable database tests. No production reset/reseed/backfill or manual production SQL was performed.

The database remains nullable for legacy compatibility even though new public intake requires Project X. Existing historical contact values are not converted to email or rewritten. New intake accepts optional valid email; private Admin records retain their existing contact field for historical compatibility. The legacy application schema is retained for historical workflows, while the dedicated public schema enforces current required answers.

## Final homepage/logo checks

The final screenshot captures include the original uploaded logo and confirm the redundant upcoming-Spaces/date-card section is absent. Hero availability, full/closed/empty/error handling and `/book` continue to work. Logo and generated social-share image return HTTP 200 locally. Application captures retain zero Axe violations and no horizontal overflow at desktop/mobile sizes. The provided image was copied directly; its graphic was not regenerated.
