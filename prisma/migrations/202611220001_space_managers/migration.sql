CREATE TABLE "SpaceManager" (
 "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "revokedAt" TIMESTAMP(3), "verifiedAt" TIMESTAMP(3), "lastActivityAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SpaceManagerAssignment" (
 "managerId" TEXT NOT NULL REFERENCES "SpaceManager"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "sessionId" TEXT NOT NULL REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 PRIMARY KEY ("managerId", "sessionId")
);
CREATE TABLE "SpaceManagerLink" (
 "id" TEXT PRIMARY KEY, "managerId" TEXT NOT NULL REFERENCES "SpaceManager"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SpaceManagerSession" (
 "id" TEXT PRIMARY KEY, "managerId" TEXT NOT NULL REFERENCES "SpaceManager"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL UNIQUE, "csrf" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SpaceManagerSession_managerId_idx" ON "SpaceManagerSession"("managerId");
CREATE INDEX "SpaceManagerLink_managerId_idx" ON "SpaceManagerLink"("managerId");
