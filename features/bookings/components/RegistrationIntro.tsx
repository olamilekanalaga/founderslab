import Link from "next/link";
import { freeSpaceDescription } from "@/lib/space-registration";

export default function RegistrationIntro({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="registration-intro">
      <h2>Free X Space</h2>
      <p>{freeSpaceDescription}</p>
      <h2>What we’ll talk about</h2>
      <p>
        Tell us what you’re building, the problem your product solves, how
        people use it, and where you see it going.
      </p>
      <p>
        The Space is public and recorded. You choose what you’re comfortable
        sharing live. We meet on Sundays at 7 PM London time.
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
