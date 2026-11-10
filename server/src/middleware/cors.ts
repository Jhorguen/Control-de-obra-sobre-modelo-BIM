import type { RequestHandler } from 'express';

/**
 * Minimal CORS for a frontend hosted on another domain (Vercel) calling this API (Render).
 * Only the configured origins are allowed. No cookies are used, so no credentials mode.
 * Written by hand to avoid a dependency for a dozen lines of headers.
 */
export function cors(allowedOrigins: readonly string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.get('Origin');
    // Responses differ by Origin, so shared caches must key on it.
    res.vary('Origin');

    if (!origin || !allowedOrigins.includes(origin)) {
      next();
      return;
    }

    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Expose-Headers', 'Content-Disposition');

    if (req.method === 'OPTIONS') {
      // Preflight request sent by the browser before PUT/DELETE or custom headers.
      res.set({
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, X-File-Name',
        'Access-Control-Max-Age': '600',
      });
      res.status(204).end();
      return;
    }

    next();
  };
}
