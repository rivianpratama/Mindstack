/**
 * The DeepSeek proxy. The key lives here and nowhere else: it is never sent to the
 * client, and no upstream error body is ever forwarded verbatim.
 *
 * Model id, base URL and key all come from the environment (DeepSeek's model names
 * shift; hardcoding one would rot). Temperature is held at 0.5: high enough to keep the
 * prose from flattening into one voice across profiles, low enough to curb the flattery
 * drift documented for higher temperatures. Per the thinking_mode guide, temperature is a
 * documented no-op while thinking is ON — it only shapes the `none` (thinking off) path.
 *
 * REASONING: deepseek-v4-flash is a hybrid reasoning model. It emits `reasoning_content`
 * (thinking) alongside `content` (the answer). Thinking is switched with the documented
 * `thinking: { type: 'enabled' | 'disabled' }` parameter and is ON by default, bounded to
 * the shortest documented effort (see DEFAULT_REASONING_EFFORT). `reasoning_content` is
 * streamed to the reader as a separate `thinking` SSE event (see routes/generate.ts),
 * clearly labeled raw scratch work, and NEVER buffered, audited, or given the disclaimer;
 * only `content` is the report. Empty/truncated failure modes are judged on content alone
 * (see `classifyStreamOutcome`). Because thinking tokens are billed against `max_tokens`,
 * MAX_COMPLETION_TOKENS is set to the model ceiling and TIMEOUT_MS is wide. Set
 * DEEPSEEK_REASONING_EFFORT=none for a fast, cheap no-thinking pass.
 */

import OpenAI from 'openai';

export const DEFAULT_MODEL = 'deepseek-v4-flash';
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';
export const TEMPERATURE = 0.5;
// Total wall-clock budget per attempt. Thinking is on by default, and at the deeper
// efforts ('default'/'max') the model can think for minutes on a large prompt before it
// writes a single byte (nothing streams during the thinking phase). 600s gives that room
// while still capping a genuinely hung connection. Set DEEPSEEK_REASONING_EFFORT=none for
// the fast (~48s) no-thinking path.
export const TIMEOUT_MS = 600_000;
// Pre-stream retries for transient failures (connection reset, 429, 5xx). Only ever
// attempted before the first byte reaches the client, so a retry can never double a
// partial report. Short backoff gives a momentary network blip time to clear.
export const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [250, 750];

/**
 * Completion cap. The comprehensive format has a 2000-word hard floor and a 2200-3000
 * word target, which is roughly 3000-4500 output tokens; 8000 leaves room for a long
 * profile plus the verbatim disclaimer without truncating mid-section. Comfortable, but
 * only because reasoning tokens no longer compete for the same budget.
 */
// Reasoning is ON by default (see DEFAULT_REASONING_EFFORT). The model's hidden thinking
// tokens are billed against this same budget, so it must cover BOTH the reasoning pass
// (a few thousand tokens on a rich profile) AND the 2000-3000 word report (~4500 tokens).
// 16000 leaves comfortable headroom; the truncation guard catches the rare overrun.
export const MAX_COMPLETION_TOKENS = 32000;

/** The effort levels DeepSeek documents (thinking_mode guide). Nothing else exists. */
export type DeepSeekReasoningEffort = 'low' | 'high' | 'max';

/**
 * Thinking ON but BOUNDED by default. Per the DeepSeek thinking_mode guide, reasoning is
 * switched with the dedicated `thinking: { type: 'enabled' | 'disabled' }` parameter (see
 * buildChatRequest); `reasoning_effort` is a SEPARATE knob sent alongside it. The docs
 * table promises `low` / `high` / `max` (and maps `medium`/`xhigh` → `high`); the API's
 * real accepted enum (from a live 400 message, verified 2026-08-27) is OpenAI's full set —
 * none/minimal/low/medium/high/xhigh/max — and anything OUTSIDE it is REJECTED with a 400,
 * so the typo-fallback below is what keeps a bad deploy variable from failing every
 * report. Values are normalized here to the three documented levels; omitting the knob
 * means DeepSeek's server default, `high` (verified live via its prompt-scaffolding size:
 * low/minimal +0, high +79, max +92 prompt tokens on an identical request).
 *
 * Effort is a BIAS, not a hard cap: benchmarked live, a hard prompt drove EVERY level
 * (low included) to spend the entire max_tokens budget thinking and return zero content —
 * the empty-report case classifyStreamOutcome exists to catch. streamReport therefore
 * enforces the cap itself (see REPORT_RESERVE_TOKENS): runaway thinking is abandoned
 * before it can eat the report's share, and the attempt is rerun once with thinking
 * disabled, so exhaustion never surfaces to the reader as a failure.
 *
 * Control with DEEPSEEK_REASONING_EFFORT. NOTE: tsx watch does NOT reload .env — fully
 * restart `npm run dev:server` after changing it, or the old value stays live.
 *   `none`    → thinking OFF, fastest (~48s), no thinking panel content;
 *   `low`     → shortest thinking (the default here; `minimal` behaves identically);
 *   `high`    → deeper (aliases: `medium`, `xhigh`, per DeepSeek's own compat table);
 *   `max`     → deepest, slowest (can take minutes on a 16k prompt);
 *   `default` → send no knob; DeepSeek's server-side default applies (currently `high`).
 */
