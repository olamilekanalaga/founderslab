# BD referral and commission operations

Register or edit a partner in **Admin operations → BD details**. Registration approves the partner. Copy the public referral link from the partner’s profile. Its identifier is initially the registered X username. It stays stable when the username changes. The profile can revoke or restore future referrals. Historical application attribution uses the permanent partner ID.

Existing partners with unambiguous X usernames are backfilled from those handles. Older display-name records and duplicate legacy handles receive distinct, stable fallback identifiers. For those records an owner can add the current X username without changing the fallback URL. Use the displayed link.

A public link issues a short-lived, hashed attribution token and follows the existing Saturday booking flow. The server resolves the token again when saving the application. Revoked, expired, invalid and unknown link selections result in an application without a linked partner. Applications started without a referral link have no referral input. The server ignores any injected referral handle or partner ID. The owner can review unmatched historical applications. An already linked application cannot be reassigned through that queue.

## Verification and payments

Mark actual founder attendance by X username in the Space Data roster. Booking status supplies the eligible roster and never earns commission by itself. A manager can save the roster and submit the Space report. The owner separately reviews the completed Space’s roster and confirms attendance to credit eligible appearances for that Space only. The host and self-referrals are excluded. Conflicting handles or project claims can be reviewed or disqualified by the owner. An authenticated BD session or exact registered contact match blocks self-credit. A handle match alone triggers review. The founder’s entered contact email is self-reported, so it should not be treated as proof that every application is authentic. One project in a Space can earn only one verified appearance. Four verified appearances earn ₦20,000. The next four earn another ₦20,000. Only record payments after transferring the money manually. A cycle can be paid in whole-naira installments. Each transfer has a date and may have a reference.

Use **Reverse verification** with a correction reason before correcting a verified booking, founder attendance count, or completed Space status. The workspace blocks edits that would otherwise leave an invalid verification in the commission balance. This recomputes earned commission while preserving paid transfers and the reversal audit entry. When paid exceeds corrected earnings, the negative outstanding amount represents an overpayment. Later earnings offset this balance before more payments can be recorded. Verification history is retained even if an underlying founder record was removed.

The leaderboard’s month filter uses application creation dates, verification dates, the date of the fourth active verification for each cycle, and recorded payment dates. The monthly outstanding value is period earnings less payments for that period. Only the all-time outstanding value represents the current balance. Founders acquired counts unique approved, attributed founders.

## Partner dashboard

The owner generates a private one-time invitation from **Edit partner and private access** and sends it through a trusted channel. The link expires after 15 minutes. Anyone who obtains it before use can redeem it, so it should be shared privately. Partner sessions last 30 days. After expiry or sign-out, the partner needs a fresh owner invitation. A public referral link cannot establish a partner session. The dashboard only shows the signed-in partner’s referral records and payment amounts and dates. It does not return banking details, transfer references or other partners’ data.

## Migration

Migration `202611240005_bd_verification_gate` adds the founder roster, owner approval timestamp and private referral review status. It backfills roster entries only for existing verified bookings in their original Space. Previously verified earnings and paid transfers stay in the ledger. New credit requires explicit owner approval. The stored roster references booking IDs checked against their session at write time. Legacy reports with no verified appearances need the roster recorded before they can generate commission.

Migration `202611240004_bd_intelligence` adds partner profile and referral fields, backfills unique link identifiers, adds reversal timestamps, and enables multiple payments per cycle while keeping transfer references and request IDs unique when present. One access table stores hashed, purpose-scoped tokens for public attribution, private invitations, and partner sessions. Existing partner IDs, applications, verifications and payment rows stay in place. The existing deployment migration runner applies it on a future production release.
