# Deploy and operate FoundersLab

Use the existing Vercel project connected to `olamilekanalaga/founderslab`. Production tracks `main` and serves [www.founderslab.fun](https://www.founderslab.fun).

## Build

The project uses Node.js 24, `npm ci` and `npm run build:vercel`. The Production build generates the Prisma client, applies migrations through the direct PostgreSQL connection, seeds programme defaults and publishes the rolling Sunday schedule before compiling Next.js. Workspace sign-in uses the accounts and password hashes stored in the connected database.

## Production settings

Use server-side Vercel Production environment variables. Keep credentials out of Git and public-prefixed variables.

| Variable                | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL application connection. Neon pooled connections are supported. |
| `DATABASE_URL_UNPOOLED` | Direct connection for migrations when the application uses Neon's pooler. |
| `APP_ORIGIN`            | Canonical HTTPS origin, `https://www.founderslab.fun`.                    |
| `TELEGRAM_BOT_TOKEN`    | Optional bot token for booking notifications. Use a Sensitive variable.   |
| `TELEGRAM_CHAT_ID`      | Optional private management chat ID, including the leading minus sign.    |

The database connection also accepts the existing integration aliases in [.env.example](.env.example). Both Telegram variables are needed to send notifications. Changes to Vercel variables take effect on the next deployment. [Telegram setup and verification](docs/telegram-bookings.md)

Accounts created through workspace signup use their stored credentials. `BOOTSTRAP_ADMIN_EMAIL` is only relevant to an existing legacy bootstrap Admin's sign-in. The manual `db:admin` script uses the bootstrap password and name when creating that account. `RESEND_API_KEY` and `MANAGER_EMAIL_FROM` are used by legacy manager email workflows. [Space Manager access](SPACE-MANAGERS.md)

## Live checks

1. Visit [Booking](https://www.founderslab.fun/book). Confirm that the first of three Sundays is open when places remain and that the other two are locked.
2. Submit an application for the open Sunday. Check the confirmation page and the pending booking in **Admin operations**.
3. Approve the application for the selected Space. Check that the project occupies one seat. If Telegram is configured, verify the booking alert and its threaded approval reply.
4. After a real Space, submit its Space Data and verify that the next Sunday opens. Use isolated tests for fixture attendance and schedule changes.

Keep preview and local databases separate from production. The Vercel preparation step runs in Production. For a persistent Node host, run the migrations, defaults seed, and Sunday publication from the [local setup guide](README.md#local-setup), then build and start the application. Keep applied migrations intact. [Database migrations](prisma/README.md)
