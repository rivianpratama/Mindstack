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
}));

vi.mock('../src/server/deepseek', async (importActual) => {
  const actual = await importActual<typeof import('../src/server/deepseek')>();
  return {
    ...actual, // keeps the real error classes, so a thrown one is `instanceof` the real type
    isConfigured: () => true,
    streamReport: async function* () {
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

async function post(scores: Record<string, number>): Promise<Frame[]> {
  const res = await generateRoute.request('/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scores }),
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/generate — thinking + content streaming', () => {
  it('emits meta first, then thinking, then chunk, then audit and done', async () => {
    control.items = [
      { kind: 'thinking', text: 'weighing the Ni spike ' },
      { kind: 'thinking', text: 'against the Fe floor ' },
      { kind: 'content', text: '## How your processing runs\n\nWorth testing [H].' },
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
      { kind: 'content', text: withDisclaimer('## How your processing runs\n\nWorth testing [H].') },
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
      { kind: 'content', text: withDisclaimer('## How your processing runs\n\nWorth testing [H].') },
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
      { kind: 'content', text: '## How your processing runs\n\nWorth testing [H]. No disclaimer.' },
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

  it('reports the empty-report error path and sends no audit or done', async () => {
    control.items = [{ kind: 'thinking', text: 'thought a lot, wrote nothing' }];
    control.error = new DeepSeekEmptyReportError('The report generator returned no report text.');

    const frames = await post(PROFILE_A);
    const events = frames.map((f) => f.event);

    // Thinking still reached the reader before the failure...
    expect(events).toContain('thinking');
    // ...then a terminal error, and no audit/done after it.
    const error = frames.find((f) => f.event === 'error');
    expect(error).toBeDefined();
    expect(JSON.parse(error!.data).message).toContain('no report text');
    expect(events).not.toContain('audit');
    expect(events).not.toContain('done');
  });
});
