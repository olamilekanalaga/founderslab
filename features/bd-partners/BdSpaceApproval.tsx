"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Modal } from "@/components/ui";

export default function BdSpaceApproval({ sessionId }: { sessionId: string }) {
  const { state, viewer } = useWorkspace();
  const router = useRouter();
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const session = state.sessions.find((row) => row.id === sessionId);
  const report = state.spaceData.find((row) => row.sessionId === sessionId);
  if (
    !viewer.permissions.includes("team.manage") ||
    session?.status !== "Completed" ||
    !report?.submittedAt
  )
    return null;

  const candidates = state.bookings
    .filter(
      (booking) =>
        booking.sessionId === sessionId &&
        report.founderBookingIds.includes(booking.id),
    )
    .flatMap((booking) => {
      const app = state.applications.find(
        (row) => row.id === booking.applicationId,
      );
      return app?.bdPartnerId && app.status === "Approved" ? [app] : [];
    });
  const flagged = candidates.filter(
    (app) => app.bdReviewStatus && app.bdReviewStatus !== "cleared",
  ).length;

  async function approve() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/bd-partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": viewer.csrf || "",
        },
        body: JSON.stringify({
          action: "finalize",
          sessionId,
          confirmed: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(
        `Attendance approved. ${data.credited} newly verified, ${data.excluded} excluded.`,
      );
      setReview(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to approve attendance.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="button"
        type="button"
        onClick={() => {
          setMessage("");
          setReview(true);
        }}
      >
        {report.bdApprovedAt
          ? "Review BD attendance approval"
          : "Review and approve BD attendance"}
      </button>
      {message && !review && <p role="status">{message}</p>}
      {review && (
        <Modal
          title="Approve completed Space attendance"
          close={() => {
            if (!busy) setReview(false);
          }}
        >
          <p>{session.title}</p>
          <p>
            {candidates.length} referred bookings with recorded
            founder attendance. {flagged} currently flagged or disqualified.
          </p>
          {!!candidates.length && (
            <ul>
              {candidates.map((app) => (
                <li key={app.id}>
                  {app.founderName} · {app.companyName}
                </li>
              ))}
            </ul>
          )}
          <p>
            Confirm the Space has ended and attendance is accurate. The server
            checks eligibility and credits each project once for this Space.
          </p>
          {message && <p role="alert">{message}</p>}
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void approve()}
          >
            Confirm final attendance approval
          </button>
        </Modal>
      )}
    </>
  );
}
