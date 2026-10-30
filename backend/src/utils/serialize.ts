import type { Prisma } from '@prisma/client';

/** Prisma maps `@db.Date` to a Date at UTC midnight; clients get a plain date. */
export function toIsoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Prisma Decimal must be serialized as a JSON number, never as a string. */
export function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Date-only columns are stored/compared at UTC midnight. */
export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
