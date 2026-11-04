import {
  AssetStatus,
  MaintenanceType,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../config/database.js';
import { dispatchPush } from '../notification/push.provider.js';
import { AppError, buildPagination } from '../../utils/response.js';
import { decimalToNumber, parseIsoDate, toIsoDate } from '../../utils/serialize.js';
import type {
  CreateMaintenanceInput,
  ListMaintenanceQuery,
  ScheduleQuery,
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

const DAY_MS = 24 * 60 * 60 * 1000;
/** Reminders go out for overdue rows and rows due within this many days. */
export const REMINDER_HORIZON_DAYS = 7;
/** The board view (used for the tab counts) always spans overdue + 30 days. */
const BOARD_WINDOW_DAYS = 30;
const DUE_SOON_DAYS = 7;

export type ScheduleState = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';

const scheduleInclude = {
  asset: {
    select: {
      id: true,
      assetCode: true,
      assetName: true,
      assetType: true,
      status: true,
    },
  },
} satisfies Prisma.MaintenanceHistoryInclude;

type ScheduleRow = Prisma.MaintenanceHistoryGetPayload<{
  include: typeof scheduleInclude;
}>;

/** Date-only schedules live at UTC midnight; "today" is the UTC date. */
function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysUntil(today: Date, date: Date): number {
  return Math.round((date.getTime() - today.getTime()) / DAY_MS);
}

function scheduleState(days: number): ScheduleState {
  if (days < 0) {
    return 'OVERDUE';
  }
  return days <= DUE_SOON_DAYS ? 'DUE_SOON' : 'UPCOMING';
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatDueDate(value: Date): string {
  return `${value.getUTCDate()} ${MONTHS_SHORT[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

function reminderMessage(row: ScheduleRow, days: number): string {
  const due = row.nextSchedule ? formatDueDate(row.nextSchedule) : '-';
  const timing =
    days < 0
      ? `terlewat ${Math.abs(days)} hari`
      : days === 0
        ? 'jatuh tempo hari ini'
        : `dalam ${days} hari`;
  const result = row.result?.trim();
  const lastResult =
    result && result.length > 0
      ? ` Hasil terakhir: ${result.length > 180 ? `${result.slice(0, 180)}...` : result}.`
      : ' Belum ada hasil perawatan yang dicatat.';
  return `Jadwal maintenance ${row.asset.assetCode} (${row.asset.assetName}) ${timing} - jatuh tempo ${due}.${lastResult}`;
}

/**
 * A flat, overdue-first view of every `nextSchedule` within the board window.
 * `items` honours the requested window and `includeOverdue`; `counts` always
 * covers the whole board (overdue + 30 days) so the UI tabs keep stable
 * badges while the list changes.
 */
export async function getMaintenanceSchedule(query: ScheduleQuery) {
  const today = utcToday();
  const boardEnd = addDays(today, BOARD_WINDOW_DAYS);

  const rows = await prisma.maintenanceHistory.findMany({
    where: { nextSchedule: { not: null, lte: boardEnd } },
    include: scheduleInclude,
    orderBy: [{ nextSchedule: 'asc' }, { id: 'asc' }],
  });

  const counts = { overdue: 0, dueSoon: 0, upcoming: 0, total: 0 };
  const bucket: Record<ScheduleState, 'overdue' | 'dueSoon' | 'upcoming'> = {
    OVERDUE: 'overdue',
    DUE_SOON: 'dueSoon',
    UPCOMING: 'upcoming',
  };
  const items: Array<{
    maintenanceId: number;
    assetId: number;
    asset: ScheduleRow['asset'];
    maintenanceType: ScheduleRow['maintenanceType'];
    maintenanceDate: string | null;
    nextSchedule: string | null;
    daysUntil: number;
    state: ScheduleState;
    lastResult: string | null;
  }> = [];

  for (const row of rows) {
    if (!row.nextSchedule) {
      continue;
    }
    const days = daysUntil(today, row.nextSchedule);
    const state = scheduleState(days);
    counts[bucket[state]] += 1;
    counts.total += 1;

    if (days > query.window || (state === 'OVERDUE' && !query.includeOverdue)) {
      continue;
    }

    items.push({
      maintenanceId: row.id,
      assetId: row.assetId,
      asset: row.asset,
      maintenanceType: row.maintenanceType,
      maintenanceDate: toIsoDate(row.maintenanceDate),
      nextSchedule: toIsoDate(row.nextSchedule),
      daysUntil: days,
      state,
      lastResult: row.result,
    });
  }

  return {
    window: query.window,
    includeOverdue: query.includeOverdue,
    today: toIsoDate(today),
    counts,
    items,
  };
}

export interface ReminderScanResult {
  scanned: number;
  created: number;
  skipped: number;
}

/**
 * Fans out `MAINTENANCE_REMINDER` rows to every active user for schedules that
 * are overdue or due within {@link REMINDER_HORIZON_DAYS}. The unique
 * `(userId, dedupeKey)` index makes repeated runs idempotent; deleting a
 * notification frees its key, so a later run may recreate it.
 */
export async function createMaintenanceReminders(): Promise<ReminderScanResult> {
  const today = utcToday();
  const horizonEnd = addDays(today, REMINDER_HORIZON_DAYS);

  const [dueRows, users] = await Promise.all([
    prisma.maintenanceHistory.findMany({
      where: { nextSchedule: { not: null, lte: horizonEnd } },
      include: scheduleInclude,
      orderBy: [{ nextSchedule: 'asc' }, { id: 'asc' }],
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);

  if (dueRows.length === 0 || users.length === 0) {
    return { scanned: dueRows.length, created: 0, skipped: 0 };
  }

  const data = dueRows.flatMap((row) => {
    if (!row.nextSchedule) {
      return [];
    }
    const days = daysUntil(today, row.nextSchedule);
    const dedupeKey = `${row.id}:${toIsoDate(row.nextSchedule)}`;
    return users.map((user) => ({
      userId: user.id,
      assetId: row.assetId,
      maintenanceId: row.id,
      type: 'MAINTENANCE_REMINDER' as const,
      title: `Pengingat maintenance: ${row.asset.assetCode}`,
      message: reminderMessage(row, days),
      dedupeKey,
    }));
  });

  // Push must mirror only rows inserted by this statement, not the whole
  // reminder set: otherwise every daily scan would re-notify every device.
  // `createManyAndReturn` also keeps overlapping runs honest, since only the
  // run that actually inserted a row dispatches its push.
  const inserted = await prisma.notification.createManyAndReturn({
    data,
    skipDuplicates: true,
  });

  const byMaintenance = new Map<number, typeof inserted>();
  for (const row of inserted) {
    const group = byMaintenance.get(row.maintenanceId as number) ?? [];
    group.push(row);
    byMaintenance.set(row.maintenanceId as number, group);
  }
  for (const [maintenanceId, group] of byMaintenance) {
    const first = group[0];
    if (!first) {
      continue;
    }
    dispatchPush(
      group.map((row) => row.userId),
      {
        title: first.title,
        body: first.message,
        data: {
          type: 'MAINTENANCE_REMINDER',
          assetId: String(first.assetId),
          maintenanceId: String(maintenanceId),
          deepLink: `/maintenance/${maintenanceId}`,
        },
      },
    );
  }

  return {
    scanned: dueRows.length,
    created: inserted.length,
    skipped: data.length - inserted.length,
  };
}
