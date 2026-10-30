import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError, buildPagination } from '../../utils/response.js';
import { decimalToNumber } from '../../utils/serialize.js';
import { buildNarrative, buildTopFactors, riskLevelForScore } from './ai.explanation.js';
import { computePatternBoosts } from './ai.pattern.js';
import {
  countWithinDays,
  computeStatisticalAdjustment,
  round2,
} from './ai.statistical.js';
import type {
  AssetScoringInput,
  BatchPredictInput,
  Layer1Factor,
  ListPredictionQuery,
  MaintenanceRecord,
  PeerScoringInput,
  RiskAssessment,
  RiskLevel,
} from './ai.schema.js';

// Orchestration: gather inputs, run the three pure layers, persist the active
// prediction, deactivate the previous one, and fan out HIGH-risk alerts.
// The engine is a deterministic heuristic, not a trained model.

export const MODEL_VERSION = 'v1.0';

const DAY_MS = 24 * 60 * 60 * 1000;

const LAYER1_WEIGHTS = {
  frequency: 0.25,
  incidents: 0.2,
  age: 0.15,
  status: 0.15,
  network: 0.05,
} as const;

const STATUS_SCORE: Record<AssetScoringInput['status'], number> = {
  ACTIVE: 0,
  MAINTENANCE: 100,
  INACTIVE: 60,
};

const NETWORK_SCORE: Record<'ONLINE' | 'OFFLINE' | 'UNKNOWN', number> = {
  ONLINE: 0,
  UNKNOWN: 50,
  OFFLINE: 100,
};

const maintenanceSelect = {
  select: {
    maintenanceType: true,
    maintenanceDate: true,
    result: true,
    nextSchedule: true,
  },
} as const;

const predictionAssetSelect = {
  select: { id: true, assetCode: true, assetName: true },
} as const;

interface MaintenanceRow {
  maintenanceType: MaintenanceRecord['maintenanceType'];
  maintenanceDate: Date;
  result: string | null;
  nextSchedule: Date | null;
}

function toMaintenanceRecords(rows: MaintenanceRow[]): MaintenanceRecord[] {
  return rows.map((row) => ({
    maintenanceType: row.maintenanceType,
    maintenanceDate: row.maintenanceDate,
    result: row.result,
    nextSchedule: row.nextSchedule,
  }));
}

function recentRepairCount(asset: AssetScoringInput, now: Date): number {
  return countWithinDays(
    asset.maintenances.filter((row) => row.maintenanceType === 'REPAIR'),
    90,
    now,
  );
}

function ageDaysOf(asset: AssetScoringInput, now: Date): number {
  const reference = asset.purchaseDate ?? asset.createdAt;
  return (now.getTime() - reference.getTime()) / DAY_MS;
}

export function computeRuleFactors(
  asset: AssetScoringInput,
  now: Date,
): { baseScore: number; factors: Layer1Factor[] } {
  const frequencyCount = countWithinDays(asset.maintenances, 90, now);
  const repairCount = recentRepairCount(asset, now);
  const ageYears = Math.max(ageDaysOf(asset, now), 0) / 365;

  const raw: Record<Layer1Factor['name'], number> = {
    frequency: Math.min(frequencyCount / 5, 1) * 100,
    incidents: Math.min(repairCount / 4, 1) * 100,
    age: Math.min(ageYears / 5, 1) * 100,
    status: STATUS_SCORE[asset.status],
    network: asset.networkStatus === null ? 50 : NETWORK_SCORE[asset.networkStatus],
  };

  const names: Layer1Factor['name'][] = [
    'frequency',
    'incidents',
    'age',
    'status',
    'network',
  ];
  const factors = names.map((name) => {
    const weight = LAYER1_WEIGHTS[name];
    return {
      name,
      raw: round2(raw[name]),
      weight,
      impact: round2(raw[name] * weight),
    };
  });

  const baseScore = round2(
    names.reduce((sum, name) => sum + raw[name] * LAYER1_WEIGHTS[name], 0),
  );

  return { baseScore, factors };
}

