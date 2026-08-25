/**
 * The client's SSE framer and dispatcher, against a canned stream.
 *
 * Pure functions only - no DOM, no wired-elements. The point of these tests is
 * that chunk boundaries are arbitrary: the transport may split a frame, a field
 * name or a CRLF pair, and the parser must not care.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createSseParser,
  dispatchFrame,
  generateReport,
  type SseFrame,
  type StreamHandlers,
} from '../src/client/api';
import type { Scores } from '../src/shared/geometry/types';

/** One complete, contract-shaped response: meta -> 3 chunks -> audit -> done. */
const CANNED_STREAM =
  'event: meta\ndata: {"regime":"NORMAL","llm":true}\n\n' +
  'event: chunk\ndata: {"text":"## How your processing runs\\n"}\n\n' +
  'event: chunk\ndata: {"text":"One hypothesis to test [H] against a real week."}\n\n' +
  'event: chunk\ndata: {"text":"\\n\\n> **What this is** — and is not.\\n"}\n\n' +
  'event: audit\ndata: {"violations":["Section 4 has no counter-observation."]}\n\n' +
  'event: done\ndata: {}\n\n';

/**
 * The unconfigured-server stream, byte-for-byte as the real server sends it:
 * meta, then a terminal error, then close. No audit, no done.
 */
const UNCONFIGURED_STREAM =
  'event: meta\ndata: {"regime":"NORMAL","llm":true}\n\n' +
  'event: error\ndata: {"message":"The report generator is not configured on this server ' +
  '(no DEEPSEEK_API_KEY). Your stack signature above is complete and was computed locally; ' +
  'only the interpreted sections need the model."}\n\n';

const UNCONFIGURED_MESSAGE =
  'The report generator is not configured on this server (no DEEPSEEK_API_KEY). Your stack ' +
  'signature above is complete and was computed locally; only the interpreted sections need ' +
  'the model.';

function feed(stream: string, size: number): SseFrame[] {
  const parser = createSseParser();
  const frames: SseFrame[] = [];
  for (let i = 0; i < stream.length; i += size) {
    frames.push(...parser.push(stream.slice(i, i + size)));
  }
  frames.push(...parser.flush());
  return frames;
}

describe('createSseParser', () => {
  it('frames the canned stream in order', () => {
    const frames = feed(CANNED_STREAM, CANNED_STREAM.length);
    expect(frames.map((f) => f.event)).toEqual([
      'meta',
      'chunk',
      'chunk',
      'chunk',
      'audit',
      'done',
    ]);
    expect(JSON.parse(frames[0].data)).toEqual({ regime: 'NORMAL', llm: true });
    expect(JSON.parse(frames[4].data)).toEqual({
      violations: ['Section 4 has no counter-observation.'],
    });
  });

  it('is indifferent to chunk boundaries', () => {
    const whole = feed(CANNED_STREAM, CANNED_STREAM.length);
    for (const size of [1, 2, 3, 7, 13, 64, 250]) {
      expect(feed(CANNED_STREAM, size)).toEqual(whole);
    }
  });

  it('handles CRLF terminators and a split CRLF pair', () => {
    const crlf = CANNED_STREAM.replace(/\n/g, '\r\n');
    expect(feed(crlf, 1)).toEqual(feed(CANNED_STREAM, CANNED_STREAM.length));
  });

  it('joins multi-line data with newlines and skips comments and unknown fields', () => {
    const frames = feed(': keep-alive\n\nevent: chunk\nid: 4\ndata: one\ndata: two\n\n', 5);
    expect(frames).toEqual([{ event: 'chunk', data: 'one\ntwo' }]);
  });

  it('defaults a nameless frame to "message" and tolerates a missing space', () => {
    expect(feed('data:{"text":"x"}\n\n', 100)).toEqual([
      { event: 'message', data: '{"text":"x"}' },
    ]);
  });

  it('emits nothing until a frame is terminated, then flushes the tail', () => {
    const parser = createSseParser();
    expect(parser.push('event: chunk\ndata: {"text":"partial"}')).toEqual([]);
    expect(parser.flush()).toEqual([{ event: 'chunk', data: '{"text":"partial"}' }]);
  });

  it('ignores stray blank space between frames', () => {
    expect(feed('\n\n\n\nevent: done\ndata: {}\n\n\n\n', 3)).toEqual([
      { event: 'done', data: '{}' },
    ]);
  });
});

