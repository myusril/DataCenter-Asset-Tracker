-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "maintenanceId" INTEGER;

-- CreateIndex
CREATE INDEX "notifications_maintenanceId_idx" ON "notifications"("maintenanceId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "maintenance_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;

