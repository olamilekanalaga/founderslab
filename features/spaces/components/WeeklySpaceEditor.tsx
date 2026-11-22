"use client";
import { useState } from "react";
import { Plus, Save, Trash2, Pencil } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Status, Modal } from "@/components/ui";
import { dateTime } from "@/lib/dates/format";
import type { DataState } from "@/lib/types";
export default function WeeklySpaceEditor({
  session,
}: {
  session: DataState["sessions"][number];
}) {
  const { state: s, viewer } = useWorkspace();
  const [open, setOpen] = useState(false);
  const record = s.spaceData.find((r) => r.sessionId === session.id);
  if (!viewer.permissions.includes("booking.write")) return null;
  return (
    <>
      <button className="button" onClick={() => setOpen(true)}>
        <Pencil size={15} />
        Edit weekly Space data
      </button>
      {open && (
        <Modal title="Weekly Space data" close={() => setOpen(false)} wide>
          <p className="weekly-edit-hint">
            The X post, Space links, listeners and time are shared by everyone
            in this Space. Each project has its own attendance counts.
          </p>
          <SpaceForm
            key={`${session.id}:${record?.updatedAt || "new"}`}
            session={session}
            record={record}
          />
        </Modal>
      )}
    </>
  );
}
type TeamInput = {
  key: string;
  companyId: string;
  foundersCount: string;
  otherTeamCount: string;
};
function SpaceForm({
  session,
  record,
}: {
  session: DataState["sessions"][number];
  record: DataState["spaceData"][number] | undefined;
}) {
  const { state: s, commit, busy, viewer } = useWorkspace();
  const [postUrl, setPostUrl] = useState(session.postUrl || "");
  const [liveUrl, setLiveUrl] = useState(session.liveUrl || "");
  const [recordingUrl, setRecordingUrl] = useState(session.recordingUrl || "");
  const [listeners, setListeners] = useState(
      record?.liveListeners?.toString() ?? "",
    ),
    [hours, setHours] = useState(
      record?.durationMinutes === null || record?.durationMinutes === undefined
        ? ""
        : String(Math.floor(record.durationMinutes / 60)),
    ),
    [minutes, setMinutes] = useState(
      record?.durationMinutes === null || record?.durationMinutes === undefined
        ? ""
        : String(record.durationMinutes % 60),
    ),
    [notes, setNotes] = useState(record?.notes || ""),
    [teams, setTeams] = useState<TeamInput[]>(() => {
      const existing = s.spaceAttendance.filter(
        (t) => t.spaceDataId === record?.id,
      );
      const companyIds = [
        ...new Set([
          ...existing.map((t) => t.companyId),
          ...s.participants
            .filter(
              (p) => p.sessionId === session.id && p.attendance !== "Cancelled",
            )
            .map((p) => p.companyId),
        ]),
      ];
      return companyIds.map((companyId) => {
        const row = existing.find((t) => t.companyId === companyId);
        return {
          key: row?.id || companyId,
          companyId,
          foundersCount: row ? String(row.foundersCount) : "",
          otherTeamCount: row ? String(row.otherTeamCount) : "",
        };
      });
    });
  const can = viewer.permissions.includes("booking.write");
  const count = teams.reduce(
    (n, t) => n + Number(t.foundersCount || 0) + Number(t.otherTeamCount || 0),
    0,
  );
  const founders = teams.reduce((n, t) => n + Number(t.foundersCount || 0), 0);
  function addTeam() {
    const company = s.companies.find(
      (c) => !teams.some((t) => t.companyId === c.id),
    );
    if (company)
      setTeams((rows) => [
        ...rows,
        {
          key: crypto.randomUUID(),
          companyId: company.id,
          foundersCount: "0",
          otherTeamCount: "0",
        },
      ]);
  }
  function changeTeam(key: string, field: keyof TeamInput, value: string) {
    setTeams((rows) =>
      rows.map((t) => (t.key === key ? { ...t, [field]: value } : t)),
    );
  }
  return (
    <form
      className="panel space-data-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await commit({
          type: "space-data.save",
          payload: {
            submit:
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) === "complete",
            sessionId: session.id,
            postUrl,
            liveUrl,
            recordingUrl,
            liveListeners: listeners === "" ? null : Number(listeners),
            durationMinutes:
              hours === "" && minutes === ""
                ? null
                : Number(hours || 0) * 60 + Number(minutes || 0),
            notes,
            teams: teams
              .filter((t) => t.foundersCount !== "" && t.otherTeamCount !== "")
              .map(({ companyId, foundersCount, otherTeamCount }) => ({
                companyId,
                foundersCount: Number(foundersCount),
                otherTeamCount: Number(otherTeamCount),
              })),
          },
        });
      }}
    >
      <div className="section-heading">
        <div>
          <h2>{session.title}</h2>
          <p>{dateTime(session.startsAt)}</p>
        </div>
        <Status
          value={
            record?.submittedAt
              ? "Attendance submitted"
              : record
                ? "Draft saved"
                : "Not recorded"
          }
        />
      </div>
      <fieldset disabled={!can || busy} className="space-data-inputs">
        <legend className="sr-only">Space results</legend>
        <div className="weekly-link-fields">
          <label>
            Shared X post URL
            <input
              aria-label="Shared X post URL"
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://x.com/…"
            />
          </label>
          <label>
            Shared Space URL
            <input
              aria-label="Shared Space URL"
              type="url"
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="https://x.com/i/spaces/…"
            />
          </label>
          <label>
            Shared recording URL
            <input
              aria-label="Shared recording URL"
              type="url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>
        <div className="space-data-fields">
          <label>
            Live listeners
            <input
              aria-label="Live listeners"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={listeners}
              onChange={(e) => setListeners(e.target.value)}
              placeholder="Not recorded"
            />
          </label>
          <label>
            Hours
            <input
              aria-label="Space hours"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Minutes
            <input
              aria-label="Space minutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="0"
            />
          </label>
        </div>
        <div className="row-between">
          <div>
            <h3>Who attended from each team?</h3>
            <span className="muted">
              {teams.length
                ? `${founders} founders · ${count} people in total`
                : "No team attendance entered"}
            </span>
          </div>
          <button
            type="button"
            className="button"
            onClick={addTeam}
            disabled={teams.length >= s.companies.length}
          >
            <Plus size={15} />
            Add team
          </button>
        </div>
        <div className="space-team-rows">
          {teams.map((team, index) => (
            <div className="space-team-row" key={team.key}>
              <label>
                Project
                <select
                  aria-label={`Project ${index + 1}`}
                  value={team.companyId}
                  onChange={(e) =>
                    changeTeam(team.key, "companyId", e.target.value)
                  }
                >
                  {s.companies.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={teams.some(
                        (t) => t.key !== team.key && t.companyId === c.id,
                      )}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Founders attended
                <input
                  aria-label={`Founders attended ${index + 1}`}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={team.foundersCount}
                  onChange={(e) =>
                    changeTeam(team.key, "foundersCount", e.target.value)
                  }
                />
              </label>
              <label>
                Other team members
                <input
                  aria-label={`Other team members ${index + 1}`}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={team.otherTeamCount}
                  onChange={(e) =>
                    changeTeam(team.key, "otherTeamCount", e.target.value)
                  }
                />
              </label>
              <span className="team-attendance-total">
                <small>Total attended</small>
                <b>
                  {Number(team.foundersCount || 0) +
                    Number(team.otherTeamCount || 0)}
                </b>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove team ${index + 1}`}
                onClick={() =>
                  setTeams((rows) => rows.filter((t) => t.key !== team.key))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <label>
          Notes
          <textarea
            aria-label="Space data notes"
            rows={3}
            maxLength={5000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </fieldset>
      <div className="space-data-footer">
        <small>
          {record
            ? `Recorded by ${record.recordedBy}`
            : "Enter actual numbers after the Space."}
        </small>
        <button
          disabled={!can || busy}
          className="button"
          name="intent"
          value="draft"
          type="submit"
        >
          <Save size={15} />
          {busy ? "Saving…" : "Save Space data"}
        </button>
        <button
          className="button primary"
          name="intent"
          value="complete"
          type="submit"
          disabled={!can || busy || new Date(session.startsAt) > new Date()}
        >
          {record?.submittedAt
            ? "Update submitted attendance"
            : "Submit attendance"}
        </button>
      </div>
    </form>
  );
}
