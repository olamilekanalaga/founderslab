"use client";
import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
type Manager = {
  id: string;
  email: string;
  status: string;
  lastActivityAt: string | null;
  assignments: { sessionId: string }[];
  lastEmailAcceptedAt: string | null;
};
export default function SpaceManagersSettings() {
  const { viewer, state } = useWorkspace();
  const [managers, setManagers] = useState<Manager[]>([]),
    [email, setEmail] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [configured, setConfigured] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/space-managers");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setManagers(data.managers);
    setConfigured(data.emailConfigured);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((e) => setMessage(e.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function act(payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/space-managers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": viewer.csrf || "",
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessage(data.message);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save.");
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel padded space-managers-settings">
      <h2>Space Managers</h2>
      <p className="muted">
        Passwordless access to assigned weekly Spaces only.
      </p>
      <>
        {!configured && (
          <p className="notice">
            Email delivery is not configured. Set RESEND_API_KEY,
            MANAGER_EMAIL_FROM and APP_ORIGIN before sending invitations.
          </p>
        )}
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: "invite", email, sessionIds: selected });
          }}
        >
          <label>
            Friend’s email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Assigned Spaces</legend>
            <div className="manager-assignments">
              {state.sessions.map((s) => (
                <label className="check-label" key={s.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() =>
                      setSelected((v) =>
                        v.includes(s.id)
                          ? v.filter((id) => id !== s.id)
                          : [...v, s.id],
                      )
                    }
                  />
                  {s.title} · {s.startsAt.slice(0, 10)}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            className="button primary"
            disabled={busy || !configured || !selected.length}
          >
            Send invitation email
          </button>
        </form>
        {message && <p role="status">{message}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Last activity</th>
                <th>Assigned Spaces</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.email}
                    <small>
                      {m.lastEmailAcceptedAt
                        ? `Email accepted ${new Date(m.lastEmailAcceptedAt).toLocaleString()}`
                        : "No email accepted yet"}
                    </small>
                  </td>
                  <td>{m.status}</td>
                  <td>
                    {m.lastActivityAt
                      ? new Date(m.lastActivityAt).toLocaleString()
                      : "Not yet"}
                  </td>
                  <td>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const values = new FormData(e.currentTarget).getAll(
                          "session",
                        );
                        void act({
                          action: "assign",
                          id: m.id,
                          sessionIds: values,
                        });
                      }}
                    >
                      <div className="manager-assignments">
                        {state.sessions.map((s) => (
                          <label
                            key={`${m.id}:${s.id}:${m.assignments.map((a) => a.sessionId).join()}`}
                            className="check-label"
                          >
                            <input
                              name="session"
                              type="checkbox"
                              value={s.id}
                              defaultChecked={m.assignments.some(
                                (a) => a.sessionId === s.id,
                              )}
                              disabled={m.status === "Revoked"}
                            />
                            {s.title} · {s.startsAt.slice(0, 10)}
                          </label>
                        ))}
                      </div>
                      <button
                        className="button"
                        disabled={busy || m.status === "Revoked"}
                      >
                        Save assignments
                      </button>
                    </form>
                  </td>
                  <td>
                    <button
                      className="button"
                      disabled={busy || !configured || m.status === "Revoked"}
                      onClick={() => void act({ action: "resend", id: m.id })}
                    >
                      Resend email
                    </button>
                    <button
                      className="button"
                      disabled={busy || m.status === "Revoked"}
                      onClick={() => void act({ action: "revoke", id: m.id })}
                    >
                      Revoke access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!managers.length && (
          <p className="muted">No Space Managers invited.</p>
        )}
      </>
    </section>
  );
}
