"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "./BrandMark";
import { ArrowRight, ShieldCheck } from "lucide-react";
export default function AuthScreen({
  configured,
  allowDemo = true,
}: {
  configured: boolean;
  allowDemo?: boolean;
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
        <h1>Welcome back.</h1>
        <p>Sign in to manage founders, bookings and weekly Spaces.</p>
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
              const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
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
          {
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
          }
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              minLength={1}
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
            {busy ? "Please wait…" : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        {allowDemo && (
          <Link className="text-link" href="/demo">
            Explore the fictional demo without login <ArrowRight size={13} />
          </Link>
        )}
        <p className="muted">
          Only the pre-provisioned administrator can sign in. There is no public
          signup.
        </p>
      </section>
    </main>
  );
}
