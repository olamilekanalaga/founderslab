import type { DataState } from "@/lib/types";

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
