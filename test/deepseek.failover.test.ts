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
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_BASE_URL,
} = await import('../src/server/deepseek');

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

  it('defaults the OpenRouter model to the free deepseek-v4-flash', () => {
    expect(OPENROUTER_DEFAULT_MODEL).toBe('deepseek/deepseek-v4-flash:free');
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

  it('does NOT fail over after only a THINKING item has streamed (thinking counts as a byte)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-stub';
    process.env.DEEPSEEK_API_KEY = 'sk-ds-stub';
    process.env.DEEPSEEK_REASONING_EFFORT = 'none';
    // The primary streams a reasoning delta, then the stream dies. The reader has already
    // seen that thinking, so switching providers would replay the murmur — no failover.
    byModel = {
      [OR_MODEL]: [{ chunks: [chunk({ reasoning: 'OR thinking, live to the reader. ' }), httpError(500)] }],
      [DS_MODEL]: [{ chunks: success }],
    };

    const items: StreamReportItem[] = [];
    let threw = false;
    try {
      for await (const item of streamReport({ system: 'sys', user: 'usr' })) items.push(item);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
    expect(items.some((i) => i.kind === 'thinking')).toBe(true);
    const models = createSpy.mock.calls.map((c) => (c[0] as { model: string }).model);
    expect(models).toEqual([OR_MODEL]); // DeepSeek was never tried
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
});
