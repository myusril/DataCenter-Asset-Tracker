import {
  AssetStatus,
  AssetType,
  ConnectionStatus,
  MaintenanceType,
  PrismaClient,
  Role,
} from '@prisma/client';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();

const dateOnly = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

interface SeedAsset {
  assetCode: string;
  assetName: string;
  assetType: AssetType;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyEnd: string;
  status: AssetStatus;
  description: string;
  createdAt: string;
  location: { dataCenter: string; rack: string; rackSlot: string; floor: string };
  network?: {
    hostname: string;
    ipAddress: string;
    subnetMask: string;
    gateway: string;
    macAddress: string;
    connectionStatus: ConnectionStatus;
    notes: string;
  };
}

const ASSETS: SeedAsset[] = [
  {
    assetCode: 'SRV-001',
    assetName: 'WEB Server 01',
    assetType: AssetType.SERVER,
    brand: 'Dell',
    model: 'PowerEdge R750',
    serialNumber: 'SN-DC-SRV-001',
    purchaseDate: '2024-02-10',
    warrantyEnd: '2027-02-10',
    status: AssetStatus.ACTIVE,
    description: 'Web server produksi untuk aplikasi internal',
    createdAt: '2026-06-01T08:00:00.000Z',
    location: { dataCenter: 'DC-1', rack: 'A', rackSlot: 'U03', floor: '1' },
    network: {
      hostname: 'web-srv-01',
      ipAddress: '192.168.1.10',
      subnetMask: '255.255.255.0',
      gateway: '192.168.1.1',
      macAddress: 'AA:BB:CC:00:00:01',
      connectionStatus: ConnectionStatus.ONLINE,
      notes: 'VLAN 10 - produksi',
    },
  },
  {
    assetCode: 'SRV-004',
    assetName: 'DB Server 01',
    assetType: AssetType.SERVER,
    brand: 'HPE',
    model: 'ProLiant DL380 Gen10',
    serialNumber: 'SN-DC-SRV-004',
    purchaseDate: '2024-05-22',
    warrantyEnd: '2027-05-22',
    status: AssetStatus.ACTIVE,
    description: 'Database server PostgreSQL',
    createdAt: '2026-07-15T09:30:00.000Z',
    location: { dataCenter: 'DC-1', rack: 'B', rackSlot: 'U10', floor: '1' },
    network: {
      hostname: 'db-srv-01',
      ipAddress: '10.0.0.5',
      subnetMask: '255.255.255.0',
      gateway: '10.0.0.1',
      macAddress: 'AA:BB:CC:00:00:02',
      connectionStatus: ConnectionStatus.ONLINE,
      notes: 'VLAN 20 - database',
    },
  },
  {
    assetCode: 'SW-001',
    assetName: 'Core Switch',
    assetType: AssetType.SWITCH,
    brand: 'Cisco',
    model: 'Catalyst 9300',
    serialNumber: 'SN-DC-SW-001',
    purchaseDate: '2023-11-03',
    warrantyEnd: '2026-11-15',
    status: AssetStatus.ACTIVE,
    description: 'Switch core distribusi DC-1',
    createdAt: '2026-06-01T08:15:00.000Z',
    location: { dataCenter: 'DC-1', rack: 'A', rackSlot: 'U20', floor: '1' },
    network: {
      hostname: 'core-sw-01',
      ipAddress: '192.168.1.2',
      subnetMask: '255.255.255.0',
      gateway: '192.168.1.1',
      macAddress: 'AA:BB:CC:00:00:03',
      connectionStatus: ConnectionStatus.ONLINE,
      notes: 'Management VLAN 99',
    },
  },
  {
    assetCode: 'RT-001',
    assetName: 'Edge Router',
    assetType: AssetType.ROUTER,
    brand: 'MikroTik',
    model: 'CCR2004-1G-12S+2XS',
    serialNumber: 'SN-DC-RT-001',
    purchaseDate: '2023-08-19',
    warrantyEnd: '2026-08-19',
    status: AssetStatus.ACTIVE,
    description: 'Router tepi ke ISP utama',
    createdAt: '2026-08-01T10:00:00.000Z',
    location: { dataCenter: 'DC-1', rack: 'A', rackSlot: 'U01', floor: '1' },
    network: {
      hostname: 'edge-rt-01',
      ipAddress: '192.168.1.1',
      subnetMask: '255.255.255.0',
      gateway: '103.10.10.1',
      macAddress: 'AA:BB:CC:00:00:04',
      connectionStatus: ConnectionStatus.ONLINE,
      notes: 'BGP ke ISP utama',
    },
  },
  {
    assetCode: 'STG-001',
    assetName: 'Storage Array',
    assetType: AssetType.STORAGE,
    brand: 'Synology',
    model: 'RS4021xs+',
    serialNumber: 'SN-DC-STG-001',
    purchaseDate: '2023-05-11',
    warrantyEnd: '2026-05-11',
    status: AssetStatus.MAINTENANCE,
    description: 'Storage backup dan arsip, disk 3 dalam perbaikan',
    createdAt: '2026-08-20T13:45:00.000Z',
    location: { dataCenter: 'DC-1', rack: 'C', rackSlot: 'U05', floor: '1' },
    network: {
      hostname: 'storage-01',
      ipAddress: '10.0.1.20',
      subnetMask: '255.255.255.0',
      gateway: '10.0.1.1',
      macAddress: 'AA:BB:CC:00:00:05',
      connectionStatus: ConnectionStatus.OFFLINE,
      notes: 'Disk 3 degraded, menunggu penggantian',
    },
  },
  {
    assetCode: 'FW-001',
    assetName: 'Perimeter Firewall',
    assetType: AssetType.FIREWALL,
    brand: 'Fortinet',
    model: 'FortiGate 100F',
    serialNumber: 'SN-DC-FW-001',
    purchaseDate: '2024-01-08',
    warrantyEnd: '2027-01-08',
    status: AssetStatus.ACTIVE,
    description: 'Firewall perimeter DC-2',
    createdAt: '2026-09-10T11:20:00.000Z',
    location: { dataCenter: 'DC-2', rack: 'D', rackSlot: 'U02', floor: '2' },
    network: {
      hostname: 'fw-01',
      ipAddress: '10.0.2.1',
      subnetMask: '255.255.255.0',
      gateway: '10.0.2.254',
      macAddress: 'AA:BB:CC:00:00:06',
      connectionStatus: ConnectionStatus.UNKNOWN,
      notes: 'Belum dicek setelah pemeliharaan ISP',
    },
  },
  {
    assetCode: 'RACK-001',
    assetName: 'Rack A1',
    assetType: AssetType.RACK,
    brand: 'Rittal',
    model: 'TS IT 42U',
    serialNumber: 'SN-DC-RACK-001',
    purchaseDate: '2022-09-01',
    warrantyEnd: '2025-09-01',
    status: AssetStatus.INACTIVE,
    description: 'Rack lama, aset sudah dipindahkan ke rack B',
    createdAt: '2026-05-01T07:30:00.000Z',
    location: { dataCenter: 'DC-1', rack: 'A1', rackSlot: 'FULL', floor: '1' },
  },
  {
    assetCode: 'UPS-001',
    assetName: 'UPS 10 kVA',
    assetType: AssetType.OTHER,
    brand: 'APC',
    model: 'Smart-UPS SRT 10000',
    serialNumber: 'SN-DC-UPS-001',
    purchaseDate: '2024-09-14',
    warrantyEnd: '2027-09-14',
    status: AssetStatus.ACTIVE,
    description: 'UPS ruang server DC-2',
    createdAt: '2026-10-05T14:10:00.000Z',
    location: { dataCenter: 'DC-2', rack: 'D', rackSlot: 'U40', floor: '2' },
    network: {
      hostname: 'ups-01',
      ipAddress: '10.0.2.30',
      subnetMask: '255.255.255.0',
      gateway: '10.0.2.254',
      macAddress: 'AA:BB:CC:00:00:08',
      connectionStatus: ConnectionStatus.ONLINE,
      notes: 'Monitoring via NMC',
    },
  },
  {
    assetCode: 'SRV-003',
    assetName: 'Backup Server',
    assetType: AssetType.SERVER,
    brand: 'Lenovo',
    model: 'ThinkSystem SR650',
    serialNumber: 'SN-DC-SRV-003',
    purchaseDate: '2025-03-30',
    warrantyEnd: '2028-03-30',
    status: AssetStatus.ACTIVE,
    description: 'Server backup harian',
    createdAt: '2026-10-20T09:00:00.000Z',
    location: { dataCenter: 'DC-2', rack: 'E', rackSlot: 'U08', floor: '2' },
    network: {
      hostname: 'backup-srv-01',
      ipAddress: '10.0.3.8',
      subnetMask: '255.255.255.0',
      gateway: '10.0.3.1',
      macAddress: 'AA:BB:CC:00:00:09',
      connectionStatus: ConnectionStatus.ONLINE,
      notes: 'VLAN 30 - backup',
    },
  },
];

