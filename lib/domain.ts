import { publicSlotOpen } from "./booking";
import type { Command, DataState, Viewer } from "./types";
import { actionPermission, RESEARCH_SECTIONS, ROLES } from "./catalog";
import { schemas, applicationSchema, normaliseKey } from "./validation";
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new DomainError(message);
}
export function approvedSeats(s: DataState, sessionId: string) {
  return new Set(
    s.participants
      .filter((p) => p.sessionId === sessionId && p.attendance !== "Cancelled")
      .map((p) => p.companyId),
  ).size;
}
export function founderSessions(s: DataState, founderId: string) {
  return s.participants
    .filter((p) => p.founderId === founderId && p.attendance !== "Cancelled")
    .map((p) => ({
      participation: p,
      session: s.sessions.find((v) => v.id === p.sessionId)!,
    }));
}
export function companySessions(s: DataState, companyId: string) {
  return s.participants
    .filter((p) => p.companyId === companyId && p.attendance !== "Cancelled")
    .map((p) => s.sessions.find((v) => v.id === p.sessionId)!)
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
}
export function scopeState(s: DataState, permissions: string[]): DataState {
  const copy = structuredClone(s),
    has = (p: string) => permissions.includes(p);
  if (!has("directory.read")) {
    copy.founders = [];
    copy.companies = [];
    copy.memberships = [];
    copy.companyLabels = [];
  }
  if (
    !has("directory.write") &&
    !has("booking.write") &&
    !has("research.write")
  )
    copy.founders = copy.founders.map((f) => ({ ...f, contact: "" }));
  if (!has("booking.read")) {
    copy.spaceData = [];
    copy.spaceAttendance = [];
    copy.applications = [];
    copy.bookings = [];
    if (has("research.read")) {
      copy.participants = copy.participants.filter((p) =>
        copy.research.some(
          (r) =>
            r.sessionId === p.sessionId &&
            r.founderId === p.founderId &&
            r.companyId === p.companyId,
        ),
      );
      copy.sessions = copy.sessions
        .filter((v) => copy.research.some((r) => r.sessionId === v.id))
        .map((v) => ({ ...v, notes: "" }));
    } else {
      copy.participants = [];
      copy.sessions = [];
    }
  }
  if (!has("research.read")) {
    copy.research = [];
    copy.answers = [];
    copy.relationships = [];
    copy.needs = [];
  }
  if (!has("commercial.read")) {
    copy.opportunities = [];
    copy.activities = [];
  }
  if (!has("campaign.read")) {
    copy.campaigns = [];
    copy.campaignParticipants = [];
    copy.awards = [];
  }
  if (!has("team.manage")) {
    copy.users = [];
    copy.invitations = [];
    copy.audit = [];
  }
  return copy;
}
/** Calendar-first public demo submission: persist both records together or neither. */
export function createLocalBookingApplication(
  state: DataState,
  input: unknown,
  sessionId: string,
  now = new Date().toISOString(),
): DataState {
  const session = state.sessions.find((s) => s.id === sessionId);
  check(
    session &&
      publicSlotOpen(
        session,
        session.capacity - approvedSeats(state, sessionId),
        Date.parse(now),
      ),
    "This Saturday is no longer available. Please choose another date.",
  );
  const next = createLocalApplication(state, input, now);
  const application = next.applications.at(-1)!;
  return applyCommand(
    next,
    {
      type: "booking.create",
      payload: {
        applicationId: application.id,
        sessionId,
        speakers: application.speakers,
      },
    },
    demoViewer(),
    now,
  );
}
export function createLocalApplication(
  state: DataState,
  input: unknown,
  now = new Date().toISOString(),
): DataState {
  const p = applicationSchema.parse(input),
    s = structuredClone(state);
  check(
    !s.applications.some(
      (a) =>
        normaliseKey(a.xHandle, a.companyName) ===
        normaliseKey(p.xHandle, p.companyName),
    ),
    "An application for this founder and project already exists. Use your saved confirmation link.",
  );
  check(
    (s.settings.countryOptions || []).includes(p.country),
    "Select a country enabled for this programme.",
  );
  check(
    s.labels.some(
      (l) => l.group === "Sector" && l.name === p.sector && l.active,
    ) &&
      s.labels.some(
        (l) => l.group === "Product stage" && l.name === p.stage && l.active,
      ),
    "Select an active sector and product stage.",
  );
  const id = crypto.randomUUID();
  const { websiteTrap: ignored, ...data } = p;
  void ignored;
  s.applications.push({
    ...data,
    id,
    reference: `FL-${id.slice(0, 8).toUpperCase()}`,
    status: "Pending",
    founderId: null,
    companyId: null,
    createdAt: now,
    updatedAt: now,
  });
  return s;
}
export function applyCommand(
  state: DataState,
  command: Command,
  actor: Viewer,
  now = new Date().toISOString(),
): DataState {
  if (actor.roleId !== "admin")
    throw new DomainError("You need admin permission for this action.", 403);
  const permission = actionPermission(command.type);
  if (!permission || !actor.permissions.includes(permission))
    throw new DomainError("You do not have permission for this action.", 403);
  const s = structuredClone(state),
    p = command.payload;
  let entityId = "settings";
  const put = <T extends { id: string }>(rows: T[], row: T) => {
    const i = rows.findIndex((r) => r.id === row.id);
    if (i < 0) rows.push(row);
    else rows[i] = row;
    entityId = row.id;
  };
  const makeId = (id?: string) => id || crypto.randomUUID();
  switch (command.type) {
    case "founder.save": {
      const v = schemas["founder.save"].parse(p),
        id = makeId(v.id),
        old = s.founders.find((f) => f.id === id);
      check(
        !s.founders.some((f) => f.xHandle === v.xHandle && f.id !== id),
        "This X identity is already recorded.",
      );
      v.companyIds.forEach((c) =>
        check(
          s.companies.some((v) => v.id === c),
          "Company not found",
        ),
      );
      const { companyIds, ...data } = v;
      put(s.founders, {
        ...data,
        id,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      s.memberships = s.memberships.filter((m) => m.founderId !== id);
      companyIds.forEach((companyId) =>
        s.memberships.push({
          founderId: id,
          companyId,
          role: v.role,
          createdAt: now,
        }),
      );
      break;
    }
    case "company.save": {
      const v = schemas["company.save"].parse(p),
        id = makeId(v.id),
        old = s.companies.find((c) => c.id === id);
      v.founderIds.forEach((f) =>
        check(
          s.founders.some((v) => v.id === f),
          "Founder not found",
        ),
      );
      v.labelIds.forEach((l) =>
        check(
          s.labels.some(
            (v) =>
              v.id === l &&
              (v.active ||
                s.companyLabels.some(
                  (existing) =>
                    existing.companyId === id && existing.labelId === l,
                )),
          ),
          "Classification label not found",
        ),
      );
      check(
        s.labels.some(
          (l) =>
            l.group === "Sector" &&
            l.name === v.sector &&
            (l.active || old?.sector === v.sector),
        ),
        "Select an active sector.",
      );
      check(
        s.labels.some(
          (l) =>
            l.group === "Product stage" &&
            l.name === v.stage &&
            (l.active || old?.stage === v.stage),
        ),
        "Select an active product stage.",
      );
      const { founderIds, labelIds, ...data } = v;
      put(s.companies, {
        ...data,
        id,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      s.memberships = s.memberships.filter((m) => m.companyId !== id);
      founderIds.forEach((founderId) =>
        s.memberships.push({
          founderId,
          companyId: id,
          role: "Founder",
          createdAt: now,
        }),
      );
      s.companyLabels = s.companyLabels.filter((l) => l.companyId !== id);
      labelIds.forEach((labelId) =>
        s.companyLabels.push({ companyId: id, labelId }),
      );
      break;
    }
    case "application.review": {
      const v = schemas["application.review"].parse(p),
        a = s.applications.find((a) => a.id === v.id);
      check(a, "Application not found");
      if (a.status === "Approved" && v.status !== "Approved")
        check(
          !s.bookings.some(
            (b) =>
              b.applicationId === a.id &&
              ["Approved", "Attended", "No-show"].includes(b.status),
          ),
          "Cancel approved bookings before declining this application.",
        );
      a.status = v.status;
      a.updatedAt = now;
      entityId = a.id;
      if (v.status === "Approved") {
        let f =
          s.founders.find((f) => f.id === a.founderId) ||
          s.founders.find((f) => f.xHandle === a.xHandle);
        if (!f) {
          f = {
            id: crypto.randomUUID(),
            name: a.founderName,
            role: a.founderRole,
            xHandle: a.xHandle,
            contact: a.contact,
            country: a.country,
            relationshipStatus: "New",
            source: `Application ${a.reference}`,
            verification: "Self-reported",
            notes: "",
            followUp: "Assign an interview session",
            createdAt: now,
            updatedAt: now,
          };
          s.founders.push(f);
        }
        let c = s.companies.find((c) => c.id === a.companyId);
        if (!c) {
          c = {
            id: crypto.randomUUID(),
            name: a.companyName,
            description: a.description,
            website: a.website,
            country: a.country,
            operatingCountries: [a.country],
            teamSize: a.teamSize,
            stage: a.stage,
            sector: a.sector,
            economicFunctions: [],
            customers: [],
            businessModels: [],
            ecosystems: a.ecosystem ? [a.ecosystem] : [],
            chains: [],
            integrations: [],
            distribution: [],
            hiringStatus: a.hiring ? "Hiring" : "Unknown",
            hiringEvidence: a.hiring
              ? `Explicit application response ${a.reference}: actively hiring.`
              : "",
            challenges: a.seeking,
            createdAt: now,
            updatedAt: now,
          };
          s.companies.push(c);
        }
        a.founderId = f.id;
        a.companyId = c.id;
        if (
          !s.memberships.some(
            (m) => m.founderId === f.id && m.companyId === c.id,
          )
        )
          s.memberships.push({
            founderId: f.id,
            companyId: c.id,
            role: a.founderRole,
            createdAt: now,
          });
      }
      break;
    }
    case "space-data.save": {
      const v = schemas["space-data.save"].parse(p);
      check(
        s.sessions.some((session) => session.id === v.sessionId),
        "Space not found",
      );
      check(
        new Set(v.teams.map((t) => t.companyId)).size === v.teams.length,
        "Add each project only once per Space.",
      );
      v.teams.forEach((team) =>
        check(
          s.companies.some((c) => c.id === team.companyId),
          "Project not found",
        ),
      );
      s.spaceData ||= [];
      s.spaceAttendance ||= [];
      const old = s.spaceData.find((row) => row.sessionId === v.sessionId),
        id = old?.id || crypto.randomUUID();
      put(s.spaceData, {
        id,
        sessionId: v.sessionId,
        liveListeners: v.liveListeners,
        durationMinutes: v.durationMinutes,
        notes: v.notes,
        recordedBy: actor.name,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      const previous = s.spaceAttendance.filter(
        (row) => row.spaceDataId === id,
      );
      s.spaceAttendance = s.spaceAttendance.filter(
        (row) => row.spaceDataId !== id,
      );
      v.teams.forEach((team) =>
        s.spaceAttendance.push({
          id:
            previous.find((row) => row.companyId === team.companyId)?.id ||
            crypto.randomUUID(),
          spaceDataId: id,
          ...team,
        }),
      );
      entityId = id;
      break;
    }
    case "session.save": {
      const v = schemas["session.save"].parse(p),
        id = makeId(v.id),
        old = s.sessions.find((v) => v.id === id);
      check(
        v.capacity >= approvedSeats(s, id),
        "Capacity cannot be below approved project seats.",
      );
      put(s.sessions, {
        ...v,
        id,
        startsAt: new Date(v.startsAt).toISOString(),
        deadline: new Date(v.deadline).toISOString(),
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      break;
    }
    case "booking.create": {
      const v = schemas["booking.create"].parse(p),
        session = s.sessions.find((x) => x.id === v.sessionId);
      check(session, "Session not found");
      check(
        s.applications.some((a) => a.id === v.applicationId),
        "Application not found",
      );
      check(
        session.status === "Scheduled",
        "This session is not open for requests",
      );
      check(
        !s.bookings.some(
          (b) =>
            b.sessionId === v.sessionId && b.applicationId === v.applicationId,
        ),
        "A booking request already exists for this application and session",
      );
      put(s.bookings, {
        ...v,
        id: crypto.randomUUID(),
        status: "Pending",
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case "booking.review": {
      const v = schemas["booking.review"].parse(p),
        b = s.bookings.find((b) => b.id === v.id);
      check(b, "Booking not found");
      const a = s.applications.find((a) => a.id === b.applicationId),
        session = s.sessions.find((v) => v.id === b.sessionId);
      check(a && session, "Application or session missing");
      if (["Approved", "Attended", "No-show"].includes(v.status)) {
        check(
          a.status === "Approved" && a.founderId && a.companyId,
          "Approve the founder application first",
        );
        check(session.status !== "Cancelled", "The session is cancelled");
        const same = s.participants.some(
          (p) =>
            p.sessionId === b.sessionId &&
            p.companyId === a.companyId &&
            p.attendance !== "Cancelled",
        );
        check(
          same || approvedSeats(s, session.id) < session.capacity,
          "Session is full. Waitlist this project or choose another session.",
        );
        const existing = s.participants.find(
          (p) =>
            p.sessionId === b.sessionId &&
            p.founderId === a.founderId &&
            p.companyId === a.companyId,
        );
        put(s.participants, {
          id: existing?.id || crypto.randomUUID(),
          sessionId: b.sessionId,
          founderId: a.founderId,
          companyId: a.companyId,
          speakers: b.speakers,
          attendance: v.status,
          createdAt: existing?.createdAt || now,
        });
      } else
        s.participants = s.participants.map((p) =>
          p.sessionId === b.sessionId &&
          p.founderId === a.founderId &&
          p.companyId === a.companyId
            ? { ...p, attendance: "Cancelled" }
            : p,
        );
      b.status = v.status;
      b.updatedAt = now;
      entityId = b.id;
      break;
    }
    case "research.save": {
      const v = schemas["research.save"].parse(p);
      check(
        s.participants.some(
          (p) =>
            p.founderId === v.founderId &&
            p.companyId === v.companyId &&
            p.sessionId === v.sessionId &&
            p.attendance !== "Cancelled",
        ),
        "Research must belong to a recorded session participation",
      );
      if (v.status === "Complete")
        check(
          RESEARCH_SECTIONS.every((k) => v.answers[k]?.trim()),
          "Complete every research section before marking complete",
        );
      if (v.visibility === "Public")
        check(
          actor.permissions.includes("team.manage") &&
            ["Verified", "Evidence reviewed"].includes(v.verification),
          "An admin must review evidence before publishing research",
        );
      const duplicate = s.research.find(
        (r) =>
          r.founderId === v.founderId &&
          r.companyId === v.companyId &&
          r.sessionId === v.sessionId,
      );
      const id = v.id || duplicate?.id || crypto.randomUUID(),
        old = s.research.find((r) => r.id === id);
      const { answers, classifications, ...data } = v;
      put(s.research, {
        ...data,
        id,
        researcher: actor.name,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      s.answers = s.answers.filter((a) => a.researchId !== id);
      RESEARCH_SECTIONS.forEach((section) =>
        s.answers.push({
          id: crypto.randomUUID(),
          researchId: id,
          section,
          response: answers[section] || "",
          classification: classifications[section] || "",
        }),
      );
      break;
    }
    case "need.save": {
      const v = schemas["need.save"].parse(p);
      check(
        s.labels.some(
          (l) =>
            l.group === "Business needs" &&
            l.name === v.kind &&
            (l.active ||
              s.needs.some((old) => old.id === v.id && old.kind === v.kind)),
        ),
        "Choose an active business needs label",
      );
      check(
        s.companies.some((c) => c.id === v.companyId),
        "Company not found",
      );
      const id = makeId(v.id),
        old = s.needs.find((n) => n.id === id);
      put(s.needs, {
        ...v,
        id,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      break;
    }
    case "relationship.save": {
      const v = schemas["relationship.save"].parse(p);
      check(
        s.labels.some(
          (l) =>
            l.group === "Company relationship" &&
            l.name === v.type &&
            (l.active ||
              s.relationships.some(
                (old) => old.id === v.id && old.type === v.type,
              )),
        ),
        "Choose an active company relationship label",
      );
      check(
        s.companies.some((c) => c.id === v.companyAId) &&
          s.companies.some((c) => c.id === v.companyBId),
        "Company not found",
      );
      check(
        !s.relationships.some(
          (r) =>
            r.id !== v.id &&
            r.companyAId === v.companyAId &&
            r.companyBId === v.companyBId &&
            r.type === v.type,
        ),
        "This relationship is already recorded",
      );
      const id = makeId(v.id),
        old = s.relationships.find((r) => r.id === id);
      put(s.relationships, {
        ...v,
        id,
        researcher: actor.name,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      break;
    }
    case "opportunity.save": {
      const v = schemas["opportunity.save"].parse(p);
      check(
        s.labels.some(
          (l) =>
            l.group === "Opportunity type" &&
            l.name === v.category &&
            (l.active ||
              s.opportunities.some(
                (old) => old.id === v.id && old.category === v.category,
              )),
        ),
        "Choose an active opportunity type label",
      );
      check(
        s.memberships.some(
          (m) => m.companyId === v.companyId && m.founderId === v.founderId,
        ),
        "Choose a founder associated with this company",
      );
      check(
        s.needs.some((n) => n.id === v.needId && n.companyId === v.companyId),
        "Choose a documented need from this company",
      );
      const id = makeId(v.id),
        old = s.opportunities.find((o) => o.id === id);
      put(s.opportunities, {
        ...v,
        id,
        followUpDate: new Date(v.followUpDate).toISOString(),
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      s.activities.push({
        id: crypto.randomUUID(),
        opportunityId: id,
        actor: actor.name,
        note: old
          ? `Status: ${old.status} → ${v.status}. ${v.nextAction}`
          : `Discovered: ${v.solution}`,
        createdAt: now,
      });
      break;
    }
    case "campaign.save": {
      const v = schemas["campaign.save"].parse(p);
      check(
        !s.campaigns.some((c) => c.period === v.period && c.id !== v.id),
        "A campaign already exists for this month",
      );
      const id = makeId(v.id),
        old = s.campaigns.find((c) => c.id === id);
      put(s.campaigns, {
        ...v,
        id,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      break;
    }
    case "campaign.assess": {
      const v = schemas["campaign.assess"].parse(p);
      check(
        s.campaigns.some((c) => c.id === v.campaignId) &&
          s.founders.some((f) => f.id === v.founderId),
        "Campaign or founder not found",
      );
      s.campaignParticipants = s.campaignParticipants.filter(
        (p) => p.campaignId !== v.campaignId || p.founderId !== v.founderId,
      );
      s.campaignParticipants.push({ ...v, reviewer: actor.name });
      entityId = v.campaignId;
      break;
    }
    case "award.save": {
      const v = schemas["award.save"].parse(p),
        campaign = s.campaigns.find((c) => c.id === v.campaignId);
      check(
        campaign && campaign.rules && campaign.criteria,
        "Publish campaign rules and criteria before selecting a winner",
      );
      check(
        s.campaignParticipants.some(
          (p) =>
            p.campaignId === v.campaignId &&
            p.founderId === v.founderId &&
            p.eligible &&
            p.assessment.trim().length > 0,
        ),
        "The winner needs an eligible, assessed campaign record",
      );
      const old = s.awards.find((a) => a.campaignId === v.campaignId);
      put(s.awards, {
        ...v,
        id: old?.id || crypto.randomUUID(),
        reviewer: actor.name,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      });
      break;
    }
    case "taxonomy.save": {
      const v = schemas["taxonomy.save"].parse(p);
      const old = s.labels.find((l) => l.id === v.id);
      check(
        !old || (old.group === v.group && old.name === v.name),
        "Existing labels retain their original meaning. Archive this label and add a new one to change its name or group.",
      );
      check(
        !s.labels.some(
          (l) =>
            l.id !== v.id &&
            l.group === v.group &&
            l.name.toLowerCase() === v.name.toLowerCase(),
        ),
        "This label already exists",
      );
      put(s.labels, { ...v, id: makeId(v.id) });
      break;
    }
    case "settings.save":
      s.settings = schemas["settings.save"].parse(p);
      break;
    case "invite.create": {
      const v = schemas["invite.create"].parse(p);
      s.invitations.push({
        ...v,
        id: crypto.randomUUID(),
        acceptedAt: null,
        createdAt: now,
        expiresAt: new Date(Date.parse(now) + 7 * 864e5).toISOString(),
      });
      break;
    }
    case "user.permissions": {
      const v = schemas["user.permissions"].parse(p),
        u = s.users.find((u) => u.id === v.id);
      check(u, "User not found");
      if (u.roleId === "admin")
        check(
          v.active && v.permissions.includes("team.manage"),
          "Use an administrator account to retain admin access",
        );
      u.permissions = v.permissions;
      u.active = v.active;
      entityId = u.id;
      break;
    }
    default:
      throw new DomainError("Unknown action");
  }
  s.audit.unshift({
    id: crypto.randomUUID(),
    actor: actor.name,
    action: command.type,
    entityId,
    detail: "Structured record updated",
    createdAt: now,
  });
  return s;
}
export function demoViewer(role = "admin"): Viewer {
  return {
    id: `demo-user-${role}`,
    name:
      role === "admin" ? "Ola_Crrypt" : ROLES[role]?.name || "Unsupported role",
    email: `${role}@example.invalid`,
    roleId: role,
    permissions: ROLES[role]?.permissions || [],
  };
}
