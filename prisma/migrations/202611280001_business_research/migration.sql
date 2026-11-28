CREATE TABLE "ApplicationResearch" (
  "applicationId" TEXT PRIMARY KEY,
  "discovery" JSONB,
  "submittedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "notes" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "linkHash" TEXT,
  "linkExpiresAt" TIMESTAMP(3),
  CONSTRAINT "ApplicationResearch_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ApplicationResearch_linkHash_key" ON "ApplicationResearch"("linkHash");
