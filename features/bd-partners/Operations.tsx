"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Spaces, { type SpaceTab } from "@/features/spaces/components/Spaces";
import type { Resource } from "@/components/shared/RecordEditor";
import { Modal, Status } from "@/components/ui";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { rewardSummary, REFERRALS_PER_CYCLE, REWARD_NAIRA } from "./rewards";

import { naira, type Partner } from "./intelligence";
import BdIntelligence from "./BdIntelligence";
import CommissionExample from "./CommissionExample";
import ReferralLink from "./ReferralLink";
import { referralStatus } from "./referral-status";

type OperationsTab = "bd" | "performance" | SpaceTab;

export default function Operations({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const requestedPanel = params.get("tab");
  const selectedPartner = params.get("partner");
  const panel: OperationsTab =
    requestedPanel === "performance" ||
    requestedPanel === "applications" ||
    requestedPanel === "bookings" ||
    requestedPanel === "sessions"
      ? requestedPanel
      : "bd";
  function setPanel(value: OperationsTab) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", value);
    next.delete("review");
    next.delete("status");
    next.delete("session");
    next.delete("partner");
    router.replace(`/operations?${next.toString()}`, { scroll: false });
  }
  const { viewer, state, lastUpdated } = useWorkspace();
  const [partnerRecords, setPartners] = useState<Partner[]>();
  const partners = partnerRecords ?? [];
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [accessLink, setAccessLink] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [paymentRequest, setPaymentRequest] = useState<string>();
  const [bankDetails, setBankDetails] = useState<{
    partnerId: string;
    bank: string;
    accountName: string;
    accountNumber: string;
  } | null>(null);
  async function viewBank(partnerId: string) {
    setBankDetails(null);
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/bd-partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": viewer.csrf || "",
        },
        body: JSON.stringify({ action: "bank", partnerId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setBankDetails({ ...result.details, partnerId });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not load transfer details.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/bd-partners", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load BD partners.");
        const result = await response.json();
        if (!controller.signal.aborted) {
          setPartners(result);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [attempt, lastUpdated]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: string,
    partnerId?: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const requestId =
      action === "pay" ? paymentRequest || crypto.randomUUID() : undefined;
    if (requestId) setPaymentRequest(requestId);
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/bd-partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": viewer.csrf || "",
        },
        body: JSON.stringify({
          ...values,
          action,
          ...(partnerId ? { partnerId } : {}),
          ...(action === "pay"
            ? {
                cycle: Number(values.cycle),
                amount: Number(values.amount),
                requestId,
              }
            : {}),
          ...(action === "profile"
            ? {
                active: values.active === "on",
                xHandle: values.xHandle || undefined,
                fullName: values.fullName || undefined,
              }
            : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "pay") setPaymentRequest(undefined);
      if (action === "access") {
        setAccessLink(result.accessLink);
        setAccessMessage("");
      }
      if (action !== "profile") form.reset();
      setBankDetails(null);
      setNotice("Saved.");
      setAttempt((value) => value + 1);
      if (action === "attribute" || action === "review-referral")
        router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const unmatched = state.applications.filter(
    (application) => application.bdReferrerXHandle && !application.bdPartnerId,
  );

  return (
    <>
      <div className="page-heading">
        <h1>Admin operations</h1>
      </div>
      <section className="panel padded">
        <h2>Founder Spaces</h2>
        <p>Review applications, manage bookings and enter weekly attendance.</p>
        <div className="heading-actions">
          {(
            [
              ["bd", "BD details"],
              ["performance", "BD Performance"],
              ["applications", "Review founder applications"],
              ["bookings", "Manage bookings"],
              ["sessions", "Enter Space data"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={panel === value ? "button primary" : "button"}
              aria-pressed={panel === value}
              aria-controls="operations-panel"
              onClick={() => {
                setBankDetails(null);
                setPanel(value);
              }}
            >
              {label}
            </button>
          ))}
          <Link className="button" href="/settings">
            Settings
          </Link>
        </div>
      </section>
      <div id="operations-panel">
        {panel === "performance" && (
          <>
            <div className="page-heading">
              <h2>BD Performance</h2>
            </div>
            {partnerRecords && !loadError ? (
              <BdIntelligence partners={partnerRecords} />
            ) : (
              <p role="status">
                {loadError
                  ? "Could not load BD performance."
                  : "Loading BD performance…"}
              </p>
            )}
            <CommissionExample />
          </>
        )}
        {panel !== "bd" && panel !== "performance" && (
          <Spaces
            key={panel}
            edit={edit}
            embedded={{ tab: panel, onChange: setPanel }}
          />
        )}
        <div hidden={panel !== "bd"}>
          {accessLink && (
            <Modal
              title="Partner dashboard invitation"
              close={() => setAccessLink("")}
            >
              <p>
                Share privately. Anyone holding this link can use it once before
                it expires in 15 minutes.
              </p>
              <label>
                Invitation link
                <input
                  readOnly
                  value={accessLink}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <button
                className="button"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(accessLink);
                    setAccessMessage("Invitation link copied.");
                  } catch {
                    setAccessMessage("Select and copy the link above.");
                  }
                }}
              >
                Copy
              </button>
              {accessMessage && <p role="status">{accessMessage}</p>}
            </Modal>
          )}
          <section className="panel padded">
            <h2 id="bd-details" style={{ scrollMarginTop: "100px" }}>
              Register a BD partner
            </h2>
            <form
              onSubmit={(event) => void submit(event, "register")}
              className="record-form"
            >
              <label>
                Full name
                <input name="fullName" maxLength={200} />
              </label>
              <label>
                BD X handle
                <input
                  name="name"
                  required
                  maxLength={16}
                  pattern="@?[A-Za-z0-9_]{1,15}"
                  placeholder="@ola__crrypt"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <label>
                Email
                <input name="email" type="email" required maxLength={200} />
              </label>
              <label>
                Bank
                <input name="bank" required maxLength={200} />
              </label>
              <label>
                Account holder
                <input name="accountName" required maxLength={200} />
              </label>
              <label>
                Account number
                <input
                  name="accountNumber"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  autoComplete="off"
                />
              </label>
              <button className="button primary" disabled={busy}>
                Register partner
              </button>
            </form>
          </section>
          {(notice || loadError) && (
            <p role="status">{notice || "Could not load BD partners."}</p>
          )}
          {!!unmatched.length && (
            <section className="panel padded">
              <h2>Historical referrals to review</h2>
              {unmatched.map((application) => (
                <form
                  className="record-form"
                  key={application.id}
                  onSubmit={(event) => void submit(event, "attribute")}
                >
                  <input
                    type="hidden"
                    name="applicationId"
                    value={application.id}
                  />
                  <p>
                    {application.founderName} · {application.companyName} · @
                    {application.bdReferrerXHandle}
                  </p>
                  <label>
                    Registered BD partner
                    <select name="partnerId" required defaultValue="">
                      <option value="" disabled>
                        Choose partner
                      </option>
                      {partners.map((partner) => (
                        <option value={partner.id} key={partner.id}>
                          {partner.name} · {partner.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button"
                    disabled={busy || !partners.length}
                  >
                    Link referral
                  </button>
                </form>
              ))}
            </section>
          )}
          {selectedPartner && (
            <Link className="button" href="/operations?tab=bd">
              View all partners
            </Link>
          )}
          {partners
            .filter(
              (partner) => !selectedPartner || partner.id === selectedPartner,
            )
            .map((partner) => {
              const referrals = state.applications.filter(
                (application) => application.bdPartnerId === partner.id,
              );
              const verifiedBookings = new Set(
                partner.appearances
                  .filter((appearance) => !appearance.reversedAt)
                  .map((appearance) => appearance.bookingId),
              );
              const reward = rewardSummary(
                verifiedBookings.size,
                partner.payments,
              );
              const statuses = referrals.map((application) => {
                const bookings = state.bookings
                  .filter((booking) => booking.applicationId === application.id)
                  .map((booking) => ({
                    ...booking,
                    attended: state.spaceData.some(
                      (report) =>
                        report.sessionId === booking.sessionId &&
                        report.founderBookingIds.includes(booking.id),
                    ),
                  }));
                return {
                  application,
                  status: referralStatus(
                    {
                      status: application.status,
                      ineligible: ["self", "host", "disqualified"].includes(
                        application.bdReviewStatus || "",
                      ),
                    },
                    bookings,
                    verifiedBookings,
                  ),
                };
              });
              const balance = (cycle: number) =>
                REWARD_NAIRA -
                partner.payments
                  .filter((payment) => payment.cycle === cycle)
                  .reduce((sum, payment) => sum + payment.amount, 0);
              const unpaid = Array.from(
                { length: reward.completedCycles },
                (_, index) => index + 1,
              ).filter((cycle) => balance(cycle) > 0 && reward.outstanding > 0);
              return (
                <section className="panel padded" key={partner.id}>
                  <h2>{partner.name}</h2>
                  <p>
                    {[partner.fullName, partner.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p>
                    {partner.active ? "Approved and active" : "Revoked"} ·
                    Registered {partner.createdAt.slice(0, 10)}
                  </p>
                  {partner.active && (
                    <ReferralLink code={partner.referralCode} />
                  )}
                  <details>
                    <summary>Edit partner and private access</summary>
                    <form
                      className="record-form"
                      onSubmit={(event) =>
                        void submit(event, "profile", partner.id)
                      }
                    >
                      <label>
                        Full name
                        <input
                          name="fullName"
                          defaultValue={partner.fullName || ""}
                          maxLength={200}
                        />
                      </label>
                      <label>
                        BD X username
                        <input
                          name="xHandle"
                          defaultValue={
                            partner.name.startsWith("@") ? partner.name : ""
                          }
                          maxLength={16}
                        />
                      </label>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={partner.active}
                        />{" "}
                        Active and approved
                      </label>
                      <button className="button" disabled={busy}>
                        Save partner
                      </button>
                    </form>
                    {partner.active && (
                      <form
                        onSubmit={(event) =>
                          void submit(event, "access", partner.id)
                        }
                      >
                        <button className="button" disabled={busy}>
                          Generate private dashboard invitation
                        </button>
                      </form>
                    )}
                  </details>
                  <dl className="facts">
                    {[
                      ["Total referred", referrals.length],
                      [
                        "Pending founders",
                        referrals.filter(
                          (referral) => referral.status === "Pending",
                        ).length,
                      ],
                      [
                        "Approved founders",
                        referrals.filter(
                          (referral) => referral.status === "Approved",
                        ).length,
                      ],
                      [
                        "Scheduled appearances",
                        statuses.filter(
                          (row) => row.status === "Space scheduled",
                        ).length,
                      ],
                      [
                        "Attended, awaiting final approval",
                        statuses.filter(
                          (row) =>
                            row.status === "Attendance pending verification",
                        ).length,
                      ],
                      [
                        "Rejected or disqualified referrals",
                        statuses.filter((row) => row.status === "Not eligible")
                          .length,
                      ],
                      ["Verified referrals", reward.verified],
                      [
                        "Current cycle",
                        `${reward.cycleProgress}/${REFERRALS_PER_CYCLE}`,
                      ],
                      ["Completed cycles", reward.completedCycles],
                      ["Paid cycles", reward.paidCycles],
                      ["Pending Payment", reward.unpaidCycles],
                      ["Total earned", naira.format(reward.earned)],
                      ["Total paid", naira.format(reward.paid)],
                      ["Outstanding", naira.format(reward.outstanding)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {(reward.verified === 0 ||
                    reward.cycleProgress < REFERRALS_PER_CYCLE) && (
                    <p>Current cycle · Not Complete</p>
                  )}
                  {!!referrals.length && (
                    <div
                      className="table-wrap"
                      role="region"
                      tabIndex={0}
                      aria-label={`Founder referrals for ${partner.name}`}
                    >
                      <table aria-label="Referred founders">
                        <thead>
                          <tr>
                            <th scope="col">Founder</th>
                            <th scope="col">Project</th>
                            <th scope="col">Referral status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statuses.map(({ application, status }) => {
                            return (
                              <tr key={application.id}>
                                <th scope="row">
                                  <Link
                                    href={`/operations?tab=applications&review=${encodeURIComponent(application.id)}`}
                                  >
                                    {application.founderName}
                                  </Link>
                                </th>
                                <td>{application.companyName}</td>
                                <td>
                                  <Status value={status} />
                                  {application.bdReviewStatus === "review" && (
                                    <p>Flagged for review</p>
                                  )}
                                  {application.bdReviewStatus === "self" && (
                                    <p>Self-referral blocked</p>
                                  )}
                                  {application.bdReviewStatus !==
                                    "disqualified" && (
                                    <details>
                                      <summary>Review referral</summary>
                                      <form
                                        className="record-form"
                                        onSubmit={(event) =>
                                          void submit(
                                            event,
                                            "review-referral",
                                            partner.id,
                                          )
                                        }
                                      >
                                        <input
                                          type="hidden"
                                          name="applicationId"
                                          value={application.id}
                                        />
                                        <label>
                                          Decision
                                          <select name="decision">
                                            <option value="disqualify">
                                              Disqualify referral
                                            </option>
                                            {application.bdReviewStatus ===
                                              "review" && (
                                              <option value="clear">
                                                Clear review flag
                                              </option>
                                            )}
                                          </select>
                                        </label>
                                        <label>
                                          Audit reason
                                          <input
                                            name="reason"
                                            required
                                            maxLength={200}
                                          />
                                        </label>
                                        <button
                                          className="button"
                                          disabled={busy}
                                        >
                                          Record decision
                                        </button>
                                      </form>
                                    </details>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <details>
                    <summary>Referral and payment history</summary>
                    <ul>
                      {partner.appearances.map((appearance) => {
                        const company = state.companies.find(
                          (value) => value.id === appearance.companyId,
                        );
                        const session = state.sessions.find(
                          (value) => value.id === appearance.sessionId,
                        );
                        return (
                          <li key={appearance.bookingId}>
                            {company?.name ?? "Archived project"} ·{" "}
                            {session?.startsAt.slice(0, 10) ??
                              appearance.verifiedAt.slice(0, 10)}{" "}
                            ·{" "}
                            {appearance.reversedAt
                              ? "Verification reversed"
                              : "Verified"}
                            {!appearance.reversedAt && (
                              <form
                                className="record-form"
                                onSubmit={(event) =>
                                  void submit(event, "reverse", partner.id)
                                }
                              >
                                <input
                                  type="hidden"
                                  name="appearanceId"
                                  value={appearance.id}
                                />
                                <label>
                                  Correction reason
                                  <input
                                    name="reason"
                                    required
                                    maxLength={200}
                                  />
                                </label>
                                <button className="button" disabled={busy}>
                                  Reverse verification
                                </button>
                              </form>
                            )}
                          </li>
                        );
                      })}
                      {partner.payments.map((payment) => (
                        <li key={payment.id}>
                          Cycle {payment.cycle} · {naira.format(payment.amount)}{" "}
                          paid · {payment.paidOn}
                          {payment.reference && ` · ${payment.reference}`}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <Link className="button" href="/operations?tab=sessions">
                    Open Space sessions
                  </Link>
                  {!!unpaid.length &&
                    (bankDetails?.partnerId === partner.id ? (
                      <div>
                        <p>
                          {bankDetails.bank} · {bankDetails.accountName} ·{" "}
                          {bankDetails.accountNumber}
                        </p>
                        <button
                          type="button"
                          className="button"
                          onClick={() => setBankDetails(null)}
                        >
                          Hide transfer details
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="button"
                        disabled={busy}
                        onClick={() => void viewBank(partner.id)}
                      >
                        View transfer details
                      </button>
                    ))}
                  {!!unpaid.length && (
                    <form
                      onSubmit={(event) =>
                        void submit(event, "pay", partner.id)
                      }
                      className="record-form"
                    >
                      <label>
                        Reward cycle
                        <select name="cycle" required>
                          {unpaid.map((cycle) => (
                            <option key={cycle} value={cycle}>
                              Cycle {cycle} ·{" "}
                              {naira.format(
                                Math.min(balance(cycle), reward.outstanding),
                              )}{" "}
                              · Pending Payment
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Payment date
                        <input name="paidOn" type="date" required />
                      </label>
                      <label>
                        Amount (₦)
                        <input
                          name="amount"
                          type="number"
                          min={1}
                          max={Math.min(REWARD_NAIRA, reward.outstanding)}
                          step={1}
                          defaultValue={Math.min(
                            balance(unpaid[0]),
                            reward.outstanding,
                          )}
                          required
                        />
                      </label>
                      <label>
                        Transfer reference (optional)
                        <input name="reference" maxLength={200} />
                      </label>
                      <button className="button primary" disabled={busy}>
                        Mark paid
                      </button>
                    </form>
                  )}
                </section>
              );
            })}
        </div>
      </div>
    </>
  );
}
