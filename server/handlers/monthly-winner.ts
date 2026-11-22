import "server-only";
import { requireViewer, requireCsrf } from "@/server/auth";
import { json, failure } from "@/server/http";
import { RETIRED_AWARD_MESSAGE } from "@/lib/programme-policy";

/** Retired write endpoint. Keep authentication/CSRF and preserve all stored decisions. */
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer("campaign.write");
    requireCsrf(request, viewer);
    return json({ error: RETIRED_AWARD_MESSAGE }, 410);
  } catch (e) {
    return failure(e);
  }
}
