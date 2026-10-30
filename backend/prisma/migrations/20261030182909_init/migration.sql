-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SERVER', 'SWITCH', 'ROUTER', 'STORAGE', 'FIREWALL', 'RACK', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ROUTINE', 'REPAIR', 'UPGRADE', 'INSPECTION', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('AI_ALERT', 'MAINTENANCE_REMINDER', 'SYSTEM', 'INFO');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TECHNICIAN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" SERIAL NOT NULL,
    "assetCode" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" DATE,
    "warrantyEnd" DATE,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_locations" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "dataCenter" TEXT NOT NULL,
    "rack" TEXT,
    "rackSlot" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_information" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "hostname" TEXT,
    "ipAddress" TEXT,
    "subnetMask" TEXT,
    "gateway" TEXT,
    "macAddress" TEXT,
    "connectionStatus" "ConnectionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastChecked" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "network_information_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_history" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "technicianId" INTEGER,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "maintenanceDate" DATE NOT NULL,
    "description" TEXT,
    "result" TEXT,
    "cost" DECIMAL(12,2),
    "nextSchedule" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_predictions" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "riskScore" DECIMAL(5,2) NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "confidence" DECIMAL(5,2),
    "topFactors" JSONB,
    "recommendation" TEXT,
    "predictedFailureDays" INTEGER,
    "modelVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "predictedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ai_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "assetId" INTEGER,
    "predictionId" INTEGER,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetCode_key" ON "assets"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "assets_serialNumber_key" ON "assets"("serialNumber");

-- CreateIndex
CREATE INDEX "assets_createdBy_idx" ON "assets"("createdBy");

-- CreateIndex
CREATE INDEX "assets_assetType_idx" ON "assets"("assetType");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "asset_locations_assetId_idx" ON "asset_locations"("assetId");

-- CreateIndex
CREATE INDEX "asset_locations_isCurrent_idx" ON "asset_locations"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "network_information_assetId_key" ON "network_information"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_history_assetId_idx" ON "maintenance_history"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_history_technicianId_idx" ON "maintenance_history"("technicianId");

-- CreateIndex
CREATE INDEX "maintenance_history_maintenanceType_idx" ON "maintenance_history"("maintenanceType");

-- CreateIndex
CREATE INDEX "maintenance_history_maintenanceDate_idx" ON "maintenance_history"("maintenanceDate");

-- CreateIndex
CREATE INDEX "ai_predictions_assetId_idx" ON "ai_predictions"("assetId");

-- CreateIndex
CREATE INDEX "ai_predictions_isActive_idx" ON "ai_predictions"("isActive");

-- CreateIndex
CREATE INDEX "ai_predictions_riskLevel_idx" ON "ai_predictions"("riskLevel");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_assetId_idx" ON "notifications"("assetId");

-- CreateIndex
CREATE INDEX "notifications_predictionId_idx" ON "notifications"("predictionId");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_locations" ADD CONSTRAINT "asset_locations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_information" ADD CONSTRAINT "network_information_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_history" ADD CONSTRAINT "maintenance_history_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_predictions" ADD CONSTRAINT "ai_predictions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "ai_predictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
