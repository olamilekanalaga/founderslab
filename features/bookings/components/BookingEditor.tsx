"use client";
import { useState } from "react";

import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Modal } from "@/components/ui";

import { approvedSeats } from "@/lib/domain";

import { formatSessionTime } from "@/components/shared/SessionTime";

export default function BookingEditor({
  sessionId,
  close,
}: {
  sessionId?: string;
  close: () => void;
}) {
  const { state: s, commit, busy } = useWorkspace();
  const [applicationId, setApplication] = useState(
      s.applications.find((a) => a.status === "Approved")?.id || "",
    ),
    [selectedSession, setSession] = useState(
      sessionId ||
        s.sessions.find(
          (v) =>
            v.status === "Scheduled" && s.programmeSessionIds?.includes(v.id),
        )?.id ||
        "",
    ),
    [speakers, setSpeakers] = useState(1);
  return (
    <Modal title="Create booking request" close={close}>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await commit({
              type: "booking.create",
              payload: { applicationId, sessionId: selectedSession, speakers },
            })
          )
            close();
        }}
      >
        <label>
          Application / project
          <select
            required
            value={applicationId}
            onChange={(e) => {
              setApplication(e.target.value);
              setSpeakers(
                s.applications.find((a) => a.id === e.target.value)?.speakers ||
                  1,
              );
            }}
          >
            <option value="">Select application</option>
            {s.applications
              .filter((a) => a.status !== "Declined")
              .map((a) => (
                <option value={a.id} key={a.id}>
                  {a.companyName} · {a.reference}
                </option>
              ))}
          </select>
        </label>
        <label>
          Session
          <select
            required
            value={selectedSession}
            onChange={(e) => setSession(e.target.value)}
          >
            <option value="">Select session</option>
            {s.sessions
              .filter(
                (v) =>
                  v.status === "Scheduled" &&
                  s.programmeSessionIds?.includes(v.id),
              )
              .map((v) => (
                <option value={v.id} key={v.id}>
                  {formatSessionTime(v.startsAt, "Europe/London")} · {v.title} ·{" "}
                  {v.capacity - approvedSeats(s, v.id)} project seats free
                </option>
              ))}
          </select>
        </label>
        <label>
          Speakers representing this project
          <input
            type="number"
            min={1}
            max={10}
            required
            value={speakers}
            onChange={(e) => setSpeakers(Number(e.target.value))}
          />
        </label>
        <p className="form-note">
          This creates a pending request. Approval checks project capacity on
          the server in the private workspace.
        </p>
        <button disabled={busy} className="button primary" type="submit">
          Create pending booking
        </button>
      </form>
    </Modal>
  );
}
