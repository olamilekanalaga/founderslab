# Verification

Use Node.js 24, local PostgreSQL and a Next.js production build. The [README](README.md#checks) lists the commands.

- **Lint, type checking, unit tests and build** cover validation, project capacity, permissions, date conversion and the production bundle.
- **PostgreSQL integration tests** cover signup closure, authenticated access, booking approval, legacy manager boundaries, the Sunday calendar, attendance, BD verification and payment records, permanent deletion, and Telegram alerts and approval replies.
- **Browser checks** cover the mobile booking form, field errors, public availability, accessibility and private routes.
- **Client secret checks** scan compiled browser files for configured server-side credentials and confirm that private environment files are outside Git.

The integration runner creates a disposable local PostgreSQL database, seeds fictional records, uses mock email and Telegram providers, and drops that database afterward. Live Telegram delivery requires a booking in the configured production environment. [Verification steps](docs/telegram-bookings.md#test-on-iphone)

Screenshots are QA evidence from local fixtures. Set `TEST_ARTIFACT_DIR` to a scratch directory when running integration checks to keep tracked screenshots out of local diffs.
