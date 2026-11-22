import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "@/server/config/environment";
import { DomainError } from "@/lib/domain";
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
