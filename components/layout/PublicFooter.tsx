import Link from "next/link";
import BrandMark from "@/components/shared/BrandMark";
import { ArrowUpRight } from "lucide-react";
export default function PublicFooter() {
  return (
    <footer className="public-footer programme-footer fl-footer">
      <div className="fl-footer-main">
        <div className="programme-footer-brand">
          <Link className="fl-footer-logo" href="/">
            <BrandMark size={27} />
            <span>Founders Lab</span>
          </Link>
          <p>
            Founder conversations.
            <br />
            Lasting connections.
          </p>
          <small>Hosted by Ola_Crrypt. Live on X Spaces.</small>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/#about">About the programme</Link>
          <Link href="/#how-it-works">How It Works</Link>
          <Link href="/book">
            Choose a Saturday <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/terms">Privacy & programme terms</Link>
        </nav>
      </div>
      <div className="fl-footer-bottom">
        <span>Built around the conversation.</span>
        <span>Saturdays, 7 PM London. Participation subject to approval.</span>
      </div>
    </footer>
  );
}
