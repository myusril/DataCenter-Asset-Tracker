import { prisma } from '../../src/config/database.js';

// Child tables first; RESTART IDENTITY keeps ids predictable per test.
const TABLES = [
  'notifications',
  'ai_predictions',
  'maintenance_history',
  'network_information',
  'asset_locations',
  'assets',
  'users',
];

export async function resetDatabase(): Promise<void> {
  const tables = TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export { prisma };
