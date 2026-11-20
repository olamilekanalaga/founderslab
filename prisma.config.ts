import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
try {
  process.loadEnvFile(".env");
} catch {}
// Prisma validates the datasource during generation; no connection is opened.
process.env.DATABASE_URL ||= "postgresql://unused@localhost:5432/unused";
export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "js",
  experimental: { adapter: true },
  adapter: async () => {
    // Client generation and schema compilation do not need a database connection.
    // Runtime database commands independently require a real DATABASE_URL.
    return new PrismaPg({
      connectionString:
        process.env.DATABASE_URL || "postgresql://unused@localhost:5432/unused",
    });
  },
});
