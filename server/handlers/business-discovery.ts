import "server-only";
import { z } from "zod";
import { businessDiscoverySchema } from "@/lib/business-research";
import { DomainError } from "@/lib/domain";
import { requireOrigin, rateLimit } from "@/server/auth";
import { db, hash } from "@/server/db";
import { body, failure, json } from "@/server/http";
import { discoveryLinkEligible } from "@/server/services/business-research";

const key = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Open a valid discovery link.");
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), token: key }),
  z.object({
    action: z.literal("submit"),
    token: key,
    discovery: businessDiscoverySchema,
  }),
]);

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    await rateLimit(
      `public:business-discovery:${request.headers.get("x-forwarded-for") || "local"}`,
      40,
      60 * 60_000,
    );
    const data = requestSchema.parse(await body(request));
    const where = {
      linkHash: hash(data.token),
      linkExpiresAt: { gt: new Date() },
      submittedAt: null,
      application: discoveryLinkEligible,
    };
    const unavailable = () =>
      new DomainError(
        "This discovery link is invalid, expired or already used. Ask the Founders Lab team for a new link.",
        404,
      );

    if (data.action === "open") {
      const slot = await db().applicationResearch.findFirst({
        where,
        select: {
          application: { select: { companyName: true, description: true } },
        },
      });
      if (!slot) throw unavailable();
      return json(slot.application);
    }

    const saved = await db().applicationResearch.updateMany({
      where,
      data: {
        discovery: data.discovery,
        submittedAt: new Date(),
        linkHash: null,
        linkExpiresAt: null,
      },
    });
    if (!saved.count) throw unavailable();
    return json({ submitted: true });
  } catch (error) {
    return failure(error);
  }
}
