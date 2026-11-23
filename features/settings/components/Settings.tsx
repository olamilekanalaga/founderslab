"use client";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { SectionHeading, Status } from "@/components/ui";
import type { Resource } from "@/components/shared/RecordEditor";
export default function Settings({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const { state: s } = useWorkspace();
  const [tab, setTab] = useState("Options");
  const [group, setGroup] = useState("Sector");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Admin settings</h1>
        </div>
      </div>
      <div className="tabs settings-tabs">
        {["Options", "Activity"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <section className="panel" hidden={tab !== "Options"}>
        <SectionHeading
          title="Company options"
          detail="Manage sector and product stage choices."
          action={
            <button
              className="button"
              onClick={() => edit("taxonomy", { group })}
            >
              <Plus size={14} /> Add label
            </button>
          }
        />
        <div className="filter-bar inset">
          <label>
            Taxonomy group
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {["Sector", "Product stage"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <span className="muted">
            Country inputs support every ISO country, including countries
            outside Africa.
          </span>
        </div>
        <div className="taxonomy-grid">
          {s.labels
            .filter((l) => l.group === group)
            .map((l) => (
              <button
                key={l.id}
                onClick={() =>
                  edit("taxonomy", l as unknown as Record<string, unknown>)
                }
              >
                <span>{l.name}</span>
                <Status value={l.active ? "Active" : "Inactive"} />
                <Pencil size={13} />
              </button>
            ))}
        </div>
      </section>
      <section className="panel" hidden={tab !== "Activity"}>
        <SectionHeading
          title="Recent audit trail"
          detail="Changes retain actor, action and timestamp."
        />
        <div className="audit-list">
          {[...s.audit]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 20)
            .map((a) => (
              <div key={a.id}>
                <b>{a.actor}</b>
                <span>{a.action}</span>
                <small>{a.createdAt.replace("T", " ").slice(0, 16)} UTC</small>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
