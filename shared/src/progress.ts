import { z } from 'zod';

export const progressStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'DONE']);
export type ProgressStatus = z.infer<typeof progressStatusSchema>;

/** Calendar date as YYYY-MM-DD (no time zone ambiguity for a site log). */
export const isoDateSchema = z.iso.date();

export const progressRequestSchema = z.object({
  globalIds: z.array(z.string().min(1)).min(1).max(50_000),
  status: progressStatusSchema,
  date: isoDateSchema,
  note: z.string().trim().max(500).optional(),
});
export type ProgressRequest = z.infer<typeof progressRequestSchema>;

export const plannedDateRequestSchema = z.object({
  globalIds: z.array(z.string().min(1)).min(1).max(50_000),
  /** null removes the planned date. */
  plannedDate: isoDateSchema.nullable(),
});
export type PlannedDateRequest = z.infer<typeof plannedDateRequestSchema>;

export const progressRecordSchema = z.object({
  id: z.number().int().positive(),
  status: progressStatusSchema,
  date: isoDateSchema,
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type ProgressRecord = z.infer<typeof progressRecordSchema>;

export const progressHistorySchema = z.array(progressRecordSchema);

/** Current status of every active element: what the viewer needs to color the model. */
export const statusMapEntrySchema = z.object({
  id: z.number().int().positive(),
  globalId: z.string(),
  status: progressStatusSchema,
  plannedDate: isoDateSchema.nullable(),
  hasBudgetItem: z.boolean(),
});
export type StatusMapEntry = z.infer<typeof statusMapEntrySchema>;
export const statusMapSchema = z.array(statusMapEntrySchema);

const ratio = z.number().min(0).max(1);

export const levelProgressSchema = z.object({
  level: z.string().nullable(),
  elements: z.number().int(),
  done: z.number().int(),
  physicalProgress: ratio,
  budget: z.number(),
  executedValue: z.number(),
  financialProgress: ratio,
});
export type LevelProgress = z.infer<typeof levelProgressSchema>;

export const curvePointSchema = z.object({
  date: isoDateSchema,
  /** Cumulative value scheduled up to this date (by planned dates). */
  planned: z.number(),
  /** Cumulative value executed up to this date (status DONE at that date). */
  executed: z.number(),
});
export type CurvePoint = z.infer<typeof curvePointSchema>;

export const progressSummarySchema = z.object({
  budgetTotal: z.number(),
  executedValue: z.number(),
  financialProgress: ratio,
  physicalProgress: ratio,
  counts: z.object({
    /** Elements with at least one budget item: the scope of the progress measures. */
    withItem: z.number().int(),
    pending: z.number().int(),
    inProgress: z.number().int(),
    done: z.number().int(),
  }),
  byLevel: z.array(levelProgressSchema),
  curve: z.array(curvePointSchema),
  /** False when no element has a planned date (the planned line cannot be drawn). */
  hasPlan: z.boolean(),
});
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
