"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";

export default function WorkspaceSignupControls() {
  const { viewer } = useWorkspace();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function closeSignup() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/close-signup", {
        method: "POST",
        headers: { "X-CSRF-Token": viewer.csrf || "" },
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setMessage(
        "Signup is closed. Existing workspace accounts can still sign in.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not close signup.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel padded">
      <h1>Workspace access</h1>
      <p>
        After both accounts are ready, close signup to disable the shared link.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void closeSignup();
        }}
      >
        <label className="check-label">
          <input type="checkbox" required /> Both accounts can sign in.
        </label>
        <button className="button primary" disabled={busy}>
          Close signup
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
