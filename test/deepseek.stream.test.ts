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

describe('prompted reasoning: the plan rides content and is split off as thinking', () => {
  const HEADING = '## How your mind tends to work';
  // Real reports run thousands of chars; fixtures must clear the prompted path's
  // MIN_REPORT_CONTENT_CHARS usability floor or they classify as empty.
  const BODY = 'A real paragraph of report prose, long enough to be a report. '.repeat(5);
  const request = {
    system: 'sys',
    user: 'usr-with-plan',
    fallbackUser: 'usr-no-plan',
    reportHeadings: [HEADING],
  };

  async function collectPrompted(): Promise<StreamReportItem[]> {
    const items: StreamReportItem[] = [];
    for await (const item of streamReport(request)) items.push(item);
    return items;
  }

  it('re-tags the plan as thinking and the report (from the heading) as content', async () => {
    // Env unset → prompted default: one call, thinking disabled on the wire.
    scriptedChunks = [
      chunk({ content: '1. Ni spike over Fe cliff.\n2. Compose ' }),
      chunk({ content: `loop with floor.\n${HEADING}\n\n${BODY}` }),
      chunk({}, 'stop'),
    ];

    const items = await collectPrompted();

    expect(items.filter((i) => i.kind === 'thinking').map((i) => i.text).join('')).toBe(
      '1. Ni spike over Fe cliff.\n2. Compose loop with floor.\n',
    );
    expect(items.filter((i) => i.kind === 'content').map((i) => i.text).join('')).toBe(
      `${HEADING}\n\n${BODY}`,
    );
    expect(createSpy).toHaveBeenCalledTimes(1);
    const sent = createSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent.thinking).toEqual({ type: 'disabled' });
    expect('reasoning_effort' in sent).toBe(false);
  });

  it('retries once with the no-plan prompt when the plan swallows the report', async () => {
    // The whole stream is plan (no heading ever): content-wise it is an empty report, and
    // the one-shot fallback swaps in the prompt without the planning pass.
    scriptedRuns = [
      [chunk({ content: 'planning forever, never a heading ' }), chunk({}, 'stop')],
      [chunk({ content: `${HEADING}\n\n${BODY}` }), chunk({}, 'stop')],
    ];

    const items = await collectPrompted();

    // The abandoned plan still reached the reader as thinking; the report is complete.
    expect(items.some((i) => i.kind === 'thinking' && i.text.includes('planning forever'))).toBe(
      true,
    );
    expect(items.filter((i) => i.kind === 'content').map((i) => i.text).join('')).toBe(
      `${HEADING}\n\n${BODY}`,
    );
    expect(createSpy).toHaveBeenCalledTimes(2);
    const first = createSpy.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
    const retry = createSpy.mock.calls[1]?.[0] as {
      messages: Array<{ content: string }>;
      thinking: unknown;
    };
    expect(first.messages[1]?.content).toBe('usr-with-plan');
    expect(retry.messages[1]?.content).toBe('usr-no-plan');
    // Thinking stays off on the retry — the fallback swaps the prompt, not the switch.
    expect(retry.thinking).toEqual({ type: 'disabled' });
    expect(console.error).toHaveBeenCalled();
  });

  it('abandons a runaway plan before it can eat the report budget', async () => {
    // PRELUDE_RUNAWAY_CHARS is derived from the 3500-token plan headroom (× 3 chars/token
    // = 10500): a plan past what was actually budgeted for it, with no heading in sight,
    // is cut off mid-stream and the attempt rerun with the no-plan prompt.
    scriptedRuns = [
      [
        chunk({ content: 'x'.repeat(11_000) }),
        chunk({ content: 'never consumed: the guard aborts first' }),
      ],
      [chunk({ content: `${HEADING}\n\n${BODY}` }), chunk({}, 'stop')],
    ];

    const items = await collectPrompted();

    expect(items.filter((i) => i.kind === 'content').map((i) => i.text).join('')).toBe(
      `${HEADING}\n\n${BODY}`,
    );
    expect(createSpy).toHaveBeenCalledTimes(2);
    const retry = createSpy.mock.calls[1]?.[0] as { messages: Array<{ content: string }> };
    expect(retry.messages[1]?.content).toBe('usr-no-plan');
    expect(console.error).toHaveBeenCalled();
  });

  it('surfaces the empty-report error when even the no-plan retry writes nothing', async () => {
    scriptedRuns = [
      [chunk({ content: 'plan only ' }), chunk({}, 'stop')],
      [chunk({ content: 'still no heading ' }), chunk({}, 'stop')],
    ];

    await expect(collectPrompted()).rejects.toBeInstanceOf(DeepSeekEmptyReportError);
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it('refuses to ship a bare leaked heading as a report, and never replays streamed content', async () => {
    // The plan ends, one canonical heading leaks through the splitter as content, the
    // stream stops cleanly. Under 200 chars of content is not a report — but the heading
    // already reached the client, so retrying would duplicate it in the report buffer.
    // The honest outcome is an error, in ONE attempt.
    scriptedChunks = [
      chunk({ content: 'short plan\n' }),
      chunk({ content: HEADING }),
      chunk({}, 'stop'),
    ];

    await expect(collectPrompted()).rejects.toBeInstanceOf(DeepSeekEmptyReportError);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('does not split when native thinking is selected: the splitter is prompted-only', async () => {
    // With an explicit level the model owns its reasoning channel; content before the
    // heading (there should be none) must not be re-tagged.
    process.env.DEEPSEEK_REASONING_EFFORT = 'low';
    scriptedChunks = [
      chunk({ reasoning_content: 'native thinking ' }),
      chunk({ content: `${HEADING}\n\nReport.` }),
      chunk({}, 'stop'),
    ];

    const items = await collectPrompted();

    expect(items).toEqual([
      { kind: 'thinking', text: 'native thinking ' },
      { kind: 'content', text: `${HEADING}\n\nReport.` },
    ]);
    const sent = createSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent.thinking).toEqual({ type: 'enabled' });
    expect(sent.reasoning_effort).toBe('low');
  });
});
