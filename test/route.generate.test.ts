/**
 * The SSE route, driven end to end with a STUBBED streamReport — no network, no paid call.
 * Proves the thinking/chunk event mapping and, critically, that only report CONTENT is
 * buffered for the guards: thinking is passed through verbatim, never audited, never given
 * the disclaimer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDisclaimer } from '../src/server/kb/loader';

// A shared control object the hoisted mock reads from (vi.mock factories can't close over
// ordinary test-scope variables).
const control = vi.hoisted(() => ({
  items: [] as Array<{ kind: 'thinking' | 'content'; text: string }>,
  error: null as unknown,
  // Every StreamRequest the route actually sent — the prompted-reasoning wiring
  // (reportHeadings, fallbackUser) lives or dies on these fields reaching streamReport.
  requests: [] as Array<Record<string, unknown>>,
}));

vi.mock('../src/server/deepseek', async (importActual) => {
  const actual = await importActual<typeof import('../src/server/deepseek')>();
  return {
    ...actual, // keeps the real error classes, so a thrown one is `instanceof` the real type
    isConfigured: () => true,
    streamReport: async function* (request: Record<string, unknown>) {
      control.requests.push(request);
      for (const item of control.items) yield item;
      if (control.error) throw control.error;
    },
  };
});

const { generateRoute } = await import('../src/server/routes/generate');
const { DeepSeekEmptyReportError } = await import('../src/server/deepseek');

interface Frame {
  event: string;
  data: string;
}

async function post(
  scores: Record<string, number>,
  extra: Record<string, unknown> = {},
): Promise<Frame[]> {
  const res = await generateRoute.request('/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scores, ...extra }),
  });
  const raw = await res.text();
  return raw
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message';
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
        .join('\n');
      return { event, data };
    });
}

// Profile A — a NORMAL profile, so the route takes the LLM path.
const PROFILE_A = { Ni: 39.6, Ti: 34, Te: 31, Fi: 30, Ne: 25.4, Se: 25, Si: 21, Fe: 8 };

const withDisclaimer = (body: string) => `${body}\n\n> ${getDisclaimer()}`;

beforeEach(() => {
  control.items = [];
  control.error = null;
  control.requests = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/generate — thinking + content streaming', () => {
  it('emits meta first, then thinking, then chunk, then audit and done', async () => {
    control.items = [
      { kind: 'thinking', text: 'weighing the Ni spike ' },
      { kind: 'thinking', text: 'against the Fe floor ' },
      { kind: 'content', text: '## How your processing runs\n\nWorth testing.' },
      { kind: 'content', text: withDisclaimer('') },
    ];

    const frames = await post(PROFILE_A);
    const events = frames.map((f) => f.event);

    expect(events[0]).toBe('meta');
    expect(events).toContain('thinking');
    expect(events).toContain('chunk');
    // meta precedes the first thinking; thinking (here) precedes the first chunk.
    expect(events.indexOf('meta')).toBeLessThan(events.indexOf('thinking'));
    expect(events.indexOf('thinking')).toBeLessThan(events.indexOf('chunk'));
    // audit then done close the stream.
    expect(events.at(-2)).toBe('audit');
    expect(events.at(-1)).toBe('done');
  });

  it('passes thinking text through verbatim on the thinking event', async () => {
    control.items = [
      { kind: 'thinking', text: 'raw chain of thought, kept as-is' },
      { kind: 'content', text: withDisclaimer('## How your processing runs\n\nWorth testing.') },
    ];

    const frames = await post(PROFILE_A);
    const thinking = frames.filter((f) => f.event === 'thinking');
    expect(thinking).toHaveLength(1);
    expect(JSON.parse(thinking[0]!.data)).toEqual({ text: 'raw chain of thought, kept as-is' });
  });

  it('audits and disclaims CONTENT only — thinking is never scored', async () => {
    // Thinking is full of prohibited vocabulary; content is clean and already carries the
    // disclaimer. If the buffer included thinking, the audit would flag INTJ and the norms
    // claim — so an empty audit proves thinking stayed out of the guarded buffer.
    control.items = [
      { kind: 'thinking', text: 'This person is clearly an INTJ, only 3% of profiles score this.' },
      { kind: 'content', text: withDisclaimer('## How your processing runs\n\nWorth testing.') },
    ];

    const frames = await post(PROFILE_A);

    const audit = frames.find((f) => f.event === 'audit');
    expect(audit).toBeDefined();
    expect(JSON.parse(audit!.data)).toEqual({ violations: [] });

    // The thinking WAS delivered to the reader, verbatim, INTJ and all.
    const thinking = frames.find((f) => f.event === 'thinking');
    expect(JSON.parse(thinking!.data).text).toContain('INTJ');

    // No chunk carries the thinking text (it was never buffered or re-emitted as content).
    const chunkText = frames
      .filter((f) => f.event === 'chunk')
      .map((f) => JSON.parse(f.data).text as string)
      .join('');
    expect(chunkText).not.toContain('INTJ');
  });

  it('appends the disclaimer to CONTENT when the model omits it, ignoring thinking', async () => {
    control.items = [
      { kind: 'thinking', text: 'no disclaimer here, and that is fine' },
      { kind: 'content', text: '## How your processing runs\n\nWorth testing. No disclaimer.' },
    ];

    const frames = await post(PROFILE_A);
    const chunkText = frames
      .filter((f) => f.event === 'chunk')
      .map((f) => JSON.parse(f.data).text as string)
      .join('');

    // The guard supplied the missing block as a final chunk...
    expect(chunkText).toContain('What this is');
    // ...and the audit reported the omission as the violation it is.
    const violations = JSON.parse(frames.find((f) => f.event === 'audit')!.data).violations;
    expect(violations.join(' ')).toMatch(/disclaimer/i);
  });

  it('sends a reader-safe error to the page and keeps the detail on the terminal', async () => {
    control.items = [{ kind: 'thinking', text: 'thought a lot, wrote nothing' }];
    control.error = new DeepSeekEmptyReportError(
      'The report generator returned no report text. The model spent part of its output ' +
        'budget on internal reasoning; set DEEPSEEK_REASONING_EFFORT=none to stop that.',
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const frames = await post(PROFILE_A);
    const events = frames.map((f) => f.event);

    // Thinking still reached the reader before the failure...
    expect(events).toContain('thinking');
    // ...then a terminal error, and no audit/done after it.
    const error = frames.find((f) => f.event === 'error');
    expect(error).toBeDefined();
    // The page is public: no operational detail (env-var names, finish reasons) may reach
    // it. The full description goes to the server terminal instead.
    const message = JSON.parse(error!.data).message as string;
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain('DEEPSEEK');
    expect(message).not.toContain('no report text');
    expect(errorSpy).toHaveBeenCalledWith(
      '[generate] report stream failed:',
      expect.stringContaining('DEEPSEEK_REASONING_EFFORT'),
    );
    expect(events).not.toContain('audit');
    expect(events).not.toContain('done');
    errorSpy.mockRestore();
  });
});

describe('POST /api/generate — prompted-reasoning wiring to streamReport', () => {
  // The route test's stub used to swallow its argument, so deleting the wiring below
  // passed the whole suite while, in production, the splitter silently stayed off and the
  // plan streamed into the audited report. These pins make that regression fail loudly.
  const withMode = async (value: string | undefined, run: () => Promise<void>) => {
    const prior = process.env.DEEPSEEK_REASONING_EFFORT;
    if (value === undefined) delete process.env.DEEPSEEK_REASONING_EFFORT;
    else process.env.DEEPSEEK_REASONING_EFFORT = value;
    try {
      await run();
    } finally {
      if (prior === undefined) delete process.env.DEEPSEEK_REASONING_EFFORT;
      else process.env.DEEPSEEK_REASONING_EFFORT = prior;
    }
  };

  it('threads the English headings and the no-plan retry prompt on the default path', async () => {
    await withMode('prompted', async () => {
      control.items = [
        { kind: 'content', text: withDisclaimer('## How your mind tends to work\n\nBody.') },
      ];
      await post(PROFILE_A);
      const request = control.requests.at(-1)!;
      expect(request.reportHeadings).toEqual([
        '# ',
        '## How your mind tends to work',
        '## How you handle different situations',
        '## When things get stressful',
        '## Things you can try',
        '## Where this report comes from',
        "## What this report can't tell you",
      ]);
      expect(request.user).toContain('PLANNING PASS');
      expect(typeof request.fallbackUser).toBe('string');
      expect(request.fallbackUser).not.toContain('PLANNING PASS');
    });
  });

  it('threads the Indonesian headings for an "id" request', async () => {
    await withMode('prompted', async () => {
      control.items = [
        { kind: 'content', text: '## Cara pikiranmu biasanya bekerja\n\nIsi laporan.' },
      ];
      await post(PROFILE_A, { language: 'id' });
      const request = control.requests.at(-1)!;
      expect((request.reportHeadings as string[])[0]).toBe('# ');
      expect((request.reportHeadings as string[])[1]).toBe('## Cara pikiranmu biasanya bekerja');
      expect(request.reportHeadings as string[]).toHaveLength(7);
    });
  });

  it('sends no fallback prompt off the prompted path', async () => {
    await withMode('none', async () => {
      control.items = [
        { kind: 'content', text: withDisclaimer('## How your mind tends to work\n\nBody.') },
      ];
      await post(PROFILE_A);
      const request = control.requests.at(-1)!;
      expect('fallbackUser' in request).toBe(false);
      expect(request.user).not.toContain('PLANNING PASS');
    });
  });
});

describe('POST /api/generate — report language', () => {
  it('rejects an unknown language with a 400 instead of writing the wrong one', async () => {
    // Strictness is per-value: unknown strings, wrong types and the wrong case
    // are all 400s, because silently writing the wrong language would be worse.
    for (const language of ['fr', 'ID', 'EN', 5, true, {}, ['id']]) {
      const res = await generateRoute.request('/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scores: PROFILE_A, language }),
      });
      expect(res.status, `language ${JSON.stringify(language)} must be a 400`).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('"language"');
    }
  });

  it('treats an explicit null like an absent field: English', async () => {
    control.items = [
      { kind: 'content', text: withDisclaimer('## How your processing runs\n\nWorth testing.') },
    ];
    const frames = await post(PROFILE_A, { language: null });
    expect(frames.map((f) => f.event).at(-1)).toBe('done');
    expect(JSON.parse(frames.find((f) => f.event === 'audit')!.data)).toEqual({ violations: [] });
  });

  it('serves the FLAT honest-null in Indonesian, audited with the Indonesian rules', async () => {
    // Deterministic path, no model: the report, its disclaimer and its audit
    // must all ride the requested language end to end.
    const flat = { Ti: 27, Se: 26, Ni: 25, Te: 25, Ne: 24, Fi: 24, Si: 23, Fe: 23 };
    const frames = await post(flat, { language: 'id' });
    expect(JSON.parse(frames[0]!.data)).toEqual({ regime: 'FLAT', llm: false });
    const chunkText = frames
      .filter((f) => f.event === 'chunk')
      .map((f) => JSON.parse(f.data).text as string)
      .join('');
    expect(chunkText).toContain('## Dari mana laporan ini berasal');
    expect(chunkText).toContain('Apa ini dan apa yang bukan.');
    expect(chunkText).not.toContain('What this is and is not.');
    // The block's own "diagnosis" must not self-flag: the strip works end to end.
    expect(JSON.parse(frames.find((f) => f.event === 'audit')!.data)).toEqual({ violations: [] });
    expect(frames.map((f) => f.event).at(-1)).toBe('done');
  });

  it('accepts an explicit "en" and behaves exactly like the default', async () => {
    control.items = [
      { kind: 'content', text: withDisclaimer('## How your processing runs\n\nWorth testing.') },
    ];
    const frames = await post(PROFILE_A, { language: 'en' });
    expect(frames.map((f) => f.event).at(-1)).toBe('done');
    expect(JSON.parse(frames.find((f) => f.event === 'audit')!.data)).toEqual({ violations: [] });
  });

  it('appends the INDONESIAN disclaimer when an Indonesian report omits it', async () => {
    control.items = [
      { kind: 'content', text: '## Cara pikiranmu biasanya bekerja\n\nLayak diuji.' },
    ];
    const frames = await post(PROFILE_A, { language: 'id' });
    const chunkText = frames
      .filter((f) => f.event === 'chunk')
      .map((f) => JSON.parse(f.data).text as string)
      .join('');
    expect(chunkText).toContain('Apa ini dan apa yang bukan.');
    // Zero cross-language contamination: no English block on the Indonesian path.
    expect(chunkText).not.toContain('What this is and is not.');
    const violations = JSON.parse(frames.find((f) => f.event === 'audit')!.data).violations;
    expect(violations.join(' ')).toMatch(/disclaimer/i);
  });

  it('accepts an Indonesian report that already carries its own disclaimer', async () => {
    const { DISCLAIMER_ID } = await import('../src/server/prompt/language');
    control.items = [
      {
        kind: 'content',
        text: `## Cara pikiranmu biasanya bekerja\n\nLayak diuji.\n\n> ${DISCLAIMER_ID}`,
      },
    ];
    const frames = await post(PROFILE_A, { language: 'id' });
    expect(JSON.parse(frames.find((f) => f.event === 'audit')!.data)).toEqual({ violations: [] });
    const chunkText = frames
      .filter((f) => f.event === 'chunk')
      .map((f) => JSON.parse(f.data).text as string)
      .join('');
    // Nothing appended: the block appears exactly once.
    expect(chunkText.indexOf('Apa ini dan apa yang bukan.')).toBe(
      chunkText.lastIndexOf('Apa ini dan apa yang bukan.'),
    );
  });
});
