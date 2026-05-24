-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyQuota" INTEGER NOT NULL DEFAULT 10,
    "leadsReceivedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationPointer" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "lastIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationPointer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAllocationCursor" (
    "id" SERIAL NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "nextOffset" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAllocationCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaResetHistory" (
    "id" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaResetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- CreateIndex
CREATE INDEX "Provider_leadsReceivedCount_idx" ON "Provider"("leadsReceivedCount");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_serviceId_idx" ON "Lead"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_phone_serviceId_key" ON "Lead"("phone", "serviceId");

-- CreateIndex
CREATE INDEX "LeadAssignment_leadId_idx" ON "LeadAssignment"("leadId");

-- CreateIndex
CREATE INDEX "LeadAssignment_providerId_idx" ON "LeadAssignment"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadAssignment_leadId_providerId_key" ON "LeadAssignment"("leadId", "providerId");

-- CreateIndex
CREATE INDEX "AllocationPointer_serviceId_idx" ON "AllocationPointer"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationPointer_providerId_serviceId_key" ON "AllocationPointer"("providerId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAllocationCursor_serviceId_key" ON "ServiceAllocationCursor"("serviceId");

-- CreateIndex
CREATE INDEX "QuotaResetHistory_providerId_idx" ON "QuotaResetHistory"("providerId");

-- CreateIndex
CREATE INDEX "QuotaResetHistory_timestamp_idx" ON "QuotaResetHistory"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_idempotencyKey_key" ON "WebhookEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_providerId_idx" ON "WebhookEvent"("providerId");

-- CreateIndex
CREATE INDEX "WebhookEvent_idempotencyKey_idx" ON "WebhookEvent"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationPointer" ADD CONSTRAINT "AllocationPointer_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationPointer" ADD CONSTRAINT "AllocationPointer_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAllocationCursor" ADD CONSTRAINT "ServiceAllocationCursor_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaResetHistory" ADD CONSTRAINT "QuotaResetHistory_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
