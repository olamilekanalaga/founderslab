# FoundersLab

FoundersLab hosts weekly conversations with Web3 founders about what they are building, who needs it, and why it matters now. The site uses Next.js, TypeScript, Prisma and PostgreSQL on Vercel. [Live site](https://www.founderslab.fun)

## Public booking

Founders start at [Booking](https://www.founderslab.fun/book), choose the open Sunday, and complete the application. A successful submission gives them a private confirmation link. A pending application does not reserve a seat.

The public calendar shows three weeks at 7 PM Europe/London. The first week accepts bookings when seats are available, and the next two are visible as **Locked**. Submitting the current week's Space Data moves the public window forward one week while retaining the completed Space in private history. Saving a draft or marking the Space complete without submitting its data does not advance the calendar.

The application collects the founder's personal X username and the project's official X username separately. Contact email and promotional consent are optional. Submission highlights missing or invalid answers and focuses the first field that needs attention.

## Workspace

- **Sign in** using your workspace account. The two team members who created their profiles during workspace signup share Admin access. Signup closes automatically after the second account. [Workspace sign-in](https://www.founderslab.fun/signin) · [Space Manager access](SPACE-MANAGERS.md)
- **Admin operations → Applications** is where you review submissions. Approving a booking-linked application reserves a project seat in its upcoming Space, subject to capacity. When an application has no upcoming booking, choose its Space in the review before approving. **Bookings** shows the requested date and seat status.
- **Space Data** records the Space after it takes place. Use **Submit attendance** to advance the calendar. BD attendance verification is a separate operation.
- **BD details** is where you register approved partners and copy their referral links. **BD Performance** shows attributed applications, verified appearances and payments. Four verified founder appearances in completed Spaces earn ₦20,000. Record payments after making them manually.
- **Telegram** optionally alerts the configured private chat when a founder books and replies to that alert when the seat is confirmed. [Telegram setup and live verification](docs/telegram-bookings.md)

## Permanent deletion

In **Admin operations → Applications**, open the record, expand **Remove this application**, select **Delete permanently** and type `DELETE` to confirm. You can also delete a founder from their profile. An administrator with directory write permission can perform permanent deletion.

Deleting an application removes its owned bookings and their Telegram tracking rows. Existing Telegram messages stay in the chat. For a linked approved application, first check the founder profile. Deletion can also remove that profile, associated applications, and other owned records. Shared Spaces are kept. Deleted confirmation links stop working.

## Local setup

Use Node.js 24 and a local PostgreSQL database. Start with [.env.example](.env.example).

```sh
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npx tsx scripts/publish-sundays.ts
npm run dev
```

Create local workspace accounts through `/signup`. For a legacy bootstrap account in local development, configure the bootstrap variables and run `npm run db:admin`. Use a dedicated local database for test fixtures.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run check:client-secrets
npm run test:integration
# Against a running backend-backed local server
npm run test:e2e
```

The integration suite creates and drops its own local PostgreSQL database and uses mock providers for Telegram and legacy manager email. [Testing guide](TESTING.md)

## Repository layout

| Directory                  | Contents                                                  |
| -------------------------- | --------------------------------------------------------- |
| `app/`                     | Pages and API route adapters                              |
| `features/`, `components/` | Screens and shared UI                                     |
| `server/`, `lib/`          | Server handlers, permissions, domain logic and validation |
| `prisma/`                  | Prisma schema and immutable SQL migrations                |
| `scripts/`, `tests/`       | Provisioning and verification                             |
| `docs/`, `artifacts/`      | Guides and historical QA evidence                         |

Production uses the existing Vercel project and its connected database. [Deployment guide](DEPLOYMENT.md) · [Architecture](docs/ARCHITECTURE.md)
