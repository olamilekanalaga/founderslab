# Deploy Founders Lab

Use the dedicated Founders Lab Vercel project connected to `olamilekanalaga/founderslab`, production branch `main`. Do not reuse a different application’s Vite/static build settings.

## Vercel or another Next.js Node host

1. Push this source to the new project's repository/branch. Import it as a **Next.js** project, Node.js 24, install `npm ci`, build `npm run build`. The checked-in `vercel.json` explicitly selects Next.js, `npm ci`, `npm run build` and the `.next` output so inherited static-site settings do not take precedence. Keep Root Directory at the repository root (the folder containing `package.json`); root-directory and Git/domain linkage must be checked in the Vercel project.
2. Provision persistent PostgreSQL and set `DATABASE_URL` as a server-only secret, using the provider's required TLS configuration. Use a pooled application connection if required by the host; use a suitable migration connection for deployment jobs. No database is needed for the browser demo, but public submissions/admin require one.
3. Set `APP_ORIGIN` to the exact HTTPS origin (for example `https://founders-lab.example.com`). It is used to check public and authenticated write requests. A preview hostname needs its own matching origin and isolated database. Do not let preview deployments mutate production data.
4. From a secure release job/terminal with the production database environment, run:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:admin
```

Set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` and a strong `BOOTSTRAP_ADMIN_PASSWORD` for the final command only. Remove bootstrap secrets afterwards. `db:seed` without `--demo` adds defaults without fictional founders. **Never run `--demo` against a real programme database.** Do not run migrations or bootstrap commands on every web request.

5. Deploy and verify `/demo`, `/apply`, `/book`, private sign-in, approvals, one shared recording, reports and admin-only access restrictions on the actual HTTPS URL. Confirm the production Secure cookie is set, anonymous `/api/workspace` returns 401, and no applicant/contact/commercial data appears in public responses.
6. Configure database backups, host monitoring, recovery procedures and the programme's actual privacy/award terms before collecting real applicant data. Set the public programme rules and retention policy in Settings.

The application does not send invitation emails or award transfers. Invitations produce manual one-time links; award records document human decisions and separately executed transfers. No API subscriptions are needed.

## Persistent Node server

The same environment and database setup apply:

```sh
npm ci
npm run build
npm start
```

Place the Node process behind HTTPS, set the exact `APP_ORIGIN`, and use a process supervisor. Port defaults to 3000. The filesystem is not the production database; PostgreSQL must persist independently.

A production deployment URL is only verified after the deployed flows have been tested. This repository currently provides local verification and deployment instructions, not a claimed live deployment.
