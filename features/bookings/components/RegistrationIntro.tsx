import Link from "next/link";

export default function RegistrationIntro({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="registration-intro">
      <p>
        Founders Lab is a research-driven business discussion. We look into a
        challenge you’re facing and discuss practical ways forward together on X
        Spaces.
      </p>
      <h2>What you get</h2>
      <ul>
        <li>Independent research into your business</li>
        <li>Analysis of your business model and challenges</li>
        <li>Potential growth and revenue opportunities</li>
        <li>Proposed solutions and ways to put them into practice</li>
        <li>Public exposure through the live X Space</li>
      </ul>
      <h2>What we expect from you</h2>
      <p>
        Share information about your business and a current challenge before the
        session. Come ready to discuss our findings and proposed strategies
        live.
      </p>
      <p>
        Participation is free. Findings are exploratory. Confidential
        information will only be discussed publicly with your permission. Leave
        out private figures, credentials and customer data.
      </p>
      <div className="registration-actions">
        <button type="button" className="button primary" onClick={onContinue}>
          Continue to registration
        </button>
        <Link href="/" className="fl-inline-action">
          This format is not for me
        </Link>
      </div>
    </div>
  );
}
