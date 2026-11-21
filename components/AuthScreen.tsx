"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "./BrandMark";
import { ArrowRight, ShieldCheck } from "lucide-react";
export default function AuthScreen({
  invite = false,
  configured,
}: {
  invite?: boolean;
  configured: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>
            Founders Lab<small>with Ola_Crrypt</small>
          </span>
        </Link>
        <div className="eyebrow">
          <ShieldCheck size={13} /> PRIVATE WORKSPACE
        </div>
        <h1>{invite ? "Accept admin invitation." : "Welcome back."}</h1>
        <p>
          {invite
            ? "Set a strong password to accept your one-time invitation."
            : "Sign in to manage founder research, sessions and opportunities."}
        </p>
        {!configured && (
          <p className="error">
            The private database is not configured. Use the fictional demo
            without signing in.
          </p>
        )}
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const token = new URLSearchParams(
                window.location.hash.slice(1),
              ).get("token");
              const response = await fetch(
                "/api/auth/" + (invite ? "accept-invite" : "login"),
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(
                    invite ? { token, password } : { email, password },
                  ),
                },
              );
              const v = await response.json();
              if (!response.ok) throw new Error(v.error);
              router.push("/dashboard");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to sign in");
            } finally {
              setBusy(false);
            }
          }}
        >
          {!invite && (
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          <label>
            {invite ? "Password · at least 12 characters" : "Password"}
            <input
              type="password"
              autoComplete={invite ? "new-password" : "current-password"}
              minLength={invite ? 12 : 1}
              maxLength={200}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !configured}
            className="button primary"
          >
            {busy ? "Please wait…" : invite ? "Accept invitation" : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        <Link className="text-link" href="/demo">
          Explore the fictional demo without login <ArrowRight size={13} />
        </Link>
        <p className="muted">
          Private accounts are created by an administrator or through a
          role-specific invitation. There are no shared production demo
          credentials.
        </p>
      </section>
    </main>
  );
}
