/**
 * The one network call the client makes: POST /api/generate, then consume the
 * server-sent-event stream it answers with.
 *
 * EventSource cannot POST, so the stream is read off `fetch`'s response body and
 * framed here. The frame parser is a pure function of the bytes it is fed - it
 * touches no DOM and no globals - so it is unit-testable against a canned
 * fixture (test/client.sse.test.ts).
 *
 * Contract (fixed; the server is built against the same one):
 *   request  POST /api/generate  { scores, language? }
 *   response text/event-stream
 *              event: meta   data: {"regime":"NORMAL","llm":true}
 *              event: chunk  data: {"text":"..."}            (repeated)
 *              event: audit  data: {"violations":[]}
 *              event: done   data: {}
 *              event: error  data: {"message":"..."}          (any point)
 *   errors   400 -> JSON { "error": "..." }
 */

import type { FunctionKey, Scores } from '../shared/geometry/types';
import type { ReportLanguage } from '../shared/language';

/* ------------------------------------------------------------------ *
 * Request / event payloads
 * ------------------------------------------------------------------ */

/**
 * The whole request. Eight scores plus the report language: the report's
 * situational material is generated server-side from the geometry, so there is
 * nothing for the person to fill in and nothing else to send.
 */
export interface GenerateRequest {
  scores: Scores;
  /** Language the report is written in. Omitted = English (the server default). */
  language?: ReportLanguage;
}

export interface MetaPayload {
  /** 'FLAT' | 'STAIRCASE' | 'NORMAL' as computed by the server. */
  regime: string;
  /** False when the server answered deterministically (FLAT honest-null). */
  llm: boolean;
}

export interface AuditPayload {
  violations: string[];
}

export interface ErrorPayload {
  message: string;
}

/** Every callback may be async; the reader awaits each one before continuing. */
export interface StreamHandlers {
  onMeta?(meta: MetaPayload): void | Promise<void>;
  /**
   * A delta of the model's raw reasoning (the `thinking` event). Separate from
   * onChunk on purpose: this is unfiltered scratch work, never report content,
   * and the two must never be conflated in the UI.
   */
  onThinking?(text: string): void | Promise<void>;
  onChunk?(text: string): void | Promise<void>;
  onAudit?(audit: AuditPayload): void | Promise<void>;
  onError?(error: ErrorPayload): void | Promise<void>;
  onDone?(): void | Promise<void>;
}

/* ------------------------------------------------------------------ *
 * SSE framing (pure)
 * ------------------------------------------------------------------ */

export interface SseFrame {
  /** The `event:` field, or 'message' when the frame names none. */
  event: string;
  /** All `data:` lines of the frame, joined with newlines. */
  data: string;
}

export interface SseParser {
  /** Feed decoded text; returns every frame completed by it. */
  push(text: string): SseFrame[];
  /** Called once at end-of-stream: returns a trailing unterminated frame. */
  flush(): SseFrame[];
}

/**
 * Incremental SSE framer. Chunk boundaries are arbitrary - a network chunk can
 * split a field name, a UTF-8 sequence's text, or a CRLF pair - so everything is
 * buffered until a blank line closes the frame.
 */
export function createSseParser(): SseParser {
  let buffer = '';
  /** A CR held back because the LF that may pair with it is in the next chunk. */
  let pendingCR = false;

  const take = (raw: string): SseFrame | null => {
    let event = '';
    const data: string[] = [];
    let sawField = false;

    for (const line of raw.split('\n')) {
      if (line === '' || line.startsWith(':')) continue; // blank / comment
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);

      if (field === 'event') {
        event = value;
        sawField = true;
      } else if (field === 'data') {
        data.push(value);
        sawField = true;
      } else if (field === 'id' || field === 'retry') {
        sawField = true;
      }
    }

    if (!sawField) return null;
    return { event: event || 'message', data: data.join('\n') };
  };

  const drain = (final: boolean): SseFrame[] => {
    const frames: SseFrame[] = [];
    let cut = buffer.indexOf('\n\n');
    while (cut !== -1) {
      const frame = take(buffer.slice(0, cut));
      if (frame) frames.push(frame);
      buffer = buffer.slice(cut + 2);
      cut = buffer.indexOf('\n\n');
    }
    if (final && buffer.trim() !== '') {
      const frame = take(buffer);
      if (frame) frames.push(frame);
      buffer = '';
    }
    return frames;
  };

  return {
    push(text: string): SseFrame[] {
      // A lone CR is a legal SSE terminator, so CRLF must not be split into two
      // of them: hold a trailing CR back until its possible LF arrives.
      let incoming = pendingCR ? `\r${text}` : text;
      pendingCR = incoming.endsWith('\r');
      if (pendingCR) incoming = incoming.slice(0, -1);
      buffer += incoming.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      return drain(false);
    },
    flush(): SseFrame[] {
      if (pendingCR) {
        pendingCR = false;
        buffer += '\n';
      }
      return drain(true);
    },
  };
}