export const DEFAULT_REASONING_EFFORT: DeepSeekReasoningEffort = 'low';

/** The sentinel that means "send no reasoning_effort at all". */
export const OMIT_REASONING_EFFORT = 'default';

/** The sentinel that turns thinking OFF (via the `thinking` switch, not an effort). */
export const DISABLE_REASONING = 'none';

/**
 * Tokens held back for the report itself. DeepSeek offers no hard thinking cap (effort is
 * a bias — benchmarked: a hard prompt exhausts any level), so streamReport enforces the
 * reserve itself: thinking may spend the budget MINUS this, never further. Sized to the
 * assemble.ts prose budget (~7400 tokens for the largest report) plus slack.
 */
export const REPORT_RESERVE_TOKENS = 8000;

/**
 * Chars-per-token used to estimate thinking spend mid-stream (usage arrives only at the
 * end). Deliberately LOW (English runs ~4) so the guard fires early, never late.
 */
export const THINKING_CHARS_PER_TOKEN = 3;

// Every accepted spelling, mapped onto a documented level. The API 400s on anything
// outside its enum, and the docs table only promises low/high/max, so normalizing here
// keeps the wire on documented values whatever the env says.
const EFFORT_ALIASES: Record<string, DeepSeekReasoningEffort> = {
  low: 'low',
  high: 'high',
  max: 'max',
  minimal: 'low', // valid API variant (OpenAI vocabulary); measured identical to low
  medium: 'high', // DeepSeek's compat table maps medium → high
  xhigh: 'high', // ditto
};

export interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export class DeepSeekError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;
  /**
   * Reader-safe wording for the public page. `message` carries the operational detail
   * (env-var hints, finish reasons, statuses) and is for the server terminal only; the
   * route must never send it to the browser.
   */
  readonly publicMessage: string;

  constructor(
    message: string,
    options?: { status?: number; retryable?: boolean; publicMessage?: string },
  ) {
    super(message);
    this.name = 'DeepSeekError';
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
    this.publicMessage =
      options?.publicMessage ?? 'The report generator hit a problem. Please try again shortly.';
  }
}

/**
 * The model stopped because it hit the output cap. The report is incomplete, and the
 * route reports it rather than passing a truncated report off as finished.
 */
export class DeepSeekTruncatedError extends DeepSeekError {
  constructor(message: string, options?: { publicMessage?: string }) {
    super(message, options);
    this.name = 'DeepSeekTruncatedError';
  }
}

/**
 * The stream carried no report text at all. This is the empty-report defect: with hybrid
 * reasoning enabled the model can spend the whole budget thinking and emit no content.
 */
