# Future BD referral tracking — proposal only

No referral schema, public BD signup, partner account, payout engine, commission rate or payment schedule is introduced by V4. Founder awards and future BD compensation are separate economic models. The homepage describes invitation-only introductions, with no earnings promises.

## First release, after business approval

Admin creates an invited BD partner record with name, private contact email, organisation, status, invited/accepted/revoked timestamps and an explicit version of the agreed qualifying rules. A partner referral reference is an opaque attribution identifier, never an authentication token or permission to read founder data. Initially Admin can record introductions manually; no new public form or account is required.

A referral links the partner to the existing application, founder/company and booking records. Do not copy those records into a second database or create duplicate founders. Retain the original introduction time, attribution source, verification evidence, attribution decision/reviewer and any competing claim. Email/X identity normalization and existing application duplicate detection can identify candidates for review; ambiguous matches must not silently merge or create payment eligibility.

Suggested future models:

| Entity | Proposed responsibilities |
| --- | --- |
| BDPartner | Private identity/contact, invitation status, revocation, agreement version |
| Referral | Partner, existing application/founder/company/booking references, introduction timestamp/source, duplicate/competing attribution state |
| QualificationDecision | Rule version, existing approval/attendance evidence, eligible/pending/ineligible decision, reason, reviewer, decision time |
| ReferralPaymentRecord | Eligibility reference, manually recorded status, agreed asset/amount only after rules are approved, payment reference and reviewer |
| ReferralAuditEvent | Actor, action, previous/new state, timestamps, source references; retention policy |

Application approval comes from the existing reviewed application. Participation evidence comes from the existing weekly Space and per-founder/team attendance where available. **A session-level listener count or submitted Space report alone does not prove that a particular referred founder attended.** Define how attendance is verified before using it as a qualifying outcome. A pending booking, click, unapproved application or introduction alone must not create a payable record.

Use explicit qualification states: pending evidence → reviewed eligible/ineligible → manually approved for payment → recorded paid/failed/cancelled. These are proposals, not agreed business rules. Keep qualification and payment states separate, make processing idempotent and prevent a duplicate payment for the same qualifying outcome. No blockchain transfer should be triggered by an application, approval or attendance-save handler.

## Business decisions required before implementation

- What exact outcome qualifies: attendance alone, verified follow-up or another measurable event?
- Who qualifies as a new referral; which pre-existing contacts, repeat founders, multiple projects, self-referrals or related parties are excluded?
- What attribution window and competing-introduction policy apply? Who resolves disputes, cancellations and fraud?
- How is individual attendance verified, and by whom? Can an existing Space Manager record evidence without seeing partner compensation?
- What agreement, consent, reward asset/amount, funding, payment timing, fees, destination verification and correction process apply?
- What historical obligations, geographic requirements and retention/deletion policies apply?

## Security and implementation boundaries

Stay in this Next.js application and Neon database. Admin-only APIs must use the existing allowlist, session, role, Origin/CSRF checks and audit conventions. Space Managers retain only their assigned Space reporting capabilities; no partner or payment visibility is implied. Founder confirmation tokens must never reveal attribution, partner contacts or compensation. No payout secrets or partner identity data belong in client bundles, public APIs or URLs.

If passwordless partner access is eventually approved, design a distinct revocable role and single-use email verification; do not reuse Admin or manager credentials. Invitation-only does not mean an unguessable URL is an authorisation boundary.

Any future schema must be additive with reviewed migrations and safe nullable references to preserve the existing permanent-deletion workflow. Agree how to retain necessary financial audit evidence without retaining deleted founder contact data unnecessarily. Historical Campaign/AwardDecision tables are not repurposed for referral compensation.
