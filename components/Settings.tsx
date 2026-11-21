"use client";
import { useState } from "react";
import { UserPlus, ShieldCheck, Plus, Pencil, Copy, Check } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { ROLES, PERMISSIONS } from "@/lib/catalog";
import { SectionHeading, Status, Avatar, Modal } from "./ui";
import type { Resource } from "./RecordEditor";
export default function Settings({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const { state: s, commit, busy, invitationPath, demo } = useWorkspace(),
    [tab, setTab] = useState("Admins"),
    [group, setGroup] = useState("Sector"),
    [userId, setUser] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const target = s.users.find((u) => u.id === userId);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Admin settings</h1>
        </div>
        <button className="button primary" onClick={() => edit("invitation")}>
          <UserPlus size={16} /> Invite admin
        </button>
      </div>
      <div className="tabs settings-tabs">
        {["Admins", "Options", "Programme", "Activity"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {invitationPath && (
        <div className="notice">
          <div>
            <b>One-time invitation created</b>
            <p>
              Expires in 7 days. Share this privately; no invitation email was
              sent.
            </p>
          </div>
          <button
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  window.location.origin + invitationPath,
                );
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} Copy invitation
          </button>
          <code>{window.location.origin + invitationPath}</code>
        </div>
      )}
      <section className="panel" hidden={tab !== "Admins"}>
        <SectionHeading
          title="Admin access"
          detail={
            demo ? "Fictional admin account" : "Authorised administrators"
          }
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team member</th>
                <th>Role</th>
                <th>Access</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.users
                .filter((u) => u.roleId === "admin")
                .map((u, i) => (
                  <tr key={u.id}>
                    <td>
                      <div className="table-person">
                        <Avatar name={u.name} index={i} />
                        <span>
                          <b>{u.name}</b>
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{ROLES[u.roleId]?.name || u.roleId}</td>
                    <td>{u.permissions.length} permissions</td>
                    <td>
                      <Status value={u.active ? "Active" : "Inactive"} />
                    </td>
                    <td>
                      <button className="button" onClick={() => setUser(u.id)}>
                        <ShieldCheck size={14} /> Permissions
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="two-grid" hidden={tab !== "Programme"}>
        <section className="panel padded">
          <div className="row-between">
            <h2>Programme defaults</h2>
            <button
              className="icon-button"
              aria-label="Edit programme settings"
              onClick={() =>
                edit(
                  "settings",
                  s.settings as unknown as Record<string, unknown>,
                )
              }
            >
              <Pencil size={16} />
            </button>
          </div>
          <dl className="facts">
            <div>
              <dt>Founder-project seats per Space</dt>
              <dd>{s.settings.capacity}</dd>
            </div>
            <div>
              <dt>Monthly founder target</dt>
              <dd>{s.settings.campaignTarget}</dd>
            </div>
            <div>
              <dt>Default award</dt>
              <dd>{s.settings.awardAmount}</dd>
            </div>
            <div>
              <dt>Retention review policy</dt>
              <dd>{s.settings.retentionDays} days</dd>
            </div>
          </dl>
          <p className="form-note">
            Policy settings do not delete records automatically. Review
            retention and privacy requests with the programme administrator.
          </p>
        </section>
        <section className="panel padded">
          <h2>Invitations</h2>
          {s.invitations
            .filter((i) => i.roleId === "admin")
            .map((i) => (
              <div className="compact-note" key={i.id}>
                <b>{i.name}</b>
                <p>
                  {i.email} · {ROLES[i.roleId]?.name}
                </p>
                <Status
                  value={
                    i.acceptedAt
                      ? "Accepted"
                      : new Date(i.expiresAt) < new Date()
                        ? "Expired"
                        : "Pending"
                  }
                />
              </div>
            ))}
          {!s.invitations.length && (
            <p>
              No invitations yet. Invite admins by role; links can be shared
              manually.
            </p>
          )}
        </section>
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
      {target && (
        <PermissionEditor
          key={target.id}
          name={target.name}
          id={target.id}
          permissions={target.permissions}
          active={target.active}
          close={() => setUser(null)}
          save={async (permissions) => {
            const ok = await commit({
              type: "user.permissions",
              payload: {
                id: target.id,
                active: permissions.active,
                permissions: permissions.values,
              },
            });
            if (ok) setUser(null);
          }}
          busy={busy}
        />
      )}
    </>
  );
}
function PermissionEditor({
  name,
  permissions,
  active,
  close,
  save,
  busy,
}: {
  name: string;
  id: string;
  permissions: string[];
  active: boolean;
  close: () => void;
  save: (p: { active: boolean; values: string[] }) => Promise<void>;
  busy: boolean;
}) {
  const [values, setValues] = useState(permissions),
    [enabled, setEnabled] = useState(active);
  return (
    <Modal title={`Permissions · ${name}`} close={close}>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await save({ active: enabled, values });
        }}
      >
        <label className="check-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Account active
        </label>
        <div className="permissions-grid">
          {PERMISSIONS.map((p) => (
            <label className="check-label" key={p}>
              <input
                type="checkbox"
                checked={values.includes(p)}
                onChange={() =>
                  setValues((v) =>
                    v.includes(p) ? v.filter((x) => x !== p) : [...v, p],
                  )
                }
              />
              {p.replaceAll(".", " · ")}
            </label>
          ))}
        </div>
        <button className="button primary" disabled={busy}>
          Save permissions
        </button>
      </form>
    </Modal>
  );
}
