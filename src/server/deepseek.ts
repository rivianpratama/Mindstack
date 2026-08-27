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
 * (thinking) alongside `content` (the answer), switched with the documented
 * `thinking: { type: 'enabled' | 'disabled' }` parameter. Native thinking proved
 * unsteerable (effort is a bias, not a cap; see DEFAULT_REASONING_MODE), so the DEFAULT
 * path is now PROMPTED reasoning: thinking OFF on the wire, and the prompt scripts a
 * bounded planning pass the model writes in the content stream before the first report
 * heading (assemble.ts PLANNING_PASS; spec in docs/superpowers/specs/). The prelude
 * splitter (prelude.ts) re-tags everything before that heading as `thinking`, so it rides
 * the same SSE event native reasoning used: streamed to the reader as raw scratch work,
 * NEVER buffered, audited, or given the disclaimer; only post-heading `content` is the
 * report. Empty/truncated failure modes are judged on content alone (see
 * `classifyStreamOutcome`). Native thinking remains available via
 * DEEPSEEK_REASONING_EFFORT=low/high/max/default; `none` is the fast no-reasoning pass
 * (no thinking, no plan).
 */

import OpenAI from 'openai';

import { createPreludeSplitter } from './prelude';

export const DEFAULT_MODEL = 'deepseek-v4-flash';
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';
/**
 * OpenRouter primary defaults. The free deepseek-v4-flash slug is the intended primary;
 * DeepSeek direct (above) is the paid fallback. Both endpoints are OpenAI-compatible, so
 * the same SDK client serves either with a different key, base URL, and model id — only
 * the reasoning dialect differs (buildChatRequest keys that on the provider `kind`).
 */
export const OPENROUTER_DEFAULT_MODEL = 'deepseek/deepseek-v4-flash:free';
export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
export const TEMPERATURE = 0.5;
// Total wall-clock budget per attempt. Sized for the native-thinking fallback path: at
// the deeper efforts ('default'/'max') the model can think for minutes on a large prompt
// before it writes a single byte (nothing streams during the thinking phase). 600s gives
// that room while still capping a genuinely hung connection. The prompted default and
// `none` stream from the first seconds and finish far inside it.
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
// On the native-thinking fallback path the model's hidden thinking tokens are billed
// against this same budget, so the ceiling must cover BOTH the reasoning pass (a few
// thousand tokens on a rich profile) AND the 2000-3000 word report (~4500 tokens). The
// prompted default asks for far less (assemble sizes maxTokens per mode); this is the
// clamp, not the ask.
export const MAX_COMPLETION_TOKENS = 32000;

/** The effort levels DeepSeek documents (thinking_mode guide). Nothing else exists. */
export type DeepSeekReasoningEffort = 'low' | 'high' | 'max';

/**
 * PROMPTED reasoning by default. Native thinking's `reasoning_effort` is a BIAS, not a
 * hard cap: benchmarked live, a hard prompt drove EVERY level (low included) to spend
 * the entire max_tokens budget thinking and return zero content — the empty-report case
 * classifyStreamOutcome exists to catch — and the thinking itself takes no instruction
 * about what to consider or how to conclude. So the default sends
 * `thinking: { type: 'disabled' }` and scripts the reasoning in the prompt instead: a
 * bounded planning pass written in the content stream before the first report heading,
 * split off by prelude.ts and surfaced on the same `thinking` SSE event. Steerable
 * (edit the prompt), truly capped (max_tokens is output-only again), and temperature
 * applies (it is a documented no-op while thinking is ON).
 *
 * Native thinking stays reachable for comparison. Per the DeepSeek thinking_mode guide,
 * `thinking` is the on/off switch and `reasoning_effort` a SEPARATE knob: the docs table
 * promises `low` / `high` / `max` (mapping `medium`/`xhigh` → `high`); the API's real
 * accepted enum (from a live 400 message, verified 2026-08-27) is OpenAI's full set, and
 * anything OUTSIDE it is REJECTED with a 400, so the typo-fallback below is what keeps a
 * bad deploy variable from failing every report. Omitting the knob means DeepSeek's
 * server default, `high` (verified live via its prompt-scaffolding size).
 *
 * Control with DEEPSEEK_REASONING_EFFORT. NOTE: tsx watch does NOT reload .env — fully
 * restart `npm run dev:server` after changing it, or the old value stays live.
 *   (unset) / `prompted` → thinking OFF, scripted plan in-stream (the default);
 *   `none`    → thinking OFF and NO plan, fastest, no thinking panel content;
 *   `low`     → shortest native thinking (`minimal` behaves identically);
 *   `high`    → deeper native thinking (aliases: `medium`, `xhigh`);
 *   `max`     → deepest, slowest (can take minutes on a 16k prompt);
 *   `default` → send no knob; DeepSeek's server-side default applies (currently `high`).
 */
