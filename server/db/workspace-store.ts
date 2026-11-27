import { trackBookingApproval } from "./booking-telegram";
import { db } from "./client";
import { hash, token } from "@/server/security/tokens";
import {
  lockProgramme,
  ensureProgrammeWindow,
  requireProgrammeBooking,
} from "@/server/services/programme-window";

import { PrismaClient, Prisma } from "@prisma/client";
import type { DataState, Viewer, Command } from "@/lib/types";
import { defaultSettings, ROLES, PERMISSIONS } from "@/lib/catalog";
import { applyCommand, DomainError, scopeState } from "@/lib/domain";
import { normaliseKey } from "@/lib/validation";

type Client = PrismaClient | Prisma.TransactionClient;
type Row = Record<string, unknown>;
interface Delegate {
  findMany(args?: unknown): Promise<Row[]>;
  upsert(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<unknown>;
}
const registry = [
  ["founders", "founder", ["id"]],
  ["companies", "company", ["id"]],
  ["memberships", "founderCompanyMembership", ["founderId", "companyId"]],
  ["applications", "application", ["id"]],
  ["sessions", "session", ["id"]],
  ["participants", "sessionParticipant", ["id"]],
  ["spaceData", "spaceData", ["id"]],
  ["spaceAttendance", "spaceTeamAttendance", ["id"]],
  ["bookings", "bookingRequest", ["id"]],
  ["research", "researchRecord", ["id"]],
  ["answers", "researchAnswer", ["id"]],
  ["labels", "classificationLabel", ["id"]],
  ["companyLabels", "companyLabel", ["companyId", "labelId"]],
  ["needs", "businessNeed", ["id"]],
  ["relationships", "companyRelationship", ["id"]],
  ["opportunities", "opportunity", ["id"]],
  ["activities", "opportunityActivity", ["id"]],
  ["campaigns", "campaign", ["id"]],
  ["campaignParticipants", "campaignParticipant", ["campaignId", "founderId"]],
  ["awards", "awardDecision", ["id"]],
  ["audit", "auditLog", ["id"]],
] as const;
function delegate(client: Client, name: string) {
  return (client as unknown as Record<string, Delegate>)[name];
}
export async function loadState(client: Client = db()): Promise<DataState> {
  const pairs = await Promise.all(
    registry.map(
      async ([key, model]) =>
        [
          key,
          key === "applications"
            ? await client.application.findMany({
                include: { projectLogo: { select: { applicationId: true } } },
              })
            : await delegate(client, model).findMany(),
        ] as const,
    ),
  );
  const settings = await client.setting.findUnique({
    where: { key: "programme" },
  });
  const dataset = await client.setting.findUnique({
    where: { key: "dataset" },
  });
  const team = await client.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      roleId: true,
      customPermissions: true,
      role: { include: { permissions: true } },
      grants: true,
    },
  });
  const invitations = await client.invitation.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      roleId: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
    },
  });
  const schedule = await client.programmeSchedule.findUnique({
    where: { id: "main" },
  });
  const programme = schedule
    ? await client.programmeWeek.findMany({
        where: {
          position: { gte: schedule.activeStart, lt: schedule.activeStart + 8 },
        },
        select: { sessionId: true },
      })
    : [];
  const data = Object.fromEntries(pairs);
  data.applications = (data.applications as Row[]).map(
    ({
      confirmationHash: ignored,
      confirmationExpires: ignored2,
      dedupeKey: ignored3,
      projectLogo,
      ...a
    }) => {
      void ignored;
      void ignored2;
      void ignored3;
      return { ...a, hasProjectLogo: Boolean(projectLogo) };
    },
  );
  return JSON.parse(
    JSON.stringify({
      ...data,
      version: 1,
      programmeSessionIds: programme.map((w) => w.sessionId),
      fictional: dataset?.value === true,
      users: team.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        active: u.active,
        roleId: u.roleId,
        permissions: u.customPermissions
          ? u.grants.map((p) => p.permissionId)
          : u.role.permissions.map((p) => p.permissionId),
      })),
      invitations,
      settings: { ...defaultSettings, ...((settings?.value as object) || {}) },
    }),
  ) as DataState;
}
export async function persistDiff(
  client: Client,
  before: DataState,
  after: DataState,
  seed = false,
) {
  for (const [key, model, keys] of [...registry].reverse()) {
    const a = before[key] as unknown as Row[],
      b = after[key] as unknown as Row[];
    const removed = a.filter(
      (r) => !b.some((x) => keys.every((k) => x[k] === r[k])),
    );
    if (removed.length)
      await delegate(client, model).deleteMany({
        where: {
          OR: removed.map((r) =>
            Object.fromEntries(keys.map((k) => [k, r[k]])),
          ),
        },
      });
  }
  for (const [key, model, keys] of registry) {
    const a = before[key] as unknown as Row[],
      b = after[key] as unknown as Row[];
    for (const row of b) {
      const old = a.find((x) => keys.every((k) => x[k] === row[k]));
      if (old && JSON.stringify(old) === JSON.stringify(row)) continue;
      const keyValues = Object.fromEntries(keys.map((k) => [k, row[k]]));
      const where =
        keys.length === 1 ? keyValues : { [keys.join("_")]: keyValues };
      if (key === "applications") {
        const { hasProjectLogo, ...application } = row;
        void hasProjectLogo;
        if (old) {
          // Attribution changes are owned by the BD workflow.
          const { bdPartnerId, bdReferrerXHandle, bdReviewStatus, ...data } =
            application;
          void bdPartnerId;
          void bdReferrerXHandle;
          void bdReviewStatus;
          await client.application.update({
            where: { id: String(row.id) },
            data,
          });
        } else if (seed)
          await delegate(client, model).upsert({
            where,
            update: application,
            create: {
              ...application,
              dedupeKey: normaliseKey(
                String(row.xHandle),
                String(row.companyName),
              ),
              confirmationHash: hash(token()),
              confirmationExpires: new Date(),
            },
          });
        else
          throw new DomainError(
            "Public applications must use the application endpoint",
          );
      } else
        await delegate(client, model).upsert({
          where,
          create: row,
          update: row,
        });
    }
  }
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings))
    await client.setting.upsert({
      where: { key: "programme" },
      create: {
        key: "programme",
        value: after.settings as unknown as Prisma.InputJsonValue,
      },
      update: { value: after.settings as unknown as Prisma.InputJsonValue },
    });
}
export async function executeCommand(command: Command, viewer: Viewer) {
  if (command.type === "invite.create" || command.type === "user.permissions")
    throw new DomainError("Use the team command handler");
  return db().$transaction(
    async (tx) => {
      if (command.type === "booking.create")
        await requireProgrammeBooking(tx, String(command.payload.sessionId));
      // Capacity decisions and edits to verified attendance share a session lock.
      let editedSession: string | undefined;
      if (command.type === "application.review") {
        await lockProgramme(tx);
        const applicationId = String(command.payload.id);
        const bookings = await tx.bookingRequest.findMany({
          where: { applicationId },
          select: { sessionId: true },
        });
        const sessionIds = new Set(
          bookings.map((booking) => booking.sessionId),
        );
        if (typeof command.payload.sessionId === "string")
          sessionIds.add(command.payload.sessionId);
        for (const sessionId of [...sessionIds].sort())
          await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
      } else if (command.type === "booking.review") {
        const booking = await tx.bookingRequest.findUnique({
          where: { id: String(command.payload.id) },
        });
        if (!booking) throw new DomainError("Booking not found", 404);
        editedSession = booking.sessionId;
      } else if (command.type === "space-data.save") {
        await lockProgramme(tx);
        editedSession = String(command.payload.sessionId);
      } else if (command.type === "session.save" && command.payload.id) {
        editedSession = String(command.payload.id);
      }
      if (editedSession)
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${editedSession} FOR UPDATE`;

      const before = await loadState(tx),
        after = applyCommand(before, command, viewer);
      if (editedSession) {
        const verified = await tx.bdAppearance.findMany({
          where: { sessionId: editedSession, reversedAt: null },
          select: { bookingId: true, companyId: true },
        });
        const session = after.sessions.find(
          (record) => record.id === editedSession,
        );
        const report = after.spaceData.find(
          (record) => record.sessionId === editedSession,
        );
        const invalid = verified.some((appearance) => {
          const booking = after.bookings.find(
            (record) => record.id === appearance.bookingId,
          );
          return (
            booking &&
            (!["Approved", "Attended"].includes(booking.status) ||
              session?.status !== "Completed" ||
              !report?.submittedAt ||
              !report.founderBookingIds.includes(appearance.bookingId))
          );
        });
        if (report?.bdApprovedAt) {
          const priorSession = before.sessions.find(
            (row) => row.id === editedSession,
          );
          const priorBooking = before.bookings.find(
            (row) => row.id === command.payload.id,
          );
          const nextBooking = after.bookings.find(
            (row) => row.id === command.payload.id,
          );
          if (
            command.type === "space-data.save" ||
            priorSession?.status !== session?.status ||
            (command.type === "booking.review" &&
              priorBooking?.status !== nextBooking?.status)
          )
            report.bdApprovedAt = null;
        }
        if (invalid)
          throw new DomainError(
            "Reverse the BD verification before changing this attendance or Space status.",
            409,
          );
      }
      await persistDiff(tx, before, after);
      const notificationBookingIds = [];
      if (
        command.type === "application.review" ||
        command.type === "booking.review"
      ) {
        const previouslyUnconfirmed = new Set(
          before.bookings
            .filter(
              (booking) =>
                !["Approved", "Attended", "No-show"].includes(booking.status),
            )
            .map((booking) => booking.id),
        );
        for (const booking of after.bookings) {
          if (
            booking.status === "Approved" &&
            previouslyUnconfirmed.has(booking.id)
          ) {
            const tracked = await trackBookingApproval(
              tx,
              booking.id,
              booking.updatedAt,
              viewer,
            );
            if (tracked.count) notificationBookingIds.push(booking.id);
          }
        }
      }
      if (command.type === "space-data.save" && command.payload.submit) {
        await ensureProgrammeWindow(tx);
        return {
          state: scopeState(await loadState(tx), viewer.permissions),
          notificationBookingIds,
        };
      }
      return {
        state: scopeState(after, viewer.permissions),
        notificationBookingIds,
      };
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
export async function ensureRoles() {
  for (const id of PERMISSIONS)
    await db().permission.upsert({ where: { id }, create: { id }, update: {} });
  for (const [id, r] of Object.entries(ROLES)) {
    await db().role.upsert({
      where: { id },
      create: { id, name: r.name },
      update: { name: r.name },
    });
    for (const permissionId of r.permissions)
      await db().rolePermission.upsert({
        where: { roleId_permissionId: { roleId: id, permissionId } },
        create: { roleId: id, permissionId },
        update: {},
      });
  }
  await db().setting.upsert({
    where: { key: "programme" },
    create: { key: "programme", value: defaultSettings },
    update: {},
  });
}
