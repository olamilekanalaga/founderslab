import Link from "next/link";
import BrandMark from "@/components/shared/BrandMark";
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
          <small>Hosted by ⭕️La_Crrypt💰₿. Live on X Spaces.</small>
        </div>
      </div>
      <div className="fl-footer-bottom">
        <span>Built around the conversation.</span>
        <span>Saturdays, 7 PM London. Participation subject to approval.</span>
      </div>
    </footer>
  );
}
