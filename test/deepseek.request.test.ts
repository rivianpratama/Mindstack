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
  it('defaults to low, the shortest effort DeepSeek documents', () => {
    // Thinking ON but short. DeepSeek's thinking_mode guide documents exactly low/high/max;
    // the old default 'minimal' is OpenAI vocabulary the API happens to accept (measured
    // identical to low), but only the documented levels are contractual, so 'low' is the
    // shortest level worth pinning.
    expect(DEFAULT_REASONING_EFFORT).toBe('low');
    expect(resolveReasoningEffort(undefined)).toBe('low');
    expect(resolveReasoningEffort('')).toBe('low');
    expect(resolveReasoningEffort('   ')).toBe('low');
    expect(resolveReasoningEffort(null)).toBe('low');
  });

  it('omits the parameter entirely for the literal "default"', () => {
    expect(OMIT_REASONING_EFFORT).toBe('default');
    expect(resolveReasoningEffort('default')).toBeNull();
    expect(resolveReasoningEffort(' default ')).toBeNull();
  });

  it('passes DeepSeek-documented values through untouched', () => {
    for (const effort of ['none', 'low', 'high', 'max']) {
      expect(resolveReasoningEffort(effort)).toBe(effort);
    }
  });

  it('maps compatibility aliases onto documented levels instead of forwarding them', () => {
    // These are valid API variants (the live 400 enum lists OpenAI's full set), but only
    // low/high/max are in the docs table, so the wire is normalized to those.
    expect(resolveReasoningEffort('minimal')).toBe('low'); // measured identical to low
    expect(resolveReasoningEffort('medium')).toBe('high'); // DeepSeek's own compat table
    expect(resolveReasoningEffort('xhigh')).toBe('high'); // ditto
  });

  it('falls back to the default (low) on an unrecognized value', () => {
    // A typo falls back to the bounded default — forwarding it would 400 every report
    // (the API rejects values outside its enum). To turn thinking OFF an operator must
    // set the explicit, recognized value `none`.
    expect(resolveReasoningEffort('nono')).toBe('low');
    expect(resolveReasoningEffort('true')).toBe('low');
    expect(resolveReasoningEffort('extrahigh')).toBe('low');
    expect(resolveReasoningEffort('none')).toBe('none');
  });

  it('never resolves to a value DeepSeek does not document', () => {
    // The wire contract: whatever reaches reasoning_effort must be low/high/max, or the
    // 'none'/null sentinels handled by buildChatRequest. Undocumented variants may drift
    // (they are OpenAI-compat courtesy), and anything outside the enum is a 400.
    const inputs = ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'default', 'typo'];
    for (const input of inputs) {
      const resolved = resolveReasoningEffort(input);
      expect([null, 'none', 'low', 'high', 'max']).toContain(resolved);
    }
  });
});

describe('buildChatRequest', () => {
  it('enables bounded (low) thinking by default: thinking on, short effort', () => {
    const request = buildChatRequest(base) as Record<string, unknown>;
    // The documented on/off switch is `thinking`, ON by default...
    expect(request.thinking).toEqual({ type: 'enabled' });
    // ...with an explicit short cap so the model keeps its reasoning brief.
    expect(request.reasoning_effort).toBe('low');
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
      reasoningEffort: 'max',
      maxTokens: 4200,
    }) as Record<string, unknown>;
    expect(request.thinking).toEqual({ type: 'enabled' });
    expect(request.reasoning_effort).toBe('max');
    expect(request.max_tokens).toBe(4200);
  });

  it('sends only DeepSeek-documented values on the wire, whatever the env says', () => {
    // Pins the normalization: only the docs-table levels ever reach the wire, so neither
    // an undocumented variant drifting upstream nor a typo'd env var (a 400) can break
    // report generation.
    for (const envValue of ['minimal', 'medium', 'xhigh', 'extrahigh', '', 'low', 'high', 'max']) {
      const request = buildChatRequest({ ...base, reasoningEffort: envValue }) as Record<
        string,
        unknown
      >;
      expect(['low', 'high', 'max']).toContain(request.reasoning_effort);
    }
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

  it('carries a reader-safe public message alongside the operational detail', () => {
    // The web page is public: `message` (with env-var hints and finish reasons) is for the
    // server terminal; `publicMessage` is what the route may send to the browser.
    const empty = classifyStreamOutcome({
      contentChars: 0,
      reasoningChars: 31_000,
      finishReason: 'length',
    })!;
    const truncated = classifyStreamOutcome({
      contentChars: 9_000,
      reasoningChars: 0,
      finishReason: 'length',
    })!;
    for (const error of [empty, truncated]) {
      expect(error.publicMessage.length).toBeGreaterThan(0);
      expect(error.publicMessage).not.toContain('DEEPSEEK');
      expect(error.publicMessage).not.toContain('finish_reason');
    }
  });
});
