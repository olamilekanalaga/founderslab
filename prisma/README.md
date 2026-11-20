# Database changes

`schema.prisma` defines the typed client and relational model. The initial SQL migration includes primary/foreign keys, normalized many-to-many joins, application dedupe/confirmation uniqueness and session-participation uniqueness.

`Session.recordingUrl` is the only stored recording URL. `SessionParticipant` joins each founder/company appearance to a session. Profile and company recording links are derived, not copied.

Run `npm run db:migrate`. The checked-in runner uses `pg`, a transaction, a PostgreSQL advisory lock and `_founders_migrations` checksums. Re-running it is safe. Do not edit an applied migration or run a different migration engine against this database.

Prisma 6.19 is pinned with the JavaScript client engine and PostgreSQL adapter. This also allows builds in environments where downloading native Prisma engines is unavailable. The environment used here could generate SQL through Prisma's JavaScript schema engine, but native migration deployment was unavailable; the checked-in SQL runner is the supported deployment path.

For future changes, update the Prisma schema, create a new numbered SQL migration based on a development database/schema diff, inspect it, and test it against a disposable PostgreSQL database. Generate the client again. Existing migrations remain immutable.
