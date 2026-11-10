import {
  bulkElementsResultSchema,
  quantitiesResponseSchema,
  type BulkElementsResult,
  type ElementInput,
  type QuantitiesResponse,
} from '@bim/shared';
import { apiRequest } from './http';

/** Sends the complete element list of the model; the server upserts by GlobalId. */
export function uploadElements(
  projectId: number,
  elements: ElementInput[],
): Promise<BulkElementsResult> {
  return apiRequest(`/projects/${projectId}/elements/bulk`, bulkElementsResultSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elements }),
  });
}

export function getQuantities(
  projectId: number,
  signal?: AbortSignal,
): Promise<QuantitiesResponse> {
  return apiRequest(`/projects/${projectId}/quantities`, quantitiesResponseSchema, { signal });
}
