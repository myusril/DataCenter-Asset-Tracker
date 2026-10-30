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
    assetId: 10,
    assetCode: 'SRV-001',
    assetName: 'WEB Server 01',
    assetType: 'SERVER',
    status: 'MAINTENANCE',
    purchaseDate: new Date(NOW.getTime() - 1.5 * 365 * DAY_MS),
    createdAt: new Date(NOW.getTime() - 1.5 * 365 * DAY_MS),
    networkStatus: 'OFFLINE',
    maintenances: maintenances([
      ['REPAIR', 10],
      ['REPAIR', 25],
      ['REPAIR', 40],
      ['ROUTINE', 70],
      ['REPAIR', 85],
    ]),
    ...overrides,
  };
}

describe('reference reproduction from the source document', () => {
  it('scores SRV-001 at 83.5 HIGH with confidence 95 and 15 predicted days', () => {
    const result = assessRisk(buildAsset(), [], NOW);

    expect(result.riskScore).toBe(83.5);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.confidence).toBe(95);
    expect(result.predictedFailureDays).toBe(15);
    expect(result.layerBreakdown.layer1.baseScore).toBe(69.5);
    expect(result.layerBreakdown.layer2.adjustments).toEqual({
      zScore: 0,
      trend: 5,
      interval: 0,
      peer: 0,
    });
    expect(result.layerBreakdown.layer2.total).toBe(5);
    expect(result.layerBreakdown.layer3.boosts).toEqual({
      downtimeOffline: 2.5,
      downtimeRepair: 1.5,
      repairRatio: 5,
      daysSince: 0,
    });
    expect(result.layerBreakdown.layer3.total).toBe(9);
    expect(result.layerBreakdown.final).toBe(83.5);
  });

  it('produces the documented explanation fields', () => {
    const result = assessRisk(buildAsset(), [], NOW);

    expect(result.shortSummary).toBe(
      'SRV-001 risiko tinggi (83.5/100) karena frekuensi maintenance tinggi, insiden perbaikan tinggi, status maintenance.',
    );
    expect(result.explanation).toContain('SRV-001');
    expect(result.explanation).toContain('83.5/100');
    expect(result.topFactors.length).toBeGreaterThanOrEqual(3);
    expect(result.topFactors.length).toBeLessThanOrEqual(5);
    expect(result.topFactors[0]?.name).toBe('frequency');
    expect(result.recommendation).toContain('inspeksi');
    expect(result.modelVersion).toBe('v1.0');
  });
});
