-- CreateTable
CREATE TABLE "ConsultationLead" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "founderName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "inboundKey" TEXT,
    "requestedAt" TIMESTAMP(3),
    "replyEmail" TEXT,
    "requestContext" TEXT,
    "followUp" JSONB,
    "followUpStatus" TEXT NOT NULL DEFAULT 'Not started',
    "followUpVersion" INTEGER NOT NULL DEFAULT 0,
    "inviteHash" TEXT,
    "offeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationSlot" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "ConsultationSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationAppointment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "discovery" JSONB NOT NULL,
    "bookingStatus" TEXT NOT NULL DEFAULT 'Confirmed',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialEngagement" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "estimatedPence" INTEGER,
    "agreedPence" INTEGER,
    "status" TEXT NOT NULL,
    "proposalAt" TIMESTAMP(3),
    "securedContractAt" TIMESTAMP(3),
    "securedEmploymentAt" TIMESTAMP(3),
    "followUpOn" DATE,
    "outcome" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationLead_applicationId_key" ON "ConsultationLead"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationLead_inviteHash_key" ON "ConsultationLead"("inviteHash");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationLead_inboundKey_key" ON "ConsultationLead"("inboundKey");

-- CreateIndex
CREATE INDEX "ConsultationSlot_startsAt_endsAt_idx" ON "ConsultationSlot"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ConsultationAppointment_leadId_idx" ON "ConsultationAppointment"("leadId");

-- CreateIndex
CREATE INDEX "ConsultationAppointment_slotId_idx" ON "ConsultationAppointment"("slotId");

-- CreateIndex
CREATE INDEX "CommercialEngagement_leadId_createdAt_idx" ON "CommercialEngagement"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultationLead" ADD CONSTRAINT "ConsultationLead_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationAppointment" ADD CONSTRAINT "ConsultationAppointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ConsultationLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationAppointment" ADD CONSTRAINT "ConsultationAppointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ConsultationSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialEngagement" ADD CONSTRAINT "CommercialEngagement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "ConsultationLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Release cancelled appointments without discarding their history.
CREATE UNIQUE INDEX "ConsultationAppointment_active_slot" ON "ConsultationAppointment"("slotId") WHERE "bookingStatus" <> 'Cancelled';
CREATE UNIQUE INDEX "ConsultationAppointment_active_lead" ON "ConsultationAppointment"("leadId") WHERE "bookingStatus" <> 'Cancelled';
