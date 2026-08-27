/**
 * Vercel Serverless Function entrypoint (Node.js request listener).
 *
 * Uses getRequestListener from @hono/node-server so Vercel's Node.js runtime
 * can pipe streaming SSE responses directly to Node's ServerResponse (`res`).
 *
 * Bundled by esbuild into api/index.js during `npm run build`.
 */

import { getRequestListener } from '@hono/node-server';
import { app } from './app';

export const config = {
  maxDuration: 60,
};

export default getRequestListener(app.fetch);
