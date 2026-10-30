import { z } from 'zod';

// Validation and the plain domain types shared by the pure scoring layers.
// Nothing here imports Prisma at runtime so the engine can be unit-tested
// without a database connection.

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const listPredictionQuerySchema = z.object({
  assetId: z.coerce.number().int().positive().optional(),
  riskLevel: riskLevelSchema.optional(),
  activeOnly: z
    .enum(['true', 'false'], { message: 'activeOnly must be "true" or "false"' })
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const batchPredictSchema = z.object({
  assetIds: z.array(z.coerce.number().int().positive()).min(1).optional(),
});

export type ListPredictionQuery = z.infer<typeof listPredictionQuerySchema>;
export type BatchPredictInput = z.infer<typeof batchPredictSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export type MaintenanceTypeName =
  | 'ROUTINE'
  | 'REPAIR'
  | 'UPGRADE'
  | 'INSPECTION'
  | 'REPLACEMENT';
export type AssetStatusName = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type ConnectionStatusName = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface MaintenanceRecord {
  maintenanceType: MaintenanceTypeName;
  maintenanceDate: Date;
  result?: string | null;
  nextSchedule?: Date | null;
}

/** Everything the engine needs about the asset being scored. */
export interface AssetScoringInput {
  assetId: number;
  assetCode: string;
  assetName: string;
  assetType: string;
  status: AssetStatusName;
  purchaseDate: Date | null;
  createdAt: Date;
  networkStatus: ConnectionStatusName | null;
  maintenances: MaintenanceRecord[];
}

/** Same-type asset used by the statistical layer; never includes the subject. */
export interface PeerScoringInput {
  assetId: number;
  assetType: string;
  maintenances: MaintenanceRecord[];
}

export interface Layer1Factor {
  name: 'frequency' | 'incidents' | 'age' | 'status' | 'network';
  /** Normalized value in 0..100. */
  raw: number;
  weight: number;
  /** raw * weight, rounded to 2 decimals. */
  impact: number;
}

export interface Layer2Adjustments {
  zScore: number;
  trend: number;
  interval: number;
  peer: number;
}

export interface Layer3Boosts {
  downtimeOffline: number;
  downtimeRepair: number;
  repairRatio: number;
  daysSince: number;
}

export interface LayerBreakdown {
  layer1: { baseScore: number; factors: Layer1Factor[] };
  layer2: { adjustments: Layer2Adjustments; total: number };
  layer3: { boosts: Layer3Boosts; total: number };
  final: number;
}

export interface TopFactor {
  name: string;
  impact: number;
  description: string;
}

export interface RiskAssessment {
  assetId: number;
  assetCode: string;
  assetName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  predictedFailureDays: number;
  shortSummary: string;
  explanation: string;
  topFactors: TopFactor[];
  recommendation: string;
  layerBreakdown: LayerBreakdown;
  modelVersion: string;
}