function computeConfidence(asset: AssetScoringInput, now: Date): number {
  const score =
    50 +
    Math.min(asset.maintenances.length, 5) * 5 +
    (asset.networkStatus !== null ? 10 : 0) +
    (asset.purchaseDate !== null ? 10 : 0) +
    (ageDaysOf(asset, now) >= 90 ? 5 : 0);
  return Math.min(score, 95);
}

export function assessRisk(
  asset: AssetScoringInput,
  peers: PeerScoringInput[],
  now: Date = new Date(),
): RiskAssessment {
  const layer1 = computeRuleFactors(asset, now);
  const layer2 = computeStatisticalAdjustment(asset, peers, now);
  const layer3 = computePatternBoosts(asset, now);

  const final = round2(
    Math.min(Math.max(layer1.baseScore + layer2.total + layer3.total, 0), 100),
  );
  const riskLevel = riskLevelForScore(final);
  const topFactors = buildTopFactors(layer1.factors, layer2.adjustments, layer3.boosts);
  const narrative = buildNarrative(asset, final, riskLevel, topFactors);
  const confidence = computeConfidence(asset, now);
  const predictedFailureDays = Math.min(
    Math.max(Math.round((100 - final) * 0.9), 3),
    365,
  );

  return {
    assetId: asset.assetId,
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    riskScore: final,
    riskLevel,
    confidence,
    predictedFailureDays,
    shortSummary: narrative.shortSummary,
    explanation: narrative.explanation,
    topFactors,
    recommendation: narrative.recommendation,
    layerBreakdown: {
      layer1,
      layer2,
      layer3,
      final,
    },
    modelVersion: MODEL_VERSION,
  };
}

interface ScoringBundle {
  asset: AssetScoringInput;
  peers: PeerScoringInput[];
}

async function loadScoringBundle(assetId: number): Promise<ScoringBundle> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      assetCode: true,
      assetName: true,
      assetType: true,
      status: true,
      purchaseDate: true,
      createdAt: true,
      networkInformation: { select: { connectionStatus: true } },
      maintenances: maintenanceSelect,
    },
  });

  if (!asset) {
    throw new AppError(404, 'Asset not found');
  }

  const peerRows = await prisma.asset.findMany({
    where: { assetType: asset.assetType, id: { not: assetId } },
    select: { id: true, assetType: true, maintenances: maintenanceSelect },
  });

  return {
    asset: {
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      assetType: asset.assetType,
      status: asset.status,
      purchaseDate: asset.purchaseDate,
      createdAt: asset.createdAt,
      networkStatus: asset.networkInformation?.connectionStatus ?? null,
      maintenances: toMaintenanceRecords(asset.maintenances),
    },
    peers: peerRows.map((peer) => ({
      assetId: peer.id,
      assetType: peer.assetType,
      maintenances: toMaintenanceRecords(peer.maintenances),
    })),
  };
}

interface PredictResult extends RiskAssessment {
  id: number;
  predictedAt: Date;
  isActive: boolean;
  alertsCreated: number;
}

export async function predictAsset(assetId: number): Promise<PredictResult> {
  const { asset, peers } = await loadScoringBundle(assetId);
  const assessment = assessRisk(asset, peers);

  const stored = await prisma.$transaction(async (tx) => {
    await tx.aiPrediction.updateMany({
      where: { assetId, isActive: true },
      data: { isActive: false },
    });

    const created = await tx.aiPrediction.create({
      data: {
        assetId,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        confidence: assessment.confidence,
        topFactors: assessment.topFactors as unknown as Prisma.InputJsonValue,
        recommendation: assessment.recommendation,
        predictedFailureDays: assessment.predictedFailureDays,
        modelVersion: MODEL_VERSION,
        isActive: true,
      },
      select: { id: true, predictedAt: true },
    });

    return { created, alertsCreated: 0 };
  });

  return {
    ...assessment,
    id: stored.created.id,
    predictedAt: stored.created.predictedAt,
    isActive: true,
    alertsCreated: stored.alertsCreated,
  };
}

export async function explainAsset(assetId: number): Promise<RiskAssessment> {
  const { asset, peers } = await loadScoringBundle(assetId);
  return assessRisk(asset, peers);
}

