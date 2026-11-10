import {
  assignmentResultSchema,
  progressHistorySchema,
  progressSummarySchema,
  statusMapSchema,
  type AssignmentResult,
  type ProgressRecord,
  type ProgressRequest,
  type ProgressSummary,
  type StatusMapEntry,
} from '@bim/shared';
import { apiRequest } from './http';

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function recordProgress(
  projectId: number,
  request: ProgressRequest,
): Promise<AssignmentResult> {
  return apiRequest(
    `/projects/${projectId}/progress`,
    assignmentResultSchema,
    json('POST', request),
  );
}

export function setPlannedDate(
  projectId: number,
  globalIds: readonly string[],
  plannedDate: string | null,
): Promise<AssignmentResult> {
  return apiRequest(
    `/projects/${projectId}/elements/planned-date`,
    assignmentResultSchema,
    json('PUT', { globalIds, plannedDate }),
  );
}

export function getStatusMap(projectId: number, signal?: AbortSignal): Promise<StatusMapEntry[]> {
  return apiRequest(`/projects/${projectId}/status-map`, statusMapSchema, { signal });
}

export function getElementHistory(
  elementId: number,
  signal?: AbortSignal,
): Promise<ProgressRecord[]> {
  return apiRequest(`/elements/${elementId}/progress`, progressHistorySchema, { signal });
}

export function getProgressSummary(
  projectId: number,
  signal?: AbortSignal,
): Promise<ProgressSummary> {
  return apiRequest(`/projects/${projectId}/summary`, progressSummarySchema, { signal });
}
