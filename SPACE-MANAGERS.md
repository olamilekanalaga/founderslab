# Space Manager access

## Current workspace accounts

The owner's chosen Space Manager signs in with their own workspace account at [FoundersLab sign-in](https://www.founderslab.fun/signin). Both accounts created through workspace signup have Admin access, including applications, bookings, Space Data and BD operations. Their password hashes are stored in the existing database.

During initial setup, each team member creates an account at `/signup`. The form asks for their profile photo, first and last name, email, X username, Telegram username and password. The second registration automatically closes signup. A signed-up Admin can also close it under **Manage signup → Workspace access**. Existing accounts can continue signing in after closure.

## Operational workflow

1. Open **Admin operations → Applications** to review new founders. Approving an application with an upcoming Space reserves its seat when capacity allows. If the application has no upcoming booking, choose its Space in the review.
2. Open **Bookings** to check dates and confirmation status.
3. Record the session in **Space Data** after it takes place. Submit the current week's data to advance the public calendar.
4. Register approved BD partners and copy their referral links under **BD details**. Review verified attendance and manually recorded payments under **BD Performance**.

## Existing legacy managers

Previously provisioned Space Manager accounts use `/manager/spaces`. Their scope depends on their existing grant.

- **Selected Spaces** can report listener count, duration, X post link and recording link for assigned sessions. They can register BD partners without access to saved bank details or payment controls.
- **All Spaces** can use the operational workspace, including bookings and BD payments. Permanent record deletion is reserved for Admin accounts with directory write permission.

Manager invitation, resend and password-link generation remain part of the legacy bootstrap Admin workflow. Admins created through workspace signup use the shared workspace account process. The legacy email flow uses `RESEND_API_KEY`, `MANAGER_EMAIL_FROM` and the canonical `APP_ORIGIN`. See the [deployment guide](DEPLOYMENT.md).
