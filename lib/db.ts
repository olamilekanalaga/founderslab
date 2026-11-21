import { databaseUrl } from "./server-env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import type { DataState, Viewer, Command } from "./types";
import { defaultSettings, ROLES, PERMISSIONS } from "./catalog";
import { applyCommand, DomainError, scopeState } from "./domain";
import { normaliseKey } from "./validation";
import { createHash, randomBytes } from "node:crypto";
const globalDb = globalThis as unknown as { foundersDb?: PrismaClient };
export function db() {
  if (!databaseUrl())
    throw new DomainError(
      "Database is not configured. The fictional /demo workspace is available without a database.",
      503,
    );
  return (globalDb.foundersDb ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl() }),
  }));
}
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
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
        [key, await delegate(client, model).findMany()] as const,
    ),
  );
  const settings = await client.setting.findUnique({
    where: { key: "programme" },
  });
  const dataset = await client.setting.findUnique({
    where: { key: "dataset" },
  });
  const team = await client.user.findMany({
    include: { role: { include: { permissions: true } }, grants: true },
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
  const data = Object.fromEntries(pairs);
  data.applications = (data.applications as Row[]).map(
    ({
      confirmationHash: ignored,
      confirmationExpires: ignored2,
      dedupeKey: ignored3,
      ...a
    }) => {
      void ignored;
      void ignored2;
      void ignored3;
      return a;
    },
  );
  return JSON.parse(
    JSON.stringify({
      ...data,
      version: 1,
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
        if (old)
          await client.application.update({
            where: { id: String(row.id) },
            data: row,
          });
        else if (seed)
          await delegate(client, model).upsert({
            where,
            update: row,
            create: {
              ...row,
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
      // All capacity decisions for one session serialize on the same PostgreSQL row lock.
      if (command.type === "booking.review") {
        const booking = await tx.bookingRequest.findUnique({
          where: { id: String(command.payload.id) },
        });
        if (!booking) throw new DomainError("Booking not found", 404);
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${booking.sessionId} FOR UPDATE`;
      } else if (command.type === "space-data.save") {
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${String(command.payload.sessionId)} FOR UPDATE`;
      } else if (command.type === "session.save" && command.payload.id) {
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${String(command.payload.id)} FOR UPDATE`;
      }
      const before = await loadState(tx),
        after = applyCommand(before, command, viewer);
      await persistDiff(tx, before, after);
      return scopeState(after, viewer.permissions);
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
