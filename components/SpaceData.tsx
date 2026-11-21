"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Save,
  Trash2,
  Users,
  Headphones,
  Clock,
  UserRound,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { Empty, Status } from "./ui";
import Chart from "./Charts";
import {
  spaceTotals,
  durationLabel,
  spaceGrowth,
  type SpaceMetric,
} from "@/lib/space-data";
import { dateTime } from "@/lib/selectors";
import type { DataState } from "@/lib/types";
export default function SpaceData() {
  const { state: s } = useWorkspace(),
    params = useSearchParams();
  const [selected, setSelected] = useState(
    params.get("session") ||
      s.sessions.find((v) => v.status === "Completed")?.id ||
      s.sessions[0]?.id ||
      "",
  );
  const [metric, setMetric] = useState<SpaceMetric>("founders");
  const growth = spaceGrowth(s, metric);
  const session = s.sessions.find((v) => v.id === selected) || s.sessions[0];
  const totals = spaceTotals(s);
  const record = (s.spaceData || []).find((r) => r.sessionId === session?.id);
  return (
    <>
      <div className="page-heading">
        <h1>Space Data</h1>
        <span className="small-tag">
          {totals.recordedSpaces} Spaces recorded
        </span>
      </div>
      <div className="metric-grid">
        {[
          {
            label: "Founders attended",
            value: totals.founders,
            icon: UserRound,
            key: "founders",
          },
          {
            label: "All team attendees",
            value: totals.people,
            icon: Users,
            key: "people",
          },
          {
            label: "Live listener total",
            value: totals.listeners,
            icon: Headphones,
            key: "listeners",
          },
          {
            label: "Total time",
            value: durationLabel(totals.durationMinutes),
            icon: Clock,
            key: "time",
          },
        ].map(({ label, value, icon: Icon, key }) => (
          <div className="metric-card" key={key}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong data-testid={`space-total-${key}`}>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Growth over time</h2>
          <select
            aria-label="Growth metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as SpaceMetric)}
          >
            <option value="founders">Founders attended</option>
            <option value="people">All team attendees</option>
            <option value="listeners">Live listeners</option>
            <option value="durationMinutes">Hours hosted</option>
          </select>
        </div>
        {growth.length ? (
          <Chart
            data={growth}
            type="area"
            fractional={metric === "durationMinutes"}
            label={`Cumulative ${metric === "durationMinutes" ? "hours hosted" : metric} by Space date`}
          />
        ) : (
          <Empty>Save attendance, listeners or time to start this chart.</Empty>
        )}
        <p className="space-chart-caption">
          Cumulative recorded totals · by Space date
        </p>
      </section>
      <label className="space-picker">
        Choose a Space
        <select
          aria-label="Choose a Space"
          value={session?.id || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {s.sessions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} · {v.startsAt.slice(0, 10)}
            </option>
          ))}
        </select>
      </label>
      {session ? (
        <SpaceForm
          key={`${session.id}:${record?.updatedAt || "new"}`}
          session={session}
          record={record}
        />
      ) : (
        <Empty>Create a Space first.</Empty>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Recorded Spaces</h2>
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Recorded Space data"
        >
          <table>
            <thead>
              <tr>
                <th>Space</th>
                <th>Founders</th>
                <th>Team attendees</th>
                <th>Live listeners</th>
                <th>Time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(s.spaceData || []).map((r) => {
                const stats = spaceTotals(s, r.sessionId);
                return (
                  <tr key={r.id}>
                    <td>
                      {s.sessions.find((v) => v.id === r.sessionId)?.title}
                    </td>
                    <td>{stats.founders ?? "—"}</td>
                    <td>{stats.people ?? "—"}</td>
                    <td>{r.liveListeners ?? "—"}</td>
                    <td>{durationLabel(r.durationMinutes)}</td>
                    <td>
                      <button
                        className="button"
                        onClick={() => setSelected(r.sessionId)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!s.spaceData?.length && <Empty>No Space data recorded yet.</Empty>}
        </div>
      </section>
      <p className="workspace-footnote">
        Totals add the recorded attendance for each Space. Repeat attendees and
        listeners can be counted in more than one Space.
      </p>
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
    [teams, setTeams] = useState<TeamInput[]>(() =>
      s.spaceAttendance
        .filter((t) => t.spaceDataId === record?.id)
        .map((t) => ({
          key: t.id,
          companyId: t.companyId,
          foundersCount: String(t.foundersCount),
          otherTeamCount: String(t.otherTeamCount),
        })),
    );
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
            sessionId: session.id,
            liveListeners: listeners === "" ? null : Number(listeners),
            durationMinutes:
              hours === "" && minutes === ""
                ? null
                : Number(hours || 0) * 60 + Number(minutes || 0),
            notes,
            teams: teams.map(
              ({ companyId, foundersCount, otherTeamCount }) => ({
                companyId,
                foundersCount: Number(foundersCount),
                otherTeamCount: Number(otherTeamCount),
              }),
            ),
          },
        });
      }}
    >
      <div className="section-heading">
        <div>
          <h2>{session.title}</h2>
          <p>{dateTime(session.startsAt, session.timezone)}</p>
        </div>
        <Status value={record ? "Recorded" : "Not recorded"} />
      </div>
      <fieldset disabled={!can || busy} className="space-data-inputs">
        <legend className="sr-only">Space results</legend>
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
                  required
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
                  required
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
          className="button primary"
          type="submit"
        >
          <Save size={15} />
          {busy ? "Saving…" : "Save Space data"}
        </button>
      </div>
    </form>
  );
}
