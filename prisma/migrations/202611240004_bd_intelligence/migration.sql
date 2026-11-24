ALTER TABLE "BdPartner" ADD COLUMN "fullName" TEXT,
ADD COLUMN "referralCode" TEXT,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

WITH handles AS (
  SELECT id, lower(substring(name from 2)) AS code,
         row_number() OVER (PARTITION BY lower(name) ORDER BY "createdAt", id) AS position
  FROM "BdPartner"
  WHERE name ~ '^@[A-Za-z0-9_]{1,15}$'
)
UPDATE "BdPartner" AS partner SET "referralCode" = handles.code
FROM handles WHERE partner.id = handles.id AND handles.position = 1;

UPDATE "BdPartner" SET "referralCode" = 'bd_' || replace(id, '-', '')
WHERE "referralCode" IS NULL;
ALTER TABLE "BdPartner" ALTER COLUMN "referralCode" SET NOT NULL;
CREATE UNIQUE INDEX "BdPartner_referralCode_key" ON "BdPartner"("referralCode");

ALTER TABLE "BdAppearance" ADD COLUMN "reversedAt" TIMESTAMP(3);
ALTER TABLE "BdPayment" ALTER COLUMN reference DROP NOT NULL,
ADD COLUMN "requestId" TEXT;
ALTER TABLE "BdPayment" DROP CONSTRAINT "BdPayment_partnerId_cycle_key";
CREATE INDEX "BdPayment_partnerId_cycle_idx" ON "BdPayment"("partnerId", cycle);
CREATE UNIQUE INDEX "BdPayment_requestId_key" ON "BdPayment"("requestId");

CREATE TABLE "BdAccess" (
  "tokenHash" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL REFERENCES "BdPartner"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BdAccess_partnerId_purpose_idx" ON "BdAccess"("partnerId", purpose);
CREATE INDEX "BdAccess_purpose_expiresAt_idx" ON "BdAccess"(purpose, "expiresAt");
