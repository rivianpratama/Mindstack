/**
 * Request shaping and stream-outcome classification for the DeepSeek call.
 *
 * These are the two places the empty-report defect lived: the request that failed to turn
 * hybrid reasoning off, and the stream loop that treated "HTTP 200 with no content" as
 * success. Both are pure functions here so the behaviour is pinned without a paid call —
 * nothing in this file touches the network.
 */

import { describe, expect, it } from 'vitest';

import {
  buildChatRequest,
  classifyStreamOutcome,
  DeepSeekEmptyReportError,
  DeepSeekTruncatedError,
  DEFAULT_REASONING_EFFORT,
  MAX_COMPLETION_TOKENS,
  OMIT_REASONING_EFFORT,
  resolveReasoningEffort,
  TEMPERATURE,
} from '../src/server/deepseek';

const base = { model: 'deepseek-v4-flash', system: 'sys', user: 'usr' };

describe('reasoning effort', () => {
  it('defaults to bounded minimal thinking (unbounded was too slow)', () => {
    // Thinking ON but short. Unset/blank => 'minimal'. `default` still means unbounded (null)
    // for anyone who explicitly opts back into it.
    expect(DEFAULT_REASONING_EFFORT).toBe('minimal');
    expect(resolveReasoningEffort(undefined)).toBe('minimal');
    expect(resolveReasoningEffort('')).toBe('minimal');
    expect(resolveReasoningEffort('   ')).toBe('minimal');
    expect(resolveReasoningEffort(null)).toBe('minimal');
    expect(resolveReasoningEffort('default')).toBeNull(); // explicit opt-in to unbounded
  });

  it('omits the parameter entirely for the literal "default"', () => {
    expect(OMIT_REASONING_EFFORT).toBe('default');
    expect(resolveReasoningEffort('default')).toBeNull();
    expect(resolveReasoningEffort(' default ')).toBeNull();
  });

  it('passes recognized settings through', () => {
    for (const effort of ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']) {
      expect(resolveReasoningEffort(effort)).toBe(effort);
    }
  });

  it('falls back to the default (minimal) on an unrecognized value', () => {
    // A typo falls back to the bounded default; to turn thinking OFF an operator must set
    // the explicit, recognized value `none`.
    expect(resolveReasoningEffort('nono')).toBe('minimal');
    expect(resolveReasoningEffort('true')).toBe('minimal');
    expect(resolveReasoningEffort('none')).toBe('none');
  });
});

describe('buildChatRequest', () => {
  it('enables bounded (minimal) thinking by default: thinking on, short effort', () => {
    const request = buildChatRequest(base) as Record<string, unknown>;
    // The documented on/off switch is `thinking`, ON by default...
    expect(request.thinking).toEqual({ type: 'enabled' });
    // ...with an explicit short cap so the model keeps its reasoning brief.
    expect(request.reasoning_effort).toBe('minimal');
    expect(request.stream).toBe(true);
    expect(request.temperature).toBe(TEMPERATURE);
    expect(request.max_tokens).toBe(MAX_COMPLETION_TOKENS);
    // Kept at the model ceiling so thinking still can't starve the report.
    expect(MAX_COMPLETION_TOKENS).toBe(32000);
    expect(request.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
  });

  it('drops the key completely when the operator asks for the model default', () => {
    const request = buildChatRequest({ ...base, reasoningEffort: 'default' });
    expect('reasoning_effort' in request).toBe(false);
  });

  it('honours an explicit override and an explicit token cap', () => {
    const request = buildChatRequest({
      ...base,
      reasoningEffort: 'medium',
      maxTokens: 4200,
    }) as Record<string, unknown>;
    expect(request.thinking).toEqual({ type: 'enabled' });
    expect(request.reasoning_effort).toBe('medium');
    expect(request.max_tokens).toBe(4200);
  });

  it('turns thinking OFF for the explicit "none" value', () => {
    const request = buildChatRequest({ ...base, reasoningEffort: 'none' }) as Record<string, unknown>;
    // `none` disables thinking via the switch and sends no reasoning_effort.
    expect(request.thinking).toEqual({ type: 'disabled' });
    expect('reasoning_effort' in request).toBe(false);
  });
});

describe('classifyStreamOutcome', () => {
  it('accepts a stream that produced content and stopped cleanly', () => {
    expect(
      classifyStreamOutcome({ contentChars: 14_000, reasoningChars: 0, finishReason: 'stop' }),
    ).toBeNull();
  });

  it('rejects the empty-report case rather than shipping a disclaimer-only report', () => {
    const error = classifyStreamOutcome({
      contentChars: 0,
      reasoningChars: 31_000,
      finishReason: 'length',
    });
    expect(error).toBeInstanceOf(DeepSeekEmptyReportError);
    expect(error!.message).toContain('no report text');
    // Names the cause and the knob that fixes it.
    expect(error!.message).toContain('DEEPSEEK_REASONING_EFFORT=none');
    // Never retried: a second identical call would just spend the key again.
    expect(error!.retryable).toBe(false);
  });

  it('surfaces truncation so a cut-off report cannot pass as finished', () => {
    const error = classifyStreamOutcome({
      contentChars: 9_000,
      reasoningChars: 0,
      finishReason: 'length',
    });
    expect(error).toBeInstanceOf(DeepSeekTruncatedError);
    expect(error!.message).toContain('cut off');
    expect(error!.message).toContain('output limit');
    // No reasoning happened, so the message must not blame reasoning.
    expect(error!.message).not.toContain('DEEPSEEK_REASONING_EFFORT');
  });

  it('reports a missing finish_reason with content as usable', () => {
    expect(
      classifyStreamOutcome({ contentChars: 500, reasoningChars: 0, finishReason: null }),
    ).toBeNull();
  });
});
