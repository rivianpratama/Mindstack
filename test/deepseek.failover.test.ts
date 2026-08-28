/**
 * Provider failover: OpenRouter primary, DeepSeek fallback (spec:
 * docs/superpowers/specs/2026-08-27-provider-failover-design.md).
 *
 * Everything here runs over a MOCKED openai module — no network, no paid call. The fake
 * scripts each streamed completion by the request's `model`, so the OpenRouter attempt and
 * the DeepSeek attempt can be given different outcomes and the failover seam proven.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreamReportItem } from '../src/server/deepseek';

type Script = { chunks?: unknown[]; throws?: unknown };

// A per-model queue of scripted completions. Each create() call shifts the next script for
// its model; the last one repeats (so a provider that retries keeps getting the same
// outcome without needing one entry per attempt).
let byModel: Record<string, Script[]> = {};
const createSpy = vi.fn();
// Captures the OpenAI constructor options per instance, so the per-kind header contract
// (X-Title / HTTP-Referer for OpenRouter, none for DeepSeek) can be asserted.
const ctorSpy = vi.fn();

vi.mock('openai', () => {
  class FakeOpenAI {
    constructor(options: unknown) {
      ctorSpy(options);
    }
    chat = {
      completions: {
        create: (body: { model: string }, ..._rest: unknown[]) => {
          createSpy(body);
          const queue = byModel[body.model] ?? [];
          const script = queue.length > 1 ? queue.shift()! : (queue[0] ?? { chunks: [] });
          if ('throws' in script && script.throws !== undefined) throw script.throws;
          const chunks = script.chunks ?? [];
          return (async function* () {
            // An Error scripted mid-array throws after the preceding chunks streamed,
            // modelling a stream that dies partway through.
            for (const c of chunks) {
              if (c instanceof Error) throw c;
              yield c;
            }
          })();
        },
      },
    };
  }
  return { default: FakeOpenAI };
});

const chunk = (
  delta: { content?: string; reasoning_content?: string; reasoning?: string },
  finish_reason: string | null = null,
) => ({ choices: [{ index: 0, delta, finish_reason }] });

const httpError = (status: number) => Object.assign(new Error(`status ${status}`), { status });

const {
  streamReport,
  buildChatRequest,
  resolveProviders,
  isConfigured,
  GEMINI_DEFAULT_MODEL,
  GEMINI_DEFAULT_BASE_URL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_BASE_URL,
} = await import('../src/server/deepseek');

const GM_MODEL = GEMINI_DEFAULT_MODEL;
const OR_MODEL = OPENROUTER_DEFAULT_MODEL;
const DS_MODEL = DEFAULT_MODEL;

async function collect(): Promise<StreamReportItem[]> {
  const items: StreamReportItem[] = [];
  for await (const item of streamReport({ system: 'sys', user: 'usr' })) items.push(item);
  return items;
}

// Every env var the provider resolver reads, saved and restored around each test so the
// suite never leaks a key into another file's process.env.
const ENV_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_BASE_URL',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'OPENROUTER_BASE_URL',
  'OPENROUTER_APP_TITLE',
  'OPENROUTER_APP_URL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_REASONING_EFFORT',
] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  byModel = {};
  createSpy.mockClear();
  ctorSpy.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe('resolveProviders', () => {
  it('puts OpenRouter first and DeepSeek second when both keys are set', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';

    const providers = resolveProviders();

    expect(providers.map((p) => p.name)).toEqual(['openrouter', 'deepseek']);
    expect(providers[0]).toMatchObject({
      kind: 'openrouter',
      apiKey: 'sk-or-stub',
      model: OPENROUTER_DEFAULT_MODEL,
      baseURL: OPENROUTER_DEFAULT_BASE_URL,
    });
    expect(providers[1]).toMatchObject({
      kind: 'deepseek',
      apiKey: 'sk-ds-stub',
      model: DEFAULT_MODEL,
      baseURL: DEFAULT_BASE_URL,
    });
  });

  it('puts Gemini FIRST, then OpenRouter, then DeepSeek when all three keys are set', () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';

    const providers = resolveProviders();

    expect(providers.map((p) => p.name)).toEqual(['gemini', 'openrouter', 'deepseek']);
    expect(providers[0]).toMatchObject({
      kind: 'gemini',
      apiKey: 'sk-gm-stub',
      model: GEMINI_DEFAULT_MODEL,
      baseURL: GEMINI_DEFAULT_BASE_URL,
    });
  });

  it('defaults the Gemini model to gemini-3.7-flash on the OpenAI-compatible endpoint', () => {
    expect(GEMINI_DEFAULT_MODEL).toBe('gemini-3.7-flash');
    expect(GEMINI_DEFAULT_BASE_URL).toBe('https://generativelanguage.googleapis.com/v1beta/openai/');
  });

  it('honours GEMINI_MODEL and GEMINI_BASE_URL overrides', () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    process.env.GEMINI_BASE_URL = 'https://proxy.example/v1beta/openai/';

    expect(resolveProviders()[0]).toMatchObject({
      model: 'gemini-2.5-flash',
      baseURL: 'https://proxy.example/v1beta/openai/',
    });
  });

  it('degrades to Gemini alone when only its key is set', () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    expect(resolveProviders().map((p) => p.name)).toEqual(['gemini']);
  });

  it('defaults the OpenRouter model to the best available free option (minimax-m3)', () => {
    // The originally-intended deepseek-v4-flash:free was retired by OpenRouter (404: "This
    // model is unavailable for free... use deepseek/deepseek-v4-flash" — the paid slug). No
    // DeepSeek :free variant remains, so the primary is the strongest FREE model that stays
    // available and follows instructions (plain language, no em-dashes, en/id); DeepSeek
    // direct is the paid fallback for when the free tier rate-limits.
    expect(OPENROUTER_DEFAULT_MODEL).toBe('minimax/minimax-m3:free');
    expect(OPENROUTER_DEFAULT_BASE_URL).toBe('https://openrouter.ai/api/v1');
  });

  it('honours OPENROUTER_MODEL and OPENROUTER_BASE_URL overrides', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.OPENROUTER_MODEL = 'meta-llama/llama-3-8b:free';
    process.env.OPENROUTER_BASE_URL = 'https://proxy.example/api/v1';

    expect(resolveProviders()[0]).toMatchObject({
      model: 'meta-llama/llama-3-8b:free',
      baseURL: 'https://proxy.example/api/v1',
    });
  });

  it('degrades to a single provider when only one key is set', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    expect(resolveProviders().map((p) => p.name)).toEqual(['deepseek']);

    delete process.env.DEEPSEEK_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    expect(resolveProviders().map((p) => p.name)).toEqual(['openrouter']);
  });

  it('returns an empty list when neither key is set', () => {
    expect(resolveProviders()).toEqual([]);
  });

  it('drives isConfigured: true when any provider resolves, false when none', () => {
    expect(isConfigured()).toBe(false);
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    expect(isConfigured()).toBe(true);
    delete process.env.OPENROUTER_API_KEY;
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    expect(isConfigured()).toBe(true);
  });
});

describe('buildChatRequest per provider kind', () => {
  const base = { model: OR_MODEL, system: 'sys', user: 'usr' };

  it('defaults to the DeepSeek shape when no kind is given (back-compat)', () => {
    const request = buildChatRequest({ model: DS_MODEL, system: 'sys', user: 'usr' }) as Record<
      string,
      unknown
    >;
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect('reasoning' in request).toBe(false);
  });

  it('translates thinking-off to reasoning.enabled=false and drops the thinking param', () => {
    for (const effort of ['none', 'prompted', '']) {
      const request = buildChatRequest({ ...base, kind: 'openrouter', reasoningEffort: effort }) as Record<
        string,
        unknown
      >;
      // DeepSeek's native switch never rides an OpenRouter request.
      expect('thinking' in request, `"${effort}" must send no thinking param`).toBe(false);
      expect(request.reasoning).toEqual({ enabled: false });
      expect('reasoning_effort' in request).toBe(false);
    }
  });

  it('translates an explicit native level to reasoning.effort', () => {
    const request = buildChatRequest({
      ...base,
      kind: 'openrouter',
      reasoningEffort: 'high',
    }) as Record<string, unknown>;
    expect(request.reasoning).toEqual({ effort: 'high' });
    expect('thinking' in request).toBe(false);
  });

  it('translates the model-default sentinel to reasoning.enabled=true', () => {
    const request = buildChatRequest({
      ...base,
      kind: 'openrouter',
      reasoningEffort: 'default',
    }) as Record<string, unknown>;
    expect(request.reasoning).toEqual({ enabled: true });
  });

  it('keeps the message and sampling shape identical across kinds', () => {
    const request = buildChatRequest({ ...base, kind: 'openrouter' }) as Record<string, unknown>;
    expect(request.stream).toBe(true);
    expect(request.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
  });

  it('translates Gemini thinking-off to the lowest accepted level (low), thoughts SHOWN', () => {
    for (const effort of ['none', 'prompted', '']) {
      const request = buildChatRequest({ ...base, kind: 'gemini', reasoningEffort: effort }) as Record<
        string,
        unknown
      >;
      // Gemini 3 cannot fully disable thinking, and gemini-3.7-flash REJECTS 'minimal' (400,
      // verified live 2026-08-28); 'low' is its floor. Because thinking can't be turned off,
      // the thoughts are SHOWN (include_thoughts: true) and unwrapped from the content stream —
      // hiding them left the reader with a report and no planning stream (the fixed defect).
      expect(request.extra_body, `"${effort}" must send native thinking_config`).toEqual({
        google: { thinking_config: { thinking_level: 'low', include_thoughts: true } },
      });
      // Never the OpenAI reasoning_effort knob (mutually exclusive with thinking_config), and
      // never the DeepSeek `thinking` or OpenRouter `reasoning` fields.
      expect('reasoning_effort' in request).toBe(false);
      expect('thinking' in request).toBe(false);
      expect('reasoning' in request).toBe(false);
    }
  });

  it('maps an explicit native level to thinking_level and surfaces the thoughts', () => {
    const high = buildChatRequest({ ...base, kind: 'gemini', reasoningEffort: 'high' }) as Record<
      string,
      unknown
    >;
    expect(high.extra_body).toEqual({
      google: { thinking_config: { thinking_level: 'high', include_thoughts: true } },
    });

    const low = buildChatRequest({ ...base, kind: 'gemini', reasoningEffort: 'low' }) as Record<
      string,
      unknown
    >;
    expect(low.extra_body).toEqual({
      google: { thinking_config: { thinking_level: 'low', include_thoughts: true } },
    });
  });

  it('maps max to high (Gemini 3 Flash has no thinking_level above high)', () => {
    const request = buildChatRequest({ ...base, kind: 'gemini', reasoningEffort: 'max' }) as Record<
      string,
      unknown
    >;
    expect(request.extra_body).toEqual({
      google: { thinking_config: { thinking_level: 'high', include_thoughts: true } },
    });
  });

  it('omits thinking_config entirely for the server-default sentinel', () => {
    const request = buildChatRequest({
      ...base,
      kind: 'gemini',
      reasoningEffort: 'default',
    }) as Record<string, unknown>;
    expect('extra_body' in request).toBe(false);
    expect('reasoning_effort' in request).toBe(false);
    expect('thinking' in request).toBe(false);
  });
});

describe('streamReport failover across providers', () => {
  const success = [
    chunk({ content: 'A real report paragraph, produced by the fallback provider.' }),
    chunk({}, 'stop'),
  ];

  it('fails over to DeepSeek when OpenRouter rejects before the first byte', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // 401 is non-retryable, so OpenRouter fails fast: one create() then failover.
    byModel = {
      [OR_MODEL]: [{ throws: httpError(401) }],
      [DS_MODEL]: [{ chunks: success }],
    };

    const items = await collect();

    expect(items.map((i) => i.text).join('')).toContain('fallback provider');
    // OpenRouter attempted once, then DeepSeek — the models on the wire prove the order.
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([OR_MODEL, DS_MODEL]);
    // The failover was logged to the terminal, never to the reader.
    expect(console.error).toHaveBeenCalled();
  });

  it('fails over after the primary exhausts its retries on a rate-limit storm', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // 429 is retryable: the primary burns its MAX_ATTEMPTS before handing off.
    byModel = {
      [OR_MODEL]: [{ throws: httpError(429) }],
      [DS_MODEL]: [{ chunks: success }],
    };

    const items = await collect();

    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models.filter((m) => m === OR_MODEL).length).toBe(3); // MAX_ATTEMPTS
    expect(models.at(-1)).toBe(DS_MODEL);
    expect(items.map((i) => i.text).join('')).toContain('fallback provider');
  });

  it('treats a 404 (retired/unknown model) as non-retryable and fails over immediately', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // A retired slug 404s; retrying the same dead model 3x just delays the handoff.
    byModel = {
      [OR_MODEL]: [{ throws: httpError(404) }],
      [DS_MODEL]: [{ chunks: success }],
    };

    const items = await collect();

    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models.filter((m) => m === OR_MODEL).length).toBe(1); // one attempt, no retry
    expect(models.at(-1)).toBe(DS_MODEL);
    expect(items.map((i) => i.text).join('')).toContain('fallback provider');
  });

  it('does NOT fail over once the primary has streamed a byte', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // The primary yields content, then the stream dies on length: a truncated report the
    // reader has already begun to see. Switching providers would duplicate it.
    byModel = {
      [OR_MODEL]: [{ chunks: [chunk({ content: 'half a report' }), chunk({}, 'length')] }],
      [DS_MODEL]: [{ chunks: success }],
    };

    await expect(collect()).rejects.toBeTruthy();
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([OR_MODEL]); // DeepSeek was never tried
  });

  it('with only DeepSeek configured, never fails over (transparent single provider)', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    byModel = { [DS_MODEL]: [{ throws: httpError(401) }] };

    await expect(collect()).rejects.toBeTruthy();
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([DS_MODEL]);
  });

  it('sends the OpenRouter reasoning translation on the primary attempt', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    byModel = { [OR_MODEL]: [{ chunks: success }] };

    await collect();

    const body = createSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.model).toBe(OR_MODEL);
    expect(body.reasoning).toEqual({ enabled: false });
    expect('thinking' in body).toBe(false);
  });

  it('reads OpenRouter reasoning deltas (delta.reasoning) as thinking, not content', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    byModel = {
      [OR_MODEL]: [
        {
          chunks: [
            chunk({ reasoning: 'OpenRouter surfaces reasoning on its own field. ' }),
            chunk({ content: 'The actual report body, long enough to be real.' }),
            chunk({}, 'stop'),
          ],
        },
      ],
    };

    const items = await collect();

    expect(items.filter((i) => i.kind === 'thinking').map((i) => i.text).join('')).toBe(
      'OpenRouter surfaces reasoning on its own field. ',
    );
    expect(items.filter((i) => i.kind === 'content').map((i) => i.text).join('')).toBe(
      'The actual report body, long enough to be real.',
    );
  });

  it('surfaces the FALLBACK provider error when both providers fail before the first byte', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // Both non-retryable (distinct statuses) so both fail in one call each: the reader must
    // get DeepSeek's 403, never OpenRouter's stale 401 — the loop keeps no first-error.
    byModel = {
      [OR_MODEL]: [{ throws: httpError(401) }],
      [DS_MODEL]: [{ throws: httpError(403) }],
    };

    const error = (await collect().then(
      () => null,
      (e) => e,
    )) as { status?: number } | null;

    expect(error?.status).toBe(403);
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([OR_MODEL, DS_MODEL]);
  });

  it('DOES fail over after only a THINKING item has streamed (scratch is not the report)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // The primary streams a reasoning delta (ephemeral scratch — never buffered, audited, or
    // part of the report), then the stream dies before any CONTENT. No report byte has reached
    // the reader, so the wrapper fails over to DeepSeek; the murmur simply continues from the
    // next provider. (This is the real-world Gemini failure: it streams the prompted plan, then
    // its stream truncates before the report — the whole 3-tier chain would be defeated if a
    // streamed plan blocked failover.)
    byModel = {
      [OR_MODEL]: [{ chunks: [chunk({ reasoning: 'OR thinking, live to the reader. ' }), httpError(500)] }],
      [DS_MODEL]: [{ chunks: success }],
    };

    const items = await collect();

    expect(items.some((i) => i.kind === 'thinking')).toBe(true);
    expect(items.map((i) => i.text).join('')).toContain('fallback provider');
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([OR_MODEL, DS_MODEL]);
  });

  it('fails over from Gemini when the prompted plan streams but NO report content does', async () => {
    // The exact gemini-3.7-flash failure this fix targets: it streams the start of the PLANNING
    // PASS (re-tagged as thinking by the prelude splitter), then the stream ends before the
    // report heading — 0 report content. Only scratch reached the reader, so the wrapper must
    // fail over to OpenRouter instead of erroring, and the report comes from the fallback.
    const HEADING = '## How your mind tends to work';
    const BODY = 'A real report paragraph, long enough to count as content. '.repeat(6);
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'prompted';
    byModel = {
      // Plan text only, no canonical heading, then the stream simply ends (finish_reason null).
      [GM_MODEL]: [{ chunks: [chunk({ content: 'PLANNING PASS\n1. Evidence scan, still planning.' })] }],
      [OR_MODEL]: [{ chunks: [chunk({ content: `${HEADING}\n\n${BODY}` }), chunk({}, 'stop')] }],
    };

    const items: StreamReportItem[] = [];
    for await (const item of streamReport({
      system: 'sys',
      user: 'usr-with-plan',
      fallbackUser: 'usr-no-plan',
      reportHeadings: [HEADING],
    })) {
      items.push(item);
    }

    // Gemini's partial plan surfaced as thinking; the report content came from OpenRouter.
    expect(items.filter((i) => i.kind === 'thinking').map((i) => i.text).join('')).toContain('PLANNING PASS');
    expect(items.filter((i) => i.kind === 'content').map((i) => i.text).join('')).toContain(HEADING);
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models[0]).toBe(GM_MODEL); // started on Gemini
    expect(models.at(-1)).toBe(OR_MODEL); // ended on OpenRouter
  });

  it('runs prompted mode end to end on the OpenRouter primary: plan split off, reasoning disabled', async () => {
    const HEADING = '## How your mind tends to work';
    const BODY = 'A real paragraph of report prose, long enough to be a report. '.repeat(5);
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'prompted';
    byModel = {
      [OR_MODEL]: [
        {
          chunks: [
            chunk({ content: '1. Ni spike over Fe cliff.\n' }),
            chunk({ content: `${HEADING}\n\n${BODY}` }),
            chunk({}, 'stop'),
          ],
        },
      ],
    };

    const items: StreamReportItem[] = [];
    for await (const item of streamReport({
      system: 'sys',
      user: 'usr-with-plan',
      fallbackUser: 'usr-no-plan',
      reportHeadings: [HEADING],
    })) {
      items.push(item);
    }

    // The plan rode content and was re-tagged thinking; the report is content from the heading.
    expect(items.filter((i) => i.kind === 'thinking').map((i) => i.text).join('')).toBe(
      '1. Ni spike over Fe cliff.\n',
    );
    expect(items.filter((i) => i.kind === 'content').map((i) => i.text).join('')).toBe(
      `${HEADING}\n\n${BODY}`,
    );
    // Prompted mode is thinking-off, so the OpenRouter body disables reasoning (never the
    // DeepSeek `thinking` switch).
    const body = createSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.reasoning).toEqual({ enabled: false });
    expect('thinking' in body).toBe(false);
  });

  it('attaches OpenRouter attribution headers per kind and honours the env overrides', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    process.env.OPENROUTER_APP_TITLE = 'Mindstack Test';
    process.env.OPENROUTER_APP_URL = 'https://mindstack.example';
    // OpenRouter fails fast so DeepSeek is also constructed in the same run.
    byModel = {
      [OR_MODEL]: [{ throws: httpError(401) }],
      [DS_MODEL]: [{ chunks: success }],
    };

    await collect();

    const headerSets = ctorSpy.mock.calls.map(
      (c) => (c[0] as { defaultHeaders?: Record<string, string> }).defaultHeaders,
    );
    // First client is OpenRouter (headers), second is DeepSeek (none).
    expect(headerSets[0]).toEqual({
      'X-Title': 'Mindstack Test',
      'HTTP-Referer': 'https://mindstack.example',
    });
    expect(headerSets[1]).toBeUndefined();
  });

  it('fails over Gemini -> OpenRouter -> DeepSeek across pre-first-byte failures', async () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // Gemini and OpenRouter both reject before the first byte (401, non-retryable); DeepSeek,
    // last in the chain, carries the report. The models on the wire prove the whole order.
    byModel = {
      [GM_MODEL]: [{ throws: httpError(401) }],
      [OR_MODEL]: [{ throws: httpError(401) }],
      [DS_MODEL]: [{ chunks: success }],
    };

    const items = await collect();

    expect(items.map((i) => i.text).join('')).toContain('fallback provider');
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([GM_MODEL, OR_MODEL, DS_MODEL]);
  });

  it('fails over from Gemini to OpenRouter and stops there when OpenRouter succeeds', async () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    byModel = {
      [GM_MODEL]: [{ throws: httpError(401) }],
      [OR_MODEL]: [{ chunks: success }],
      [DS_MODEL]: [{ chunks: success }],
    };

    const items = await collect();

    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([GM_MODEL, OR_MODEL]); // DeepSeek never reached
    expect(items.map((i) => i.text).join('')).toContain('fallback provider');
  });

  it('does NOT fail over once Gemini has streamed a byte', async () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // The primary yields content, then dies on length: a truncated report the reader has
    // already begun to see. Switching providers would duplicate it.
    byModel = {
      [GM_MODEL]: [{ chunks: [chunk({ content: 'half a report' }), chunk({}, 'length')] }],
      [OR_MODEL]: [{ chunks: success }],
    };

    await expect(collect()).rejects.toBeTruthy();
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([GM_MODEL]); // OpenRouter was never tried
  });

  it('sends the Gemini native thinking_config on the primary attempt (thinking off)', async () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    byModel = { [GM_MODEL]: [{ chunks: success }] };

    await collect();

    const body = createSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.model).toBe(GM_MODEL);
    expect(body.extra_body).toEqual({
      google: { thinking_config: { thinking_level: 'low', include_thoughts: true } },
    });
    expect('reasoning_effort' in body).toBe(false);
    expect('thinking' in body).toBe(false);
  });

  it('unwraps Gemini <thought> content into the thinking stream, keeping the report clean', async () => {
    // Gemini can't stop thinking; with thoughts shown it inlines them in `content` wrapped in
    // <thought>...</thought> (no separate reasoning field). The unwrapper must peel those onto
    // the `thinking` event so the planning stream shows, and the report must NOT carry the tags.
    const HEADING = '## How your mind tends to work';
    const BODY = 'A real report paragraph, long enough to count as content. '.repeat(6);
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'prompted';
    byModel = {
      [GM_MODEL]: [
        {
          chunks: [
            // A thought block split across deltas (the </thought> tag straddles a boundary),
            // then the real report — exactly the shape the live endpoint streams.
            chunk({ content: '<thought>Weighing the Ni spike against the Fe cliff.</thou' }),
            chunk({ content: `ght>${HEADING}\n\n${BODY}` }),
            chunk({}, 'stop'),
          ],
        },
      ],
    };

    const items: StreamReportItem[] = [];
    for await (const item of streamReport({
      system: 'sys',
      user: 'usr-with-plan',
      fallbackUser: 'usr-no-plan',
      reportHeadings: [HEADING],
    })) {
      items.push(item);
    }

    const thinking = items.filter((i) => i.kind === 'thinking').map((i) => i.text).join('');
    const content = items.filter((i) => i.kind === 'content').map((i) => i.text).join('');
    expect(thinking).toContain('Weighing the Ni spike against the Fe cliff.');
    // The tags are stripped from BOTH streams; the report is clean.
    expect(thinking).not.toContain('<thought>');
    expect(thinking).not.toContain('</thought>');
    expect(content).toContain(HEADING);
    expect(content).not.toContain('<thought>');
    expect(content).not.toContain('</thought>');
    expect(content).not.toContain('Weighing the Ni spike');
    // Only Gemini ran; the thought stream did not defeat the report.
    expect(createSpy.mock.calls.map((c) => (c[0] as { model: string }).model)).toEqual([GM_MODEL]);
  });

  it('constructs the Gemini client at its endpoint with no attribution headers', async () => {
    process.env.GEMINI_API_KEY = 'sk-gm-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    byModel = { [GM_MODEL]: [{ chunks: success }] };

    await collect();

    const ctorOptions = ctorSpy.mock.calls[0]?.[0] as {
      baseURL?: string;
      defaultHeaders?: unknown;
    };
    expect(ctorOptions.baseURL).toBe(GEMINI_DEFAULT_BASE_URL);
    expect(ctorOptions.defaultHeaders).toBeUndefined();
  });
});
