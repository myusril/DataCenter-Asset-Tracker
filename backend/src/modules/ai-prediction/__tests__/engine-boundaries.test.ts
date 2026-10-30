import { riskLevelForScore } from '../ai.explanation.js';
import { assessRisk } from '../ai.service.js';
import type { AssetScoringInput, MaintenanceRecord } from '../ai.schema.js';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function maintenances(
  entries: Array<[MaintenanceRecord['maintenanceType'], number]>,
): MaintenanceRecord[] {
  return entries.map(([maintenanceType, daysAgo]) => ({
    maintenanceType,
    maintenanceDate: new Date(NOW.getTime() - daysAgo * DAY_MS),
    result: maintenanceType === 'REPAIR' ? 'In progress' : 'OK',
  }));
}

function buildAsset(overrides: Partial<AssetScoringInput> = {}): AssetScoringInput {
  return {
    assetId: 11,
    assetCode: 'SRV-002',
    assetName: 'Test Server',
    assetType: 'SERVER',
    status: 'ACTIVE',
    purchaseDate: new Date(NOW.getTime() - 365 * DAY_MS),
    createdAt: new Date(NOW.getTime() - 365 * DAY_MS),
    networkStatus: 'ONLINE',
    maintenances: [],
    ...overrides,
  };
}

describe('risk level boundaries', () => {
  it('maps scores at the documented cut-offs', () => {
    expect(riskLevelForScore(0)).toBe('LOW');
    expect(riskLevelForScore(30)).toBe('LOW');
    expect(riskLevelForScore(30.01)).toBe('MEDIUM');
    expect(riskLevelForScore(31)).toBe('MEDIUM');
    expect(riskLevelForScore(60)).toBe('MEDIUM');
    expect(riskLevelForScore(60.01)).toBe('HIGH');
    expect(riskLevelForScore(61)).toBe('HIGH');
    expect(riskLevelForScore(100)).toBe('HIGH');
  });
});

describe('score bounds', () => {
  it('keeps a maximal-input score inside the 0..100 clamp', () => {
    const asset = buildAsset({
      status: 'MAINTENANCE',
      networkStatus: 'OFFLINE',
      purchaseDate: new Date(NOW.getTime() - 10 * 365 * DAY_MS),
      maintenances: maintenances([
        ['REPAIR', 5],
        ['REPAIR', 10],
        ['REPAIR', 15],
        ['REPAIR', 20],
        ['REPAIR', 25],
      ]),
    });
    // Three peers with long servicing intervals push the z-score and peer
    // signals to their positive limits, so layer 2 hits its own +10 cap.
    const peers = [21, 22, 23].map((assetId) => ({
      assetId,
      assetType: 'SERVER',
      maintenances: maintenances([
        ['ROUTINE', 200],
        ['ROUTINE', 400],
        ['ROUTINE', 600],
        ['ROUTINE', 800],
      ]),
    }));

    const result = assessRisk(asset, peers, NOW);
    expect(result.layerBreakdown.layer2.total).toBe(10);
    expect(result.layerBreakdown.layer3.total).toBe(9);
    // Layer 1 weights sum to 0.80, so 99 is the reachable maximum; the final
    // clamp at 100 is a defensive guard rather than a reachable value.
    expect(result.riskScore).toBe(99);
    expect(result.riskScore).toBeLessThanOrEqual(100);
    expect(result.riskLevel).toBe('HIGH');
  });

  it('keeps an asset with no maintenance and no network at a low score and confidence', () => {
    const asset = buildAsset({
      purchaseDate: new Date(NOW.getTime() - 10 * DAY_MS),
      createdAt: new Date(NOW.getTime() - 10 * DAY_MS),
      networkStatus: null,
      maintenances: [],
    });

    const result = assessRisk(asset, [], NOW);
    expect(result.riskScore).toBeCloseTo(2.58, 2);
    expect(result.riskScore).toBeLessThanOrEqual(30);
    expect(result.riskLevel).toBe('LOW');
    expect(result.confidence).toBe(60);
    expect(result.layerBreakdown.layer2.total).toBe(0);
    expect(result.layerBreakdown.layer3.total).toBe(0);
    expect(result.topFactors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('condition deterioration', () => {
  it('raises the score into HIGH after four repairs, MAINTENANCE, and OFFLINE', () => {
    const baseline = buildAsset({
      purchaseDate: new Date(NOW.getTime() - 1.5 * 365 * DAY_MS),
      networkStatus: null,
      maintenances: maintenances([['ROUTINE', 30]]),
    });
    const worsened = buildAsset({
      purchaseDate: new Date(NOW.getTime() - 1.5 * 365 * DAY_MS),
      status: 'MAINTENANCE',
      networkStatus: 'OFFLINE',
      maintenances: maintenances([
        ['ROUTINE', 30],
        ['REPAIR', 10],
        ['REPAIR', 20],
        ['REPAIR', 35],
        ['REPAIR', 85],
      ]),
    });

    const before = assessRisk(baseline, [], NOW);
    const after = assessRisk(worsened, [], NOW);

    expect(before.riskLevel).toBe('LOW');
    expect(after.riskScore).toBeGreaterThan(before.riskScore);
    expect(after.riskScore).toBe(83.5);
    expect(after.riskLevel).toBe('HIGH');
  });
});
