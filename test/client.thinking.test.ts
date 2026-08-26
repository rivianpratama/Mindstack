/**
 * The thinking panel's pure state machine (createThinkingModel). No DOM.
 *
 * Guarantees that matter: the raw reasoning is HTML-escaped exactly once per
 * character (so a multi-thousand-token stream stays O(total), and script tags
 * can never execute), deltas drain incrementally, the status line tracks the
 * thinking→writing transition, content is noted exactly once (one auto-collapse),
 * and the mandatory "not the report / not checked" notice is present.
 */

import { describe, expect, it } from 'vitest';
import {
  createThinkingModel,
  THINKING_NOTICE,
  THINKING_STATUS,
  WRITING_STATUS,
} from '../src/client/ui/ThinkingPanel';

describe('createThinkingModel', () => {
  it('accumulates raw reasoning and drains escaped deltas once', () => {
    const m = createThinkingModel();
    expect(m.active).toBe(false);
    expect(m.status()).toBeNull();

    m.push('weighing ');
    m.push('the Ni spike');
    expect(m.active).toBe(true);
    expect(m.raw).toBe('weighing the Ni spike');

    // drain returns everything pending, then clears it.
    expect(m.drain()).toBe('weighing the Ni spike');
    expect(m.drain()).toBe('');

    m.push(' vs the tie');
    expect(m.drain()).toBe(' vs the tie');
  });

  it('escapes HTML so raw reasoning can never inject markup', () => {
    const m = createThinkingModel();
    m.push('<script>alert(1)</script> & "quotes"');
    const html = m.drain();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('escapes each character exactly once across the whole stream (linear, not O(n^2))', () => {
    const m = createThinkingModel();
    let expected = '';
    for (let i = 0; i < 500; i++) {
      const delta = `token${i} <x> `;
      m.push(delta);
      expected += delta;
      m.drain(); // drain repeatedly, mid-stream, the way the DOM shell does
    }
    // charsEscaped counts characters escaped; it must equal the raw length,
    // proving no character was ever re-escaped.
    expect(m.charsEscaped).toBe(expected.length);
    expect(m.raw).toBe(expected);
  });

  it('ignores empty deltas', () => {
    const m = createThinkingModel();
    m.push('');
    expect(m.active).toBe(false);
    expect(m.drain()).toBe('');
  });

  it('tracks the thinking→writing status transition', () => {
    const m = createThinkingModel();
    expect(m.status()).toBeNull(); // nothing yet
    m.push('hmm');
    expect(m.status()).toBe(THINKING_STATUS); // reasoning, no content yet
    m.noteContent();
    expect(m.status()).toBe(WRITING_STATUS); // report has started
  });

  it('notes content exactly once (one auto-collapse)', () => {
    const m = createThinkingModel();
    expect(m.contentStarted).toBe(false);
    expect(m.noteContent()).toBe(true); // first time → collapse
    expect(m.noteContent()).toBe(false); // subsequent calls → no-op
    expect(m.contentStarted).toBe(true);
  });

  it('carries the mandatory not-the-report notice', () => {
    expect(THINKING_NOTICE).toContain('NOT part of');
    expect(THINKING_NOTICE.toLowerCase()).toContain('honesty rules');
  });
});
