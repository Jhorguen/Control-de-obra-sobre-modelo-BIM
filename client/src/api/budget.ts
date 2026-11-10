import {
  assignmentResultSchema,
  budgetItemListSchema,
  budgetItemSchema,
  budgetResponseSchema,
  type AssignmentResult,
  type BudgetItem,
  type BudgetItemInput,
  type BudgetResponse,
} from '@bim/shared';
import { z } from 'zod';
import { apiRequest } from './http';

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function listBudgetItems(projectId: number, signal?: AbortSignal): Promise<BudgetItem[]> {
  return apiRequest(`/projects/${projectId}/budget-items`, budgetItemListSchema, { signal });
}

export function createBudgetItem(projectId: number, input: BudgetItemInput): Promise<BudgetItem> {
  return apiRequest(`/projects/${projectId}/budget-items`, budgetItemSchema, json('POST', input));
}

export function updateBudgetItem(id: number, input: BudgetItemInput): Promise<BudgetItem> {
  return apiRequest(`/budget-items/${id}`, budgetItemSchema, json('PUT', input));
}

export async function deleteBudgetItem(id: number): Promise<void> {
  await apiRequest(`/budget-items/${id}`, z.unknown(), { method: 'DELETE' });
}

export function assignBudgetItem(
  projectId: number,
  globalIds: readonly string[],
  budgetItemId: number,
): Promise<AssignmentResult> {
  return apiRequest(
    `/projects/${projectId}/elements/assign`,
    assignmentResultSchema,
    json('PUT', { globalIds, budgetItemId }),
  );
}

export function unassignBudgetItem(
  projectId: number,
  globalIds: readonly string[],
  budgetItemId: number,
): Promise<AssignmentResult> {
  return apiRequest(
    `/projects/${projectId}/elements/unassign`,
    assignmentResultSchema,
    json('PUT', { globalIds, budgetItemId }),
  );
}

export function getBudget(projectId: number, signal?: AbortSignal): Promise<BudgetResponse> {
  return apiRequest(`/projects/${projectId}/budget`, budgetResponseSchema, { signal });
}
