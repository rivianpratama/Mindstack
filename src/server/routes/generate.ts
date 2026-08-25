/**
 * POST /api/generate — validate, compute the authoritative Signature, assemble the
 * prompt, stream the report as Server-Sent Events.
 *
 * Event sequence (fixed contract; the client is built against it):
 *   meta   {"regime":"FLAT"|"STAIRCASE"|"NORMAL","llm":boolean}
 *   chunk  {"text":string}    repeated — report markdown for sections 2-6
 *   audit  {"violations":string[]}   once, after generation
 *   done   {}
 *   error  {"message":string}  on upstream failure; terminal, replaces audit+done
 *
 * Out-of-range scores are accepted here: 02 §1 forbids clamping, and the client confirms
 * them with the user before sending. Only missing or non-numeric values are a 400.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import { computeSignature } from '../../shared/geometry';
import { validateScores } from '../../shared/validation';
import { assemblePrompt, type ContextAnswers } from '../prompt/assemble';
import { auditReport, ensureDisclaimer } from '../guards';
import { isConfigured, streamReport } from '../deepseek';

interface GenerateBody {
  scores?: unknown;
  context?: unknown;
}

export const generateRoute = new Hono();

generateRoute.post('/generate', async (c) => {
  let body: GenerateBody;
  try {
    body = (await c.req.json()) as GenerateBody;
  } catch {
    return c.json({ error: 'Request body must be JSON: { "scores": {...}, "context": {...}|null }' }, 400);
  }

  const validation = validateScores(body?.scores);
  if (!validation.ok || !validation.scores) {
    const hard = validation.flags.filter(
      (flag) => flag.code !== 'out-of-range' && flag.code !== 'unknown-key',
    );
    return c.json(
      {
        error:
          hard.map((flag) => flag.message).join(' ') ||
          'All eight cognitive-function scores are required.',
      },
      400,
    );
  }

  const signature = computeSignature(validation.scores);
  const assembly = assemblePrompt(signature, readContext(body?.context));

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: 'meta',
      data: JSON.stringify({ regime: assembly.regime, llm: assembly.llm }),
    });

    /* FLAT: no model call. The honest-null text is deterministic and already carries the
     * disclaimer, so it streams straight through the same guard path. */
    if (!assembly.llm || assembly.honestNull) {
      const text = assembly.honestNullReport ?? '';
      for (const piece of chunkText(text)) {
        await stream.writeSSE({ event: 'chunk', data: JSON.stringify({ text: piece }) });
      }
      await stream.writeSSE({
        event: 'audit',
        data: JSON.stringify({ violations: auditReport(text) }),
      });
      await stream.writeSSE({ event: 'done', data: '{}' });
      return;
    }

    if (!isConfigured()) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          message:
            'The report generator is not configured on this server (no DEEPSEEK_API_KEY). ' +
            'Your stack signature above is complete and was computed locally; only the ' +
            'interpreted sections need the model.',
        }),
      });
      return;
    }

    const abort = new AbortController();
    stream.onAbort(() => abort.abort());

    let buffered = '';
    try {
      for await (const delta of streamReport({
        system: assembly.systemPrompt,
        user: assembly.userPrompt,
        maxTokens: assembly.maxTokens,
        signal: abort.signal,
      })) {
        buffered += delta;
        await stream.writeSSE({ event: 'chunk', data: JSON.stringify({ text: delta }) });
      }
    } catch (error) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: messageFor(error) }),
      });
      return;
    }

    /*
     * Guard pass. The audit runs on what the model actually produced — so a missing
     * disclaimer is reported as the violation it is — and the repair is then streamed as
     * a final chunk, because a report without the §5.6 block is a hard fail.
     */
    const violations = auditReport(buffered);
    const guarded = ensureDisclaimer(buffered);
    if (guarded !== buffered) {
      await stream.writeSSE({
        event: 'chunk',
        data: JSON.stringify({ text: guarded.slice(buffered.length) }),
      });
    }

    await stream.writeSSE({ event: 'audit', data: JSON.stringify({ violations }) });
    await stream.writeSSE({ event: 'done', data: '{}' });
  });
});

/** The 5W1H block, if the client sent one. Anything else is treated as absent. */
function readContext(value: unknown): ContextAnswers | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const context: ContextAnswers = {};
  for (const field of ['who', 'what', 'when', 'where', 'why', 'how'] as const) {
    const entry = record[field];
    if (typeof entry === 'string') context[field] = entry;
  }
  return context;
}

/** Deterministic text is streamed in paragraph-sized pieces so the client renders progressively. */
function chunkText(text: string): string[] {
  const pieces = text.split(/(?<=\n\n)/);
  return pieces.filter((piece) => piece.length > 0);
}

function messageFor(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The report generator failed unexpectedly. Try again shortly.';
}
