# BD referral and commission operations

Register or edit a partner in **Admin operations → BD details**. Registration approves the partner. Copy the public referral link from the partner’s profile. Its identifier is initially the registered X username. It stays stable when the username changes. The profile can revoke or restore future referrals. Historical application attribution uses the permanent partner ID.

Existing partners with unambiguous X usernames are backfilled from those handles. Older display-name records and duplicate legacy handles receive distinct, stable fallback identifiers. For those records an owner can add the current X username without changing the fallback URL. Use the displayed link.

A public link issues a short-lived, hashed attribution token and follows the existing Saturday booking flow. The server resolves the token again when saving the application. Revoked, expired, invalid and unknown link selections result in an application without a linked partner. A manually entered X username works on applications started without a referral link. An unmatched username can be resolved by an operator. An application already linked to a partner cannot be reassigned through that queue.

## Verification and payments

Verify only approved and attended bookings with recorded founder attendance in a completed Space. One project in a Space can earn only one verified appearance. Four verified appearances earn ₦20,000. The next four earn another ₦20,000. Only record payments after transferring the money manually. A cycle can be paid in whole-naira installments. Each transfer has a date and may have a reference.

Use **Reverse verification** with a correction reason before correcting a verified booking, founder attendance count, or completed Space status. The workspace blocks edits that would otherwise leave an invalid verification in the commission balance. This recomputes earned commission while preserving paid transfers and the reversal audit entry. When paid exceeds corrected earnings, the negative outstanding amount represents an overpayment. Later earnings offset this balance before more payments can be recorded. Verification history is retained even if an underlying founder record was removed.

The leaderboard’s month filter uses application creation dates, verification dates, the date of the fourth active verification for each cycle, and recorded payment dates. The monthly outstanding value is period earnings less payments for that period. Only the all-time outstanding value represents the current balance. Founders acquired counts unique approved, attributed founders.

## Partner dashboard

The owner generates a private one-time invitation from **Edit partner and private access** and sends it through a trusted channel. The link expires after 15 minutes. Anyone who obtains it before use can redeem it, so it should be shared privately. Partner sessions last 30 days. After expiry or sign-out, the partner needs a fresh owner invitation. A public referral link cannot establish a partner session. The dashboard only shows the signed-in partner’s referral records and payment amounts and dates. It does not return banking details, transfer references or other partners’ data.

## Migration

Migration `202611240004_bd_intelligence` adds partner profile and referral fields, backfills unique link identifiers, adds reversal timestamps, and enables multiple payments per cycle while keeping transfer references and request IDs unique when present. One access table stores hashed, purpose-scoped tokens for public attribution, private invitations, and partner sessions. Existing partner IDs, applications, verifications and payment rows stay in place. The existing deployment migration runner applies it on a future production release.