export const PROMPTED_REASONING = 'prompted';

/** What an unset (or typo'd) DEEPSEEK_REASONING_EFFORT resolves to. */
export const DEFAULT_REASONING_MODE = PROMPTED_REASONING;

/** The sentinel that means "send no reasoning_effort at all". */
export const OMIT_REASONING_EFFORT = 'default';

/** The sentinel that turns thinking OFF (via the `thinking` switch, not an effort). */
export const DISABLE_REASONING = 'none';

/** Everything resolveReasoningEffort can return; null means "omit the knob". */
export type ResolvedReasoningMode =
  | DeepSeekReasoningEffort
  | typeof DISABLE_REASONING
  | typeof PROMPTED_REASONING
  | null;

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

/**
 * Tokens the prompted planning pass may spend, budgeted into maxTokens by assemble.ts on
 * the prompted path. Owned HERE so the runaway guard below can never drift from what was
 * actually reserved. Sized for the prompt's 1200-word plan ceiling (~2650 tokens at the
 * 2.2 tokens/word convention) plus slack.
 */
export const PROMPTED_PLAN_HEADROOM_TOKENS = 3500;

/**
 * The prompted-mode analogue of the runaway guard: characters of planning pass allowed
 * before any report content. DERIVED from the plan's own token headroom at the
 * deliberately-low chars-per-token estimate, so the guard fires before the plan can
 * spend past its budgeted share — mirroring how the native guard reserves the report's
 * share of max_tokens. A genuine 1200-word plan (~8000 chars) fits comfortably under it;
 * an attempt cut off here is rerun once with the no-plan prompt instead of silently
 * eating the report's budget and dying on `length` mid-report.
 */
export const PRELUDE_RUNAWAY_CHARS = PROMPTED_PLAN_HEADROOM_TOKENS * THINKING_CHARS_PER_TOKEN;

/**
 * The floor below which forwarded content is not a report. A bare heading that leaked
 * past the splitter (~45 chars) must never ship as a "successful" report with an
 * auto-appended disclaimer; the shortest legitimate report (a STAIRCASE profile's) still
 * runs thousands of characters. Judged at stream end by classifyStreamOutcome.
 */
export const MIN_REPORT_CONTENT_CHARS = 200;

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

/** Which upstream a provider talks to; selects the request dialect and the delta fields. */
export type ProviderKind = 'openrouter' | 'deepseek';

/**
 * A resolved upstream: an OpenAI-compatible endpoint, the model to ask for, and the
 * dialect (`kind`) to speak. resolveProviders() returns these in failover order.
 */
export interface Provider {
  name: string;
  kind: ProviderKind;
  apiKey: string;
  baseURL: string;
  model: string;
}

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
  return resolveProviders().length > 0;
}

/** An env var counts as set only when it is a non-empty string. */
function envKey(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * The providers to try, in failover order: OpenRouter first (the free primary) when its
 * key is set, DeepSeek second (the paid fallback) when its key is set. Either may be
 * absent; an empty list means the generator is unconfigured (the route's honest-null path
 * still works with no key at all). Pure over process.env and never throws, so isConfigured()
 * and the stream wrapper read exactly the same truth.
 */
export function resolveProviders(): Provider[] {
  const providers: Provider[] = [];
  const openRouterKey = envKey('OPENROUTER_API_KEY');
  if (openRouterKey) {
    providers.push({
      name: 'openrouter',
      kind: 'openrouter',
      apiKey: openRouterKey,
      baseURL: process.env.OPENROUTER_BASE_URL || OPENROUTER_DEFAULT_BASE_URL,
      model: process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL,
    });
  }
  const deepSeekKey = envKey('DEEPSEEK_API_KEY');
  if (deepSeekKey) {
    providers.push({
      name: 'deepseek',
      kind: 'deepseek',
      apiKey: deepSeekKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
      model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    });
  }
  return providers;
}

/**
 * Attribution headers OpenRouter uses for its free-tier ranking. Optional and harmless:
 * X-Title defaults to the app name, HTTP-Referer is sent only when configured.
 */
function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Title': process.env.OPENROUTER_APP_TITLE || 'Mindstack',
  };
  const referer = envKey('OPENROUTER_APP_URL');
  if (referer) headers['HTTP-Referer'] = referer;
  return headers;
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
  /**
   * The no-plan variant of `user` (assemble's userPromptNoPlan): the one-shot retry
   * prompt for when the prompted plan swallows the report. Ignored off that path.
   */
  fallbackUser?: string;
  /**
   * The exact canonical headings for the report's language. Required for the prompted
   * default to work: they are what the prelude splitter keys on. Without them the
   * splitter stays off and content passes through untagged.
   */
  reportHeadings?: readonly string[];
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
export function resolveReasoningEffort(raw?: string | null): ResolvedReasoningMode {
  const value = (raw ?? '').trim();
  if (value === '') return DEFAULT_REASONING_MODE; // unset → prompted plan, thinking off
  if (value === PROMPTED_REASONING) return PROMPTED_REASONING; // explicit spelling of the default
  if (value === OMIT_REASONING_EFFORT) return null; // 'default' → omit; server default (high)
  if (value === DISABLE_REASONING) return DISABLE_REASONING; // 'none' → thinking off, no plan
  return EFFORT_ALIASES[value] ?? DEFAULT_REASONING_MODE; // level or alias; typo → default
}

