/**
 * The Hono app and its Node entry point.
 *
 * Two jobs only: serve the built client, and proxy /api/generate. All interpretation
 * lives in prompt/, all measurement in src/shared/geometry — this file wires them to a
 * port and nothing else.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import { generateRoute } from './routes/generate';
import { isConfigured } from './deepseek';

/*
 * Load the repo-root .env before anything reads process.env.
 *
 * Resolved from import.meta.url, not cwd, so `npm start`, `tsx src/server/index.ts` and a
 * launch from any other directory all find the same file. The file is optional: a missing
 * .env throws, and that is fine — geometry, section 1 and flat-profile reports never need
 * a key (see GET /api/health for which state the server is in).
 *
 * Verified on Node 22.17: process.loadEnvFile does NOT override variables already present
 * in process.env, so a value exported in the shell or passed on the command line wins over
 * the file. That is the precedence we want for deploys and for tests.
 *
 * This runs after the imports above by ESM evaluation order, which is safe only because no
 * imported module reads process.env at module scope — deepseek.ts reads it inside
 * readConfig()/isConfigured(), both called per request. Keep it that way.
 */
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  /* .env is optional. */
}

export const app = new Hono();

app.get('/api/health', (c) =>
  c.json({ ok: true, generator: isConfigured() ? 'configured' : 'unconfigured' }),
);

app.route('/api', generateRoute);

/*
 * In production the client is a built Vite bundle in ./dist; in dev, Vite serves it and
 * proxies /api here, so mounting the static handler would only shadow a directory that
 * may not exist yet.
 */
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

/** True only when this module is the process entry point, so importing `app` is inert. */
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port }, (info) => {
    const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    console.log(
      `Mindstack server on http://localhost:${info.port} (${mode}, report generator ` +
        `${isConfigured() ? 'configured' : 'UNCONFIGURED — flat-profile reports only'})`,
    );
  });
}

export default app;
