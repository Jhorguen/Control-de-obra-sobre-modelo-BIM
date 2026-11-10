import type { ErrorResponse } from '@bim/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

/** Throw this from any route to answer with a specific status and error code. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function errorBody(code: string, message: string): ErrorResponse {
  return { error: { code, message } };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(errorBody('NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));
};

/** Errors raised by express.json() carry a `type` field (they come from body-parser). */
function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

/**
 * Single place that turns errors into the `{ error: { code, message } }` format.
 * Express 5 forwards rejected promises from async handlers here automatically.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json(errorBody(err.code, err.message));
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues
      .map((issue) => `${issue.path.join('.') || '(cuerpo)'}: ${issue.message}`)
      .join('; ');
    res.status(400).json(errorBody('VALIDATION_ERROR', `Datos inválidos. ${details}`));
    return;
  }

  const parserErrorType = bodyParserErrorType(err);
  if (parserErrorType === 'entity.parse.failed') {
    res.status(400).json(errorBody('INVALID_JSON', 'El cuerpo de la petición no es JSON válido.'));
    return;
  }
  if (parserErrorType === 'entity.too.large') {
    res
      .status(413)
      .json(errorBody('PAYLOAD_TOO_LARGE', 'El cuerpo de la petición es demasiado grande.'));
    return;
  }

  // Unknown error: log it, but never leak internals to the client.
  console.error(err);
  res.status(500).json(errorBody('INTERNAL_ERROR', 'Error interno del servidor.'));
};
