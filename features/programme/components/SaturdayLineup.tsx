"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { currentSaturday } from "@/features/spaces/lib/current-saturday";

const londonDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "long",
});

export default function SaturdayLineup({ now }: { now: number }) {
  const { state, path } = useWorkspace();
  const [week, setWeek] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const { startsAt, session } = currentSaturday(state, new Date(now), week);
  const projects = new Map<
    string,
    { name: string; description: string; founders: Set<string> }
  >();
  if (session && session.status !== "Cancelled") {
    for (const participant of state.participants) {
      if (
        participant.sessionId !== session.id ||
        !["Approved", "Attended"].includes(participant.attendance)
      )
        continue;

      const project = state.companies.find(
        (company) => company.id === participant.companyId,
      );
      if (!project) continue;

      const founder = state.founders.find(
        (person) => person.id === participant.founderId,
      );
      const handle = founder?.xHandle.trim().replace(/^@+/, "");
      const name = handle
        ? `@${handle}`
        : founder?.name || "X username unavailable";
      let entry = projects.get(project.id);
      if (!entry) {
        entry = {
          name: project.name,
          description: project.description,
          founders: new Set(),
        };
        projects.set(project.id, entry);
      }
      entry.founders.add(name);
    }
  }
  const lineup = [...projects.values()];
  const date = londonDate.format(startsAt);
  const remaining = session ? Math.max(0, session.capacity - lineup.length) : 0;

  async function copyLineup() {
    const rows = lineup.map(
      (entry) =>
        `${[...entry.founders].join(", ")} · ${entry.name}${entry.description ? ` — ${entry.description}` : ""}`,
    );
    try {
      await navigator.clipboard.writeText(
        [`Founders Lab · Saturday, ${date} · 7:00 PM UK`, ...rows].join("\n\n"),
      );
      setCopyStatus("Lineup copied.");
    } catch {
      setCopyStatus(
        "Clipboard unavailable. Select the lineup text to copy it.",
      );
    }
  }

  return (
    <section
      className="panel padded saturday-lineup"
      aria-labelledby="lineup-title"
    >
      <h2 id="lineup-title">Confirmed founder lineup</h2>
      <div
        className="heading-actions"
        aria-label="Choose a Saturday"
        role="group"
      >
        {["This Saturday", "Next Saturday"].map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={week === index}
            className={week === index ? "button primary" : "button"}
            onClick={() => {
              setWeek(index);
              setCopyStatus("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p>Saturday, {date} · 7:00 PM UK</p>
      {!session ? (
        <p>No Founder Space scheduled.</p>
      ) : session.status === "Cancelled" ? (
        <p>This Founder Space is cancelled.</p>
      ) : (
        <>
          <p>
            {lineup.length}/{session.capacity} confirmed · {remaining} open{" "}
            {remaining === 1 ? "seat" : "seats"}
          </p>
          {lineup.length ? (
            <ol>
              {lineup.map((entry, index) => (
                <li key={index}>
                  <strong>
                    {[...entry.founders].join(", ")} · {entry.name}
                  </strong>
                  {entry.description && <p>{entry.description}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p>No founders confirmed yet.</p>
          )}
          <div className="heading-actions">
            {!!lineup.length && (
              <button
                type="button"
                className="button primary"
                onClick={() => void copyLineup()}
              >
                Copy lineup
              </button>
            )}
            <Link
              className="button"
              href={`${path("operations")}?tab=bookings&session=${encodeURIComponent(session.id)}`}
            >
              View bookings
            </Link>
          </div>
          <div role="status">{copyStatus}</div>
        </>
      )}
    </section>
  );
}
