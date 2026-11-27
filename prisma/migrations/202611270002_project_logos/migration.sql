CREATE TABLE "ProjectLogo" (
  "applicationId" TEXT PRIMARY KEY,
  "image" TEXT NOT NULL,
  CONSTRAINT "ProjectLogo_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
