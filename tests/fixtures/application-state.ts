import { publicSlotOpen } from "@/lib/dates/booking";
import { ROLES } from "@/lib/catalog";
import type { DataState, Viewer } from "@/lib/types";
import { applicationSchema, normaliseKey } from "@/lib/validation";
import { approvedSeats, applyCommand } from "@/lib/domain";

import { check } from "@/lib/domain/errors";

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
    "This Sunday is no longer available. Please choose another date.",
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
    bdReferrerXHandle: null,
    bdReviewStatus: null,
    bdPartnerId: null,
    founderId: null,
    companyId: null,
    createdAt: now,
    updatedAt: now,
  });
  return s;
}
export function demoViewer(role = "admin"): Viewer {
  return {
    id: `demo-user-${role}`,
    name:
      role === "admin"
        ? "⭕️La_Crrypt💰₿"
        : ROLES[role]?.name || "Unsupported role",
    email: `${role}@example.invalid`,
    roleId: role,
    permissions: ROLES[role]?.permissions || [],
  };
}
