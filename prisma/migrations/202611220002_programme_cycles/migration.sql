ALTER TABLE "SpaceData" ADD COLUMN "submittedAt" TIMESTAMP(3), ADD COLUMN "submittedBy" TEXT;
CREATE TABLE "ProgrammeSchedule" ("id" TEXT PRIMARY KEY, "anchorDay" TEXT NOT NULL, "activeStart" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "ProgrammeWeek" ("sessionId" TEXT PRIMARY KEY REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "position" INTEGER NOT NULL UNIQUE);

UPDATE "Session" SET host='⭕️La_Crrypt💰₿' WHERE host IN ('Ola_Crrypt','Ola_Crypt');
UPDATE "User" SET name='⭕️La_Crrypt💰₿' WHERE name IN ('Ola_Crrypt','Ola_Crypt');
