/**
 * POST /api/generate: validate, compute the authoritative Signature, assemble the
 * prompt, stream the report as Server-Sent Events.
 *
 * Event sequence (fixed contract; the client is built against it):
 *   meta     {"regime":"FLAT"|"STAIRCASE"|"NORMAL","llm":boolean}
 *   thinking {"text":string}  repeated: the model's raw reasoning, streamed live; never
 *                             buffered, audited, or given the disclaimer
 *   chunk    {"text":string}  repeated: report markdown for sections 2-6
 *   audit    {"violations":string[]}   once, after generation
 *   done     {}
 *   error    {"message":string}  on upstream failure; terminal, replaces audit+done
 *
 * `meta` is first; `thinking` and `chunk` events follow and may interleave (reasoning
 * usually precedes content, but the client handles either order).
 *
 * Out-of-range scores are accepted here: 02 §1 forbids clamping, and the client confirms
 * them with the user before sending. Only missing or non-numeric values are a 400.
 *
 * The request's `context` field is accepted and ignored: section 3 is built from scenarios
 * the report generates for itself, not from a situation the reader types in.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import { computeSignature } from '../../shared/geometry';
import {
  DEFAULT_REPORT_LANGUAGE,
  isReportLanguage,
  type ReportLanguage,
} from '../../shared/language';
import { validateScores } from '../../shared/validation';
import { assemblePrompt } from '../prompt/assemble';
import { auditReport, ensureDisclaimer } from '../guards';
import { isConfigured, streamReport } from '../deepseek';

interface GenerateBody {
  scores?: unknown;
  context?: unknown;
  language?: unknown;
}

export const generateRoute = new Hono();

generateRoute.post('/generate', async (c) => {
  let body: GenerateBody;
  try {
    body = (await c.req.json()) as GenerateBody;
  } catch {
    return c.json(
      { error: 'Request body must be JSON: { "scores": {...}, "language": "en"|"id"|undefined }' },
      400,
    );
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

  /*
   * The report language. Absent means English (the wire contract predates the field);
   * present-but-unknown is a 400, because silently writing the wrong language would be
   * worse than an error.
   */
  let language: ReportLanguage = DEFAULT_REPORT_LANGUAGE;
  if (body.language !== undefined && body.language !== null) {
    if (!isReportLanguage(body.language)) {
      return c.json(
        { error: 'The "language" field must be "en" (English) or "id" (Bahasa Indonesia).' },
        400,
      );
    }
    language = body.language;
  }

  const signature = computeSignature(validation.scores);
  /*
   * `context` is accepted for wire compatibility and then ignored. The report generates its
   * own situational scenarios from the taxonomy and this profile's supply grades, so there is no
   * reader-supplied situation to read any more.
   */
  const assembly = assemblePrompt(signature, null, language);

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
        data: JSON.stringify({ violations: auditReport(text, language) }),
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

    // Only report CONTENT accumulates here. Thinking is passed through verbatim and is
    // never buffered, so guards, auditReport and ensureDisclaimer never see reasoning text.
    let buffered = '';
    try {
      for await (const item of streamReport({
        system: assembly.systemPrompt,
        user: assembly.userPrompt,
        maxTokens: assembly.maxTokens,
        signal: abort.signal,
      })) {
        if (item.kind === 'thinking') {
          await stream.writeSSE({ event: 'thinking', data: JSON.stringify({ text: item.text }) });
          continue;
        }
        buffered += item.text;
        await stream.writeSSE({ event: 'chunk', data: JSON.stringify({ text: item.text }) });
      }
    } catch (error) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: messageFor(error) }),
      });
      return;
    }

    /*
     * Guard pass. The audit runs on what the model actually produced, so a missing
     * disclaimer is reported as the violation it is, and the repair is then streamed as
     * a final chunk, because a report without the §5.6 block is a hard fail.
     */
    const violations = auditReport(buffered, language);
    const guarded = ensureDisclaimer(buffered, language);
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


/** Deterministic text is streamed in paragraph-sized pieces so the client renders progressively. */
function chunkText(text: string): string[] {
  const pieces = text.split(/(?<=\n\n)/);
  return pieces.filter((piece) => piece.length > 0);
}

function messageFor(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'The report generator failed unexpectedly. Try again shortly.';
}
