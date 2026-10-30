import { AssetStatus, AssetType, type Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, buildPagination } from '../../utils/response.js';
import { decimalToNumber, parseIsoDate, toIsoDate } from '../../utils/serialize.js';
import type { CreateAssetInput, ListAssetQuery, UpdateAssetInput } from './asset.schema.js';

const listInclude = {
  locations: {
    where: { isCurrent: true },
    orderBy: { movedAt: 'desc' },
    take: 1,
  },
  networkInformation: {
    select: { connectionStatus: true, hostname: true, ipAddress: true },
  },
} satisfies Prisma.AssetInclude;

const detailInclude = {
  creator: { select: { id: true, username: true, fullName: true } },
  locations: { orderBy: { movedAt: 'desc' } },
  networkInformation: true,
  predictions: {
    where: { isActive: true },
    orderBy: { predictedAt: 'desc' },
    take: 1,
  },
  _count: { select: { maintenances: true } },
} satisfies Prisma.AssetInclude;

type AssetListRow = Prisma.AssetGetPayload<{ include: typeof listInclude }>;
type AssetDetailRow = Prisma.AssetGetPayload<{ include: typeof detailInclude }>;

function toListAsset(asset: AssetListRow) {
  const { locations, networkInformation, ...rest } = asset;
  return {
    ...rest,
    purchaseDate: toIsoDate(rest.purchaseDate),
    warrantyEnd: toIsoDate(rest.warrantyEnd),
    location: locations[0] ?? null,
    network: networkInformation,
  };
}

function toDetailAsset(asset: AssetDetailRow) {
  const { locations, networkInformation, predictions, _count, ...rest } = asset;
  const latest = predictions[0];

  return {
    ...rest,
    purchaseDate: toIsoDate(rest.purchaseDate),
    warrantyEnd: toIsoDate(rest.warrantyEnd),
    location: locations.find((row) => row.isCurrent) ?? locations[0] ?? null,
    locationHistory: locations,
    network: networkInformation,
    maintenanceCount: _count.maintenances,
    latestPrediction: latest
      ? {
          ...latest,
          riskScore: Number(latest.riskScore),
          confidence: decimalToNumber(latest.confidence),
        }
      : null,
  };
}

async function assertUniqueAssetFields(
  assetCode: string | undefined,
  serialNumber: string | undefined,
  excludeId?: number,
): Promise<void> {
  if (!assetCode && !serialNumber) {
    return;
  }

  const duplicate = await prisma.asset.findFirst({
    where: {
      ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
      OR: [
        ...(assetCode ? [{ assetCode }] : []),
        ...(serialNumber ? [{ serialNumber }] : []),
      ],
    },
    select: { assetCode: true, serialNumber: true },
  });

  if (!duplicate) {
    return;
  }

  if (assetCode && duplicate.assetCode === assetCode) {
    const message = 'An asset with this asset code already exists';
    throw new AppError(409, message, [{ field: 'assetCode', message }]);
  }

  const message = 'An asset with this serial number already exists';
  throw new AppError(409, message, [{ field: 'serialNumber', message }]);
}

