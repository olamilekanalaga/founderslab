# BD operations

Open **Admin operations** in the private sidebar. The page links to founder application review, booking management and weekly Space data. Use the registration form there to register a BD partner and capture their bank details.

A referral can be recorded when the founder application is approved, the booking is marked Attended and the submitted Space report confirms founder attendance for the project. Admin verifies the attribution from the partner’s record. Each project can qualify once per Space, even if it has multiple founders or bookings. Verification assigns appearances to cycles in verification order. Each group of four earns ₦20,000 and appears as Pending Payment until recorded as paid. Pending or incomplete cycles have no payable balance.

For a completed cycle, review the transfer details, make the transfer independently, and record the payment date and reference. Each cycle and transfer reference can be recorded once. A partner’s balances and referral and payment history appear on the same page.

Set the server-side `BD_BANK_ENCRYPTION_KEY` to a base64-encoded random 32-byte key before enabling registration. Keep a secure backup of the key and use separate keys for separate environments. Existing ciphertext requires the original key. The list endpoint omits bank details. Viewing transfer details requires an authenticated Admin and CSRF validation and creates an audit entry.

The additive migration creates three BD tables. It preserves existing founder, session, booking and award data. Qualification records store opaque booking, company and session IDs so the reward ledger can survive removal of those source records without retaining founder contact information. Existing scheduled session capacities are governed by their saved configuration. Newly generated weekly Spaces default to four seats.
