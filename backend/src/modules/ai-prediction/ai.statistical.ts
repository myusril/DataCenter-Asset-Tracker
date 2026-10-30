import type {
  AssetScoringInput,
  Layer2Adjustments,
  MaintenanceRecord,
  PeerScoringInput,
} from './ai.schema.js';

// Layer 2 — statistical adjustment. Pure functions only: every window is
// derived from the `now` argument so tests are deterministic.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Small-sample guards. The worked example in the source document shows the
 * z-score and peer signals as 0 because the asset had no peers; applying the
 * same minimum-sample rule to the interval signal keeps a burst of incident
 * repairs from being mistaken for a servicing cadence.
 */
export const MIN_PEERS = 3;
export const MIN_PEER_ROWS = 3;
export const MIN_SCHEDULED_ROWS = 3;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function countWithinDays(
  rows: MaintenanceRecord[],
  days: number,
  now: Date,
): number {
  const from = now.getTime() - days * DAY_MS;
  const to = now.getTime();
  return rows.filter((row) => {
    const time = row.maintenanceDate.getTime();
    return time >= from && time <= to;
  }).length;
}

function intervalsBetween(rows: MaintenanceRecord[]): number[] {
  const times = rows
    .map((row) => row.maintenanceDate.getTime())
    .sort((left, right) => left - right);
  const intervals: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const current = times[index];
    const previous = times[index - 1];
    if (current === undefined || previous === undefined) {
      continue;
    }
    intervals.push((current - previous) / DAY_MS);
  }
  return intervals;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) {
    return upper;
  }
  return ((sorted[middle - 1] ?? 0) + upper) / 2;
}

/**
 * A negative z-score means this asset needs servicing sooner than its peers,
 * so the adjustment has the opposite sign of z. Full weight at |z| >= 2,
 * half weight between 1.5 and 2.
 */
export function computeZScoreAdjustment(
  asset: AssetScoringInput,
  peers: PeerScoringInput[],
): number {
  const qualifiedPeers = peers.filter(
    (peer) => peer.maintenances.length >= MIN_PEER_ROWS,
  );
  if (qualifiedPeers.length < MIN_PEERS) {
    return 0;
  }

  const ownIntervals = intervalsBetween(asset.maintenances);
  if (ownIntervals.length < 2) {
    return 0;
  }

  const peerMeans = qualifiedPeers.map((peer) => mean(intervalsBetween(peer.maintenances)));
  const peerMean = mean(peerMeans);
  const variance =
    peerMeans.reduce((sum, value) => sum + (value - peerMean) ** 2, 0) / peerMeans.length;
  const standardDeviation = Math.sqrt(variance);
  if (standardDeviation === 0) {
    return 0;
  }

  const z = (mean(ownIntervals) - peerMean) / standardDeviation;
  if (z >= 2) {
    return -10;
  }
  if (z >= 1.5) {
    return -5;
  }
  if (z <= -2) {
    return 10;
  }
  if (z <= -1.5) {
    return 5;
  }
  return 0;
}

/** Last 45 days versus the 45 days before that. */
export function computeTrendAdjustment(asset: AssetScoringInput, now: Date): number {
  const recent = countWithinDays(asset.maintenances, 45, now);
  const previous = countWithinDays(asset.maintenances, 90, now) - recent;
  if (recent > previous) {
    return 5;
  }
  if (recent < previous) {
    return -5;
  }
  return 0;
}

/**
 * Mean spacing of scheduled servicing (everything except corrective REPAIR
 * rows). Fewer than three scheduled rows is too small a sample to call a
 * cadence, so the signal stays neutral.
 */
export function computeIntervalAdjustment(asset: AssetScoringInput): number {
  const scheduled = asset.maintenances.filter(
    (row) => row.maintenanceType !== 'REPAIR',
  );
  if (scheduled.length < MIN_SCHEDULED_ROWS) {
    return 0;
  }
  const interval = mean(intervalsBetween(scheduled));
  if (interval < 60) {
    return 5;
  }
  if (interval < 90) {
    return 2.5;
  }
  if (interval > 180) {
    return -5;
  }
  return 0;
}

/** Maintenance count per 90 days relative to the median same-type peer. */
export function computePeerAdjustment(
  asset: AssetScoringInput,
  peers: PeerScoringInput[],
  now: Date,
): number {
  if (peers.length < MIN_PEERS) {
    return 0;
  }
  const counts = peers.map((peer) => countWithinDays(peer.maintenances, 90, now));
  const own = countWithinDays(asset.maintenances, 90, now);
  const peerMedian = median(counts);
  if (own > peerMedian) {
    return 5;
  }
  if (own < peerMedian) {
    return -2.5;
  }
  return 0;
}

export function computeStatisticalAdjustment(
  asset: AssetScoringInput,
  peers: PeerScoringInput[],
  now: Date,
): { adjustments: Layer2Adjustments; total: number } {
  const adjustments: Layer2Adjustments = {
    zScore: computeZScoreAdjustment(asset, peers),
    trend: computeTrendAdjustment(asset, now),
    interval: computeIntervalAdjustment(asset),
    peer: computePeerAdjustment(asset, peers, now),
  };
  const rawTotal =
    adjustments.zScore +
    adjustments.trend +
    adjustments.interval +
    adjustments.peer;
  return {
    adjustments,
    total: round2(Math.min(Math.max(rawTotal, -10), 10)),
  };
}
