"use client";

import { useState } from "react";

export default function CopyConsultationLink({
  link,
  message,
}: {
  link: string;
  message?: string;
}) {
  const [notice, setNotice] = useState("");
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(label + " copied.");
    } catch {
      setNotice("Select and copy the text manually.");
    }
  }

  return (
    <div className="stack-form">
      <label>
        Private booking link
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <div className="inline">
        <button
          type="button"
          className="button"
          onClick={() => void copy(link, "Link")}
        >
          Copy link
        </button>
        {message && (
          <button
            type="button"
            className="button primary"
            onClick={() =>
              void copy(message + "\n\n" + link, "Follow-up and link")
            }
          >
            Copy follow-up and link
          </button>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
