CREATE TABLE "SpaceData" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "liveListeners" INTEGER,
  "durationMinutes" INTEGER,
  "notes" TEXT NOT NULL DEFAULT '',
  "recordedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpaceData_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpaceData_counts_check" CHECK (("liveListeners" IS NULL OR "liveListeners" >= 0) AND ("durationMinutes" IS NULL OR "durationMinutes" >= 0)),
  CONSTRAINT "SpaceData_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpaceData_sessionId_key" ON "SpaceData"("sessionId");
CREATE TABLE "SpaceTeamAttendance" (
  "id" TEXT NOT NULL,
  "spaceDataId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "foundersCount" INTEGER NOT NULL DEFAULT 0,
  "otherTeamCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SpaceTeamAttendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpaceTeamAttendance_counts_check" CHECK ("foundersCount" >= 0 AND "otherTeamCount" >= 0),
  CONSTRAINT "SpaceTeamAttendance_spaceDataId_fkey" FOREIGN KEY ("spaceDataId") REFERENCES "SpaceData"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpaceTeamAttendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpaceTeamAttendance_spaceDataId_companyId_key" ON "SpaceTeamAttendance"("spaceDataId", "companyId");