interface SeedMaintenance {
  assetCode: string;
  maintenanceType: MaintenanceType;
  maintenanceDate: string;
  description: string;
  result: string;
  cost: string;
  nextSchedule?: string;
}

const MAINTENANCES: SeedMaintenance[] = [
  {
    assetCode: 'SRV-001',
    maintenanceType: MaintenanceType.ROUTINE,
    maintenanceDate: '2026-06-12',
    description: 'Pembersihan filter dan pengecekan suhu',
    result: 'OK - suhu normal',
    cost: '150000',
  },
  {
    assetCode: 'SRV-001',
    maintenanceType: MaintenanceType.REPAIR,
    maintenanceDate: '2026-09-25',
    description: 'Ganti RAM modul 2',
    result: 'Resolved - RAM diganti',
    cost: '850000',
    nextSchedule: '2027-03-25',
  },
  {
    assetCode: 'SRV-004',
    maintenanceType: MaintenanceType.INSPECTION,
    maintenanceDate: '2026-07-18',
    description: 'Pengecekan kesehatan disk dan RAID',
    result: 'OK - semua disk sehat',
    cost: '0',
  },
  {
    assetCode: 'SW-001',
    maintenanceType: MaintenanceType.UPGRADE,
    maintenanceDate: '2026-08-02',
    description: 'Upgrade firmware IOS',
    result: 'Resolved - firmware 17.9.4 terpasang',
    cost: '0',
  },
  {
    assetCode: 'STG-001',
    maintenanceType: MaintenanceType.REPAIR,
    maintenanceDate: '2026-10-05',
    description: 'Disk 3 degraded, menunggu penggantian',
    result: 'In progress - menunggu spare part',
    cost: '1250000',
    nextSchedule: '2026-11-05',
  },
  {
    assetCode: 'STG-001',
    maintenanceType: MaintenanceType.REPLACEMENT,
    maintenanceDate: '2026-10-10',
    description: 'Penggantian disk 3',
    result: 'Resolved - disk diganti dan rebuild selesai',
    cost: '2100000',
  },
];

