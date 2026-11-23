"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
type Space = {
  id: string;
  title: string;
  startsAt: string;
  timezone: string;
  recordingUrl: string;
  postUrl: string;
  spaceData: null | {
    liveListeners: number | null;
    durationMinutes: number | null;
    submittedAt: string | null;
  };
};
export default function ManagerSpaces() {
  const [spaces, setSpaces] = useState<Space[]>([]),
    [csrf, setCsrf] = useState(""),
    [email, setEmail] = useState(""),
    [linkToken, setToken] = useState(""),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/manager/spaces");
    const data = await r.json();
    if (!r.ok) {
      setCsrf("");
      setSpaces([]);
      setReady(true);
      if (r.status !== 401) throw new Error(data.error);
      return;
    }
    setCsrf(data.csrf);
    setSpaces(data.spaces);
    setReady(true);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = new URLSearchParams(location.hash.slice(1)).get("token");
      if (raw) {
        setToken(raw);
        history.replaceState(null, "", location.pathname);
        setReady(true);
      } else
        void load().catch((e) => {
          setMessage(e.message);
          setReady(true);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function post(action: string, payload: unknown) {
    const r = await fetch("/api/manager/" + action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401) {
        setCsrf("");
        setSpaces([]);
      }
      throw new Error(data.error);
    }
    return data;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="manager-page" id="main-content">
      <header className="row-between">
        <Link href="/" className="brand">
          Founders Lab
        </Link>
        <span className="badge">Space Manager</span>
      </header>
      <h1>Your weekly Spaces</h1>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!ready ? (
        <p role="status">Loading your access…</p>
      ) : linkToken ? (
        <section className="panel padded">
          <h2>Open your assigned Spaces</h2>
          <p>
            This email link can be used once. Your secure session lasts eight
            hours.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await post("verify", { token: linkToken });
                setToken("");
                await load();
              })
            }
          >
            Continue securely
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              setToken("");
              setMessage("");
            }}
          >
            Request a new email link
          </button>
        </section>
      ) : !csrf ? (
        <section className="panel padded">
          <h2>Sign in by email</h2>
          <p>
            Use the email address invited by the administrator. No account
            signup or password is needed.
          </p>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const d = await post("request-link", { email });
                setMessage(d.message);
              });
            }}
          >
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              className="button"
              name="intent"
              value="draft"
              disabled={busy}
            >
              Email me a sign-in link
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="row-between">
            <p>{spaces.length} assigned Spaces</p>
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await post("logout", {});
                  setCsrf("");
                  setSpaces([]);
                })
              }
            >
              Sign out
            </button>
          </div>
          {!spaces.length && (
            <section className="panel padded">
              No Spaces assigned yet. Ask the administrator to assign your
              weekly sessions.
            </section>
          )}
          {spaces.map((space) => (
            <SpaceEditor
              key={`${space.id}:${space.spaceData?.durationMinutes}:${space.recordingUrl}:${space.postUrl}`}
              space={space}
              busy={busy}
              save={(payload) =>
                run(async () => {
                  await post("save", payload);
                  await load();
                  setMessage(
                    "Space data saved. Shared founder and company profiles are updated.",
                  );
                })
              }
            />
          ))}
        </>
      )}
    </main>
  );
}
function SpaceEditor({
  space,
  busy,
  save,
}: {
  space: Space;
  busy: boolean;
  save: (p: unknown) => Promise<void>;
}) {
  const duration = space.spaceData?.durationMinutes;
  const [hours, setHours] = useState(
      duration == null ? "" : String(Math.floor(duration / 60)),
    ),
    [minutes, setMinutes] = useState(
      duration == null ? "" : String(duration % 60),
    ),
    [listeners, setListeners] = useState(
      space.spaceData?.liveListeners?.toString() ?? "",
    ),
    [recording, setRecording] = useState(space.recordingUrl),
    [post, setPost] = useState(space.postUrl);
  return (
    <section className="panel padded manager-space">
      <h2>{space.title}</h2>
      <p className="muted">
        {new Date(space.startsAt).toLocaleString("en-GB", { timeZone: "UTC" })}{" "}
        UTC
      </p>
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            submit:
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) === "complete",
            sessionId: space.id,
            liveListeners: listeners === "" ? null : Number(listeners),
            durationMinutes:
              hours === "" && minutes === ""
                ? null
                : Number(hours || 0) * 60 + Number(minutes || 0),
            recordingUrl: recording,
            postUrl: post,
          });
        }}
      >
        <label>
          Live listeners
          <input
            type="number"
            min="0"
            step="1"
            max="100000000"
            value={listeners}
            onChange={(e) => setListeners(e.target.value)}
            placeholder="Not recorded"
          />
        </label>
        <div className="two-grid">
          <label>
            Hours
            <input
              type="number"
              min="0"
              max="16666"
              step="1"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </label>
          <label>
            Minutes
            <input
              type="number"
              min="0"
              max="59"
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        </div>
        <label>
          X Spaces recording URL
          <input
            type="url"
            value={recording}
            onChange={(e) => setRecording(e.target.value)}
          />
        </label>
        <label>
          Weekly X post URL
          <input
            type="url"
            value={post}
            onChange={(e) => setPost(e.target.value)}
          />
        </label>
        <button className="button" name="intent" value="draft" disabled={busy}>
          {busy ? "Saving…" : "Save Space data"}
        </button>
        <button
          className="button primary"
          name="intent"
          value="complete"
          disabled={busy || new Date(space.startsAt) > new Date()}
        >
          {space.spaceData?.submittedAt
            ? "Update submitted attendance"
            : "Submit attendance"}
        </button>
      </form>
    </section>
  );
}