export async function listAssets(query: ListAssetQuery) {
  const where: Prisma.AssetWhereInput = {};

  if (query.search) {
    where.OR = [
      { assetCode: { contains: query.search, mode: 'insensitive' } },
      { assetName: { contains: query.search, mode: 'insensitive' } },
      { serialNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.type) {
    where.assetType = query.type;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.rack) {
    where.locations = {
      some: { isCurrent: true, rack: { equals: query.rack, mode: 'insensitive' } },
    };
  }

  // sortBy/order come from a validated union; the computed key is safe.
  const orderBy = { [query.sortBy]: query.order } as Prisma.AssetOrderByWithRelationInput;

  const [total, assets] = await prisma.$transaction([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      include: listInclude,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: assets.map(toListAsset),
    pagination: buildPagination(query.page, query.limit, total),
  };
}

export async function getAssetById(id: number) {
  const asset = await prisma.asset.findUnique({ where: { id }, include: detailInclude });
  if (!asset) {
    throw new AppError(404, 'Asset not found');
  }
  return toDetailAsset(asset);
}

export async function createAsset(input: CreateAssetInput, requesterId: number) {
  await assertUniqueAssetFields(input.assetCode, input.serialNumber);

  const created = await prisma.asset.create({
    data: {
      assetCode: input.assetCode,
      assetName: input.assetName,
      assetType: input.assetType,
      brand: input.brand,
      model: input.model,
      serialNumber: input.serialNumber,
      purchaseDate: input.purchaseDate ? parseIsoDate(input.purchaseDate) : null,
      warrantyEnd: input.warrantyEnd ? parseIsoDate(input.warrantyEnd) : null,
      status: input.status,
      description: input.description,
      createdBy: requesterId,
      locations: input.location
        ? { create: { ...input.location, isCurrent: true } }
        : undefined,
      networkInformation: input.network ? { create: { ...input.network } } : undefined,
    },
    select: { id: true },
  });

  return getAssetById(created.id);
}

export async function updateAsset(id: number, input: UpdateAssetInput) {
  const existing = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, assetCode: true, serialNumber: true },
  });
  if (!existing) {
    throw new AppError(404, 'Asset not found');
  }

  if (input.assetCode !== undefined || input.serialNumber !== undefined) {
    await assertUniqueAssetFields(input.assetCode, input.serialNumber, id);
  }

  const { location, network, purchaseDate, warrantyEnd, ...scalars } = input;

  await prisma.$transaction(async (tx) => {
    await tx.asset.update({
      where: { id },
      data: {
        ...scalars,
        ...(purchaseDate === undefined ? {} : { purchaseDate: parseIsoDate(purchaseDate) }),
        ...(warrantyEnd === undefined ? {} : { warrantyEnd: parseIsoDate(warrantyEnd) }),
      },
    });

    if (location) {
      await tx.assetLocation.updateMany({
        where: { assetId: id, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.assetLocation.create({
        data: { assetId: id, ...location, isCurrent: true },
      });
    }

    if (network) {
      await tx.networkInformation.upsert({
        where: { assetId: id },
        update: { ...network },
        create: { assetId: id, ...network },
      });
    }
  });

  return getAssetById(id);
}

export async function deleteAsset(id: number): Promise<void> {
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { maintenances: true, predictions: true } },
    },
  });

  if (!asset) {
    throw new AppError(404, 'Asset not found');
  }

  if (asset._count.maintenances > 0 || asset._count.predictions > 0) {
    throw new AppError(
      409,
      'Asset has maintenance or prediction history and cannot be deleted',
    );
  }

  // Children without an audit trail are removed explicitly; assets with
  // maintenance/prediction rows were rejected above so history survives.
  await prisma.$transaction([
    prisma.assetLocation.deleteMany({ where: { assetId: id } }),
    prisma.networkInformation.deleteMany({ where: { assetId: id } }),
    prisma.asset.delete({ where: { id } }),
  ]);
}

export async function getAssetStatistics() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [total, statusGroups, typeGroups, warrantyExpiringSoon, addedThisMonth] =
    await Promise.all([
      prisma.asset.count(),
      prisma.asset.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.asset.groupBy({ by: ['assetType'], _count: { _all: true } }),
      prisma.asset.count({ where: { warrantyEnd: { gte: today, lte: in30Days } } }),
      prisma.asset.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);

  const byStatus: Record<AssetStatus, number> = {
    ACTIVE: 0,
    MAINTENANCE: 0,
    INACTIVE: 0,
  };
  for (const group of statusGroups) {
    byStatus[group.status] = group._count._all;
  }

  const byType: Record<AssetType, number> = {
    SERVER: 0,
    SWITCH: 0,
    ROUTER: 0,
    STORAGE: 0,
    FIREWALL: 0,
    RACK: 0,
    OTHER: 0,
  };
  for (const group of typeGroups) {
    byType[group.assetType] = group._count._all;
  }

  return { total, byStatus, byType, warrantyExpiringSoon, addedThisMonth };
}
