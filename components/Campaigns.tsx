"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Award, Pencil, CheckCircle2, Users } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { SectionHeading, Avatar, Status, Empty } from "./ui";
import type { Resource } from "./RecordEditor";
export default function Campaigns({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const { state: s, viewer, path } = useWorkspace(),
    [selected, setSelected] = useState(s.campaigns.at(-1)?.id || "");
  const campaign = s.campaigns.find((c) => c.id === selected),
    members = s.campaignParticipants.filter((p) => p.campaignId === selected),
    award = s.awards.find((a) => a.campaignId === selected),
    can = viewer.permissions.includes("campaign.write");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Campaigns & awards</h1>
        </div>
        {can && (
          <button className="button primary" onClick={() => edit("campaign")}>
            <Plus size={16} /> New campaign
          </button>
        )}
      </div>
      <div className="campaign-layout">
        <div className="campaign-choice-grid">
          {s.campaigns.map((c) => (
            <button
              key={c.id}
              className={`panel campaign-choice ${c.id === selected ? "selected" : ""}`}
              onClick={() => setSelected(c.id)}
            >
              <div className="row-between">
                <span className="tag">{c.period}</span>
                <Status value={c.status} />
              </div>
              <h2>{c.name}</h2>
              <p>
                {
                  s.campaignParticipants.filter((p) => p.campaignId === c.id)
                    .length
                }{" "}
                / {c.target} founders · {c.awardAmount} award
              </p>
            </button>
          ))}
        </div>
        {campaign ? (
          <div className="campaign-body">
            <section className="panel">
              <SectionHeading
                title={campaign.name}
                detail={`${campaign.period} · monthly cadence`}
                action={
                  can ? (
                    <button
                      className="button"
                      onClick={() =>
                        edit(
                          "campaign",
                          campaign as unknown as Record<string, unknown>,
                        )
                      }
                    >
                      <Pencil size={14} /> Edit campaign
                    </button>
                  ) : null
                }
              />
              <div className="campaign-overview">
                <div>
                  <Users size={22} />
                  <strong>
                    {members.length}
                    <small> / {campaign.target}</small>
                  </strong>
                  <p>Participating founders</p>
                </div>
                <div>
                  <CheckCircle2 size={22} />
                  <strong>{members.filter((p) => p.eligible).length}</strong>
                  <p>Eligible after review</p>
                </div>
                <div>
                  <Award size={22} />
                  <strong>{campaign.awardAmount}</strong>
                  <p>One founder · no automatic payment</p>
                </div>
              </div>
              <div className="two-grid campaign-rules">
                <div>
                  <h3>Published rules</h3>
                  <p>{campaign.rules}</p>
                </div>
                <div>
                  <h3>Selection criteria</h3>
                  <p>{campaign.criteria}</p>
                </div>
              </div>
            </section>
            <section className="panel">
              <SectionHeading
                title="Founder eligibility & assessments"
                action={
                  can ? (
                    <button
                      className="button"
                      onClick={() =>
                        edit("assessment", { campaignId: selected })
                      }
                    >
                      Add / update assessment
                    </button>
                  ) : null
                }
              />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Founder</th>
                      <th>Eligibility</th>
                      <th>Reviewer assessment</th>
                      <th>Reviewer</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((p, i) => {
                      const f = s.founders.find((f) => f.id === p.founderId);
                      return (
                        <tr key={p.founderId}>
                          <td>
                            <Link
                              className="table-person"
                              href={path("founders", p.founderId)}
                            >
                              <Avatar name={f?.name || "Founder"} index={i} />
                              <b>{f?.name}</b>
                            </Link>
                          </td>
                          <td>
                            <Status
                              value={
                                p.eligible ? "Eligible" : "Not yet eligible"
                              }
                            />
                          </td>
                          <td className="wrap-cell">
                            {p.assessment || "Not assessed"}
                          </td>
                          <td>{p.reviewer || "Unassigned"}</td>
                          <td>
                            {can && (
                              <button
                                className="icon-button"
                                aria-label={`Assess ${f?.name}`}
                                onClick={() =>
                                  edit(
                                    "assessment",
                                    p as unknown as Record<string, unknown>,
                                  )
                                }
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!members.length && (
                  <Empty>Add founders through an eligibility assessment.</Empty>
                )}
              </div>
            </section>
            <section className="panel padded">
              <div className="row-between">
                <h2>Award decision</h2>
                {can && (
                  <button
                    className="button primary"
                    onClick={() =>
                      edit(
                        "award",
                        award
                          ? (award as unknown as Record<string, unknown>)
                          : { campaignId: selected },
                      )
                    }
                  >
                    {award ? "Update award record" : "Record human decision"}
                  </button>
                )}
              </div>
              {award ? (
                <>
                  <div className="award-winner">
                    <Award size={34} />
                    <div>
                      <b>
                        {s.founders.find((f) => f.id === award.founderId)?.name}
                      </b>
                      <p>
                        {campaign.awardAmount} · decision{" "}
                        {award.decisionDate.slice(0, 10)}
                      </p>
                    </div>
                    <Status value={award.status} />
                  </div>
                  <p>{award.rationale}</p>
                  <small>
                    Reviewed by {award.reviewer}. Transfer reference:{" "}
                    {award.transactionReference ||
                      "Not recorded; no transfer is claimed."}
                  </small>
                </>
              ) : (
                <p>
                  No winner selected. A founder must be eligible and assessed
                  before a decision can be recorded.
                </p>
              )}
            </section>
          </div>
        ) : (
          <Empty>Create a campaign to start a monthly cohort.</Empty>
        )}
      </div>
    </>
  );
}
