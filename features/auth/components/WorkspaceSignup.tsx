"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

async function profilePhoto(file: File) {
  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 8 * 1024 * 1024
  )
    throw new Error("Choose a JPG, PNG or WebP image under 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const size = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(size, 256);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not read the photo.");
    context.drawImage(
      bitmap,
      (bitmap.width - size) / 2,
      (bitmap.height - size) / 2,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    bitmap.close();
  }
}

export default function WorkspaceSignup({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const key = new URLSearchParams(window.location.hash.slice(1)).get("key");
    const file = fields.get("photo");
    if (!key || !(file instanceof File)) {
      setMessage(
        "Open the full private signup link and choose a profile photo.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(fields),
          key,
          photo: await profilePhoto(file),
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      window.history.replaceState(null, "", "/signup");
      setComplete(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Registration could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-card">
        <Link className="brand" href="/">
          FoundersLab
        </Link>
        <h1>
          {complete ? "Your account is ready" : "Create your workspace account"}
        </h1>
        {complete || !enabled ? (
          <p>
            {complete
              ? "Sign in with your new email and password."
              : "Workspace registration is closed."}
          </p>
        ) : (
          <form className="stack-form" onSubmit={submit}>
            <label>
              Profile photo
              <input
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <label>
              First name
              <input
                name="firstName"
                autoComplete="given-name"
                maxLength={80}
                required
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                autoComplete="family-name"
                maxLength={80}
                required
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              X username
              <input name="x" autoCapitalize="none" maxLength={16} required />
            </label>
            <label>
              Telegram username
              <input
                name="telegram"
                autoCapitalize="none"
                maxLength={33}
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={15}
                maxLength={128}
                required
              />
            </label>
            {message && (
              <p className="error" role="alert">
                {message}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
        <Link className="text-link" href="/signin">
          Sign in
        </Link>
      </section>
    </main>
  );
}
