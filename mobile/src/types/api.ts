export type Role = 'ADMIN' | 'TECHNICIAN';
export type AssetType =
  | 'SERVER'
  | 'SWITCH'
  | 'ROUTER'
  | 'STORAGE'
  | 'FIREWALL'
  | 'RACK'
  | 'OTHER';
export type AssetStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type ConnectionStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type MaintenanceType =
  | 'ROUTINE'
  | 'REPAIR'
  | 'UPGRADE'
  | 'INSPECTION'
  | 'REPLACEMENT';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetLocation {
  id: number;
  assetId: number;
  dataCenter: string;
  rack: string | null;
  rackSlot: string | null;
  floor: string | null;
  room: string | null;
  isCurrent: boolean;
  movedAt: string;
}

export interface NetworkInfo {
  id?: number;
  assetId?: number;
  hostname: string | null;
  ipAddress: string | null;
  subnetMask?: string | null;
  gateway?: string | null;
  macAddress?: string | null;
  connectionStatus: ConnectionStatus;
  lastChecked?: string | null;
  notes?: string | null;
}

export interface Asset {
  id: number;
  assetCode: string;
  assetName: string;
  assetType: AssetType;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
  status: AssetStatus;
  description: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  location: AssetLocation | null;
  network: NetworkInfo | null;
}

export interface TopFactor {
  name: string;
  impact: number;
  description: string;
}

export interface Prediction {
  id: number;
  assetId: number;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: number | null;
  topFactors: TopFactor[] | null;
  recommendation: string | null;
  predictedFailureDays: number | null;
  modelVersion: string;
  predictedAt: string;
  isActive: boolean;
  asset?: { id: number; assetCode: string; assetName: string };
}

export interface AssetDetail extends Asset {
  creator: { id: number; username: string; fullName: string } | null;
  locationHistory: AssetLocation[];
  maintenanceCount: number;
  latestPrediction: Prediction | null;
}

export interface MaintenanceRecord {
  id: number;
  assetId: number;
  technicianId: number | null;
  maintenanceType: MaintenanceType;
  maintenanceDate: string;
  description: string | null;
  result: string | null;
  cost: number | null;
  nextSchedule: string | null;
  createdAt: string;
  updatedAt: string;
  technician: { id: number; username: string; fullName: string } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface AssetStatistics {
  total: number;
  byStatus: Record<AssetStatus, number>;
  byType: Record<AssetType, number>;
  warrantyExpiringSoon: number;
  addedThisMonth: number;
}

export interface RiskSummary {
  counts: Record<RiskLevel, number>;
  averageScore: number;
  topRiskAssets: Array<{
    assetId: number;
    assetCode: string;
    assetName: string;
    riskScore: number;
    riskLevel: RiskLevel;
    predictedFailureDays: number | null;
    predictedAt: string;
  }>;
  assetsWithoutPrediction: number;
  lastPredictedAt: string | null;
}

export interface LayerBreakdown {
  layer1: { baseScore: number; factors: Array<{ name: string; raw: number; weight: number; impact: number }> };
  layer2: { adjustments: Record<string, number>; total: number };
  layer3: { boosts: Record<string, number>; total: number };
  final: number;
}

export interface RiskExplanation {
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

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: Array<{ field: string; message: string }>;
}
