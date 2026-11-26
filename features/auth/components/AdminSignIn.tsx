"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/shared/BrandMark";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
export default function AuthScreen({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
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
            Founders Lab<small>with ⭕️La_Crrypt💰₿</small>
          </span>
        </Link>
        <div className="eyebrow">
          <ShieldCheck size={13} /> PRIVATE WORKSPACE
        </div>
        <h1>Welcome back.</h1>
        <p>Sign in to manage founders, bookings and weekly Spaces.</p>
        {!configured && (
          <p className="error">
            The private service is not ready. Contact the programme
            administrator.
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
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          }
          <div className="signin-password">
            <label htmlFor="signin-password">Password</label>
            <div className="signin-password-input">
              <input
                id="signin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                minLength={1}
                maxLength={200}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="signin-password"
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? (
                  <EyeOff size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
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
        <p className="muted">
          Use your FoundersLab workspace account to sign in.
        </p>
      </section>
    </main>
  );
}
