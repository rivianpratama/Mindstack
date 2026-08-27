/**
 * Vercel Serverless Function entrypoint.
 *
 * Bundled by esbuild into api/index.js during `npm run build`.
 */

import { handle } from 'hono/vercel';
import { app } from './app';

export const config = {
  maxDuration: 60,
};

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);

export default handle(app);
