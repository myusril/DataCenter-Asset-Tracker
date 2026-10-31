import type {
  AssetStatus,
  AssetType,
  ConnectionStatus,
  MaintenanceType,
  RiskLevel,
  Role,
} from '../types/api';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  SERVER: 'Server',
  SWITCH: 'Switch',
  ROUTER: 'Router',
  STORAGE: 'Storage',
  FIREWALL: 'Firewall',
  RACK: 'Rack',
  OTHER: 'Lainnya',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: 'Aktif',
  MAINTENANCE: 'Maintenance',
  INACTIVE: 'Nonaktif',
};

export const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  UNKNOWN: 'Belum diketahui',
};

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  ROUTINE: 'Rutin',
  REPAIR: 'Perbaikan',
  UPGRADE: 'Upgrade',
  INSPECTION: 'Inspeksi',
  REPLACEMENT: 'Penggantian',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  TECHNICIAN: 'Teknisi',
};

const MONTHS = [
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

/** Formats a `YYYY-MM-DD` string without timezone drift. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** Formats an ISO timestamp as local date and time. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()} ${hours}:${minutes}`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) {
    return 'Selamat pagi';
  }
  if (hour < 15) {
    return 'Selamat siang';
  }
  if (hour < 19) {
    return 'Selamat sore';
  }
  return 'Selamat malam';
}