/** How a dispatched frame moved the stream along. */
export type FrameOutcome = 'continue' | 'done' | 'error';

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Route one frame to the handlers. Unknown event names are ignored rather than
 * treated as failures, so the server can add events without breaking clients.
 */
export async function dispatchFrame(
  frame: SseFrame,
  handlers: StreamHandlers,
): Promise<FrameOutcome> {
  switch (frame.event) {
    case 'meta': {
      const record = asRecord(parseJson(frame.data));
      await handlers.onMeta?.({
        regime: typeof record?.regime === 'string' ? record.regime : 'NORMAL',
        llm: record?.llm !== false,
      });
      return 'continue';
    }
    case 'thinking': {
      const record = asRecord(parseJson(frame.data));
      const text = typeof record?.text === 'string' ? record.text : '';
      if (text) await handlers.onThinking?.(text);
      return 'continue';
    }
    case 'chunk': {
      const record = asRecord(parseJson(frame.data));
      const text = typeof record?.text === 'string' ? record.text : '';
      if (text) await handlers.onChunk?.(text);
      return 'continue';
    }
    case 'audit': {
      const record = asRecord(parseJson(frame.data));
      const raw = record?.violations;
      const violations = Array.isArray(raw) ? raw.map((v) => String(v)).filter(Boolean) : [];
      await handlers.onAudit?.({ violations });
      return 'continue';
    }
    case 'error': {
      const record = asRecord(parseJson(frame.data));
      const message =
        typeof record?.message === 'string' && record.message.trim() !== ''
          ? record.message
          : 'The report generator reported an error.';
      await handlers.onError?.({ message });
      return 'error';
    }
    case 'done': {
      await handlers.onDone?.();
      return 'done';
    }
    default:
      return 'continue';
  }
}

/* ------------------------------------------------------------------ *
 * The call
 * ------------------------------------------------------------------ */

export interface GenerateOptions {
  endpoint?: string;
  signal?: AbortSignal;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

const GENERIC_FAILURE =
  'Could not reach the report generator. Check your connection and try again.';

/**
 * POST the profile and drive `handlers` from the response stream.
 *
 * Never throws for an expected failure: HTTP errors, malformed streams and
 * network faults all arrive through `onError`. Only an aborted request resolves
 * silently, because the caller asked for that.
 */
export async function generateReport(
  request: GenerateRequest,
  handlers: StreamHandlers,
  options: GenerateOptions = {},
): Promise<void> {
  const endpoint = options.endpoint ?? '/api/generate';
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  let response: Response;
  try {
    response = await doFetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(request),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted) return;
    await handlers.onError?.({ message: describeFailure(error) });
    return;
  }

  if (!response.ok) {
    await handlers.onError?.({ message: await readErrorBody(response) });
    return;
  }

  if (!response.body) {
    await handlers.onError?.({
      message: 'This browser could not stream the response. Try a recent Chrome, Firefox or Safari.',
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let terminal: FrameOutcome = 'continue';

  let streamEnded = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        streamEnded = true;
        break;
      }
      const frames = parser.push(decoder.decode(value, { stream: true }));
      for (const frame of frames) {
        const outcome = await dispatchFrame(frame, handlers);
        if (outcome !== 'continue') terminal = outcome;
      }
      // A done or error event ends the report; stop reading whatever follows.
      if (terminal !== 'continue') break;
    }
    if (terminal === 'continue') {
      for (const frame of parser.flush()) {
        const outcome = await dispatchFrame(frame, handlers);
        if (outcome !== 'continue') terminal = outcome;
      }
    }
  } catch (error) {
    if (options.signal?.aborted) return;
    await handlers.onError?.({ message: describeFailure(error) });
    return;
  } finally {
    // Release the connection only if we stopped before the server closed it;
    // cancelling an already-finished stream would log a spurious abort.
    if (!streamEnded) void reader.cancel().catch(() => undefined);
  }

  if (terminal === 'continue') {
    await handlers.onError?.({
      message: 'The connection closed before the report finished. Nothing was lost - try again.',
    });
  }
}

async function readErrorBody(response: Response): Promise<string> {
  // 400s carry JSON { "error": "..." }; anything else gets a plain message.
  try {
    const body = asRecord(await response.json());
    if (typeof body?.error === 'string' && body.error.trim() !== '') return body.error;
  } catch {
    /* not JSON - fall through */
  }
  if (response.status === 429) {
    return 'Too many reports requested from this address. Wait a minute and try again.';
  }
  if (response.status >= 500) {
    return 'The report generator is having trouble right now. Try again in a moment.';
  }
  return `The request was rejected (HTTP ${response.status}).`;
}

function describeFailure(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'The report took too long and was stopped. Try again.';
  }
  return GENERIC_FAILURE;
}

/** Narrowing helper for form code that has string-keyed values. */
export type RawScores = Partial<Record<FunctionKey, string>>;
