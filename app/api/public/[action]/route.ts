import { z } from "zod";
import { db, hash, token, loadState } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
import { requireOrigin, rateLimit } from "@/lib/auth";
import { applicationSchema, normaliseKey } from "@/lib/validation";
import { approvedSeats, DomainError } from "@/lib/domain";
import { defaultSettings } from "@/lib/catalog";
export const runtime = "nodejs";
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
      const dataset = await db().setting.findUnique({
        where: { key: "dataset" },
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
        settings: {
          ...defaultSettings,
          ...((settings?.value as object) || {}),
        },
        labels: await db().classificationLabel.findMany({
          where: { active: true, group: { in: ["Sector", "Product stage"] } },
          select: { group: true, name: true },
        }),
        fictional: dataset?.value === true,
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
    const sessions = await db().session.findMany({
      where: { status: "Scheduled", deadline: { gte: new Date() } },
      include: {
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
      const p = applicationSchema.parse(await body(request));
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
      const application = await db().application.create({
        data: {
          ...data,
          id,
          reference: `FL-${id.slice(0, 8).toUpperCase()}`,
          dedupeKey: normaliseKey(p.xHandle, p.companyName),
          confirmationHash: hash(raw),
          confirmationExpires: new Date(Date.now() + 30 * 864e5),
        },
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
          await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${p.sessionId!} FOR UPDATE`;
          const session = await tx.session.findUnique({
            where: { id: p.sessionId },
          });
          if (
            !session ||
            session.status !== "Scheduled" ||
            session.deadline < new Date()
          )
            throw new DomainError(
              "This session is not open for booking requests.",
            );
          if (["Declined"].includes(a.status))
            throw new DomainError(
              "This application is not eligible for booking.",
            );
          const state = await loadState(tx),
            status =
              approvedSeats(state, session.id) >= session.capacity
                ? "Waitlisted"
                : "Pending";
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
