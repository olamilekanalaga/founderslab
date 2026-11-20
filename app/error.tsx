"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-card">
        <h1>The workspace couldn’t load.</h1>
        <p>
          The private service may need its database connection checked. No
          private data is shown here.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <Link className="text-link" href="/demo">
          Open the independent fictional demo
        </Link>
      </section>
    </main>
  );
}
