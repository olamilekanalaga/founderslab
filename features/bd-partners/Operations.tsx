"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Spaces, { type SpaceTab } from "@/features/spaces/components/Spaces";
import type { Resource } from "@/components/shared/RecordEditor";
import { Status } from "@/components/ui";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { rewardSummary, REFERRALS_PER_CYCLE, REWARD_NAIRA } from "./rewards";

type Partner = {
  id: string;
  name: string;
  email: string;
  appearances: {
    bookingId: string;
    sessionId: string;
    companyId: string;
    ordinal: number;
    verifiedAt: string;
  }[];
  payments: {
    cycle: number;
    amount: number;
    paidOn: string;
    reference: string;
  }[];
};
const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export default function Operations({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const requestedPanel = params.get("tab");
  const panel: "bd" | SpaceTab =
    requestedPanel === "applications" ||
    requestedPanel === "bookings" ||
    requestedPanel === "sessions"
      ? requestedPanel
      : "bd";
  function setPanel(value: "bd" | SpaceTab) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", value);
    next.delete("review");
    next.delete("status");
    next.delete("session");
    router.replace(`/operations?${next.toString()}`, { scroll: false });
  }
  const { viewer, state } = useWorkspace();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
        if (!controller.signal.aborted) setPartners(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice("Could not load BD partners.");
      });
    return () => controller.abort();
  }, [attempt]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: string,
    partnerId?: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
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
          ...(action === "pay" ? { cycle: Number(values.cycle) } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      setBankDetails(null);
      setNotice("Saved.");
      setAttempt((value) => value + 1);
      if (action === "attribute") router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const claimed = new Set(
    partners.flatMap((p) =>
      p.appearances.map((a) => JSON.stringify([a.sessionId, a.companyId])),
    ),
  );
  const unmatched = state.applications.filter(
    (application) => application.bdReferrerXHandle && !application.bdPartnerId,
  );
  const attendedBookings = state.bookings.flatMap((booking) => {
    const application = state.applications.find(
      (a) => a.id === booking.applicationId,
    );
    const session = state.sessions.find((s) => s.id === booking.sessionId);
    const attendance = state.spaceData.find(
      (report) => report.sessionId === booking.sessionId,
    );
    return booking.status === "Attended" &&
      application?.status === "Approved" &&
      application.bdPartnerId &&
      session &&
      session.status !== "Cancelled" &&
      attendance?.submittedAt &&
      state.spaceAttendance.some(
        (entry) =>
          entry.spaceDataId === attendance.id &&
          entry.companyId === application.companyId &&
          entry.foundersCount > 0,
      ) &&
      !claimed.has(JSON.stringify([session.id, application.companyId]))
      ? [
          {
            id: booking.id,
            partnerId: application.bdPartnerId,
            label: `${application.companyName} · ${session.startsAt.slice(0, 10)}`,
          },
        ]
      : [];
  });

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
        {panel !== "bd" && (
          <Spaces
            key={panel}
            edit={edit}
            embedded={{ tab: panel, onChange: setPanel }}
          />
        )}
        <div hidden={panel !== "bd"}>
          <section className="panel padded">
            <h2 id="bd-details" style={{ scrollMarginTop: "100px" }}>
              Register a BD partner
            </h2>
            <form
              onSubmit={(event) => void submit(event, "register")}
              className="record-form"
            >
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
          {notice && <p role="status">{notice}</p>}
          {!!unmatched.length && (
            <section className="panel padded">
              <h2>Referrers to review</h2>
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
          {partners.map((partner) => {
            const referrals = state.applications.filter(
              (application) => application.bdPartnerId === partner.id,
            );
            const reviewedBookings = attendedBookings.filter(
              (booking) => booking.partnerId === partner.id,
            );
            const verifiedBookings = new Set(
              partner.appearances.map((appearance) => appearance.bookingId),
            );
            const reward = rewardSummary(
              partner.appearances.length,
              partner.payments,
            );
            const unpaid = Array.from(
              { length: reward.completedCycles },
              (_, index) => index + 1,
            ).filter(
              (cycle) =>
                !partner.payments.some((payment) => payment.cycle === cycle),
            );
            return (
              <section className="panel padded" key={partner.id}>
                <h2>{partner.name}</h2>
                <p>{partner.email}</p>
                <dl className="facts">
                  {[
                    ["Total referred", referrals.length],
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
                        {referrals.map((application) => {
                          const bookings = state.bookings.filter(
                            (booking) =>
                              booking.applicationId === application.id,
                          );
                          const status = bookings.some((booking) =>
                            verifiedBookings.has(booking.id),
                          )
                            ? "Verified"
                            : application.status === "Approved"
                              ? bookings.some(
                                  (booking) => booking.status === "Attended",
                                )
                                ? "Attendance to verify"
                                : bookings.some(
                                      (booking) =>
                                        booking.status === "Approved",
                                    )
                                  ? "Booked"
                                  : "Awaiting booking"
                              : application.status === "Pending"
                                ? "Awaiting approval"
                                : application.status;
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
                          Cycle{" "}
                          {Math.ceil(appearance.ordinal / REFERRALS_PER_CYCLE)}{" "}
                          · {company?.name ?? "Archived project"} ·{" "}
                          {session?.startsAt.slice(0, 10) ??
                            appearance.verifiedAt.slice(0, 10)}
                        </li>
                      );
                    })}
                    {partner.payments.map((payment) => (
                      <li key={payment.cycle}>
                        Cycle {payment.cycle} · Paid · {payment.paidOn} ·{" "}
                        {payment.reference}
                      </li>
                    ))}
                  </ul>
                </details>
                <form
                  onSubmit={(event) => void submit(event, "verify", partner.id)}
                  className="record-form"
                >
                  <label>
                    Attended founder booking
                    <select name="bookingId" required defaultValue="">
                      <option value="" disabled>
                        Select booking
                      </option>
                      {reviewedBookings.map((booking) => (
                        <option value={booking.id} key={booking.id}>
                          {booking.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button"
                    disabled={busy || !reviewedBookings.length}
                  >
                    Verify referral
                  </button>
                </form>
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
                    onSubmit={(event) => void submit(event, "pay", partner.id)}
                    className="record-form"
                  >
                    <label>
                      Reward cycle
                      <select name="cycle" required>
                        {unpaid.map((cycle) => (
                          <option key={cycle} value={cycle}>
                            Cycle {cycle} · {naira.format(REWARD_NAIRA)} ·
                            Pending Payment
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Payment date
                      <input name="paidOn" type="date" required />
                    </label>
                    <label>
                      Transfer reference
                      <input name="reference" required maxLength={200} />
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
