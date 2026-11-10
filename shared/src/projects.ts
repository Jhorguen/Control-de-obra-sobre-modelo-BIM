import { z } from 'zod';

/** Upper bound for an uploaded model file (IFC or Fragments). */
export const MAX_MODEL_FILE_BYTES = 25 * 1024 * 1024;

export const modelFileKindSchema = z.enum(['ifc', 'frag']);
export type ModelFileKind = z.infer<typeof modelFileKindSchema>;

export const modelFileInfoSchema = z.object({
  fileName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.iso.datetime(),
});
export type ModelFileInfo = z.infer<typeof modelFileInfoSchema>;

export const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  isDemo: z.boolean(),
  createdAt: z.iso.datetime(),
  files: z.object({
    ifc: modelFileInfoSchema.nullable(),
    frag: modelFileInfoSchema.nullable(),
  }),
});
export type Project = z.infer<typeof projectSchema>;

export const projectListSchema = z.array(projectSchema);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del proyecto es obligatorio.').max(120),
  description: z.string().trim().max(1000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
