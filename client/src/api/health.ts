import { healthResponseSchema, type HealthResponse } from '@bim/shared';
import { apiRequest } from './http';

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  // A 503 still carries a valid health body: the API is up but the database is not.
  return apiRequest('/health', healthResponseSchema, { signal, acceptStatuses: [503] });
}
