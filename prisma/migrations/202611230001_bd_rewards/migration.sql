CREATE TABLE "BdPartner" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "bankDetails" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "BdAppearance" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL REFERENCES "BdPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "bookingId" TEXT NOT NULL UNIQUE,
  "sessionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL CHECK ("ordinal" > 0),
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("sessionId", "companyId"),
  UNIQUE ("partnerId", "ordinal")
);

CREATE TABLE "BdPayment" (
  "id" TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL REFERENCES "BdPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "cycle" INTEGER NOT NULL CHECK ("cycle" > 0),
  "reference" TEXT NOT NULL UNIQUE,
  "paidOn" TEXT NOT NULL,
  "amount" INTEGER NOT NULL CHECK ("amount" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("partnerId", "cycle")
);
