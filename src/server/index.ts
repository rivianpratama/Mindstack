/**
 * The Hono app and its Node entry point.
 *
 * Two jobs only: serve the built client, and proxy /api/generate. All interpretation
 * lives in prompt/, all measurement in src/shared/geometry — this file wires them to a
 * port and nothing else.
 */

import { pathToFileURL } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

import { generateRoute } from './routes/generate';
import { isConfigured } from './deepseek';

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
