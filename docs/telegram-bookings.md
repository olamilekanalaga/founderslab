# FoundersLab Telegram booking notifications

This integration sends management-group alerts for founder-submitted bookings and threaded replies when an authorised FoundersLab reviewer confirms the booking. Approve bookings in FoundersLab. The bot has no incoming webhook, command processor or approval permissions.

## Set up on iPhone

1. In Telegram, open the official [@BotFather](https://t.me/BotFather), send `/newbot` and follow the prompts. Keep the token it returns for the Vercel setup. Enter it directly in Vercel as a sensitive variable.
2. Open your private Telegram management group. Tap the group name, tap **Add Members**, search for your bot’s exact username and add it. Allow it to send messages. A bot that can post as a regular member needs no administrator role.
3. In the group, send `/chatid@YourBotUsername` using the bot’s actual username. This addresses the message to the bot with Telegram privacy mode enabled. The bot itself does not reply.
4. In a **Private** Safari tab on your iPhone, open this official Telegram API URL, replacing YOUR_BOT_TOKEN with the token from BotFather.

   ```text
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates?allowed_updates=%5B%22message%22%5D
   ```

   In the response, find the object named `chat` with your group’s title. Copy its `id`, including the minus sign and any `-100` prefix. Use the `chat.id` value under `message`, since `from.id` identifies a person. If the result is empty, send the addressed command again and reload. Close the Private tab once you have the ID. Keep the full API URL and token out of messages and screenshots.

5. In Safari, open your FoundersLab project in [Vercel](https://vercel.com/dashboard). Go to **Settings → Environment Variables → Add**. Set the following values for **Production**. Use the **Sensitive** option where available.

   | Name                 | Value                    |
   | -------------------- | ------------------------ |
   | `TELEGRAM_BOT_TOKEN` | Token from BotFather     |
   | `TELEGRAM_CHAT_ID`   | Negative group `chat.id` |

6. After the pull request is reviewed and approved for release, deploy the approved revision to Production. If you add the variables after that revision is already deployed, redeploy it in **Deployments** so the change takes effect. Both variables are optional for FoundersLab itself.

## Test on iPhone

1. Open [FoundersLab booking](https://www.founderslab.fun/book), select the open Sunday and submit a dummy founder booking. Use a clearly labelled test name and an available slot.
2. Check the private Telegram group for one **FOUNDERSLAB — NEW BOOKING** message. Tap the X and website links and verify the speaker count, Sunday and submitted time. No approval reply should appear yet.
3. Sign in to FoundersLab using the reviewer’s own account. Open **Admin operations → Applications**, choose the dummy booking and tap **Approve**. The booking should show as approved and occupy one slot.
4. In Telegram, open **FOUNDERSLAB — BOOKING APPROVED**. Tap the quoted message to verify it links to the original alert. Check the reviewer identity, role, London timestamp and elapsed time. For a legacy Space Manager whose profile only has an email address, that existing account identifier is shown. Review or save the approved booking again to verify a second reply does not appear.
5. Cancel the test booking in FoundersLab to release its slot, and remove the dummy records if appropriate. Cancel and Space Data actions have no Telegram messages.

## Migration and delivery behaviour

- The existing production preparation step applies migration `202611270001_booking_telegram_notifications` to the connected database. It adds one table keyed by booking ID. No existing data is backfilled and it needs no additional service or database.
- Booking and approval commits record tracking before delivery starts. Telegram delivery happens after the HTTP response. The first real approval stores its timestamp and authenticated reviewer. Resaving or reapproving retains that first approval and its single reply.
- Bookings submitted while Telegram is unconfigured have no group destination and generate no retroactive alerts. Bookings submitted before the migration also have no Telegram history. If you change groups, existing notifications stay linked to their original group.
- Telegram rate limits defer a safe retry until a later founder booking or newly confirmed booking after the indicated cooldown. A rejected reply, deleted original, or uncertain network result does not affect the booking. A failed or uncertain delivery is never recorded as sent. Because Telegram does not offer a send idempotency key, ambiguous sends and interrupted sends marked `sending` require checking the group and database before any manual reconciliation. A deleted original never results in a standalone approval alert.
- Vercel runtime logs identify the delivery stage and outcome without exposing tokens, chat IDs, message contents or founder details. The tracking table stores delivery state and message IDs for troubleshooting.
