/** Server-only connection configuration. Never return connection values to a client. */
type Env = Record<string, string | undefined>;
export function databaseUrl(env: Env = process.env) {
  return (
    env.DATABASE_URL ||
    env.DATABASE_DATABASE_URL ||
    env.STORAGE_DATABASE_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRES_URL ||
    ""
  );
}
export function migrationUrl(env: Env = process.env) {
  const direct =
    env.DATABASE_URL_UNPOOLED ||
    env.DATABASE_DATABASE_URL_UNPOOLED ||
    env.STORAGE_DATABASE_URL_UNPOOLED ||
    env.POSTGRES_URL_NON_POOLING;
  if (direct) return direct;
  const application = databaseUrl(env);
  if (application) {
    let hostname: string;
    try {
      hostname = new URL(application).hostname;
    } catch {
      throw new Error("Database connection must be a valid PostgreSQL URL.");
    }
    if (hostname.includes("-pooler."))
      throw new Error("Set DATABASE_URL_UNPOOLED for database migrations.");
  }
  return application;
}
export function publicDemoAllowed() {
  return false;
}
