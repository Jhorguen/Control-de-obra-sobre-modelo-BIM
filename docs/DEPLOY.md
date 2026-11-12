# Deployment (free tiers)

Architecture: **Vercel** (static frontend) → **Render** (Express API) → **Neon** (PostgreSQL).
All three have a free plan; check their current terms before you start.

## 1. Database on Neon

1. Create a project on [neon.tech](https://neon.tech), in a region close to Render's (e.g. `us-west-2` if Render runs in Oregon).
2. Copy the connection string (`postgresql://…?sslmode=require`). That is the `DATABASE_URL`. Use the **direct** connection: turn off _Connection pooling_ in Neon's _Connect_ dialog (the host must not contain `-pooler`), because migrations need a direct connection.

The tables create themselves: the API runs `prisma migrate deploy` every time it starts and creates the demo project if it does not exist yet (`db:seed -- --if-missing`).

To **reset the demo** (for example, if a visitor deleted its items), run this on your machine with the Neon string:

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npm run db:seed -w @bim/server
```

## 2. API on Render

1. On [render.com](https://render.com): **New → Blueprint** and pick this repository. Render reads [`render.yaml`](../render.yaml).
2. In the service's **Environment**, set:
   - `DATABASE_URL`: the Neon string.
   - `CORS_ORIGINS`: the frontend URL on Vercel (e.g. `https://control-obra-bim.vercel.app`, no trailing slash). You can fill it in after step 3.
3. Check `https://<your-service>.onrender.com/api/health` → `{"status":"ok","database":"up",…}`.

> Render's free plan stops the service after ~15 minutes without traffic. The next request takes about a minute; the frontend shows it in the server status.

## 3. Frontend on Vercel

1. On [vercel.com](https://vercel.com): **Add New → Project** and import the repository.
2. **Root Directory**: `client` (if Vercel suggests a multi-service project, choose **Import single project** on `client`). [`client/vercel.json`](../client/vercel.json) installs and builds from the monorepo root, because the client depends on `@bim/shared` and on TypeScript, which live outside `client`. It also serves the sample models of `samples/` as downloads under `/samples/`.
3. Environment variable `VITE_API_URL` = the Render URL, without `/api` (e.g. `https://control-obra-bim-api.onrender.com`).
4. Deploy, then go back to step 2 to put this URL in `CORS_ORIGINS`.

Both services redeploy on every push to `main`.

## Environment variables

| Service | Variable       | Example                                                          |
| ------- | -------------- | ---------------------------------------------------------------- |
| Render  | `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| Render  | `CORS_ORIGINS` | `https://control-obra-bim.vercel.app`                            |
| Vercel  | `VITE_API_URL` | `https://control-obra-bim-api.onrender.com`                      |

Templates: [`server/.env.example`](../server/.env.example) and [`client/.env.example`](../client/.env.example).
