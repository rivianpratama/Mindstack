/**
 * The DeepSeek proxy. The key lives here and nowhere else — it is never sent to the
 * client, and no upstream error body is ever forwarded verbatim.
 *
 * Model id, base URL and key all come from the environment (DeepSeek's model names
 * shift; hardcoding one would rot). Temperature is held at 0.5: high enough to keep the
 * prose from flattening into one voice across profiles, low enough to curb the flattery
 * drift documented for higher temperatures.
 */

import OpenAI from 'openai';

export const DEFAULT_MODEL = 'deepseek-v4-flash';
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';
export const TEMPERATURE = 0.5;
export const TIMEOUT_MS = 90_000;

/**
 * Completion cap. The comprehensive format has a 2000-word hard floor and a 2200-3000
 * word target, which is roughly 3000-4500 output tokens; 8000 leaves room for a long
 * profile plus the verbatim disclaimer without truncating mid-section.
 */
export const MAX_COMPLETION_TOKENS = 8000;

export interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export class DeepSeekError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;

  constructor(message: string, options?: { status?: number; retryable?: boolean }) {
    super(message);
    this.name = 'DeepSeekError';
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

/** Whether a live call is possible at all. The route checks this before promising one. */
export function isConfigured(): boolean {
  return typeof process.env.DEEPSEEK_API_KEY === 'string' && process.env.DEEPSEEK_API_KEY !== '';
}

export function readConfig(): DeepSeekConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError(
      'The report generator is not configured on this server: DEEPSEEK_API_KEY is unset. ' +
        'Geometry, section 1 and flat-profile reports work without it.',
    );
  }
  return {
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
  };
}

export interface StreamRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /** Caller's cancellation (client disconnect). Composed with the 90s timeout. */
  signal?: AbortSignal;
}

/**
 * Streams the completion as text deltas.
 *
 * One retry, and only on 429 or 5xx, and only before the first delta has been yielded —
 * once bytes have reached the client there is nothing to rewind.
 */
export async function* streamReport(request: StreamRequest): AsyncGenerator<string> {
  const config = readConfig();
  // maxRetries: 0 — the retry policy is the one below (exactly one, and only before the
  // first delta reaches the client), not the SDK's default of two silent replays.
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 0 });

  let attempt = 0;
  for (;;) {
    attempt += 1;
    let yielded = false;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const signal = composeSignals(timeout.signal, request.signal);

    try {
      const stream = await client.chat.completions.create(
        {
          model: config.model,
          temperature: TEMPERATURE,
          stream: true,
          max_tokens: request.maxTokens ?? MAX_COMPLETION_TOKENS,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        },
        { signal },
      );

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          yielded = true;
          yield delta;
        }
      }
      return;
    } catch (error) {
      const failure = describe(error, timeout.signal.aborted);
      if (attempt === 1 && !yielded && failure.retryable) continue;
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** One AbortSignal that fires when either input does. */
function composeSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) controller.abort();
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

/**
 * Upstream failures, reduced to a status and a message safe to show a reader. Never
 * includes the key, the request body, or the raw upstream payload.
 */
function describe(error: unknown, timedOut: boolean): DeepSeekError {
  if (timedOut) {
    return new DeepSeekError(
      `The report generator did not respond within ${TIMEOUT_MS / 1000} seconds. Try again.`,
      { retryable: false },
    );
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  if (status === 401 || status === 403) {
    return new DeepSeekError(
      'The report generator rejected this server’s credentials. This is a server-side ' +
        'configuration problem, not something you can fix.',
      { status, retryable: false },
    );
  }
  if (status === 429) {
    return new DeepSeekError('The report generator is rate-limited right now. Try again shortly.', {
      status,
      retryable: true,
    });
  }
  if (typeof status === 'number' && Number.isFinite(status) && status >= 500) {
    return new DeepSeekError('The report generator is having trouble upstream. Try again shortly.', {
      status,
      retryable: true,
    });
  }
  if (error instanceof DeepSeekError) return error;

  const name = error instanceof Error ? error.name : '';
  if (name === 'AbortError') {
    return new DeepSeekError('The report request was cancelled.', { retryable: false });
  }

  return new DeepSeekError(
    'The report generator could not be reached. Try again shortly.',
    { ...(typeof status === 'number' && Number.isFinite(status) ? { status } : {}), retryable: false },
  );
}
