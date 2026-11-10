import { z } from 'zod';

/** A quantity in SI units, or null when the IFC does not provide it (never invented). */
const quantitySchema = z.number().finite().nonnegative().nullable();

/** One element as extracted from the IFC in the browser. */
export const elementInputSchema = z.object({
  globalId: z.string().min(1).max(64),
  ifcClass: z.string().min(1).max(100),
  name: z.string().max(500).nullable(),
  typeName: z.string().max(500).nullable(),
  level: z.string().max(200).nullable(),
  volume: quantitySchema,
  area: quantitySchema,
  length: quantitySchema,
});
export type ElementInput = z.infer<typeof elementInputSchema>;

export const MAX_BULK_ELEMENTS = 50_000;

/** The full list of elements of the model: elements missing from it are marked as removed. */
export const bulkElementsRequestSchema = z.object({
  elements: z.array(elementInputSchema).max(MAX_BULK_ELEMENTS),
});
export type BulkElementsRequest = z.infer<typeof bulkElementsRequestSchema>;

export const bulkElementsResultSchema = z.object({
  received: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
  removed: z.number().int(),
  duplicatesIgnored: z.number().int(),
});
export type BulkElementsResult = z.infer<typeof bulkElementsResultSchema>;

export const elementSchema = elementInputSchema.extend({
  id: z.number().int().positive(),
});
export type Element = z.infer<typeof elementSchema>;

export const elementsQuerySchema = z.object({
  ifcClass: z.string().optional(),
  level: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
});
export type ElementsQuery = z.infer<typeof elementsQuerySchema>;

export const elementsPageSchema = z.object({
  items: z.array(elementSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ElementsPage = z.infer<typeof elementsPageSchema>;

/** Sums of the known quantities of a set of elements, plus how many lack each quantity. */
export const quantitySumsSchema = z.object({
  count: z.number().int(),
  volume: z.number(),
  area: z.number(),
  length: z.number(),
  withoutVolume: z.number().int(),
  withoutArea: z.number().int(),
  withoutLength: z.number().int(),
});
export type QuantitySums = z.infer<typeof quantitySumsSchema>;

export const quantityGroupSchema = quantitySumsSchema.extend({
  ifcClass: z.string(),
  typeName: z.string().nullable(),
  level: z.string().nullable(),
  /** Lets the client highlight the group's elements in the 3D model. */
  globalIds: z.array(z.string()),
});
export type QuantityGroup = z.infer<typeof quantityGroupSchema>;

export const classTotalSchema = quantitySumsSchema.extend({ ifcClass: z.string() });
export type ClassTotal = z.infer<typeof classTotalSchema>;

export const quantitiesResponseSchema = z.object({
  groups: z.array(quantityGroupSchema),
  classTotals: z.array(classTotalSchema),
  totals: quantitySumsSchema,
});
export type QuantitiesResponse = z.infer<typeof quantitiesResponseSchema>;
