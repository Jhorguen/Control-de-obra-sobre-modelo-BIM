import { z } from 'zod';
import { HttpError } from './middleware/errors.js';

const idSchema = z.coerce.number().int().positive();

/** Parses a numeric route parameter such as `:id`; invalid values answer 400. */
export function parseId(value: unknown, label = 'id'): number {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, 'INVALID_ID', `El parámetro "${label}" debe ser un entero positivo.`);
  }
  return parsed.data;
}

export function notFound(what: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', `${what} no existe.`);
}