describe('dispatchFrame', () => {
  function spyHandlers() {
    return {
      onMeta: vi.fn(),
      onChunk: vi.fn(),
      onAudit: vi.fn(),
      onError: vi.fn(),
      onDone: vi.fn(),
    } satisfies StreamHandlers;
  }

  it('routes each event type and reports the terminal ones', async () => {
    const handlers = spyHandlers();
    const outcomes: string[] = [];
    for (const frame of feed(CANNED_STREAM, 9)) {
      outcomes.push(await dispatchFrame(frame, handlers));
    }
    expect(handlers.onMeta).toHaveBeenCalledWith({ regime: 'NORMAL', llm: true });
    expect(handlers.onChunk).toHaveBeenCalledTimes(3);
    expect(handlers.onChunk.mock.calls[0][0]).toBe('## How your processing runs\n');
    expect(handlers.onAudit).toHaveBeenCalledWith({
      violations: ['Section 4 has no counter-observation.'],
    });
    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(outcomes).toEqual(['continue', 'continue', 'continue', 'continue', 'continue', 'done']);
  });

  it('awaits async handlers before moving on', async () => {
    const order: string[] = [];
    const handlers: StreamHandlers = {
      async onChunk(text) {
        await Promise.resolve();
        order.push(text);
      },
    };
    for (const frame of feed(CANNED_STREAM, 40)) await dispatchFrame(frame, handlers);
    expect(order).toHaveLength(3);
    expect(order[1]).toContain('One hypothesis to test [H]');
  });

  it('treats an error frame as terminal and supplies a fallback message', async () => {
    const handlers = spyHandlers();
    expect(await dispatchFrame({ event: 'error', data: '{"message":"upstream refused"}' }, handlers))
      .toBe('error');
    expect(handlers.onError).toHaveBeenCalledWith({ message: 'upstream refused' });

    await dispatchFrame({ event: 'error', data: 'not json' }, handlers);
    expect(handlers.onError.mock.calls[1][0].message).toMatch(/reported an error/);
  });

  it('ignores unknown events instead of failing', async () => {
    const handlers = spyHandlers();
    expect(await dispatchFrame({ event: 'heartbeat', data: '{}' }, handlers)).toBe('continue');
    expect(handlers.onChunk).not.toHaveBeenCalled();
  });

  it('reads llm:false out of the meta event', async () => {
    const handlers = spyHandlers();
    await dispatchFrame({ event: 'meta', data: '{"regime":"FLAT","llm":false}' }, handlers);
    expect(handlers.onMeta).toHaveBeenCalledWith({ regime: 'FLAT', llm: false });
  });
});

