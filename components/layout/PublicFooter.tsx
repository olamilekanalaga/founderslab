import Link from "next/link";
export default function PublicFooter() {
  return (
    <footer className="public-footer programme-footer">
      <div className="programme-footer-brand">
        <Link href="/">
          Founders Lab <small>with Ola_Crrypt · ⭕️La_Crrypt💰₿</small>
        </Link>
        <p>Founder conversations. Lasting connections.</p>
        <p>Saturdays · 7:00 PM London · Participation subject to approval.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/#about">About the programme</Link>
        <Link href="/#how-it-works">How It Works</Link>
        <Link href="/book">Book a Space</Link>
        <Link href="/terms">Privacy & programme terms</Link>
      </nav>
    </footer>
  );
}
