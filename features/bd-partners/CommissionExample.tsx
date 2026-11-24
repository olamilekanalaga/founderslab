"use client";

import { useState } from "react";
import { naira } from "./intelligence";
import { rewardSummary } from "./rewards";

export default function CommissionExample() {
  const [recorded, setRecorded] = useState<number[]>([]);
  const [approved, setApproved] = useState<number[]>([]);
  const reward = rewardSummary(
    recorded.filter((founder) =>
      approved.includes(Math.floor((founder - 1) / 4)),
    ).length,
    [],
  );

  return (
    <details className="panel padded">
      <summary>BD Referral Tracker · Interactive example</summary>
      <h2>Eight referrals, two example Spaces</h2>
      <p>
        Demo only. Each group represents a separate Space with four booked
        projects.
      </p>
      {[0, 1].map((space) => (
        <fieldset key={space} disabled={approved.includes(space)}>
          <legend>Record attendance · Space {space + 1}</legend>
          {Array.from({ length: 4 }, (_, n) => space * 4 + n + 1).map(
            (founder) => (
              <label className="check-label" key={founder}>
                <input
                  type="checkbox"
                  checked={recorded.includes(founder)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRecorded((rows) =>
                      checked
                        ? [...rows, founder]
                        : rows.filter((row) => row !== founder),
                    );
                  }}
                />{" "}
                Founder {founder}
              </label>
            ),
          )}
          <button
            type="button"
            className="button"
            onClick={() => setApproved((rows) => [...rows, space])}
          >
            Complete and approve Space {space + 1}
          </button>
        </fieldset>
      ))}
      <p role="status">
        8 referrals · {reward.verified} verified · {reward.completedCycles}{" "}
        cycles · {naira.format(reward.earned)} earned · {reward.cycleProgress}/4
        cycle progress
      </p>
      {!approved.length && (
        <p>
          Attendance is pending final approval. No commission has been earned.
        </p>
      )}
      <button
        type="button"
        className="button"
        onClick={() => {
          setRecorded([]);
          setApproved([]);
        }}
      >
        Reset example
      </button>
    </details>
  );
}