async function seedUsers(): Promise<{ adminId: number; technicianId: number }> {
  const adminPassword = env.SEED_ADMIN_PASSWORD;
  const technicianPassword = env.SEED_TECH_PASSWORD;

  if (!adminPassword || !technicianPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD and SEED_TECH_PASSWORD must be set in backend/.env before seeding.',
    );
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@datacenter.local',
      passwordHash: await hashPassword(adminPassword),
      fullName: 'Administrator',
      role: Role.ADMIN,
    },
  });

  const technician = await prisma.user.upsert({
    where: { username: 'teknisi1' },
    update: {},
    create: {
      username: 'teknisi1',
      email: 'teknisi1@datacenter.local',
      passwordHash: await hashPassword(technicianPassword),
      fullName: 'Budi Santoso',
      role: Role.TECHNICIAN,
    },
  });

  return { adminId: admin.id, technicianId: technician.id };
}

async function seedAssets(adminId: number): Promise<Record<string, number>> {
  const ids: Record<string, number> = {};

  for (const asset of ASSETS) {
    const created = await prisma.asset.upsert({
      where: { assetCode: asset.assetCode },
      update: {},
      create: {
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        assetType: asset.assetType,
        brand: asset.brand,
        model: asset.model,
        serialNumber: asset.serialNumber,
        purchaseDate: dateOnly(asset.purchaseDate),
        warrantyEnd: dateOnly(asset.warrantyEnd),
        status: asset.status,
        description: asset.description,
        createdBy: adminId,
        createdAt: new Date(asset.createdAt),
        locations: {
          create: { ...asset.location, isCurrent: true, movedAt: new Date(asset.createdAt) },
        },
        networkInformation: asset.network
          ? {
              create: {
                ...asset.network,
                lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000),
              },
            }
          : undefined,
      },
    });

    ids[asset.assetCode] = created.id;
  }

  return ids;
}

async function seedMaintenances(
  assetIds: Record<string, number>,
  technicianId: number,
): Promise<void> {
  for (const row of MAINTENANCES) {
    const assetId = assetIds[row.assetCode];
    if (assetId === undefined) {
      throw new Error(`Seed maintenance references unknown asset ${row.assetCode}`);
    }

    const maintenanceDate = dateOnly(row.maintenanceDate);
    const existing = await prisma.maintenanceHistory.findFirst({
      where: { assetId, maintenanceType: row.maintenanceType, maintenanceDate },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.maintenanceHistory.create({
      data: {
        assetId,
        technicianId,
        maintenanceType: row.maintenanceType,
        maintenanceDate,
        description: row.description,
        result: row.result,
        cost: row.cost,
        nextSchedule: row.nextSchedule ? dateOnly(row.nextSchedule) : null,
      },
    });
  }
}

async function main(): Promise<void> {
  const { adminId, technicianId } = await seedUsers();
  const assetIds = await seedAssets(adminId);
  await seedMaintenances(assetIds, technicianId);

  const [users, assets, maintenances, networks] = await Promise.all([
    prisma.user.count(),
    prisma.asset.count(),
    prisma.maintenanceHistory.count(),
    prisma.networkInformation.count(),
  ]);

  console.log(
    `Seed complete: ${users} users, ${assets} assets, ${maintenances} maintenance rows, ${networks} network rows.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
