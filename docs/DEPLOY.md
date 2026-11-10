# Despliegue (capas gratuitas)

Arquitectura: **Vercel** (frontend estático) → **Render** (API Express) → **Neon** (PostgreSQL).
Los tres tienen plan gratuito; verifica sus condiciones vigentes antes de empezar.

## 1. Base de datos en Neon

1. Crea un proyecto en [neon.tech](https://neon.tech) (región cercana a la de Render, p. ej. `us-west-2` si Render está en Oregon).
2. Copia la cadena de conexión (`postgresql://…?sslmode=require`). Es el `DATABASE_URL`.

Las tablas se crean solas: la API ejecuta `prisma migrate deploy` cada vez que arranca.

## 2. API en Render

1. En [render.com](https://render.com): **New → Blueprint** y elige este repositorio. Render lee [`render.yaml`](../render.yaml).
2. En **Environment** del servicio define:
   - `DATABASE_URL`: la cadena de Neon.
   - `CORS_ORIGINS`: la URL del frontend en Vercel (p. ej. `https://control-obra-bim.vercel.app`). Puedes completarla después del paso 3.
3. Verifica `https://<tu-servicio>.onrender.com/api/health` → `{"status":"ok","database":"up",…}`.

> El plan gratuito de Render apaga el servicio tras ~15 min sin tráfico. La primera petición después tarda cerca de un minuto; el frontend lo indica en el estado del servidor.

## 3. Frontend en Vercel

1. En [vercel.com](https://vercel.com): **Add New → Project** e importa el repositorio.
2. **Root Directory**: `client`. Vercel detecta Vite y usa [`client/vercel.json`](../client/vercel.json).
3. Variable de entorno `VITE_API_URL` = URL de Render, sin `/api` (p. ej. `https://control-obra-bim-api.onrender.com`).
4. Despliega y vuelve al paso 2 para poner esta URL en `CORS_ORIGINS`.

## Variables de entorno

| Servicio | Variable       | Ejemplo                                                          |
| -------- | -------------- | ---------------------------------------------------------------- |
| Render   | `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| Render   | `CORS_ORIGINS` | `https://control-obra-bim.vercel.app`                            |
| Vercel   | `VITE_API_URL` | `https://control-obra-bim-api.onrender.com`                      |

Plantillas: [`server/.env.example`](../server/.env.example) y [`client/.env.example`](../client/.env.example).
