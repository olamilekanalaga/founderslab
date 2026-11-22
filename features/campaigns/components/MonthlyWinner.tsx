"use client";
import { useWorkspace } from "@/components/layout/WorkspaceContext";

/** Read-only history. Retiring the programme must not rewrite past obligations. */
export default function AwardArchive() {
  const { state } = useWorkspace();
  const campaigns = state.campaigns.toSorted((a, b) =>
    b.period.localeCompare(a.period),
  );
  return (
    <>
      <div className="page-heading">
        <h1>Founder award archive</h1>
      </div>
      <section className="panel padded">
        <p>
          The founder reward programme has ended. These historical records are
          read-only; recorded decisions, payment references and any existing
          obligations are preserved.
        </p>
        <p>
          No new founder awards are offered. This archive is separate from any
          future BD referral programme.
        </p>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Historical founder campaigns and award decisions
            </caption>
            <thead>
              <tr>
                <th>Period / campaign</th>
                <th>Recorded amount</th>
                <th>Founder</th>
                <th>Decision status</th>
                <th>Payment reference</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const award = state.awards.find(
                  (a) => a.campaignId === campaign.id,
                );
                const founder = state.founders.find(
                  (f) => f.id === award?.founderId,
                );
                return (
                  <tr key={campaign.id}>
                    <td>
                      <b>{campaign.period}</b>
                      <small>{campaign.name}</small>
                    </td>
                    <td>{campaign.awardAmount}</td>
                    <td>{founder?.name || "No recorded winner"}</td>
                    <td>{award?.status || campaign.status}</td>
                    <td>
                      {award?.transactionReference || "No reference recorded"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!campaigns.length && (
          <p className="padded muted">No historical campaign records.</p>
        )}
      </section>
    </>
  );
}
