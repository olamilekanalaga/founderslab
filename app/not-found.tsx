import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-card">
        <h1>That page isn’t in the lab.</h1>
        <p>Try the founder workspace or the public programme.</p>
        <Link className="button primary" href="/demo">
          Open the fictional demo
        </Link>
        <Link className="text-link" href="/">
          Programme website
        </Link>
      </section>
    </main>
  );
}
