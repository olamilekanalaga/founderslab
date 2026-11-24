"use client";

import { useState } from "react";
import Link from "next/link";

export default function ReferralLink({ code }: { code: string }) {
  const [status, setStatus] = useState("");
  const path = `/book?ref=${encodeURIComponent(code)}`;
  return (
    <div className="heading-actions">
      <Link href={path} prefetch={false}>
        Referral link · {path}
      </Link>
      <button
        type="button"
        className="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(path, window.location.origin).href,
            );
            setStatus("Referral link copied.");
          } catch {
            setStatus("Use your browser to copy the referral link.");
          }
        }}
      >
        Copy Link
      </button>
      {status && <span role="status">{status}</span>}
    </div>
  );
}
