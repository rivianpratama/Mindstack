/**
 * The streaming generator, exercised over a MOCKED OpenAI client — no network, no paid
 * call. Proves the tagged-item shape (thinking vs content) and that empty/truncation
 * detection still judges content only, with reasoning surfaced rather than swallowed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StreamReportItem } from '../src/server/deepseek';

// A scriptable stand-in for one streamed completion.
let scriptedChunks: unknown[] = [];
const createSpy = vi.fn();

vi.mock('openai', () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: (...args: unknown[]) => {
          createSpy(...args);
          return (async function* () {
            for (const chunk of scriptedChunks) yield chunk;
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
  createSpy.mockClear();
});

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
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

  it('still throws empty-report when a stream is reasoning-only', async () => {
    // The live defect: the whole budget spent thinking, zero content, stopped on length.
    scriptedChunks = [
      chunk({ reasoning_content: 'thinking hard, burning the cap... ' }),
      chunk({ reasoning_content: 'still thinking... ' }),
      chunk({}, 'length'),
    ];

    await expect(collect()).rejects.toBeInstanceOf(DeepSeekEmptyReportError);
  });

  it('still throws truncation when content stops on length', async () => {
    scriptedChunks = [chunk({ content: 'half a report' }), chunk({}, 'length')];
    await expect(collect()).rejects.toBeInstanceOf(DeepSeekTruncatedError);
  });

  it('does not count thinking toward content: thinking never rescues an empty report', async () => {
    // A great deal of reasoning, not one content char — must still be an empty report.
    scriptedChunks = [
      chunk({ reasoning_content: 'x'.repeat(5000) }),
      chunk({ content: '' }, 'stop'),
    ];
    await expect(collect()).rejects.toBeInstanceOf(DeepSeekEmptyReportError);
  });
});
