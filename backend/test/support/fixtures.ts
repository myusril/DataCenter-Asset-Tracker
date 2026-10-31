import type {
  AssetStatus,
  AssetType,
  ConnectionStatus,
  MaintenanceType,
  NotificationType,
  Role,
} from '@prisma/client';
import { prisma } from './database.js';
import { signToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';

export const TEST_PASSWORD = 'TestPassw0rd!';

// bcrypt at cost 10 is slow; every fixture user shares one hash.
let cachedHash: Promise<string> | undefined;
function passwordHash(): Promise<string> {
  cachedHash ??= hashPassword(TEST_PASSWORD);
  return cachedHash;
}

export interface TestUser {
  id: number;
  username: string;
  role: Role;
  token: string;
}

export interface CreateUserOptions {
  username?: string;
  role?: Role;
  isActive?: boolean;
  fullName?: string;
  email?: string;
}

export async function createUser(options: CreateUserOptions = {}): Promise<TestUser> {
  const username = options.username ?? 'fixture-user';
  const user = await prisma.user.create({
    data: {
      username,
      email: options.email ?? `${username}@test.local`,
      passwordHash: await passwordHash(),
      fullName: options.fullName ?? `Fixture ${username}`,
      role: options.role ?? 'TECHNICIAN',
      isActive: options.isActive ?? true,
    },
    select: { id: true, username: true, role: true },
  });

  return {
    ...user,
    token: signToken({ sub: user.id, username: user.username, role: user.role }),
  };
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export interface CreateAssetOptions {
  assetCode: string;
  assetName?: string;
  assetType?: AssetType;
  status?: AssetStatus;
  serialNumber?: string | null;
  purchaseDate?: Date | null;
  warrantyEnd?: Date | null;
  createdAt?: Date;
  createdBy?: number | null;
  location?: {
    dataCenter?: string;
    rack?: string;
    rackSlot?: string;
    floor?: string;
    room?: string;
    isCurrent?: boolean;
    movedAt?: Date;
  } | null;
  network?: {
    hostname?: string;
    ipAddress?: string;
    gateway?: string;
    connectionStatus?: ConnectionStatus;
    lastChecked?: Date | null;
  } | null;
}

export async function createAsset(options: CreateAssetOptions) {
  const {
    location,
    network,
    assetCode,
    assetName = `Asset ${options.assetCode}`,
    assetType = 'SERVER',
    ...rest
  } = options;

  return prisma.asset.create({
    data: {
      assetCode,
      assetName,
      assetType,
      ...rest,
      ...(location
        ? {
            locations: {
              create: {
                dataCenter: location.dataCenter ?? 'DC-1',
                rack: location.rack ?? 'A',
                rackSlot: location.rackSlot ?? 'U01',
                floor: location.floor ?? '1',
                room: location.room,
                isCurrent: location.isCurrent ?? true,
                ...(location.movedAt ? { movedAt: location.movedAt } : {}),
              },
            },
          }
        : {}),
      ...(network ? { networkInformation: { create: network } } : {}),
    },
    include: { locations: true, networkInformation: true },
  });
}

export interface CreateMaintenanceOptions {
  assetId: number;
  technicianId?: number | null;
  maintenanceType?: MaintenanceType;
  maintenanceDate?: Date;
  description?: string;
  result?: string;
  cost?: number | null;
  nextSchedule?: Date | null;
}

export async function createMaintenance(options: CreateMaintenanceOptions) {
  return prisma.maintenanceHistory.create({
    data: {
      assetId: options.assetId,
      technicianId: options.technicianId,
      maintenanceType: options.maintenanceType ?? 'ROUTINE',
      maintenanceDate:
        options.maintenanceDate ?? new Date('2026-10-01T00:00:00.000Z'),
      description: options.description,
      result: options.result,
      cost: options.cost,
      nextSchedule: options.nextSchedule,
    },
  });
}

export interface CreatePredictionOptions {
  assetId: number;
  riskScore?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence?: number;
  predictedAt?: Date;
  isActive?: boolean;
  predictedFailureDays?: number;
}

export async function createPrediction(options: CreatePredictionOptions) {
  return prisma.aiPrediction.create({
    data: {
      assetId: options.assetId,
      riskScore: options.riskScore ?? 20,
      riskLevel: options.riskLevel ?? 'LOW',
      confidence: options.confidence ?? 80,
      predictedAt: options.predictedAt,
      isActive: options.isActive ?? true,
      predictedFailureDays: options.predictedFailureDays ?? 72,
    },
  });
}

export interface CreateNotificationOptions {
  userId: number;
  assetId?: number | null;
  predictionId?: number | null;
  type?: NotificationType;
  title?: string;
  message?: string;
  isRead?: boolean;
  readAt?: Date | null;
  createdAt?: Date;
}

export async function createNotification(options: CreateNotificationOptions) {
  return prisma.notification.create({
    data: {
      userId: options.userId,
      assetId: options.assetId,
      predictionId: options.predictionId,
      type: options.type ?? 'INFO',
      title: options.title ?? 'Fixture notification',
      message: options.message ?? 'Fixture message',
      isRead: options.isRead ?? false,
      readAt: options.readAt,
      createdAt: options.createdAt,
    },
  });
}

export { prisma };
