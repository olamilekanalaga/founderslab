import "server-only";
import { db } from "@/server/db";
import { databaseUrl } from "@/server/config/environment";

export async function GET() {
  if (!databaseUrl())
    return Response.json(
      { status: "not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    // Checks application tables without exposing records, credentials or account details.
    const programme = await db().setting.findUnique({
      where: { key: "programme" },
      select: { key: true },
    });
    if (!programme)
      return Response.json(
        { status: "not_ready" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "not_ready" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