type PredictionWithAsset = Prisma.AiPredictionGetPayload<{
  include: { asset: typeof predictionAssetSelect };
}>;

function serializePrediction(row: PredictionWithAsset) {
  return {
    ...row,
    riskScore: Number(row.riskScore),
    confidence: decimalToNumber(row.confidence),
  };
}

export async function listPredictions(query: ListPredictionQuery) {

  const where: Prisma.AiPredictionWhereInput = {};
  if (query.assetId) {
    where.assetId = query.assetId;
  }
  if (query.riskLevel) {
    where.riskLevel = query.riskLevel;
  }
  if (query.activeOnly !== undefined) {
    where.isActive = query.activeOnly;
  }

  const [total, rows] = await prisma.$transaction([
    prisma.aiPrediction.count({ where }),
    prisma.aiPrediction.findMany({
      where,
      include: { asset: predictionAssetSelect },
      orderBy: [{ predictedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(serializePrediction),
    pagination: buildPagination(query.page, query.limit, total),
  };
}

export async function getAssetPredictions(assetId: number) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true },
  });
  if (!asset) {
    throw new AppError(404, 'Asset not found');
  }

  const rows = await prisma.aiPrediction.findMany({
    where: { assetId },
    include: { asset: predictionAssetSelect },
    orderBy: [{ predictedAt: 'desc' }, { id: 'desc' }],
  });

  return { items: rows.map(serializePrediction) };
}

export async function getRiskSummary() {
  const [activeRows, assetsWithoutPrediction, latest] = await Promise.all([
    prisma.aiPrediction.findMany({
      where: { isActive: true },
      include: { asset: predictionAssetSelect },
      orderBy: [{ riskScore: 'desc' }, { id: 'desc' }],
    }),
    prisma.asset.count({ where: { predictions: { none: {} } } }),
    prisma.aiPrediction.findFirst({
      orderBy: { predictedAt: 'desc' },
      select: { predictedAt: true },
    }),
  ]);

  const counts: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  let scoreTotal = 0;
  for (const row of activeRows) {
    counts[row.riskLevel] += 1;
    scoreTotal += Number(row.riskScore);
  }

  const topRiskAssets = activeRows
    .filter((row) => row.riskLevel !== 'LOW')
    .slice(0, 5)
    .map((row) => ({
      assetId: row.assetId,
      assetCode: row.asset.assetCode,
      assetName: row.asset.assetName,
      riskScore: Number(row.riskScore),
      riskLevel: row.riskLevel,
      predictedFailureDays: row.predictedFailureDays,
      predictedAt: row.predictedAt,
    }));

  return {
    counts,
    averageScore:
      activeRows.length === 0 ? 0 : round2(scoreTotal / activeRows.length),
    topRiskAssets,
    assetsWithoutPrediction,
    lastPredictedAt: latest?.predictedAt ?? null,
  };
}

export interface BatchPredictSummary {
  processed: number;
  high: number;
  medium: number;
  low: number;
  alertsCreated: number;
  failed: Array<{ assetId: number; message: string }>;
}

export async function predictBatch(
  input: BatchPredictInput,
): Promise<BatchPredictSummary> {
  const assetIds =
    input.assetIds ??
    (await prisma.asset.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map(
      (asset) => asset.id,
    );

  const summary: BatchPredictSummary = {
    processed: 0,
    high: 0,
    medium: 0,
    low: 0,
    alertsCreated: 0,
    failed: [],
  };

  for (const assetId of assetIds) {
    try {
      const result = await predictAsset(assetId);
      summary.processed += 1;
      if (result.riskLevel === 'HIGH') {
        summary.high += 1;
      } else if (result.riskLevel === 'MEDIUM') {
        summary.medium += 1;
      } else {
        summary.low += 1;
      }
      summary.alertsCreated += result.alertsCreated;
    } catch (error) {
      summary.failed.push({
        assetId,
        message: error instanceof AppError ? error.message : 'Prediction failed',
      });
    }
  }

  return summary;
}
