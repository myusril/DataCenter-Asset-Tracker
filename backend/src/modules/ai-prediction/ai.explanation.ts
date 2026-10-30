import type {
  AssetScoringInput,
  Layer1Factor,
  Layer2Adjustments,
  Layer3Boosts,
  RiskLevel,
  TopFactor,
} from './ai.schema.js';
import { round2 } from './ai.statistical.js';

// Narration for the prediction. Deterministic templates, no external AI call.

const FACTOR_ORDER = [
  'frequency',
  'incidents',
  'age',
  'status',
  'network',
  'zScore',
  'trend',
  'interval',
  'peer',
  'downtimeOffline',
  'downtimeRepair',
  'repairRatio',
  'daysSince',
];

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  frequency: 'Frekuensi maintenance dalam 90 hari terakhir sangat tinggi',
  incidents: 'Jumlah insiden perbaikan (REPAIR) dalam 90 hari terakhir tinggi',
  age: 'Usia aset sudah mendekati batas siklus ekonomisnya',
  status: 'Aset sedang berada pada status maintenance',
  network: 'Kondisi jaringan aset terputus atau belum diketahui',
  zScore: 'Interval maintenance menyimpang dari aset sejenis',
  trend: 'Frekuensi maintenance 45 hari terakhir meningkat',
  interval: 'Jarak antar maintenance terjadwal terlalu pendek',
  peer: 'Frekuensi maintenance berada di atas median aset sejenis',
  downtimeOffline: 'Aset sedang offline',
  downtimeRepair: 'Riwayat perbaikan berulang minimal tiga kali',
  repairRatio: 'Rasio perbaikan terhadap total maintenance tinggi',
  daysSince: 'Sudah lama tidak ada maintenance',
};

const FACTOR_SHORT: Record<string, string> = {
  frequency: 'frekuensi maintenance tinggi',
  incidents: 'insiden perbaikan tinggi',
  age: 'usia aset',
  status: 'status maintenance',
  network: 'kondisi jaringan',
  zScore: 'interval maintenance menyimpang',
  trend: 'tren maintenance meningkat',
  interval: 'interval maintenance pendek',
  peer: 'frekuensi di atas aset sejenis',
  downtimeOffline: 'aset offline',
  downtimeRepair: 'perbaikan berulang',
  repairRatio: 'rasio perbaikan tinggi',
  daysSince: 'lama tanpa maintenance',
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: 'rendah',
  MEDIUM: 'sedang',
  HIGH: 'tinggi',
};

const RECOMMENDATION: Record<RiskLevel, string> = {
  LOW: 'Lanjutkan pemantauan rutin sesuai jadwal maintenance.',
  MEDIUM: 'Jadwalkan preventive maintenance dalam waktu dekat dan pantau tren kondisinya.',
  HIGH: 'Lakukan inspeksi menyeluruh segera dan jadwalkan penggantian komponen yang berisiko.',
};

export function riskLevelForScore(score: number): RiskLevel {
  if (score <= 30) {
    return 'LOW';
  }
  if (score <= 60) {
    return 'MEDIUM';
  }
  return 'HIGH';
}

export function buildTopFactors(
  layer1: Layer1Factor[],
  layer2: Layer2Adjustments,
  layer3: Layer3Boosts,
): TopFactor[] {
  const entries: TopFactor[] = [
    ...layer1.map((factor) => ({
      name: factor.name,
      impact: factor.impact,
      description: FACTOR_DESCRIPTIONS[factor.name] ?? factor.name,
    })),
    ...(Object.keys(layer2) as Array<keyof Layer2Adjustments>).map((name) => ({
      name,
      impact: layer2[name],
      description: FACTOR_DESCRIPTIONS[name] ?? name,
    })),
    ...(Object.keys(layer3) as Array<keyof Layer3Boosts>).map((name) => ({
      name,
      impact: layer3[name],
      description: FACTOR_DESCRIPTIONS[name] ?? name,
    })),
  ];

  const byImpact = (left: TopFactor, right: TopFactor): number => {
    const difference = Math.abs(right.impact) - Math.abs(left.impact);
    if (difference !== 0) {
      return difference;
    }
    return FACTOR_ORDER.indexOf(left.name) - FACTOR_ORDER.indexOf(right.name);
  };

  const nonZero = entries.filter((entry) => Math.abs(entry.impact) > 0.004);
  const padded = [...nonZero];
  if (padded.length < 3) {
    const zeroEntries = entries
      .filter((entry) => Math.abs(entry.impact) <= 0.004)
      .sort(byImpact);
    for (const entry of zeroEntries) {
      if (padded.length >= 3) {
        break;
      }
      padded.push(entry);
    }
  }

  return padded.sort(byImpact).slice(0, 5);
}

export function buildNarrative(
  asset: AssetScoringInput,
  riskScore: number,
  riskLevel: RiskLevel,
  topFactors: TopFactor[],
): { shortSummary: string; explanation: string; recommendation: string } {
  const score = String(round2(riskScore));
  const highlights = topFactors
    .slice(0, 3)
    .map((factor) => FACTOR_SHORT[factor.name] ?? factor.name);
  const dominant = topFactors
    .slice(0, 3)
    .map((factor) => factor.description)
    .join('; ')
    .toLowerCase();
  const recommendation = RECOMMENDATION[riskLevel];

  return {
    shortSummary: `${asset.assetCode} risiko ${LEVEL_LABEL[riskLevel]} (${score}/100) karena ${highlights.join(', ')}.`,
    explanation: `Aset ${asset.assetCode} (${asset.assetName}) memiliki skor risiko ${score}/100 dengan level ${riskLevel}. Faktor dominan: ${dominant}. ${recommendation}`,
    recommendation,
  };
}
