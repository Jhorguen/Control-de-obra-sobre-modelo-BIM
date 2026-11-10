import { z } from 'zod';

export const unitSchema = z.enum(['M3', 'M2', 'M', 'KG', 'UN']);
export type Unit = z.infer<typeof unitSchema>;

/** Which extracted quantity of an element feeds a budget item. */
export const quantitySourceSchema = z.enum(['VOLUME', 'AREA', 'LENGTH', 'COUNT']);
export type QuantitySource = z.infer<typeof quantitySourceSchema>;

/** The natural source for each unit; the form proposes it, the user may pick another. */
export const DEFAULT_SOURCE_BY_UNIT: Record<Unit, QuantitySource> = {
  M3: 'VOLUME',
  M2: 'AREA',
  M: 'LENGTH',
  KG: 'VOLUME',
  UN: 'COUNT',
};

export const budgetItemInputSchema = z.object({
  code: z.string().trim().min(1, 'El código es obligatorio.').max(30),
  description: z.string().trim().min(1, 'La descripción es obligatoria.').max(300),
  unit: unitSchema,
  quantitySource: quantitySourceSchema,
  /** Multiplier over the base quantity: 90 kg/m³ of rebar, 2 formwork faces, 0,02 m of plaster. */
  factor: z.number().positive().max(1_000_000).default(1),
  /** Colombian pesos per unit, from the APU. */
  unitPrice: z.number().nonnegative().max(1_000_000_000_000),
});
export type BudgetItemInput = z.input<typeof budgetItemInputSchema>;

export const budgetItemSchema = z.object({
  id: z.number().int().positive(),
  code: z.string(),
  description: z.string(),
  unit: unitSchema,
  quantitySource: quantitySourceSchema,
  factor: z.number(),
  unitPrice: z.number(),
});
export type BudgetItem = z.infer<typeof budgetItemSchema>;

export const budgetItemListSchema = z.array(budgetItemSchema);

/** Elements are addressed by GlobalId: it is what the viewer and the tables know. */
export const assignmentRequestSchema = z.object({
  globalIds: z.array(z.string().min(1)).min(1).max(50_000),
  budgetItemId: z.number().int().positive(),
});
export type AssignmentRequest = z.infer<typeof assignmentRequestSchema>;

export const assignmentResultSchema = z.object({ affected: z.number().int() });
export type AssignmentResult = z.infer<typeof assignmentResultSchema>;

export const budgetLineSchema = z.object({
  item: budgetItemSchema,
  elementCount: z.number().int(),
  /** Assigned elements whose IFC lacks the quantity this item needs. */
  withoutQuantity: z.number().int(),
  /** Sum of element quantities × factor, rounded to 2 decimals. */
  quantity: z.number(),
  /** quantity × unit price, in COP. */
  subtotal: z.number(),
  globalIds: z.array(z.string()),
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

export const elementGroupSchema = z.object({
  count: z.number().int(),
  globalIds: z.array(z.string()),
  byClass: z.array(z.object({ ifcClass: z.string(), count: z.number().int() })),
});
export type ElementGroup = z.infer<typeof elementGroupSchema>;

export const budgetResponseSchema = z.object({
  lines: z.array(budgetLineSchema),
  total: z.number(),
  /** Active elements with no budget item at all. */
  unassigned: elementGroupSchema,
  /** Assigned elements that do not add to some item because their quantity is missing. */
  withoutQuantity: elementGroupSchema,
});
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;
