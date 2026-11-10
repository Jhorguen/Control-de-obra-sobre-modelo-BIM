import { errorResponseSchema } from '@bim/shared';
import type { ZodType } from 'zod';

// Empty in development (Vite proxies /api); the backend URL in production.
const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  /** Non-2xx statuses whose body is still a valid response (e.g. 503 from /health). */
  acceptStatuses?: number[];
}

/**
 * Typed fetch: every response is validated against the shared Zod schema, so the
 * rest of the client can trust the data it receives.
 */
export async function apiRequest<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { acceptStatuses = [], ...init } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo contactar el servidor.');
  }

  const body: unknown = await response.json().catch(() => null);

  if (response.ok || acceptStatuses.includes(response.status)) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'La respuesta del servidor no tiene el formato esperado.',
      );
    }
    return parsed.data;
  }

  const apiError = errorResponseSchema.safeParse(body);
  if (apiError.success) {
    const { code, message } = apiError.data.error;
    throw new ApiError(response.status, code, message);
  }

  // A 5xx without our error format usually means a proxy or gateway could not reach the API.
  if (response.status >= 500) {
    throw new ApiError(response.status, 'NETWORK_ERROR', 'No se pudo contactar el servidor.');
  }
  throw new ApiError(
    response.status,
    'UNEXPECTED_RESPONSE',
    `Respuesta inesperada del servidor (HTTP ${response.status}).`,
  );
}
