# Founder/project identity and audience messaging

## Public changes

The homepage hero now reads **Introduce your product. Share your journey. Reach your audience.**, with the requested audience-focused description and **Book a Founder Space** CTA. The product card reads **Show people what you’re building.** and uses the requested product-exposure copy. Existing branding, light theme, FAQs, schedule, free participation, review requirements and live availability remain. The copy does not guarantee users, investment or partnerships.

The existing application has two groups: **About you** (name, personal X, private contact email and founder role), and **About your project** (project name/X, website, description, country, stage, sector, team size, speakers, business focus and existing programme/research details).

The owner's later clarification supersedes the initial optional-project-X proposal: **only contact email is optional for new applications**. The email box says **Optional**. Project X, role, country, stage, sector, team/speaker counts and the remaining programme answers are required. Existing additional fields are visible rather than hidden behind an optional-details toggle. Hiring is an explicit Yes/No selection, never a required claim that the company is hiring. Business needs/comments that do not apply can be answered **None**. Promotional consent remains a separate voluntary consent choice, as before; privacy/terms acceptance remains required.

Username input ignores capitalization, surrounding/embedded whitespace and an initial @. Country names are canonicalized ignoring case/repeated whitespace; free-text fields accept mixed case and trim surrounding whitespace. Websites still accept a bare domain. Invalid link schemes and invalid username characters remain rejected; blank/whitespace-only required answers remain invalid. Browser validation and existing field-error focus guide founders to missing answers.

## Ownership and compatibility

| Field | Owner |
| --- | --- |
| `Founder.xHandle` | Existing required personal username; its identity/uniqueness rule is retained |
| `Founder.contact` | Existing private contact; new intake shows it as optional email |
| `Application.xHandle` | Existing submitted personal username snapshot |
| `Application.projectXHandle` | New nullable submitted official project username snapshot |
| `Company.xHandle` | New nullable official project username |

Approval reuses the existing personal-username lookup for Founder and automatically copies the submitted official project username into a **new** Company. No project handle is ever used as a founder identity. Re-approval does not overwrite later Admin profile corrections. Existing company edits which omit the new property preserve the existing handle; explicit clearing sets it to null. No unique constraint is added to company handles and no records are automatically merged by handle.

Admin founder/company profiles and existing editors show **Founder X** and **Project X** separately. Application review shows both submitted identities and links to both approved profiles. Admin can correct each independently without changing the other entity's username.

The original legacy application schema remains available to historical/domain workflows. The new public intake schema enforces the latest required answers on client and server. **Existing stored applications with no project X remain valid and approvable; fresh public submissions must provide it.** Existing confirmation/booking associations and confirmation response fields are unchanged. No founder contact data is added to public or manager responses.

## Additive migration

`prisma/migrations/202611220004_project_x_identity/migration.sql` adds two nullable TEXT columns:

```sql
ALTER TABLE "Company" ADD COLUMN "xHandle" TEXT;
ALTER TABLE "Application" ADD COLUMN "projectXHandle" TEXT;
```

There is no backfill, reset, reseed, table rename, data deletion, new not-null constraint or modification of prior migration files. Existing project handles intentionally remain NULL rather than being inferred from personal accounts. Keep the columns on any code rollback; do not drop them or rewrite migration history.

The existing checksum-based SQL migration runner remains the only migration mechanism. The production Vercel prepare script already runs pending migrations using its configured direct connection before building. No environment variable name or credential is changed. Local verification uses only localhost, disposable PostgreSQL and existing guarded fixtures; no manual production schema/data commands are issued.

The architecture test still pins every historical migration's bytes. It verifies the original schema after removing exactly the two declared nullable lines, and explicitly allowlists the new migration's two ALTER statements. Authentication/manager implementation fingerprints and client/server boundaries remain unchanged.

## Main changed files

- Homepage component and page metadata; reviewed homepage heading in browser/route contracts.
- Existing public application component; shared legacy/current public validation and input normalization.
- Prisma schema plus the single additive SQL migration.
- Existing domain approval/company-save logic; typed fixture compatibility.
- Existing Admin record editor, founder/company profiles and application-review display.
- Unit, browser and disposable PostgreSQL integration coverage, including pre-change rows across migration, required-field validation, independent Admin editing and legacy approvals.

See [verification results](VALIDATION.md) for final checks and deployment limits.

## Homepage simplification and logo

Later instructions in the same update remove the entire **Make room for your next conversation** section (its heading, link and large date cards). The remaining hero preview still links to the unchanged full booking calendar. Its now-unused `UpcomingSpaces` card-list component was removed after checking for other callers.

The original uploaded logo is stored unmodified at `public/founders-lab-logo.jpg` and reused by the existing shared BrandMark. The favicon embeds the same image, and the social-share image reads it locally during generation. No remote logo download, image-generation service or dark-mode switch is introduced. Public and private pages remain light; only the supplied logo itself has its original dark background.
