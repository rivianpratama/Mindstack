/**
 * The streaming generator, exercised over a MOCKED OpenAI client — no network, no paid
 * call. Proves the tagged-item shape (thinking vs content) and that empty/truncation
 * detection still judges content only, with reasoning surfaced rather than swallowed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreamReportItem } from '../src/server/deepseek';

// A scriptable stand-in for one streamed completion. `scriptedRuns`, when set, scripts
// each successive create() call separately (attempt 1, attempt 2, ...) so the exhaustion
// fallback can be given a different second stream.
let scriptedChunks: unknown[] = [];
let scriptedRuns: unknown[][] | null = null;
const createSpy = vi.fn();

vi.mock('openai', () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: (...args: unknown[]) => {
          createSpy(...args);
          const chunks =
            scriptedRuns && scriptedRuns.length > 0 ? scriptedRuns.shift()! : scriptedChunks;
          return (async function* () {
            for (const chunk of chunks) yield chunk;
          })();
        },
      },
    };
    constructor(_options: unknown) {}
  }
  return { default: FakeOpenAI };
});

const chunk = (
  delta: { content?: string; reasoning_content?: string },
  finish_reason: string | null = null,
) => ({ choices: [{ index: 0, delta, finish_reason }] });

// Imported after the mock is registered (vi.mock is hoisted above imports anyway).
const { streamReport, DeepSeekEmptyReportError, DeepSeekTruncatedError } = await import(
  '../src/server/deepseek'
);

async function collect(): Promise<StreamReportItem[]> {
  const items: StreamReportItem[] = [];
  for await (const item of streamReport({ system: 'sys', user: 'usr' })) items.push(item);
  return items;
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'sk-stub-not-real';
  delete process.env.DEEPSEEK_REASONING_EFFORT;
  scriptedChunks = [];
  scriptedRuns = null;
  createSpy.mockClear();
  // The exhaustion guard reports its fallback on the server terminal; keep test output quiet.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  vi.restoreAllMocks();
});

describe('streamReport tagged items', () => {
  it('tags reasoning deltas as thinking and content deltas as content', async () => {
    scriptedChunks = [
      chunk({ reasoning_content: 'let me consider the Ni spike... ' }),
      chunk({ reasoning_content: 'and the Fe floor. ' }),
      chunk({ content: '## How your processing runs\n\n' }),
      chunk({ content: 'Worth testing against a real week.\n' }),
      chunk({}, 'stop'),
    ];

    const items = await collect();

    expect(items).toEqual([
      { kind: 'thinking', text: 'let me consider the Ni spike... ' },
      { kind: 'thinking', text: 'and the Fe floor. ' },
      { kind: 'content', text: '## How your processing runs\n\n' },
      { kind: 'content', text: 'Worth testing against a real week.\n' },
    ]);
  });

  it('surfaces reasoning that interleaves with content, in stream order', async () => {
    scriptedChunks = [
      chunk({ content: 'A. ' }),
      chunk({ reasoning_content: 'reconsidering ' }),
      chunk({ content: 'B.' }),
      chunk({}, 'stop'),
    ];

    expect((await collect()).map((i) => i.kind)).toEqual(['content', 'thinking', 'content']);
  });

  it('still throws empty-report when even the no-thinking fallback is reasoning-only', async () => {
    // The live defect: the whole budget spent thinking, zero content, stopped on length.
    // The exhaustion guard retries once with thinking disabled; if THAT stream is somehow
    // still reasoning-only, the empty-report error must surface rather than loop.
    scriptedChunks = [
      chunk({ reasoning_content: 'thinking hard, burning the cap... ' }),
      chunk({ reasoning_content: 'still thinking... ' }),
      chunk({}, 'length'),
    ];

    await expect(collect()).rejects.toBeInstanceOf(DeepSeekEmptyReportError);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it('still throws truncation when content stops on length', async () => {
    scriptedChunks = [chunk({ content: 'half a report' }), chunk({}, 'length')];
    await expect(collect()).rejects.toBeInstanceOf(DeepSeekTruncatedError);
  });

  it('does not count thinking toward content: thinking never rescues an empty report', async () => {
    // A great deal of reasoning, not one content char — must still be an empty report
    // (after the guard's single no-thinking fallback replays the same emptiness).
    scriptedChunks = [
      chunk({ reasoning_content: 'x'.repeat(5000) }),
      chunk({ content: '' }, 'stop'),
    ];
    await expect(collect()).rejects.toBeInstanceOf(DeepSeekEmptyReportError);
  });
});

describe('exhaustion guard: no reader-visible failure from reasoning exhaustion', () => {
  it('aborts runaway thinking before any content and retries once with thinking disabled', async () => {
    // Default budget 32000, reserve 8000, 3 chars/token: the guard must fire once
    // reasoning passes (32000-8000)*3 = 72000 chars with no content written.
    scriptedRuns = [
      [
        chunk({ reasoning_content: 'x'.repeat(40_000) }),
        chunk({ reasoning_content: 'y'.repeat(40_000) }),
        chunk({ reasoning_content: 'never consumed: the guard aborts first' }),
      ],
      [
        chunk({ content: 'Recovered: the report, generated without thinking.' }),
        chunk({}, 'stop'),
      ],
    ];

    const items = await collect();

    // The reader saw the (abandoned) thinking live, then a complete report — no error.
    expect(items.filter((i) => i.kind === 'thinking')).toHaveLength(2);
    expect(items.filter((i) => i.kind === 'content').map((i) => i.text)).toEqual([
      'Recovered: the report, generated without thinking.',
    ]);
    expect(createSpy).toHaveBeenCalledTimes(2);
    const retry = createSpy.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(retry.thinking).toEqual({ type: 'disabled' });
    expect('reasoning_effort' in retry).toBe(false);
    // The cause lands on the server terminal, not in the stream.
    expect(console.error).toHaveBeenCalled();
  });

  it('recovers when the stream ends reasoning-only below the runaway threshold', async () => {
    scriptedRuns = [
      [chunk({ reasoning_content: 'brief think, then the cap' }), chunk({}, 'length')],
      [chunk({ content: 'Recovered report.' }), chunk({}, 'stop')],
    ];

    const items = await collect();

    expect(items.at(-1)).toEqual({ kind: 'content', text: 'Recovered report.' });
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it('honours a small explicit maxTokens: the guard fires proportionally earlier', async () => {
    // maxTokens 9000 → thinking may spend (9000-8000)*3 = 3000 chars before the guard.
    scriptedRuns = [
      [chunk({ reasoning_content: 'x'.repeat(3_500) }), chunk({ reasoning_content: 'more' })],
      [chunk({ content: 'Tiny-budget report.' }), chunk({}, 'stop')],
    ];

    const items: string[] = [];
    for await (const item of streamReport({ system: 'sys', user: 'usr', maxTokens: 9000 })) {
      if (item.kind === 'content') items.push(item.text);
    }

    expect(items).toEqual(['Tiny-budget report.']);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });
});
