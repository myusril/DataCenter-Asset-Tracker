import { ConnectionStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, buildPagination } from '../../utils/response.js';
import type {
  ListNetworkQuery,
  UpdateNetworkInput,
  UpsertNetworkInput,
} from './network.schema.js';

const networkInclude = {
  asset: { select: { id: true, assetCode: true, assetName: true } },
} satisfies Prisma.NetworkInformationInclude;

const ONLINE_PROBABILITY = 0.8;

async function requireAsset(assetId: number): Promise<void> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) {
    throw new AppError(404, 'Asset not found');
  }
}

export async function listNetworkInformation(query: ListNetworkQuery) {
  const where: Prisma.NetworkInformationWhereInput = {};

  if (query.connectionStatus) {
    where.connectionStatus = query.connectionStatus;
  }
  if (query.search) {
    where.OR = [
      { hostname: { contains: query.search, mode: 'insensitive' } },
      { ipAddress: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.networkInformation.count({ where }),
    prisma.networkInformation.findMany({
      where,
      include: networkInclude,
      orderBy: { id: 'asc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows,
    pagination: buildPagination(query.page, query.limit, total),
  };
}

export async function getNetworkById(id: number) {
  const row = await prisma.networkInformation.findUnique({
    where: { id },
    include: networkInclude,
  });
  if (!row) {
    throw new AppError(404, 'Network information not found');
  }
  return row;
}

export async function getNetworkByAsset(assetId: number) {
  await requireAsset(assetId);

  const row = await prisma.networkInformation.findUnique({
    where: { assetId },
    include: networkInclude,
  });
  if (!row) {
    throw new AppError(404, 'Network information not found for this asset');
  }
  return row;
}

export async function upsertNetwork(input: UpsertNetworkInput) {
  await requireAsset(input.assetId);

  const { assetId, ...fields } = input;

  return prisma.networkInformation.upsert({
    where: { assetId },
    update: { ...fields },
    create: { assetId, ...fields },
    include: networkInclude,
  });
}

export async function updateNetwork(id: number, input: UpdateNetworkInput) {
  const existing = await prisma.networkInformation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Network information not found');
  }

  return prisma.networkInformation.update({
    where: { id },
    data: { ...input },
    include: networkInclude,
  });
}

export async function deleteNetwork(id: number): Promise<void> {
  const existing = await prisma.networkInformation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Network information not found');
  }
  await prisma.networkInformation.delete({ where: { id } });
}

/**
 * Simulated connectivity check: no ICMP is sent. The result is random with an
 * 80% chance of ONLINE, matching the assignment's simulation requirement.
 */
export async function checkNetwork(id: number) {
  const existing = await prisma.networkInformation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Network information not found');
  }

  return prisma.networkInformation.update({
    where: { id },
    data: {
      lastChecked: new Date(),
      connectionStatus:
        Math.random() < ONLINE_PROBABILITY ? ConnectionStatus.ONLINE : ConnectionStatus.OFFLINE,
    },
    include: networkInclude,
  });
}

export async function getNetworkStatistics() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, statusGroups, lastCheckedWithin24h] = await Promise.all([
    prisma.networkInformation.count(),
    prisma.networkInformation.groupBy({
      by: ['connectionStatus'],
      _count: { _all: true },
    }),
    prisma.networkInformation.count({ where: { lastChecked: { gte: since } } }),
  ]);

  const byConnectionStatus: Record<ConnectionStatus, number> = {
    ONLINE: 0,
    OFFLINE: 0,
    UNKNOWN: 0,
  };
  for (const group of statusGroups) {
    byConnectionStatus[group.connectionStatus] = group._count._all;
  }

  return { total, byConnectionStatus, lastCheckedWithin24h };
}
