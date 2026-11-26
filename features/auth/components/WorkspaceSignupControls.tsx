"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";

export default function WorkspaceSignupControls() {
  const { viewer } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [message, setMessage] = useState("");

  async function closeSignup() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/close-signup", {
        method: "POST",
        headers: { "X-CSRF-Token": viewer.csrf || "" },
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setClosed(true);
      setMessage("Signup is closed. Existing accounts can still sign in.");
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
      <p>Signup closes automatically after two accounts are created.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void closeSignup();
        }}
      >
        <label className="check-label">
          <input type="checkbox" required disabled={closed} /> Close signup for
          everyone.
        </label>
        <button className="button primary" disabled={busy || closed}>
          Close signup
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
