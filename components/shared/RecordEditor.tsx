"use client";
import { useState } from "react";
import { Modal } from "@/components/ui";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { COUNTRIES, SECTORS, STAGES, TEAM_SIZES } from "@/lib/catalog";
import { utcInputValue, utcInputToIso } from "@/lib/dates/utc-input";
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
  "founder" | "company" | "session" | "taxonomy" | "settings";
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
  const { state, commit, busy, fieldErrors } = useWorkspace();
  const now = new Date().toISOString();
  const defaults: Record<Resource, Record<string, unknown>> = {
    founder: {
      name: "",
      role: "Founder",
      xHandle: "",
      contact: "",
      country: "Nigeria",
      relationshipStatus: "New",
      source: "Manual entry",
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
      title: "Founders Lab with ⭕️La_Crrypt💰₿",
      startsAt: now,
      timezone: "UTC",
      host: "⭕️La_Crrypt💰₿",
      capacity: state.settings.capacity,
      deadline: now,
      status: "Scheduled",
      researchStatus: "Not started",
      liveUrl: "",
      recordingUrl: "",
      postUrl: "",
      notes: "",
    },
    taxonomy: { group: "Sector", name: "", active: true },
    settings: { ...state.settings },
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
    fo = state.founders.map((f) => ({ value: f.id, label: f.name }));
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
      f("liveUrl", "X Spaces live URL", "url", undefined, false, true),
      f("postUrl", "Shared X post URL", "url", undefined, false, true),
      f("recordingUrl", "Shared recording URL", "url", undefined, false, true),
      f("notes", "Internal notes", "textarea", undefined, false, true),
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
      f(
        "terms",
        "Historical programme terms (current public policy is maintained separately)",
        "textarea",
        undefined,
        true,
        true,
      ),
    ],
  };
  const verbs: Record<Resource, string> = {
    founder: "founder.save",
    company: "company.save",
    session: "session.save",
    taxonomy: "taxonomy.save",
    settings: "settings.save",
  };
  const change = (name: string, value: unknown) =>
    setValues((v) => ({
      ...v,
      [name]: value,
    }));
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${resource === "settings" ? "programme settings" : resource}`}
      close={close}
      wide
      guardUnsaved
      className="record-editor"
    >
      <form
        className="record-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const data = { ...values };
          for (const field of sections[resource])
            if (field.type === "datetime-local" && data[field.name]) {
              data[field.name] = utcInputToIso(String(data[field.name]));
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
            Enter dates in UTC. London programme time and your local time are
            shown below. Recording links are shared with connected founder and
            company records.
          </p>
        )}
        {resource === "session" && Boolean(values.startsAt) && (
          <div className="time-preview span-2">
            <span>
              <b>London programme time</b>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/London",
              }).format(new Date(utcInputToIso(String(values.startsAt))))}
            </span>
            <span>
              <b>Your local time</b>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(utcInputToIso(String(values.startsAt))))}
            </span>
          </div>
        )}
        {resource === "taxonomy" && record && (
          <p className="form-note span-2">
            Preserve an existing label’s meaning. Archive it and add a new label
            to change the name or group.
          </p>
        )}
        {sections[resource].map((field) => {
          let value = values[field.name];
          if (field.type === "datetime-local" && value)
            value = utcInputValue(String(value));
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
              {fieldErrors[field.name] && (
                <span
                  className="field-error"
                  role="alert"
                  id={`${resource}-${field.name}-error`}
                >
                  {fieldErrors[field.name]}
                </span>
              )}
              {field.type === "textarea" ? (
                <textarea
                  aria-label={field.label}
                  aria-invalid={Boolean(fieldErrors[field.name])}
                  aria-describedby={
                    fieldErrors[field.name]
                      ? `${resource}-${field.name}-error`
                      : undefined
                  }
                  rows={3}
                  maxLength={5000}
                  required={field.required}
                  value={String(value || "")}
                  onChange={(e) => change(field.name, e.target.value)}
                />
              ) : field.type === "select" || field.type === "multi" ? (
                <select
                  aria-label={field.label}
                  aria-invalid={Boolean(fieldErrors[field.name])}
                  aria-describedby={
                    fieldErrors[field.name]
                      ? `${resource}-${field.name}-error`
                      : undefined
                  }
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
                    aria-invalid={Boolean(fieldErrors[field.name])}
                    aria-describedby={
                      fieldErrors[field.name]
                        ? `${resource}-${field.name}-error`
                        : undefined
                    }
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
                    aria-invalid={Boolean(fieldErrors[field.name])}
                    aria-describedby={
                      fieldErrors[field.name]
                        ? `${resource}-${field.name}-error`
                        : undefined
                    }
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
          <button
            type="button"
            className="button"
            onClick={() => {
              const button = document.querySelector(
                ".record-editor .modal-heading button",
              ) as HTMLButtonElement | null;
              button?.click();
            }}
          >
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
