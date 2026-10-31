import { api } from './client';
import type {
  ApiEnvelope,
  BatchPredictionResult,
  PredictionResult,
  RiskExplanation,
  RiskSummary,
} from '../types/api';

export async function fetchRiskSummary(): Promise<RiskSummary> {
  const response = await api.get<ApiEnvelope<RiskSummary>>('/api/ai/risk-summary');
  return response.data.data;
}

/** Read-only risk recomputation; it does not store a new prediction. */
export async function fetchRiskExplanation(assetId: number): Promise<RiskExplanation> {
  const response = await api.get<ApiEnvelope<RiskExplanation>>(
    `/api/ai/explain/${assetId}`,
  );
  return response.data.data;
}

/** ADMIN only: stores a new active prediction and creates HIGH alerts. */
export async function predictAssetRisk(assetId: number): Promise<PredictionResult> {
  const response = await api.post<ApiEnvelope<PredictionResult>>(
    `/api/ai/predict/${assetId}`,
  );
  return response.data.data;
}

/** ADMIN only: `assetIds` omitted means every asset. */
export async function predictAllAssets(
  assetIds?: number[],
): Promise<BatchPredictionResult> {
  const response = await api.post<ApiEnvelope<BatchPredictionResult>>(
    '/api/ai/predict-batch',
    assetIds ? { assetIds } : {},
  );
  return response.data.data;
}
