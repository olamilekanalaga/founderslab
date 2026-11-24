ALTER TABLE "Application" ADD COLUMN "bdReferrerXHandle" TEXT,
ADD COLUMN "bdPartnerId" TEXT;
ALTER TABLE "Application" ADD CONSTRAINT "Application_bdPartnerId_fkey"
FOREIGN KEY ("bdPartnerId") REFERENCES "BdPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Application_bdPartnerId_idx" ON "Application"("bdPartnerId");
