import type { PillTone } from '../components/StatusPill';
import type {
  AssetStatus,
  ConnectionStatus,
  MaintenanceType,
  RiskLevel,
} from '../types/api';

export const ASSET_STATUS_TONES: Record<AssetStatus, PillTone> = {
  ACTIVE: 'success',
  MAINTENANCE: 'warning',
  INACTIVE: 'neutral',
};

export const CONNECTION_TONES: Record<ConnectionStatus, PillTone> = {
  ONLINE: 'success',
  OFFLINE: 'danger',
  UNKNOWN: 'neutral',
};

export const RISK_TONES: Record<RiskLevel, PillTone> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export const MAINTENANCE_TYPE_TONES: Record<MaintenanceType, PillTone> = {
  ROUTINE: 'accent',
  REPAIR: 'danger',
  UPGRADE: 'accent',
  INSPECTION: 'neutral',
  REPLACEMENT: 'warning',
};
