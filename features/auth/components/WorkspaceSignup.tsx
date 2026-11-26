"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./workspace-signup.module.css";

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

function SignupPassword({ confirm = false }: { confirm?: boolean }) {
  const [visible, setVisible] = useState(false);
  const label = confirm ? "Confirm password" : "Password";
  const name = confirm ? "confirmation" : "password";
  const id = `workspace-signup-${name}`;
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="signin-password">
      <label htmlFor={id}>{label}</label>
      <div className="signin-password-input">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={confirm ? "Confirm password" : "Create password"}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={128}
          required
        />
        <button
          type="button"
          className="icon-button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-controls={id}
          onClick={() => setVisible((value) => !value)}
        >
          <Icon size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function WorkspaceSignup({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const file = fields.get("photo");
    if (!(file instanceof File) || !file.size) {
      setMessage("Choose a profile photo.");
      return;
    }
    if (fields.get("password") !== fields.get("confirmation")) {
      setMessage("The passwords do not match.");
      return;
    }
    fields.delete("confirmation");
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(fields),
          photo: await profilePhoto(file),
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
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
    <main className={`auth-page ${styles.page}`} id="main-content">
      <section className={`auth-card ${styles.card}`}>
        <header className={styles.heading}>
          <h1>{complete ? "Your account is ready" : "Create your account"}</h1>
          <Link href="/">FoundersLab</Link>
        </header>
        {complete || !enabled ? (
          <p className={styles.intro}>
            {complete
              ? "Sign in with your new email and password."
              : "Workspace registration is closed."}
          </p>
        ) : (
          <form className="stack-form" onSubmit={submit}>
            <label className={styles.photoPicker}>
              <span className={styles.photo}>
                {preview ? (
                  <Image
                    src={preview}
                    unoptimized
                    width={84}
                    height={84}
                    alt=""
                  />
                ) : (
                  <UserRound size={36} aria-hidden="true" />
                )}
              </span>
              <span>
                {preview ? "Change profile picture" : "Upload profile picture"}
              </span>
              <input
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : "");
                }}
              />
            </label>
            <div className={styles.fieldPair}>
              <label>
                First name
                <input
                  name="firstName"
                  placeholder="First name"
                  autoComplete="given-name"
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  placeholder="Last name"
                  autoComplete="family-name"
                  maxLength={80}
                  required
                />
              </label>
            </div>
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="Enter email address"
                autoComplete="username"
                required
              />
            </label>
            <div className={styles.fieldPair}>
              <label>
                X username
                <input
                  name="x"
                  placeholder="@username"
                  autoCapitalize="none"
                  maxLength={16}
                  required
                />
              </label>
              <label>
                Telegram username
                <input
                  name="telegram"
                  placeholder="@username"
                  autoCapitalize="none"
                  maxLength={33}
                  required
                />
              </label>
            </div>
            <SignupPassword />
            <SignupPassword confirm />
            {message && (
              <p className="error" role="alert">
                {message}
              </p>
            )}
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
        <div className={styles.signin}>
          {enabled && !complete && "Already have an account? "}
          <Link href="/signin">Sign in</Link>
        </div>
      </section>
    </main>
  );
}
