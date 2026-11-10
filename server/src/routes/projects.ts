import { createProjectSchema, MAX_MODEL_FILE_BYTES, modelFileKindSchema } from '@bim/shared';
import express, { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseId } from '../http.js';
import {
  createProject,
  deleteProject,
  getModelFileData,
  getModelFileVersion,
  getProject,
  listProjects,
  saveModelFile,
} from '../services/projects.js';

const fileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  // Keep only the base name: never trust paths coming from a client.
  .transform((name) => name.split(/[\\/]/).pop() ?? name);

export function createProjectsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await listProjects(prisma));
  });

  router.post('/', async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    res.status(201).json(await createProject(prisma, input));
  });

  router.get('/:id', async (req, res) => {
    res.json(await getProject(prisma, parseId(req.params.id)));
  });

  router.delete('/:id', async (req, res) => {
    await deleteProject(prisma, parseId(req.params.id));
    res.status(204).end();
  });

  // The model is sent as the raw request body (application/octet-stream) instead of
  // multipart/form-data: one file per request, no extra parsing library needed.
  router.put(
    '/:id/files/:kind',
    express.raw({ type: 'application/octet-stream', limit: MAX_MODEL_FILE_BYTES }),
    async (req, res) => {
      const projectId = parseId(req.params.id);
      const kind = modelFileKindSchema.parse(req.params.kind);
      const fileName = fileNameSchema.parse(
        decodeURIComponent(req.get('X-File-Name') ?? `modelo.${kind}`),
      );
      const body: unknown = req.body;
      const data = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
      res.json(await saveModelFile(prisma, projectId, kind, fileName, data));
    },
  );

  router.get('/:id/files/:kind', async (req, res) => {
    const projectId = parseId(req.params.id);
    const kind = modelFileKindSchema.parse(req.params.kind);
    const version = await getModelFileVersion(prisma, projectId, kind);

    // The ETag identifies this exact upload. If the browser already has it, answer
    // 304 without reading several megabytes from the database.
    res.set({
      ETag: `"${version.id}-${version.createdAt.getTime()}"`,
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(version.fileName)}`,
    });
    if (req.fresh) {
      res.status(304).end();
      return;
    }

    const data = await getModelFileData(prisma, version.id);
    res.send(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  });

  return router;
}
