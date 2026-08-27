/**
 * The Hono app definition (routes, handlers, middleware).
 *
 * Separated from index.ts so this app can be used both in standalone Node
 * (via @hono/node-server in index.ts) and in serverless/edge environments (via hono/vercel in api/index.ts).
 */

import { Hono } from 'hono';
import { generateRoute } from './routes/generate';
import { isConfigured } from './deepseek';

export const app = new Hono();

app.get('/api/health', (c) =>
  c.json({ ok: true, generator: isConfigured() ? 'configured' : 'unconfigured' }),
);

app.route('/api', generateRoute);

export default app;
