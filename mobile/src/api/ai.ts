import { api } from './client';
import type { ApiEnvelope, RiskExplanation, RiskSummary } from '../types/api';

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