/**
 * The mode the environment resolves to right now. Read per call on purpose — the same
 * live value streamReport uses — so assemble's prompt and the stream splitter can never
 * disagree about whether a planning pass was asked for.
 */
export function activeReasoningMode(): ResolvedReasoningMode {
  return resolveReasoningEffort(process.env.DEEPSEEK_REASONING_EFFORT);
}

export interface ChatRequestInput {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  reasoningEffort?: string | null;
  /** Which dialect to speak. Defaults to DeepSeek so pre-failover callers are unchanged. */
  kind?: ProviderKind;
}

/**
 * The exact request body, built as a pure function so the reasoning policy is testable
 * without a paid call. The two providers control reasoning with DIFFERENT parameters, so
 * the resolved mode is translated per `kind`:
 *   - DeepSeek: the documented `thinking` on/off switch, plus `reasoning_effort` only when
 *     thinking is on AND an explicit level was chosen.
 *   - OpenRouter: its unified `reasoning` object — `{enabled:false}` for the no-native-
 *     thinking paths (none/prompted), `{effort}` for an explicit level, `{enabled:true}`
 *     for the server default. DeepSeek's `thinking` param never rides an OpenRouter call.
 * Both share sampling, streaming, the token cap, and the messages, so those are built once.
 */
export function buildChatRequest(input: ChatRequestInput) {
  const effort = resolveReasoningEffort(input.reasoningEffort);
  // 'none' and 'prompted' both turn thinking OFF ('prompted' reasons in the content stream
  // instead); a level, or null for the server default, turns it ON.
  const thinkingOn = effort !== DISABLE_REASONING && effort !== PROMPTED_REASONING;
  const common = {
    model: input.model,
    temperature: TEMPERATURE,
    stream: true as const,
    max_tokens: input.maxTokens ?? MAX_COMPLETION_TOKENS,
    messages: [
      { role: 'system' as const, content: input.system },
      { role: 'user' as const, content: input.user },
    ],
  };

  if (input.kind === 'openrouter') {
    const reasoning = !thinkingOn
      ? { enabled: false }
      : effort !== null
        ? { effort }
        : { enabled: true };
    return { ...common, reasoning };
  }

  return {
    ...common,
    // The DeepSeek-documented on/off switch for hybrid reasoning.
    thinking: { type: thinkingOn ? ('enabled' as const) : ('disabled' as const) },
    // A cap is sent ONLY when thinking is on AND an explicit level was chosen; unbounded
    // (null) sends no cap, so the model decides how much to think.
    ...(thinkingOn && effort !== null ? { reasoning_effort: effort } : {}),
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
 *
 * `minContentChars` raises the emptiness floor above the default (any content at all).
 * The prompted path passes MIN_REPORT_CONTENT_CHARS: there, a stray bare heading leaking
 * past the splitter is a plausible stream shape, and ~30 chars plus an auto-appended
 * disclaimer must not ship as a finished report. Native/none paths keep the historical
 * zero test — tiny content there is pure model degeneracy the wire has always surfaced
 * as-is.
 */
export function classifyStreamOutcome(
  outcome: StreamOutcome,
  options?: { minContentChars?: number },
): DeepSeekError | null {
  const floor = options?.minContentChars ?? 1;
  const spentThinking =
    outcome.reasoningChars > 0
      ? ' The model spent part of its output budget on internal reasoning; set ' +
        'DEEPSEEK_REASONING_EFFORT=none to stop that.'
      : '';

  if (outcome.contentChars < floor) {
    return new DeepSeekEmptyReportError(
      `The report generator returned no usable report text (${outcome.contentChars} chars of content).` +
        spentThinking +
        ' Nothing usable was written; please try again.',
      {
        publicMessage:
          'The report generator finished without writing your report. ' +
          'Please try again.',
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
 * The failover wrapper and public entry point. Resolves the ordered provider list and
 * delegates each attempt to streamOneProvider, advancing to the next provider ONLY when
 * the inner generator throws before yielding its first item of any kind — the same
 * no-rewind rule the per-provider retry uses, lifted one level. Once anything (thinking or
 * content) has streamed, an inner error propagates unchanged: the reader has already begun
 * to see this provider's output, so switching would duplicate it. With a single configured
 * provider the wrapper is transparent, so the route and the existing tests call it unchanged.
 */
export async function* streamReport(request: StreamRequest): AsyncGenerator<StreamReportItem> {
  const providers = resolveProviders();
  if (providers.length === 0) {
    // Defensive: the route guards with isConfigured() first, so this is only reachable if a
    // caller skips that check. Same shape of failure as readConfig's not-configured error.
    throw new DeepSeekError(
      'The report generator is not configured on this server: neither OPENROUTER_API_KEY ' +
        'nor DEEPSEEK_API_KEY is set. Geometry, section 1 and flat-profile reports work ' +
        'without it.',
      {
        publicMessage:
          'The report generator is not configured on this server. Your stack signature ' +
          'above is complete and was computed locally; only the interpreted sections need it.',
      },
    );
  }

  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i];
    const isLast = i === providers.length - 1;
    let yielded = false;
    try {
      for await (const item of streamOneProvider(request, provider)) {
        yielded = true;
        yield item;
      }
      return; // this provider carried the report to completion
    } catch (error) {
      // No rewind: if bytes already reached the reader, or this is the last provider,
      // surface the failure. Otherwise fail over to the next provider in the list.
      if (yielded || isLast) throw error;
      const next = providers[i + 1];
      console.error(
        `[failover] ${provider.name} failed before the first byte; trying ${next.name}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}

/**
 * Streams one provider's completion as tagged items (see `StreamReportItem`).
 *
 * One retry, and only on 429 or 5xx, and only before the first item has reached the client
 * : once anything (thinking or content) has streamed there is nothing to rewind, and a
 * retry would replay the model's reasoning from scratch.
 *
 * Two sources feed the `thinking` items, never the report buffer that guards and the
 * disclaimer see:
 *   - reasoning deltas — `reasoning_content` (DeepSeek) or `reasoning` (OpenRouter),
 *     surfaced and counted;
 *   - in prompted mode, the planning pass: content deltas before the first canonical
 *     heading, re-tagged by the prelude splitter (see prelude.ts and reportHeadings).
 */
async function* streamOneProvider(
  request: StreamRequest,
  provider: Provider,
): AsyncGenerator<StreamReportItem> {
  // maxRetries: 0. The retry policy is the one below (exactly one, and only before the
  // first item reaches the client), not the SDK's default of two silent replays.
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    maxRetries: 0,
    ...(provider.kind === 'openrouter' ? { defaultHeaders: openRouterHeaders() } : {}),
  });

  const maxTokens = request.maxTokens ?? MAX_COMPLETION_TOKENS;
  // Thinking may spend at most the budget minus the report's reserve, estimated in chars
  // because usage arrives only after the stream ends.
  const runawayChars = Math.max(0, maxTokens - REPORT_RESERVE_TOKENS) * THINKING_CHARS_PER_TOKEN;
  // The prompted default needs the headings to find the plan/report boundary; without
  // them the splitter stays off and content passes through untouched (test callers).
  const prompted =
    activeReasoningMode() === PROMPTED_REASONING && (request.reportHeadings?.length ?? 0) > 0;
  // One-shot: after the fallback (thinking off, or the no-plan prompt), a second
  // exhaustion cannot happen — nothing is left to over-spend on.
  let exhaustionFallback = false;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    let yielded = false;
    let contentChars = 0;
    let reasoningChars = 0;
    let finishReason: string | null = null;
    // Recreated per attempt: a retry starts a fresh stream with its own plan boundary.
    const splitter = prompted ? createPreludeSplitter(request.reportHeadings!) : null;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
    const signal = composeSignals(timeout.signal, request.signal);

    try {
      const stream = await client.chat.completions.create(
        buildChatRequest({
          model: provider.model,
          kind: provider.kind,
          system: request.system,
          // The prompted fallback swaps the prompt (plan instructions stripped) instead
          // of the thinking switch, which is already off on that path.
          user: exhaustionFallback && request.fallbackUser ? request.fallbackUser : request.user,
          ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
          reasoningEffort:
            exhaustionFallback && !prompted
              ? DISABLE_REASONING
              : process.env.DEEPSEEK_REASONING_EFFORT,
        }),
        { signal },
      );

      let runaway: 'thinking' | 'prelude' | null = null;
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;

        // Hybrid-reasoning field, not in the SDK's types: surface it as `thinking`, and
        // count it toward reasoningChars (never contentChars, so it can't mask an empty
        // report). DeepSeek names it `reasoning_content`; OpenRouter normalizes the same
        // stream to `reasoning`. Read either, so neither provider's reasoning is dropped.
        // Any item on the wire counts as `yielded`: a retry would replay it.
        const deltaObj = choice.delta as
          | { reasoning_content?: unknown; reasoning?: unknown }
          | undefined;
        const reasoning =
          typeof deltaObj?.reasoning_content === 'string' && deltaObj.reasoning_content.length > 0
            ? deltaObj.reasoning_content
            : typeof deltaObj?.reasoning === 'string' && deltaObj.reasoning.length > 0
              ? deltaObj.reasoning
              : '';
        if (reasoning.length > 0) {
          reasoningChars += reasoning.length;
          yielded = true;
          yield { kind: 'thinking', text: reasoning };
          // NO FAILURE FROM EXHAUSTION: if thinking is about to eat the report's reserve
          // and no content exists yet, abandon this attempt (breaking closes the upstream
          // stream) and rerun without thinking, instead of dying on `length` with an
          // empty report the reader would have to pay to retry.
          if (!exhaustionFallback && contentChars === 0 && reasoningChars > runawayChars) {
            runaway = 'thinking';
            break;
          }
        }

        const delta = choice.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          // In prompted mode the splitter re-tags the plan as thinking; it is a
          // pass-through once the report's first heading has been seen.
          const pieces: StreamReportItem[] = splitter
            ? splitter.push(delta)
            : [{ kind: 'content', text: delta }];
          for (const item of pieces) {
            if (item.kind === 'content') contentChars += item.text.length;
            else reasoningChars += item.text.length;
            yielded = true;
            yield item;
          }
          // The prompted analogue of the runaway guard: a plan far past its prompt
          // ceiling with no heading in sight is abandoned, and the attempt rerun once
          // with the no-plan prompt.
          if (
            splitter &&
            !splitter.contentStarted &&
            !exhaustionFallback &&
            splitter.preludeChars > PRELUDE_RUNAWAY_CHARS
          ) {
            runaway = 'prelude';
            break;
          }
        }
      }

      // The stream ended with the splitter still holding a partial line: plan tail.
      if (runaway === null && splitter) {
        for (const item of splitter.flush()) {
          if (item.kind === 'content') contentChars += item.text.length;
          else reasoningChars += item.text.length;
          yielded = true;
          yield item;
        }
      }

      if (runaway) {
        exhaustionFallback = true;
        console.error(
          runaway === 'prelude'
            ? `[deepseek] the planning pass ran past ${PRELUDE_RUNAWAY_CHARS} chars with no ` +
                'report heading yet; retrying once with the no-plan prompt.'
            : `[deepseek] reasoning spent ~${Math.round(reasoningChars / THINKING_CHARS_PER_TOKEN)} ` +
                `of the ${maxTokens}-token budget with no report text yet; ` +
                'retrying once with thinking disabled.',
        );
        continue;
      }

      const outcome = classifyStreamOutcome(
        { contentChars, reasoningChars, finishReason },
        // Only the prompted path raises the floor: a bare heading leaking past the
        // splitter is a plausible shape there and must not ship as a finished report.
        prompted ? { minContentChars: MIN_REPORT_CONTENT_CHARS } : undefined,
      );
      if (outcome) {
        // The other exhaustion shape: the stream ended (typically on `length`) having
        // written no content at all. Same remedy, same one-shot fallback. Gated on
        // contentChars === 0, never the classifier's usability floor: a retry must not
        // replay content the client has already rendered, so a sub-floor leak (a bare
        // heading) surfaces as an honest error instead of a duplicated report.
        if (outcome instanceof DeepSeekEmptyReportError && !exhaustionFallback && contentChars === 0) {
          exhaustionFallback = true;
          console.error(
            `[deepseek] ${outcome.message} Retrying once ` +
              `${prompted ? 'with the no-plan prompt' : 'with thinking disabled'}.`,
          );
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
