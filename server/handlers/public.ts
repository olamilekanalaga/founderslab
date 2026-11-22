import "server-only";
import { PARTICIPATION_TERMS } from "@/lib/programme-policy";
import {
  ensureProgrammeWindow,
  requireProgrammeBooking,
  WINDOW_WEEKS,
} from "@/server/services/programme-window";
import { z } from "zod";
import { publicSlotOpen } from "@/lib/dates/booking";
import { db, hash, token, loadState } from "@/server/db";
import { body, json, failure } from "@/server/http";
import { requireOrigin, rateLimit } from "@/server/auth";
import { applicationSchema, normaliseKey } from "@/lib/validation";
import { approvedSeats, DomainError } from "@/lib/domain";
import { defaultSettings } from "@/lib/catalog";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (action === "programme") {
      const settings = await db().setting.findUnique({
        where: { key: "programme" },
      });
      const approved = await db().researchRecord.findMany({
        where: {
          visibility: "Public",
          verification: { in: ["Verified", "Evidence reviewed"] },
          status: "Complete",
          founder: {
            applications: {
              some: { promotionalConsent: true, status: "Approved" },
            },
          },
        },
        include: {
          company: { select: { name: true } },
          founder: {
            include: {
              applications: {
                select: {
                  companyId: true,
                  promotionalConsent: true,
                  status: true,
                },
              },
            },
          },
          answers: { where: { section: "Product and customer" } },
        },
        take: 30,
      });
      return json({
        settings: (() => {
          const s = {
            ...defaultSettings,
            ...((settings?.value as object) || {}),
          };
          return {
            countryOptions: s.countryOptions,
            capacity: s.capacity,
            terms: PARTICIPATION_TERMS,
          };
        })(),
        labels: await db().classificationLabel.findMany({
          where: { active: true, group: { in: ["Sector", "Product stage"] } },
          select: { group: true, name: true },
        }),
        highlights: approved
          .filter((r) =>
            r.founder.applications.some(
              (a) =>
                a.companyId === r.companyId &&
                a.promotionalConsent &&
                a.status === "Approved",
            ),
          )
          .slice(0, 3)
          .map((r) => ({
            company: r.company.name,
            text: r.answers[0]?.response || "",
            recordedAt: r.recordedAt,
            source: r.evidence,
          })),
      });
    }
    if (action !== "sessions") return json({ error: "Not found" }, 404);
    const window = await db().$transaction((tx) => ensureProgrammeWindow(tx), {
      timeout: 30000,
    });
    const sessions = await db().session.findMany({
      where: {
        programmeWeek: {
          position: {
            gte: window.activeStart,
            lt: window.activeStart + WINDOW_WEEKS,
          },
        },
      },
      include: {
        programmeWeek: { select: { position: true } },
        spaceData: { select: { submittedAt: true } },
        participants: {
          where: { attendance: { not: "Cancelled" } },
          select: { companyId: true },
        },
      },
      orderBy: { startsAt: "asc" },
    });
    return json({
      sessions: sessions.map(({ participants, ...s }) => ({
        id: s.id,
        position: s.programmeWeek!.position,
        submitted: Boolean(s.spaceData?.submittedAt),
        title: s.title,
        startsAt: s.startsAt,
        timezone: s.timezone,
        host: s.host,
        capacity: s.capacity,
        deadline: s.deadline,
        status: s.status,
        availableSeats: Math.max(
          0,
          s.capacity - new Set(participants.map((p) => p.companyId)).size,
        ),
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    requireOrigin(request);
    const { action } = await params;
    await rateLimit(
      `public:${action}:${request.headers.get("x-forwarded-for") || "local"}`,
      action === "confirmation" ? 60 : 20,
      60 * 60000,
    );
    if (action === "apply") {
      const { sessionId, ...p } = applicationSchema
        .extend({ sessionId: z.string().min(1).max(200).optional() })
        .parse(await body(request));
      const configuration = await db().setting.findUnique({
        where: { key: "programme" },
      });
      const configured = configuration?.value as {
        countryOptions?: string[];
      } | null;
      if (
        !(
          configured?.countryOptions || defaultSettings.countryOptions
        ).includes(p.country)
      )
        throw new DomainError("Select a country enabled for this programme.");
      const labels = await db().classificationLabel.findMany({
        where: {
          active: true,
          OR: [
            { group: "Sector", name: p.sector },
            { group: "Product stage", name: p.stage },
          ],
        },
      });
      if (labels.length !== 2)
        throw new DomainError("Select an active sector and product stage.");

      const raw = token();
      const id = crypto.randomUUID();
      const { websiteTrap: ignored, ...data } = p;
      void ignored;
      const application = await db().$transaction(async (tx) => {
        if (sessionId) {
          await requireProgrammeBooking(tx, sessionId);
          await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
          const session = await tx.session.findUnique({
            where: { id: sessionId },
            include: {
              participants: {
                where: { attendance: { not: "Cancelled" } },
                select: { companyId: true },
              },
            },
          });
          const occupied = session
            ? new Set(session.participants.map((p) => p.companyId)).size
            : 0;
          if (
            !session ||
            !publicSlotOpen(
              {
                ...session,
                startsAt: session.startsAt.toISOString(),
                deadline: session.deadline.toISOString(),
              },
              session.capacity - occupied,
            )
          )
            throw new DomainError(
              "This Saturday is no longer available. Please choose another date.",
              409,
            );
        }
        return tx.application.create({
          data: {
            ...data,
            id,
            reference: `FL-${id.slice(0, 8).toUpperCase()}`,
            dedupeKey: normaliseKey(p.xHandle, p.companyName),
            confirmationHash: hash(raw),
            confirmationExpires: new Date(Date.now() + 30 * 864e5),
            ...(sessionId
              ? {
                  bookings: {
                    create: {
                      sessionId,
                      speakers: p.speakers,
                      status: "Pending",
                    },
                  },
                }
              : {}),
          },
        });
      });
      return json(
        {
          token: raw,
          reference: application.reference,
          companyName: application.companyName,
          status: application.status,
        },
        201,
      );
    }
    const p = z
      .object({
        token: z.string().min(30).max(100),
        sessionId: z.string().max(200).optional(),
      })
      .parse(await body(request));
    const a = await db().application.findUnique({
      where: { confirmationHash: hash(p.token) },
    });
    if (!a || a.confirmationExpires < new Date())
      throw new DomainError("Confirmation link is invalid or expired.", 404);
    if (action === "confirmation") {
      const bookings = await db().bookingRequest.findMany({
        where: { applicationId: a.id },
        include: {
          session: { select: { title: true, startsAt: true, timezone: true } },
        },
      });
      return json({
        reference: a.reference,
        companyName: a.companyName,
        status: a.status,
        bookings: bookings.map((b) => ({
          status: b.status,
          session: b.session,
        })),
      });
    }
    if (action === "book" && p.sessionId) {
      const result = await db().$transaction(
        async (tx) => {
          await requireProgrammeBooking(tx, p.sessionId!);
          await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${p.sessionId!} FOR UPDATE`;
          const session = await tx.session.findUnique({
            where: { id: p.sessionId },
          });
          if (
            !session ||
            !publicSlotOpen(
              {
                ...session,
                startsAt: session.startsAt.toISOString(),
                deadline: session.deadline.toISOString(),
              },
              1,
            )
          )
            throw new DomainError(
              "This session is not open for booking requests.",
            );
          if (["Declined"].includes(a.status))
            throw new DomainError(
              "This application is not eligible for booking.",
            );
          const state = await loadState(tx);
          if (approvedSeats(state, session.id) >= session.capacity)
            throw new DomainError(
              "This Saturday is full. Please choose another date.",
              409,
            );
          const status = "Pending";
          return tx.bookingRequest.create({
            data: {
              applicationId: a.id,
              sessionId: session.id,
              speakers: a.speakers,
              status,
            },
          });
        },
        { timeout: 30000 },
      );
      return json({ status: result.status }, 201);
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}
