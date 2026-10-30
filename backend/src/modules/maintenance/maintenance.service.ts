import {
  AssetStatus,
  MaintenanceType,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, buildPagination } from '../../utils/response.js';
import { decimalToNumber, parseIsoDate, toIsoDate } from '../../utils/serialize.js';
import type {
  CreateMaintenanceInput,
  ListMaintenanceQuery,
  UpdateMaintenanceInput,
} from './maintenance.schema.js';

const maintenanceInclude = {
  asset: { select: { id: true, assetCode: true, assetName: true } },
  technician: { select: { id: true, username: true, fullName: true } },
} satisfies Prisma.MaintenanceHistoryInclude;

type MaintenanceRow = Prisma.MaintenanceHistoryGetPayload<{
  include: typeof maintenanceInclude;
}>;

const STATUS_TRIGGER_TYPES: MaintenanceType[] = [
  MaintenanceType.REPAIR,
  MaintenanceType.UPGRADE,
  MaintenanceType.REPLACEMENT,
];

function toMaintenance(row: MaintenanceRow) {
  return {
    ...row,
    maintenanceDate: toIsoDate(row.maintenanceDate),
    nextSchedule: toIsoDate(row.nextSchedule),
    cost: decimalToNumber(row.cost),
  };
}

/**
 * Maintenance rows drive the asset status: unfinished repair/upgrade/
 * replacement moves the asset to MAINTENANCE, a row whose result starts with
 * "Resolved" returns it to ACTIVE.
 */
function resolveAssetStatus(
  maintenanceType: MaintenanceType,
  result: string | undefined,
): AssetStatus | null {
  if (result?.trim().toLowerCase().startsWith('resolved')) {
    return AssetStatus.ACTIVE;
  }
  if (STATUS_TRIGGER_TYPES.includes(maintenanceType)) {
    return AssetStatus.MAINTENANCE;
  }
  return null;
}

async function requireAsset(assetId: number): Promise<void> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) {
    throw new AppError(404, 'Asset not found');
  }
}

async function requireTechnician(technicianId: number): Promise<void> {
  const technician = await prisma.user.findUnique({
    where: { id: technicianId },
    select: { id: true },
  });
  if (!technician) {
    throw new AppError(404, 'Technician not found');
  }
}

export async function listMaintenances(query: ListMaintenanceQuery) {
  const where: Prisma.MaintenanceHistoryWhereInput = {};

  if (query.type) {
    where.maintenanceType = query.type;
  }
  if (query.assetId) {
    where.assetId = query.assetId;
  }
  if (query.technicianId) {
    where.technicianId = query.technicianId;
  }
  if (query.startDate || query.endDate) {
    where.maintenanceDate = {
      ...(query.startDate ? { gte: parseIsoDate(query.startDate) } : {}),
      ...(query.endDate ? { lte: parseIsoDate(query.endDate) } : {}),
    };
  }

  const [total, rows] = await prisma.$transaction([
    prisma.maintenanceHistory.count({ where }),
    prisma.maintenanceHistory.findMany({
      where,
      include: maintenanceInclude,
      orderBy: [{ maintenanceDate: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toMaintenance),
    pagination: buildPagination(query.page, query.limit, total),
  };
}

export async function getMaintenanceById(id: number) {
  const row = await prisma.maintenanceHistory.findUnique({
    where: { id },
    include: maintenanceInclude,
  });
  if (!row) {
    throw new AppError(404, 'Maintenance record not found');
  }
  return toMaintenance(row);
}

export async function getMaintenancesByAsset(assetId: number) {
  await requireAsset(assetId);

  const rows = await prisma.maintenanceHistory.findMany({
    where: { assetId },
    include: maintenanceInclude,
    orderBy: [{ maintenanceDate: 'desc' }, { id: 'desc' }],
  });

  return { items: rows.map(toMaintenance) };
}

export async function createMaintenance(
  input: CreateMaintenanceInput,
  requesterId: number,
) {
  await requireAsset(input.assetId);
  // The document has no user-directory endpoint; default to the caller.
  const technicianId = input.technicianId ?? requesterId;
  await requireTechnician(technicianId);

  const createdId = await prisma.$transaction(async (tx) => {
    const created = await tx.maintenanceHistory.create({
      data: {
        assetId: input.assetId,
        technicianId,
        maintenanceType: input.maintenanceType,
        maintenanceDate: parseIsoDate(input.maintenanceDate),
        description: input.description,
        result: input.result,
        cost: input.cost,
        nextSchedule: input.nextSchedule ? parseIsoDate(input.nextSchedule) : null,
      },
      select: { id: true },
    });

    const nextStatus = resolveAssetStatus(input.maintenanceType, input.result);
    if (nextStatus) {
      await tx.asset.update({
        where: { id: input.assetId },
        data: { status: nextStatus },
      });
    }

    return created.id;
  });

  return getMaintenanceById(createdId);
}

export async function updateMaintenance(id: number, input: UpdateMaintenanceInput) {
  const existing = await prisma.maintenanceHistory.findUnique({
    where: { id },
    select: {
      id: true,
      assetId: true,
      maintenanceType: true,
      result: true,
    },
  });
  if (!existing) {
    throw new AppError(404, 'Maintenance record not found');
  }

  if (input.technicianId !== undefined) {
    await requireTechnician(input.technicianId);
  }

  const { maintenanceDate, nextSchedule, ...scalars } = input;

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceHistory.update({
      where: { id },
      data: {
        ...scalars,
        ...(maintenanceDate === undefined
          ? {}
          : { maintenanceDate: parseIsoDate(maintenanceDate) }),
        ...(nextSchedule === undefined ? {} : { nextSchedule: parseIsoDate(nextSchedule) }),
      },
    });

    // Only the "Resolved" rule applies on update; changing the type never
    // silently reverts the asset status.
    if (
      input.result !== undefined &&
      input.result.trim().toLowerCase().startsWith('resolved')
    ) {
      await tx.asset.update({
        where: { id: existing.assetId },
        data: { status: AssetStatus.ACTIVE },
      });
    }
  });

  return getMaintenanceById(id);
}

export async function deleteMaintenance(id: number): Promise<void> {
  const existing = await prisma.maintenanceHistory.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, 'Maintenance record not found');
  }
  await prisma.maintenanceHistory.delete({ where: { id } });
}

export async function getMaintenanceStatistics() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [total, typeGroups, costAggregate, thisMonthCount, upcomingSchedules] =
    await Promise.all([
      prisma.maintenanceHistory.count(),
      prisma.maintenanceHistory.groupBy({ by: ['maintenanceType'], _count: { _all: true } }),
      prisma.maintenanceHistory.aggregate({ _sum: { cost: true } }),
      prisma.maintenanceHistory.count({
        where: { maintenanceDate: { gte: startOfMonth, lt: startOfNextMonth } },
      }),
      prisma.maintenanceHistory.count({
        where: { nextSchedule: { gte: today, lte: in30Days } },
      }),
    ]);

  const byType: Record<MaintenanceType, number> = {
    ROUTINE: 0,
    REPAIR: 0,
    UPGRADE: 0,
    INSPECTION: 0,
    REPLACEMENT: 0,
  };
  for (const group of typeGroups) {
    byType[group.maintenanceType] = group._count._all;
  }

  return {
    total,
    byType,
    totalCost: decimalToNumber(costAggregate._sum.cost) ?? 0,
    thisMonthCount,
    upcomingSchedules,
  };
}
