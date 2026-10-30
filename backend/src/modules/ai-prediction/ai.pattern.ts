import type { AssetScoringInput, Layer3Boosts } from './ai.schema.js';
import { countWithinDays, round2 } from './ai.statistical.js';

// Layer 3 — pattern matching. Boosts only; the total never exceeds 15.

export interface PatternBoosts {
  boosts: Layer3Boosts;
  total: number;
}

export function computePatternBoosts(
  asset: AssetScoringInput,
  now: Date,
): PatternBoosts {
  const maintenanceCount = countWithinDays(asset.maintenances, 90, now);
  const recentRepairs = asset.maintenances.filter(
    (row) => row.maintenanceType === 'REPAIR',
  );
  const repairCount = countWithinDays(recentRepairs, 90, now);

  const latest = asset.maintenances.reduce<Date | null>((latestDate, row) => {
    if (row.maintenanceDate.getTime() > now.getTime()) {
      return latestDate;
    }
    return latestDate === null || row.maintenanceDate > latestDate
      ? row.maintenanceDate
      : latestDate;
  }, null);
  const daysSince = latest
    ? Math.floor((now.getTime() - latest.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const repairRatio =
    maintenanceCount === 0 ? 0 : repairCount / maintenanceCount;

  const boosts: Layer3Boosts = {
    downtimeOffline: asset.networkStatus === 'OFFLINE' ? 2.5 : 0,
    downtimeRepair: repairCount >= 3 ? 1.5 : 0,
    repairRatio:
      repairRatio >= 0.5 ? round2(Math.min(repairRatio * 6.25, 5)) : 0,
    daysSince:
      daysSince === null
        ? 0
        : daysSince >= 180
          ? 5
          : daysSince > 90
            ? round2(Math.min(Math.max(((daysSince - 90) / 90) * 5, 0), 5))
            : 0,
  };

  const total =
    boosts.downtimeOffline +
    boosts.downtimeRepair +
    boosts.repairRatio +
    boosts.daysSince;

  return { boosts, total: round2(Math.min(total, 15)) };
}
