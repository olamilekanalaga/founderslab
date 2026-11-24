"use client";
import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Modal } from "@/components/ui";
type Manager = {
  id: string;
  email: string;
  status: string;
  lastActivityAt: string | null;
  allSpaces: boolean;
  passwordConfigured: boolean;
  assignments: { sessionId: string }[];
  lastEmailAcceptedAt: string | null;
};
export default function SpaceManagersSettings() {
  const { viewer, state } = useWorkspace();
  const [managers, setManagers] = useState<Manager[]>([]),
    [email, setEmail] = useState(""),
    [allSpaces, setAllSpaces] = useState(true),
    [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [configured, setConfigured] = useState<boolean | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [manualLink, setManualLink] = useState(""),
    [copyStatus, setCopyStatus] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch("/api/space-managers", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error || "Unable to load Space Managers.");
      setManagers(data.managers);
      setConfigured(data.emailConfigured);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load Space Managers.",
      );
    } finally {
      setLoading(false);
    }
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
      if (typeof data.link === "string") {
        setManualLink(data.link);
        setCopyStatus("");
      }
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
        All Spaces access lets a manager run the operational workspace,
        including BD payments. Selected Spaces access is limited to those
        sessions and BD registration.
      </p>
      <>
        {loading && (
          <div
            className="chart-skeleton"
            role="status"
            aria-label="Loading Space Managers"
          />
        )}
        {loadError && (
          <div className="notice" role="alert">
            <b>Space Managers couldn’t load.</b>
            <p>{loadError}</p>
            <button className="button" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}
        {!loading && !loadError && configured === false && (
          <p className="notice">
            Email delivery is not connected. Connect the programme’s email
            service to send email invitations, or generate a manual link.
          </p>
        )}
        <form
          className="stack-form"
          hidden={loading || Boolean(loadError)}
          onSubmit={(e) => {
            e.preventDefault();
            const submitter = (e.nativeEvent as SubmitEvent).submitter;
            if (
              submitter instanceof HTMLButtonElement &&
              (submitter.value === "manual" ||
                submitter.value === "password-link")
            ) {
              void act({ action: submitter.value, email });
            } else {
              void act({
                action: "invite",
                email,
                allSpaces,
                sessionIds: allSpaces ? [] : selected,
              });
            }
          }}
        >
          <label>
            Manager’s email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>Space access</legend>
            <label className="check-label">
              <input
                type="checkbox"
                checked={allSpaces}
                onChange={(e) => setAllSpaces(e.target.checked)}
              />
              All current and future Spaces
            </label>
            <div className="manager-assignments" hidden={allSpaces}>
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
            disabled={
              busy ||
              loading ||
              Boolean(loadError) ||
              !configured ||
              (!allSpaces && !selected.length)
            }
          >
            Send invitation email
          </button>
          <button
            type="submit"
            value="manual"
            className="button"
            disabled={busy || loading || Boolean(loadError)}
          >
            Generate &amp; Copy Invitation Link
          </button>
          <button
            type="submit"
            value="password-link"
            className="button"
            disabled={busy || loading || Boolean(loadError)}
          >
            Generate password setup link
          </button>
          <p className="muted">
            New managers created by a manual or password setup link get All
            Spaces access. A password link for an existing manager keeps their
            current assignments.
          </p>
        </form>
        {manualLink && (
          <Modal
            title={
              manualLink.includes("#setup=")
                ? "Manager password link"
                : "Manual invitation link"
            }
            close={() => setManualLink("")}
          >
            <div className="stack-form">
              <p>
                This link expires in 15 minutes and can be used once. Anyone who
                has it can access this manager account. Share it privately with
                the intended person.
              </p>
              <label>
                Invitation link
                <input
                  value={manualLink}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <button
                className="button primary"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(manualLink);
                    setCopyStatus("Invitation link copied.");
                  } catch {
                    setCopyStatus(
                      "Select the link above and copy it manually.",
                    );
                  }
                }}
              >
                Copy
              </button>
              {copyStatus && <p role="status">{copyStatus}</p>}
            </div>
          </Modal>
        )}
        {message && <p role="status">{message}</p>}
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Space manager accounts"
          hidden={loading || Boolean(loadError)}
        >
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
                        const form = new FormData(e.currentTarget);
                        const allSpaces = form.has("allSpaces");
                        void act({
                          action: "assign",
                          id: m.id,
                          allSpaces,
                          sessionIds: allSpaces ? [] : form.getAll("session"),
                        });
                      }}
                    >
                      <label className="check-label" key={String(m.allSpaces)}>
                        <input
                          type="checkbox"
                          name="allSpaces"
                          defaultChecked={m.allSpaces}
                          disabled={m.status === "Revoked"}
                        />
                        All current and future Spaces
                      </label>
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
                    {m.status === "Expired" && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void act({ action: "manual", email: m.email })
                        }
                      >
                        Generate replacement link
                      </button>
                    )}
                    <button
                      className="button"
                      disabled={busy || m.status === "Revoked"}
                      onClick={() =>
                        void act({ action: "password-link", email: m.email })
                      }
                    >
                      {m.passwordConfigured
                        ? "Generate password reset link"
                        : "Set up password"}
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
        {!loading && !loadError && !managers.length && (
          <p className="muted">No Space Managers invited.</p>
        )}
      </>
    </section>
  );
}
