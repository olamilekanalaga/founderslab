ALTER TABLE "SpaceManager" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "SpaceManagerLink" ADD COLUMN "passwordSetup" BOOLEAN NOT NULL DEFAULT false;
