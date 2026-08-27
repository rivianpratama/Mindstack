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
  DEFAULT_REASONING_MODE,
  MAX_COMPLETION_TOKENS,
  OMIT_REASONING_EFFORT,
  PROMPTED_REASONING,
  resolveReasoningEffort,
  TEMPERATURE,
} from '../src/server/deepseek';

const base = { model: 'deepseek-v4-flash', system: 'sys', user: 'usr' };

describe('reasoning effort', () => {
  it('defaults to prompted: thinking off, the plan scripted in the prompt instead', () => {
    // Native effort is a bias, not a cap, and native thinking takes no instruction about
    // what to consider — the overthinking defect. The default is therefore the prompted
    // planning pass (see assemble.ts PLANNING_PASS_INSTRUCTIONS and prelude.ts).
    expect(DEFAULT_REASONING_MODE).toBe('prompted');
    expect(resolveReasoningEffort(undefined)).toBe('prompted');
    expect(resolveReasoningEffort('')).toBe('prompted');
    expect(resolveReasoningEffort('   ')).toBe('prompted');
    expect(resolveReasoningEffort(null)).toBe('prompted');
    expect(resolveReasoningEffort('prompted')).toBe('prompted');
    expect(PROMPTED_REASONING).toBe('prompted');
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

  it('falls back to the default (prompted) on an unrecognized value', () => {
    // A typo falls back to the default — forwarding it would 400 every report (the API
    // rejects values outside its enum). To get native thinking or the bare no-plan pass
    // an operator must set an explicit, recognized value.
    expect(resolveReasoningEffort('nono')).toBe('prompted');
    expect(resolveReasoningEffort('true')).toBe('prompted');
    expect(resolveReasoningEffort('extrahigh')).toBe('prompted');
    expect(resolveReasoningEffort('none')).toBe('none');
  });

  it('never resolves to a value DeepSeek does not document', () => {
    // The wire contract: whatever reaches reasoning_effort must be low/high/max, or the
    // 'none'/'prompted'/null sentinels handled by buildChatRequest. Undocumented variants
    // may drift (they are OpenAI-compat courtesy), and anything outside the enum is a 400.
    const inputs = ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'default', 'typo'];
    for (const input of inputs) {
      const resolved = resolveReasoningEffort(input);
      expect([null, 'none', 'prompted', 'low', 'high', 'max']).toContain(resolved);
    }
  });
});

describe('buildChatRequest', () => {
  it('disables native thinking by default: the reasoning is prompted, not hybrid', () => {
    const request = buildChatRequest(base) as Record<string, unknown>;
    // The documented on/off switch is `thinking`, OFF on the prompted default; the model
    // reasons in the content stream instead, where the prompt can steer it.
    expect(request.thinking).toEqual({ type: 'disabled' });
    // 'prompted' is ours, not DeepSeek's: it must never reach the wire as an effort.
    expect('reasoning_effort' in request).toBe(false);
    expect(request.stream).toBe(true);
    expect(request.temperature).toBe(TEMPERATURE);
    expect(request.max_tokens).toBe(MAX_COMPLETION_TOKENS);
    // Kept at the model ceiling so the native fallback still can't starve the report.
    expect(MAX_COMPLETION_TOKENS).toBe(32000);
    expect(request.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
  });

  it('enables bounded native thinking for an explicit level (the fallback path)', () => {
    const request = buildChatRequest({ ...base, reasoningEffort: 'low' }) as Record<string, unknown>;
    expect(request.thinking).toEqual({ type: 'enabled' });
    expect(request.reasoning_effort).toBe('low');
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
    for (const envValue of ['minimal', 'medium', 'xhigh', 'low', 'high', 'max']) {
      const request = buildChatRequest({ ...base, reasoningEffort: envValue }) as Record<
        string,
        unknown
      >;
      expect(['low', 'high', 'max']).toContain(request.reasoning_effort);
    }
    // Everything that resolves off the native path sends no effort at all — a typo or an
    // unset var lands on 'prompted', never on the wire.
    for (const envValue of ['', 'extrahigh', 'prompted', 'none']) {
      const request = buildChatRequest({ ...base, reasoningEffort: envValue });
      expect('reasoning_effort' in request, `"${envValue}" must send no effort`).toBe(false);
    }
  });

  it('turns thinking OFF for both no-native-thinking sentinels', () => {
    for (const sentinel of ['none', 'prompted']) {
      const request = buildChatRequest({ ...base, reasoningEffort: sentinel }) as Record<
        string,
        unknown
      >;
      // Both disable thinking via the switch and send no reasoning_effort; they differ
      // only in the prompt (the plan) and the stream handling (the splitter).
      expect(request.thinking).toEqual({ type: 'disabled' });
      expect('reasoning_effort' in request).toBe(false);
    }
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
    expect(error!.message).toContain('no usable report text');
    // Names the cause and the knob that fixes it.
    expect(error!.message).toContain('DEEPSEEK_REASONING_EFFORT=none');
    // Never retried: a second identical call would just spend the key again.
    expect(error!.retryable).toBe(false);
  });

  it('honours a raised usability floor: a bare heading is not a report (prompted path)', () => {
    // ~30 chars of leaked heading with a clean stop used to classify as success and ship
    // with an auto-appended disclaimer. With the prompted path's floor it is empty.
    const outcome = { contentChars: 31, reasoningChars: 4_000, finishReason: 'stop' };
    expect(classifyStreamOutcome(outcome, { minContentChars: 200 })).toBeInstanceOf(
      DeepSeekEmptyReportError,
    );
    // Without the raised floor (native/none paths) the historical zero test applies.
    expect(classifyStreamOutcome(outcome)).toBeNull();
    // A normal short-but-real stream clears the floor either way.
    expect(
      classifyStreamOutcome(
        { contentChars: 500, reasoningChars: 0, finishReason: 'stop' },
        { minContentChars: 200 },
      ),
    ).toBeNull();
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
