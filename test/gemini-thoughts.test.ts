/**
 * The Gemini thought unwrapper: the pure peeler for Gemini's inline reasoning. Gemini streams
 * its thoughts inside `content`, wrapped in `<thought>...</thought>` (it has no separate
 * reasoning field); this module re-tags the interior as `thinking`, strips the marker tags, and
 * passes the rest through as `content`. Exercised across hostile delta boundaries, because the
 * model's chunking splits the tags wherever it likes.
 */

import { describe, expect, it } from 'vitest';

import { createThoughtUnwrapper } from '../src/server/gemini-thoughts';
import type { StreamReportItem } from '../src/server/deepseek';

/** Push every delta, then flush, and return the merged text per kind (plus the raw items). */
function run(deltas: string[]) {
  const u = createThoughtUnwrapper();
  const items: StreamReportItem[] = [];
  for (const delta of deltas) items.push(...u.push(delta));
  items.push(...u.flush());
  const text = (kind: StreamReportItem['kind']) =>
    items
      .filter((item) => item.kind === kind)
      .map((item) => item.text)
      .join('');
  return { items, thinking: text('thinking'), content: text('content') };
}

describe('gemini thought unwrapper', () => {
  it('routes <thought> interior to thinking and the rest to content, stripping tags', () => {
    const { thinking, content } = run(['<thought>Weighing Ni over Fe.</thought># Headline\n\nThe report.']);
    expect(thinking).toBe('Weighing Ni over Fe.');
    expect(content).toBe('# Headline\n\nThe report.');
  });

  it('is a transparent pass-through when no <thought> ever appears', () => {
    const { thinking, content, items } = run(['## Heading\n\n', 'Body text, all report.']);
    expect(thinking).toBe('');
    expect(content).toBe('## Heading\n\nBody text, all report.');
    // No empty items are emitted.
    expect(items.every((i) => i.text.length > 0)).toBe(true);
  });

  it('reassembles an OPEN tag split across two deltas', () => {
    const { thinking, content } = run(['<thou', 'ght>hidden reasoning</thought>report']);
    expect(thinking).toBe('hidden reasoning');
    expect(content).toBe('report');
  });

  it('reassembles a CLOSE tag split across two deltas', () => {
    const { thinking, content } = run(['<thought>reasoning</thou', 'ght>report']);
    expect(thinking).toBe('reasoning');
    expect(content).toBe('report');
  });

  it('splits the tag one character per delta and still never leaks a fragment', () => {
    const stream = '<thought>x</thought>y'.split('');
    const { thinking, content } = run(stream);
    expect(thinking).toBe('x');
    expect(content).toBe('y');
  });

  it('does not hold a lone < that turns out to be report prose', () => {
    // A '<' followed by a non-tag character is ordinary content, emitted without waiting.
    const { thinking, content } = run(['a < b is a comparison, not a tag.']);
    expect(thinking).toBe('');
    expect(content).toBe('a < b is a comparison, not a tag.');
  });

  it('treats an unterminated <thought> block as thinking through end of stream', () => {
    const { thinking, content } = run(['<thought>reasoning that never closes because the stream cut off']);
    expect(thinking).toBe('reasoning that never closes because the stream cut off');
    expect(content).toBe('');
  });

  it('emits a held partial-marker tail as its literal text on flush', () => {
    // The stream ends mid-`</thought`; that run never completed the tag, so it is thought text.
    const { thinking, content } = run(['<thought>reasoning</thou']);
    expect(thinking).toBe('reasoning</thou');
    expect(content).toBe('');
  });

  it('preserves order across interleaved content and a thought block', () => {
    const { items } = run(['lead content <thought>mid thought</thought> trailing content']);
    expect(items).toEqual([
      { kind: 'content', text: 'lead content ' },
      { kind: 'thinking', text: 'mid thought' },
      { kind: 'content', text: ' trailing content' },
    ]);
  });
});