export class DeepSeekEmptyReportError extends DeepSeekError {
  constructor(message: string, options?: { publicMessage?: string }) {
    super(message, options);
    this.name = 'DeepSeekEmptyReportError';
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
      {
        publicMessage:
          'The report generator is not configured on this server. Your stack signature ' +
          'above is complete and was computed locally; only the interpreted sections need it.',
      },
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
 * One item off the stream. Two kinds travel the same channel, tagged so the route can
 * route each to its own SSE event:
 *   - `content`:  a `delta.content` piece, the report itself, buffered and audited.
 *   - `thinking`: a `delta.reasoning_content` piece, the model's raw reasoning, streamed
 *                  to the reader verbatim but never part of the report (not buffered, not
 *                  audited, no disclaimer).
 *
 * Empty/truncation detection judges CONTENT only, thinking is never report text, so the
 * `contentChars`/`reasoningChars` bookkeeping and `classifyStreamOutcome` are unchanged.
 */
export interface StreamReportItem {
  kind: 'content' | 'thinking';
  text: string;
}

/**
 * Resolve the reasoning setting from the environment. Returns null when the parameter must
 * be omitted entirely, so DeepSeek's own default (`high`) applies.
 *
 * An unrecognized value falls back to the default rather than being forwarded: the API
 * rejects values outside its enum with a 400 invalid_request_error, so a typo in a deploy
 * variable would otherwise fail every report outright.
 */
export function resolveReasoningEffort(
  raw?: string | null,
): DeepSeekReasoningEffort | typeof DISABLE_REASONING | null {
  const value = (raw ?? '').trim();
  if (value === '') return DEFAULT_REASONING_EFFORT; // unset → the bounded default (low)
  if (value === OMIT_REASONING_EFFORT) return null; // 'default' → omit; server default (high)
  if (value === DISABLE_REASONING) return DISABLE_REASONING; // 'none' → thinking off
  return EFFORT_ALIASES[value] ?? DEFAULT_REASONING_EFFORT; // level or alias; typo → default
}

export interface ChatRequestInput {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  reasoningEffort?: string | null;
}

/**
 * The exact request body, built as a pure function so the reasoning-effort policy is
 * testable without a paid call.
 */
export function buildChatRequest(input: ChatRequestInput) {
  const effort = resolveReasoningEffort(input.reasoningEffort);
  // 'none' is the one value that turns thinking OFF; everything else (a level, or null for
  // the server default) turns it ON via the documented `thinking` switch.
  const thinkingOn = effort !== DISABLE_REASONING;
  return {
    model: input.model,
    temperature: TEMPERATURE,
    stream: true as const,
    max_tokens: input.maxTokens ?? MAX_COMPLETION_TOKENS,
    // The DeepSeek-documented on/off switch for hybrid reasoning.
    thinking: { type: thinkingOn ? ('enabled' as const) : ('disabled' as const) },
    // A cap is sent ONLY when thinking is on AND an explicit level was chosen; unbounded
    // (null) sends no cap, so the model decides how much to think.
    ...(thinkingOn && effort !== null ? { reasoning_effort: effort } : {}),
    messages: [
      { role: 'system' as const, content: input.system },
      { role: 'user' as const, content: input.user },
    ],
  };
}

export interface StreamOutcome {
  /** Characters of `content` actually forwarded to the reader. */
  contentChars: number;
  /** Characters of `reasoning_content` seen and discarded. */
  reasoningChars: number;
  finishReason: string | null;
}

/**
 * Decide whether a completed stream is usable. Returns the error to raise, or null.
 *
 * This is the guard against the empty-report defect recurring silently: a stream that ends
 * on `length`, or that carried no content at all, is a failure even though the HTTP call
 * succeeded.
 */
export function classifyStreamOutcome(outcome: StreamOutcome): DeepSeekError | null {
  const spentThinking =
    outcome.reasoningChars > 0
      ? ' The model spent part of its output budget on internal reasoning; set ' +
        'DEEPSEEK_REASONING_EFFORT=none to stop that.'
      : '';

  if (outcome.contentChars === 0) {
    return new DeepSeekEmptyReportError(
      'The report generator returned no report text.' +
        spentThinking +
        ' Nothing was written, so there is nothing to show; please try again.',
      {
        publicMessage:
          'The report generator finished without writing any report text. ' +
          'Nothing was lost; please try again.',
      },
    );
  }

  if (outcome.finishReason === 'length') {
    return new DeepSeekTruncatedError(
      'The report was cut off before it finished: the generator hit its output limit ' +
        `(finish_reason "length") after about ${Math.round(outcome.contentChars / 6)} words.` +
        spentThinking +
        ' What you can see above is real, but the closing sections are missing.',
      {
        publicMessage:
          'The report was cut off before it finished. What you can see above is real, ' +
          'but the closing sections are missing. Please try again.',
      },
    );
  }

  return null;
}

/**
 * Streams the completion as tagged items (see `StreamReportItem`).
 *
 * One retry, and only on 429 or 5xx, and only before the first item has reached the client
 * : once anything (thinking or content) has streamed there is nothing to rewind, and a
 * retry would replay the model's reasoning from scratch.
 *
 * `reasoning_content` deltas are surfaced as `thinking` items and counted, but never mixed
 * into the report: they are the model thinking aloud, and the route keeps them out of the
 * buffer that guards and the disclaimer see.
 */
export async function* streamReport(request: StreamRequest): AsyncGenerator<StreamReportItem> {
  const config = readConfig();
  // maxRetries: 0. The retry policy is the one below (exactly one, and only before the
  // first item reaches the client), not the SDK's default of two silent replays.
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 0 });