describe('generateReport', () => {
  const scores: Scores = { Ni: 39.6, Ne: 25.4, Si: 21, Se: 25, Ti: 34, Te: 31, Fi: 30, Fe: 8 };

  function streamOf(text: string, pieces = 5): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const size = Math.ceil(text.length / pieces);
    let offset = 0;
    return new ReadableStream({
      pull(controller) {
        if (offset >= text.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(text.slice(offset, offset + size)));
        offset += size;
      },
    });
  }

  it('posts the contract body and drives the handlers from the stream', async () => {
    const calls: [string, RequestInit][] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(streamOf(CANNED_STREAM), { status: 200 });
    }) as unknown as typeof fetch;

    const chunks: string[] = [];
    const seen: string[] = [];
    await generateReport(
      { scores, context: null },
      {
        onMeta: () => void seen.push('meta'),
        onChunk: (text) => void chunks.push(text),
        onAudit: () => void seen.push('audit'),
        onDone: () => void seen.push('done'),
        onError: (error) => void seen.push(`error:${error.message}`),
      },
      { fetchImpl },
    );

    expect(seen).toEqual(['meta', 'audit', 'done']);
    expect(chunks.join('')).toContain('## How your processing runs');

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('/api/generate');
    expect(calls[0][1].method).toBe('POST');
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ scores, context: null });
  });

  it('surfaces a 400 { error } body through onError', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 'Fe must be a number.' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    const onError = vi.fn();
    await generateReport({ scores, context: null }, { onError }, { fetchImpl });
    expect(onError).toHaveBeenCalledWith({ message: 'Fe must be a number.' });
  });

  it('reports a stream that ends without a done event', async () => {
    const fetchImpl = (async () =>
      new Response(streamOf('event: chunk\ndata: {"text":"half a report"}\n\n'), {
        status: 200,
      })) as unknown as typeof fetch;

    const onError = vi.fn();
    const onChunk = vi.fn();
    await generateReport({ scores, context: null }, { onChunk, onError }, { fetchImpl });
    expect(onChunk).toHaveBeenCalledWith('half a report');
    expect(onError.mock.calls[0][0].message).toMatch(/closed before the report finished/);
  });

  /*
   * Regression: an unconfigured server answers meta -> error -> close. The
   * error is terminal, so no done event ever arrives. The server's message is
   * the only thing that tells the operator to set DEEPSEEK_API_KEY, so it must
   * reach onError intact - and it must be the ONLY onError call, because a
   * second, generic one would replace the card and lose the explanation.
   */
  it('surfaces a terminal error event when the stream closes right after it', async () => {
    const fetchImpl = (async () =>
      new Response(streamOf(UNCONFIGURED_STREAM, 4), { status: 200 })) as unknown as typeof fetch;

    const order: string[] = [];
    const errors: string[] = [];
    await generateReport(
      { scores, context: null },
      {
        onMeta: () => void order.push('meta'),
        onChunk: () => void order.push('chunk'),
        onAudit: () => void order.push('audit'),
        onDone: () => void order.push('done'),
        onError: (error) => {
          order.push('error');
          errors.push(error.message);
        },
      },
      { fetchImpl },
    );

    expect(order).toEqual(['meta', 'error']);
    expect(errors).toEqual([UNCONFIGURED_MESSAGE]);
  });

  it('does not add a closed-early error on top of a terminal error event', async () => {
    // Same stream at every chunk boundary: the frame may be split anywhere, and
    // the close always follows immediately.
    for (const pieces of [1, 3, 11, 40, UNCONFIGURED_STREAM.length]) {
      const fetchImpl = (async () =>
        new Response(streamOf(UNCONFIGURED_STREAM, pieces), {
          status: 200,
        })) as unknown as typeof fetch;

      const onError = vi.fn();
      const onDone = vi.fn();
      await generateReport({ scores, context: null }, { onError, onDone }, { fetchImpl });

      expect(onDone).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith({ message: UNCONFIGURED_MESSAGE });
    }
  });

  it('frames meta and a terminal error with no trailing done', () => {
    const frames = feed(UNCONFIGURED_STREAM, 6);
    expect(frames.map((f) => f.event)).toEqual(['meta', 'error']);
    expect(JSON.parse(frames[1].data)).toEqual({ message: UNCONFIGURED_MESSAGE });
  });

  it('turns a network failure into a friendly message, not a throw', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const onError = vi.fn();
    await expect(
      generateReport({ scores, context: null }, { onError }, { fetchImpl }),
    ).resolves.toBeUndefined();
    expect(onError.mock.calls[0][0].message).toMatch(/Could not reach/);
  });
});
