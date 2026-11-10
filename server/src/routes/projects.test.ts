import { errorResponseSchema, projectListSchema, projectSchema } from '@bim/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resetDatabase, testPrisma } from '../test/db.js';

const app = createApp({ prisma: testPrisma, corsOrigins: ['https://frontend.example'] });

const IFC_CONTENT = Buffer.from(
  "ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n",
);

const errorCode = (body: unknown) => errorResponseSchema.parse(body).error.code;

async function createTestProject(name = 'Edificio de prueba') {
  const res = await request(app).post('/api/projects').send({ name, description: 'Torre A' });
  return projectSchema.parse(res.body);
}

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('projects CRUD', () => {
  it('creates, lists, gets and deletes a project', async () => {
    const created = await createTestProject();
    expect(created).toMatchObject({
      name: 'Edificio de prueba',
      description: 'Torre A',
      isDemo: false,
    });
    expect(created.files).toEqual({ ifc: null, frag: null });

    const list = projectListSchema.parse((await request(app).get('/api/projects')).body);
    expect(list.map((p) => p.id)).toEqual([created.id]);

    const detail = await request(app).get(`/api/projects/${created.id}`);
    expect(detail.status).toBe(200);
    expect(projectSchema.parse(detail.body).id).toBe(created.id);

    expect((await request(app).delete(`/api/projects/${created.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/projects/${created.id}`)).status).toBe(404);
  });

  it('rejects a project without a name', async () => {
    const res = await request(app).post('/api/projects').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
  });

  it('answers 400 for a non-numeric id and 404 for a missing project', async () => {
    expect((await request(app).get('/api/projects/abc')).status).toBe(400);
    const missing = await request(app).get('/api/projects/999');
    expect(missing.status).toBe(404);
    expect(errorCode(missing.body)).toBe('NOT_FOUND');
  });

  it('refuses to delete the demo project', async () => {
    const demo = await testPrisma.project.create({ data: { name: 'Demo', isDemo: true } });
    const res = await request(app).delete(`/api/projects/${demo.id}`);
    expect(res.status).toBe(403);
    expect(errorCode(res.body)).toBe('DEMO_PROJECT_LOCKED');
  });
});

describe('model files', () => {
  it('uploads an IFC and downloads the same bytes, with 304 on revalidation', async () => {
    const project = await createTestProject();

    const upload = await request(app)
      .put(`/api/projects/${project.id}/files/ifc`)
      .set('Content-Type', 'application/octet-stream')
      .set('X-File-Name', encodeURIComponent('Edificio Ñandú.ifc'))
      .send(IFC_CONTENT);
    expect(upload.status).toBe(200);
    expect(projectSchema.parse(upload.body).files.ifc).toMatchObject({
      fileName: 'Edificio Ñandú.ifc',
      sizeBytes: IFC_CONTENT.length,
    });

    const download = await request(app)
      .get(`/api/projects/${project.id}/files/ifc`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(Buffer.compare(download.body as Buffer, IFC_CONTENT)).toBe(0);

    const etag = download.headers['etag'];
    expect(etag).toBeTruthy();
    const revalidation = await request(app)
      .get(`/api/projects/${project.id}/files/ifc`)
      .set('If-None-Match', String(etag));
    expect(revalidation.status).toBe(304);
  });

  it('replaces the previous file of the same kind instead of duplicating it', async () => {
    const project = await createTestProject();
    const put = () =>
      request(app)
        .put(`/api/projects/${project.id}/files/ifc`)
        .set('Content-Type', 'application/octet-stream')
        .send(IFC_CONTENT);
    await put();
    await put();
    expect(await testPrisma.modelFile.count({ where: { projectId: project.id } })).toBe(1);
  });

  it('rejects a file that is not an IFC', async () => {
    const project = await createTestProject();
    const res = await request(app)
      .put(`/api/projects/${project.id}/files/ifc`)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('not an ifc'));
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('INVALID_IFC');
  });

  it('rejects an unknown file kind and a missing file', async () => {
    const project = await createTestProject();
    expect((await request(app).get(`/api/projects/${project.id}/files/pdf`)).status).toBe(400);
    expect((await request(app).get(`/api/projects/${project.id}/files/frag`)).status).toBe(404);
  });

  it('does not let anyone replace the demo model', async () => {
    const demo = await testPrisma.project.create({ data: { name: 'Demo', isDemo: true } });
    const res = await request(app)
      .put(`/api/projects/${demo.id}/files/ifc`)
      .set('Content-Type', 'application/octet-stream')
      .send(IFC_CONTENT);
    expect(res.status).toBe(403);
  });
});

describe('CORS', () => {
  it('answers the preflight only for allowed origins', async () => {
    const allowed = await request(app)
      .options('/api/projects')
      .set('Origin', 'https://frontend.example')
      .set('Access-Control-Request-Method', 'PUT');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://frontend.example');

    const denied = await request(app).get('/api/projects').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