  const maxTokens = request.maxTokens ?? MAX_COMPLETION_TOKENS;
  // Thinking may spend at most the budget minus the report's reserve, estimated in chars
  // because usage arrives only after the stream ends.
  const runawayChars = Math.max(0, maxTokens - REPORT_RESERVE_TOKENS) * THINKING_CHARS_PER_TOKEN;
  // One-shot: after the fallback, thinking is off, so a second exhaustion cannot happen.
  let exhaustionFallback = false;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    let yielded = false;
    let contentChars = 0;
    let reasoningChars = 0;
    let finishReason: string | null = null;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const signal = composeSignals(timeout.signal, request.signal);

    try {
      const stream = await client.chat.completions.create(
        buildChatRequest({
          model: config.model,
          system: request.system,
          user: request.user,
          ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
          reasoningEffort: exhaustionFallback
            ? DISABLE_REASONING
            : process.env.DEEPSEEK_REASONING_EFFORT,
        }),
        { signal },
      );

      let runaway = false;
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;

        // Hybrid-reasoning field, not in the SDK's types: surface it as `thinking`, and
        // count it toward reasoningChars (never contentChars, so it can't mask an empty
        // report). Any item on the wire counts as `yielded`: a retry would replay it.
        const reasoning = (choice.delta as { reasoning_content?: unknown } | undefined)
          ?.reasoning_content;
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          reasoningChars += reasoning.length;
          yielded = true;
          yield { kind: 'thinking', text: reasoning };
          // NO FAILURE FROM EXHAUSTION: if thinking is about to eat the report's reserve
          // and no content exists yet, abandon this attempt (breaking closes the upstream
          // stream) and rerun without thinking, instead of dying on `length` with an
          // empty report the reader would have to pay to retry.
          if (!exhaustionFallback && contentChars === 0 && reasoningChars > runawayChars) {
            runaway = true;
            break;
          }
        }

        const delta = choice.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          contentChars += delta.length;
          yielded = true;
          yield { kind: 'content', text: delta };
        }
      }

      if (runaway) {
        exhaustionFallback = true;
        console.error(
          `[deepseek] reasoning spent ~${Math.round(reasoningChars / THINKING_CHARS_PER_TOKEN)} ` +
            `of the ${maxTokens}-token budget with no report text yet; ` +
            'retrying once with thinking disabled.',
        );
        continue;
      }

      const outcome = classifyStreamOutcome({ contentChars, reasoningChars, finishReason });
      if (outcome) {
        // The other exhaustion shape: the stream ended (typically on `length`) having
        // written no content at all. Same remedy, same one-shot fallback.
        if (outcome instanceof DeepSeekEmptyReportError && !exhaustionFallback) {
          exhaustionFallback = true;
          console.error(`[deepseek] ${outcome.message} Retrying once with thinking disabled.`);
          continue;
        }
        throw outcome;
      }
      return;
    } catch (error) {
      const failure = describe(error, timeout.signal.aborted);
      if (attempt < MAX_ATTEMPTS && !yielded && failure.retryable) {
        const backoff = RETRY_BACKOFF_MS[attempt - 1] ?? 0;
        if (backoff > 0) await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
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
    const publicMessage = 'The report generator took too long to respond. Try again.';
    return new DeepSeekError(
      `The report generator did not respond within ${TIMEOUT_MS / 1000} seconds. Try again.`,
      { retryable: false, publicMessage },
    );
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  if (status === 401 || status === 403) {
    return new DeepSeekError(
      'The report generator rejected this server\'s credentials. This is a server-side ' +
        'configuration problem, not something you can fix.',
      {
        status,
        retryable: false,
        publicMessage: 'The report generator is unavailable right now. Please try again later.',
      },
    );
  }
  if (status === 429) {
    // Already reader-safe: no statuses, no configuration detail.
    const message = 'The report generator is rate-limited right now. Try again shortly.';
    return new DeepSeekError(message, { status, retryable: true, publicMessage: message });
  }
  if (typeof status === 'number' && Number.isFinite(status) && status >= 500) {
    const message = 'The report generator is having trouble upstream. Try again shortly.';
    return new DeepSeekError(message, { status, retryable: true, publicMessage: message });
  }
  if (error instanceof DeepSeekError) return error;

  const name = error instanceof Error ? error.name : '';
  if (name === 'AbortError') {
    const message = 'The report request was cancelled.';
    return new DeepSeekError(message, { retryable: false, publicMessage: message });
  }

  // Network-layer failure with no HTTP status: DNS, TCP reset, TLS, connection refused.
  // These are usually transient, so allow the pre-stream retry loop to try again before
  // surfacing the error to the reader.
  const message = 'The report generator could not be reached. Try again shortly.';
  return new DeepSeekError(message, {
    ...(typeof status === 'number' && Number.isFinite(status) ? { status } : {}),
    retryable: true,
    publicMessage: message,
  });
}
