"use client";
import { useState } from "react";
import { Modal } from "./ui";
import { useWorkspace } from "./WorkspaceContext";
import {
  COUNTRIES,
  SECTORS,
  STAGES,
  TEAM_SIZES,
  FUNCTIONS,
  NEEDS,
  RELATIONS,
  OPPORTUNITY_TYPES,
  PIPELINE,
  CONFIDENCE,
  VERIFICATION,
  ROLES,
} from "@/lib/catalog";
interface Option {
  value: string;
  label: string;
}
interface Field {
  name: string;
  label: string;
  type?: string;
  options?: (string | Option)[];
  required?: boolean;
  wide?: boolean;
}
export type Resource =
  | "founder"
  | "company"
  | "session"
  | "need"
  | "relationship"
  | "opportunity"
  | "campaign"
  | "assessment"
  | "award"
  | "taxonomy"
  | "settings"
  | "invitation";
const array = (v: unknown) =>
  Array.isArray(v)
    ? v.map(String)
    : typeof v === "string"
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
export default function RecordEditor({
  resource,
  record,
  close,
}: {
  resource: Resource;
  record?: Record<string, unknown>;
  close: () => void;
}) {
  const { state, viewer, commit, busy } = useWorkspace();
  const now = new Date().toISOString();
  const company = state.companies[0],
    founder = state.founders[0];
  const defaults: Record<Resource, Record<string, unknown>> = {
    founder: {
      name: "",
      role: "Founder",
      xHandle: "",
      contact: "",
      country: "Nigeria",
      relationshipStatus: "New",
      source: "Manual research",
      verification: "Self-reported",
      notes: "",
      followUp: "",
      companyIds: [],
    },
    company: {
      name: "",
      description: "",
      website: "",
      country: "Nigeria",
      operatingCountries: [],
      teamSize: "2–5",
      stage: "MVP",
      sector: "Payments",
      economicFunctions: [],
      customers: [],
      businessModels: [],
      ecosystems: [],
      chains: [],
      integrations: [],
      distribution: [],
      hiringStatus: "Unknown",
      hiringEvidence: "",
      challenges: "",
      founderIds: [],
      labelIds: [],
    },
    session: {
      title: "",
      startsAt: now,
      timezone: "Africa/Lagos",
      host: "Ola_Crrypt",
      capacity: state.settings.capacity,
      deadline: now,
      status: "Scheduled",
      researchStatus: "Not started",
      liveUrl: "",
      recordingUrl: "",
      notes: "",
    },
    need: {
      companyId: company?.id || "",
      kind: "Distribution",
      description: "",
      evidence: "",
      confidence: "Medium",
      verification: "Self-reported",
    },
    relationship: {
      companyAId: company?.id || "",
      companyBId: state.companies[1]?.id || "",
      type: "Potential integration",
      reason: "",
      evidence: "",
      confidence: "Medium",
      verification: "Unverified",
      reviewedAt: now,
    },
    opportunity: {
      companyId: company?.id || "",
      founderId:
        state.memberships.find((m) => m.companyId === company?.id)?.founderId ||
        "",
      needId: state.needs.find((n) => n.companyId === company?.id)?.id || "",
      category: "Consulting",
      solution: "",
      skills: [],
      decisionMaker: founder?.name || "",
      budget: "Unknown",
      evidence: "",
      owner: viewer.name,
      nextAction: "",
      followUpDate: now,
      status: "Discovered",
      outcome: "",
    },
    campaign: {
      name: "",
      period: now.slice(0, 7),
      target: state.settings.campaignTarget,
      awardAmount: state.settings.awardAmount,
      rules: state.settings.terms,
      criteria:
        "Customer problem, evidence of progress, learning and programme contribution. Record reviewer conflicts.",
      status: "Open",
    },
    assessment: {
      campaignId: state.campaigns.at(-1)?.id || "",
      founderId: founder?.id || "",
      eligible: false,
      assessment: "",
    },
    award: {
      campaignId: state.campaigns.at(-1)?.id || "",
      founderId: "",
      rationale: "",
      decisionDate: now,
      status: "Selected",
      transactionReference: "",
    },
    taxonomy: { group: "Sector", name: "", active: true },
    settings: { ...state.settings },
    invitation: { name: "", email: "", roleId: "researcher" },
  };
  const initial = { ...defaults[resource], ...record };
  if (record && resource === "founder")
    initial.companyIds = state.memberships
      .filter((m) => m.founderId === record.id)
      .map((m) => m.companyId);
  if (record && resource === "company") {
    initial.founderIds = state.memberships
      .filter((m) => m.companyId === record.id)
      .map((m) => m.founderId);
    initial.labelIds = state.companyLabels
      .filter((l) => l.companyId === record.id)
      .map((l) => l.labelId);
  }
  const [values, setValues] = useState(initial),
    [error, setError] = useState("");
  const co = state.companies.map((c) => ({ value: c.id, label: c.name })),
    fo = state.founders.map((f) => ({ value: f.id, label: f.name })),
    campaigns = state.campaigns.map((c) => ({ value: c.id, label: c.name }));
  const labelOptions = (group: string, fallback: string[]) => {
    const list = state.labels
      .filter((l) => l.group === group && l.active)
      .map((l) => l.name);
    const fields: Record<string, string> = {
      Sector: "sector",
      "Product stage": "stage",
      "Economic function": "economicFunctions",
      "Customer segment": "customers",
      "Business model": "businessModels",
      "Blockchain ecosystem": "ecosystems",
      "Business needs": "kind",
      "Company relationship": "type",
      "Opportunity type": "category",
    };
    const previous = record?.[fields[group]];
    return Array.from(
      new Set([
        ...(state.labels.some((l) => l.group === group) ? list : fallback),
        ...(Array.isArray(previous)
          ? previous.map(String)
          : previous
            ? [String(previous)]
            : []),
      ]),
    );
  };
  const f = (
    name: string,
    label: string,
    type = "text",
    options?: Field["options"],
    required = true,
    wide = false,
  ): Field => ({ name, label, type, options, required, wide });
  const sections: Record<Resource, Field[]> = {
    founder: [
      f("name", "Founder name"),
      f("role", "Role"),
      f("xHandle", "X username"),
      f("contact", "Email or Telegram", "text", undefined, false),
      f("country", "Country", "country"),
      f("companyIds", "Associated companies", "multi", co, false, true),
      f("relationshipStatus", "Relationship", "select", [
        "New",
        "Contacted",
        "Interviewed",
        "Follow-up",
        "Partner",
        "Inactive",
      ]),
      f("source", "Source"),
      f("verification", "Verification", "select", VERIFICATION),
      f("followUp", "Next follow-up", "textarea", undefined, false, true),
      f("notes", "Internal notes", "textarea", undefined, false, true),
    ],
    company: [
      f("name", "Company name"),
      f("website", "Website", "url"),
      f(
        "description",
        "Product description",
        "textarea",
        undefined,
        true,
        true,
      ),
      f("country", "Headquarters country", "country"),
      f("teamSize", "Team size", "select", TEAM_SIZES),
      f("sector", "Primary sector", "select", labelOptions("Sector", SECTORS)),
      f(
        "stage",
        "Product stage",
        "select",
        labelOptions("Product stage", STAGES),
      ),
      f("founderIds", "Associated founders", "multi", fo, false, true),
      f(
        "labelIds",
        "Additional classification labels",
        "multi",
        state.labels
          .filter((l) => l.active)
          .map((l) => ({ value: l.id, label: `${l.group}: ${l.name}` })),
        false,
        true,
      ),
      f(
        "operatingCountries",
        "Operating countries · comma separated",
        "text",
        undefined,
        false,
        true,
      ),
      f(
        "economicFunctions",
        "Economic functions",
        "multi",
        labelOptions("Economic function", FUNCTIONS),
        false,
      ),
      f(
        "customers",
        "Customer segments",
        "multi",
        labelOptions("Customer segment", ["Consumers", "Developers"]),
        false,
      ),
      f(
        "businessModels",
        "Business models",
        "multi",
        labelOptions("Business model", ["Subscription", "Services"]),
        false,
      ),
      f(
        "ecosystems",
        "Blockchain ecosystems",
        "multi",
        labelOptions("Blockchain ecosystem", [
          "Solana",
          "Ethereum",
          "Base",
          "Multichain",
        ]),
        false,
      ),
      f(
        "chains",
        "Supported chains · comma separated",
        "text",
        undefined,
        false,
      ),
      f(
        "integrations",
        "Current integrations · comma separated",
        "text",
        undefined,
        false,
      ),
      f(
        "distribution",
        "Distribution channels · comma separated",
        "text",
        undefined,
        false,
        true,
      ),
      f("hiringStatus", "Hiring status", "select", [
        "Unknown",
        "Hiring",
        "Not hiring",
      ]),
      f(
        "hiringEvidence",
        "Explicit hiring evidence",
        "textarea",
        undefined,
        false,
        true,
      ),
      f(
        "challenges",
        "Reported business challenges",
        "textarea",
        undefined,
        false,
        true,
      ),
    ],
    session: [
      f("title", "Session title", "text", undefined, true, true),
      f("startsAt", "Session starts · UTC", "datetime-local"),
      f("deadline", "Application deadline · UTC", "datetime-local"),
      f("timezone", "Display timezone · IANA"),
      f("host", "Host"),
      f("capacity", "Founder-project capacity", "number"),
      f("status", "Session status", "select", [
        "Scheduled",
        "Completed",
        "Cancelled",
      ]),
      f("researchStatus", "Research status", "select", [
        "Not started",
        "In progress",
        "Complete",
      ]),
      f("liveUrl", "X Spaces live URL", "url", undefined, false, true),
      f("recordingUrl", "Shared recording URL", "url", undefined, false, true),
      f("notes", "Internal notes", "textarea", undefined, false, true),
    ],
    need: [
      f("companyId", "Company", "select", co),
      f(
        "kind",
        "Business need",
        "select",
        labelOptions("Business needs", NEEDS),
      ),
      f("description", "Identified need", "textarea", undefined, true, true),
      f("evidence", "Source evidence", "textarea", undefined, true, true),
      f("confidence", "Confidence", "select", CONFIDENCE),
      f("verification", "Verification", "select", VERIFICATION),
    ],
    relationship: [
      f("companyAId", "Company A", "select", co),
      f("companyBId", "Company B", "select", co),
      f(
        "type",
        "Relationship type",
        "select",
        labelOptions("Company relationship", RELATIONS),
      ),
      f("confidence", "Confidence", "select", CONFIDENCE),
      f("reason", "Reason", "textarea", undefined, true, true),
      f("evidence", "Evidence", "textarea", undefined, true, true),
      f("verification", "Verification", "select", VERIFICATION),
      f("reviewedAt", "Last reviewed · UTC", "datetime-local"),
    ],
    opportunity: [
      f("companyId", "Company", "select", co),
      f(
        "founderId",
        "Related founder",
        "select",
        fo.filter((f) =>
          state.memberships.some(
            (m) => m.companyId === values.companyId && m.founderId === f.value,
          ),
        ),
      ),
      f(
        "needId",
        "Documented business need",
        "select",
        state.needs
          .filter((n) => n.companyId === values.companyId)
          .map((n) => ({
            value: n.id,
            label: `${n.kind}: ${n.description.slice(0, 65)}`,
          })),
        true,
        true,
      ),
      f(
        "category",
        "Opportunity type",
        "select",
        labelOptions("Opportunity type", OPPORTUNITY_TYPES),
      ),
      f("status", "Pipeline status", "select", PIPELINE),
      f("solution", "Potential solution", "textarea", undefined, true, true),
      f(
        "skills",
        "Relevant skills · comma separated",
        "text",
        undefined,
        false,
        true,
      ),
      f("decisionMaker", "Decision-maker"),
      f("budget", "Budget or unknown"),
      f("evidence", "Evidence", "textarea", undefined, true, true),
      f("owner", "Opportunity owner"),
      f("followUpDate", "Follow-up date · UTC", "datetime-local"),
      f("nextAction", "Next action", "textarea", undefined, true, true),
      f("outcome", "Outcome", "textarea", undefined, false, true),
    ],
    campaign: [
      f("name", "Campaign name"),
      f("period", "Campaign month", "month"),
      f("target", "Founder target", "number"),
      f("awardAmount", "Award amount"),
      f("status", "Campaign status", "select", ["Open", "Reviewing", "Closed"]),
      f("rules", "Published rules", "textarea", undefined, true, true),
      f("criteria", "Selection criteria", "textarea", undefined, true, true),
    ],
    assessment: [
      f("campaignId", "Campaign", "select", campaigns),
      f("founderId", "Founder", "select", fo),
      f(
        "eligible",
        "Eligible under published rules",
        "checkbox",
        undefined,
        false,
        true,
      ),
      f(
        "assessment",
        "Reviewer assessment and any conflicts",
        "textarea",
        undefined,
        true,
        true,
      ),
    ],
    award: [
      f("campaignId", "Campaign", "select", campaigns),
      f(
        "founderId",
        "Eligible founder",
        "select",
        fo.filter((f) =>
          state.campaignParticipants.some(
            (p) =>
              p.campaignId === values.campaignId &&
              p.founderId === f.value &&
              p.eligible,
          ),
        ),
      ),
      f(
        "rationale",
        "Human selection rationale and conflicts",
        "textarea",
        undefined,
        true,
        true,
      ),
      f("decisionDate", "Decision date · UTC", "datetime-local"),
      f("status", "Award status", "select", [
        "Selected",
        "Transfer pending",
        "Transferred",
        "Cancelled",
      ]),
      f(
        "transactionReference",
        "Transfer reference · only if independently transferred",
        "text",
        undefined,
        false,
        true,
      ),
    ],
    taxonomy: [
      f("group", "Classification group", "select", [
        "Sector",
        "Economic function",
        "Customer segment",
        "Business model",
        "Product stage",
        "Geographic market",
        "Blockchain ecosystem",
        "Business needs",
        "Company relationship",
        "Opportunity type",
      ]),
      f("name", "Label name"),
      f("active", "Active label", "checkbox", undefined, false),
    ],
    settings: [
      f(
        "countryOptions",
        "Enabled application countries",
        "multi",
        COUNTRIES,
        true,
        true,
      ),
      f("capacity", "Default project seats per Space", "number"),
      f("retentionDays", "Privacy retention policy · days", "number"),
      f("campaignTarget", "Monthly founder target", "number"),
      f("awardAmount", "Default award amount"),
      f(
        "terms",
        "Published programme terms",
        "textarea",
        undefined,
        true,
        true,
      ),
    ],
    invitation: [
      f("name", "Collaborator name"),
      f("email", "Email address", "email"),
      f(
        "roleId",
        "Role",
        "select",
        Object.entries(ROLES).map(([value, r]) => ({ value, label: r.name })),
      ),
    ],
  };
  const verbs: Record<Resource, string> = {
    founder: "founder.save",
    company: "company.save",
    session: "session.save",
    need: "need.save",
    relationship: "relationship.save",
    opportunity: "opportunity.save",
    campaign: "campaign.save",
    assessment: "campaign.assess",
    award: "award.save",
    taxonomy: "taxonomy.save",
    settings: "settings.save",
    invitation: "invite.create",
  };
  const change = (name: string, value: unknown) =>
    setValues((v) => ({
      ...v,
      [name]: value,
      ...(resource === "opportunity" && name === "companyId"
        ? { founderId: "", needId: "" }
        : {}),
    }));
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${resource === "assessment" ? "reviewer assessment" : resource === "settings" ? "programme settings" : resource}`}
      close={close}
      wide
    >
      <form
        className="record-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const data = { ...values };
          for (const field of sections[resource])
            if (field.type === "datetime-local" && data[field.name]) {
              const raw = String(data[field.name]);
              data[field.name] = raw.endsWith("Z")
                ? raw
                : new Date(
                    raw + (raw.length === 16 ? ":00Z" : "Z"),
                  ).toISOString();
            }
          const ok = await commit({ type: verbs[resource], payload: data });
          if (ok) close();
          else
            setError(
              "Could not save. Review the notification and check the fields below.",
            );
        }}
      >
        {resource === "session" && (
          <p className="form-note span-2">
            Paste the recording once here. Every connected founder and company
            will inherit this session link.
          </p>
        )}
        {resource === "taxonomy" && record && (
          <p className="form-note span-2">
            Preserve an existing label’s meaning. Archive it and add a new label
            to change the name or group.
          </p>
        )}
        {resource === "award" && (
          <p className="form-note span-2">
            This records a human decision. No cryptocurrency payment is
            initiated.
          </p>
        )}
        {sections[resource].map((field) => {
          let value = values[field.name];
          if (field.type === "datetime-local" && value)
            value = new Date(String(value)).toISOString().slice(0, 16);
          if (Array.isArray(value) && field.type !== "multi")
            value = value.join(", ");
          return (
            <label
              className={`${field.wide ? "span-2" : ""} ${field.type === "checkbox" ? "check-label" : ""}`}
              key={field.name}
            >
              {field.type !== "checkbox" && (
                <span>
                  {field.label}
                  {!field.required && field.type !== "multi"
                    ? " · optional"
                    : ""}
                </span>
              )}
              {field.type === "textarea" ? (
                <textarea
                  aria-label={field.label}
                  rows={3}
                  maxLength={5000}
                  required={field.required}
                  value={String(value || "")}
                  onChange={(e) => change(field.name, e.target.value)}
                />
              ) : field.type === "select" || field.type === "multi" ? (
                <select
                  aria-label={field.label}
                  disabled={
                    resource === "taxonomy" &&
                    Boolean(record) &&
                    field.name === "group"
                  }
                  multiple={field.type === "multi"}
                  required={field.required}
                  value={
                    field.type === "multi" ? array(value) : String(value || "")
                  }
                  onChange={(e) =>
                    change(
                      field.name,
                      field.type === "multi"
                        ? Array.from(e.target.selectedOptions).map(
                            (o) => o.value,
                          )
                        : e.target.value,
                    )
                  }
                >
                  {field.type !== "multi" && <option value="">Select…</option>}
                  {field.options?.map((option) => {
                    const o =
                      typeof option === "string"
                        ? { value: option, label: option }
                        : option;
                    return (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    );
                  })}
                </select>
              ) : field.type === "checkbox" ? (
                <>
                  <input
                    aria-label={field.label}
                    readOnly={
                      resource === "taxonomy" &&
                      Boolean(record) &&
                      field.name === "name"
                    }
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => change(field.name, e.target.checked)}
                  />
                  <span>{field.label}</span>
                </>
              ) : (
                <>
                  <input
                    aria-label={field.label}
                    readOnly={
                      resource === "taxonomy" &&
                      Boolean(record) &&
                      field.name === "name"
                    }
                    type={
                      field.type === "country" ? "text" : field.type || "text"
                    }
                    list={
                      field.type === "country"
                        ? `countries-${resource}`
                        : undefined
                    }
                    required={field.required}
                    value={String(value ?? "")}
                    maxLength={field.type === "number" ? undefined : 2000}
                    min={field.type === "number" ? 1 : undefined}
                    onChange={(e) => change(field.name, e.target.value)}
                  />
                  {field.type === "country" && (
                    <datalist id={`countries-${resource}`}>
                      {COUNTRIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </datalist>
                  )}
                </>
              )}
            </label>
          );
        })}
        {error && (
          <p role="alert" className="error span-2">
            {error}
          </p>
        )}
        <div className="form-actions span-2">
          <button type="button" className="button" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
