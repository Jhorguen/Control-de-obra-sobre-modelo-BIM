import {
  projectListSchema,
  projectSchema,
  type CreateProjectInput,
  type ModelFileKind,
  type Project,
} from '@bim/shared';
import { z } from 'zod';
import { apiRequest, apiUrl, ApiError, readApiError } from './http';
import { t } from '../i18n/core';

export function listProjects(signal?: AbortSignal): Promise<Project[]> {
  return apiRequest('/projects', projectListSchema, { signal });
}

export function getProject(id: number, signal?: AbortSignal): Promise<Project> {
  return apiRequest(`/projects/${id}`, projectSchema, { signal });
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiRequest('/projects', projectSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteProject(id: number): Promise<void> {
  await apiRequest(`/projects/${id}`, z.unknown(), { method: 'DELETE' });
}

/** Sends the file as the raw request body; the server stores it in PostgreSQL. */
export function uploadModelFile(
  projectId: number,
  kind: ModelFileKind,
  data: BlobPart,
  fileName: string,
): Promise<Project> {
  return apiRequest(`/projects/${projectId}/files/${kind}`, projectSchema, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName),
    },
    body: new Blob([data]),
  });
}

export async function downloadModelFile(
  projectId: number,
  kind: ModelFileKind,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  let response: Response;
  try {
    // The browser revalidates with the ETag, so an unchanged model is not downloaded again.
    response = await fetch(apiUrl(`/projects/${projectId}/files/${kind}`), { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', t('errors.NETWORK_ERROR'));
  }
  if (!response.ok) throw await readApiError(response);
  return response.arrayBuffer();
}
