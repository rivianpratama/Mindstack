/**
 * The report renderer's pure half: HTML escaping, the markdown subset, section
 * splitting, and the epistemic-tag chips.
 *
 * The escaping tests are the load-bearing ones. Report prose comes from a
 * language model over the network; it is untrusted input, and the only thing
 * standing between it and innerHTML is escapeHtml running first.
 */

import { describe, expect, it } from 'vitest';
import {
  couldContinueHeading,
  createSectionSplitter,
  escapeHtml,
  matchSectionTitle,
  renderMarkdown,
  splitSections,
  SECTION_TITLES,
  type SectionDelta,
} from '../src/client/ui/ReportView';
import { applyTagChips } from '../src/client/ui/tags';

/** Feed `text` to the incremental splitter in fixed-size pieces. */
function stream(text: string, size: number): { drains: SectionDelta[][]; final: SectionDelta[] } {
  const splitter = createSectionSplitter();
  const drains: SectionDelta[][] = [];
  for (let i = 0; i < text.length; i += size) {
    splitter.push(text.slice(i, i + size));
    drains.push(splitter.drain());
  }
  splitter.end();
  drains.push(splitter.drain());
  return { drains, final: splitter.snapshot() };
}

describe('escapeHtml', () => {
  it('neutralises every HTML-significant character', () => {
    expect(escapeHtml('<b>&"\'</b>')).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  });

  it('escapes the ampersand before anything can double-escape', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });
});

describe('renderMarkdown - injection safety', () => {
  it('neutralises a script tag', () => {
    const html = renderMarkdown('<script>alert("pwned")</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('neutralises an img onerror payload', () => {
    const html = renderMarkdown('- <img src=x onerror="alert(1)">');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(html).toContain('<li>');
  });

  it('cannot be tricked into markup through bold or list syntax', () => {
    const html = renderMarkdown('**<i>x</i>** and *<u>y</u>*');
    expect(html).toContain('<strong>&lt;i&gt;x&lt;/i&gt;</strong>');
    expect(html).toContain('<em>&lt;u&gt;y&lt;/u&gt;</em>');
    expect(html).not.toContain('<i>');
    expect(html).not.toContain('<u>');
  });

  it('does not let a blockquote smuggle a tag', () => {
    const html = renderMarkdown('> <iframe src="javascript:alert(1)"></iframe>');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<blockquote class="disclaimer">');
  });
});

describe('renderMarkdown - the supported subset', () => {
  it('renders paragraphs, joining wrapped lines', () => {
    expect(renderMarkdown('one\ntwo\n\nthree')).toBe('<p>one two</p><p>three</p>');
  });

  it('renders ## as h3 and ### as h4', () => {
    expect(renderMarkdown('## Levers\n### Experiment')).toBe(
      '<h3>Levers</h3><h4>Experiment</h4>',
    );
  });

  it('renders bold and italic without confusing the two', () => {
    expect(renderMarkdown('**Prediction:** a *plain* word')).toBe(
      '<p><strong>Prediction:</strong> a <em>plain</em> word</p>',
    );
  });

  it('renders a dash list', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('renders the disclaimer as a distinct blockquote', () => {
    const html = renderMarkdown(
      '> **What this is — and is not.** This report is structured self-reflection.',
    );
    expect(html).toBe(
      '<blockquote class="disclaimer"><p><strong>What this is — and is not.</strong> ' +
        'This report is structured self-reflection.</p></blockquote>',
    );
  });

  it('closes a list when a paragraph follows', () => {
    expect(renderMarkdown('- one\ntail')).toBe('<ul><li>one</li></ul><p>tail</p>');
  });

  it('returns nothing for empty or whitespace input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('\n  \n')).toBe('');
  });
});

describe('applyTagChips', () => {
  it('chips each of the four tiers', () => {
    expect(applyTagChips('[S]')).toContain('tag tag-s');
    expect(applyTagChips('[D]')).toContain('tag tag-d');
    expect(applyTagChips('[H]')).toContain('tag tag-h');
    expect(applyTagChips('[D→H]')).toContain('tag tag-dh');
  });

  it('recognises the arrow written as -> or already escaped', () => {
    expect(applyTagChips('[D->H]')).toContain('tag tag-dh');
    expect(applyTagChips('[D-&gt;H]')).toContain('tag tag-dh');
  });

  it('does not mistake [D→H] for a bare [D]', () => {
    const html = applyTagChips('[D→H]');
    expect(html).not.toContain('tag-d"');
    expect((html.match(/class="tag/g) ?? []).length).toBe(1);
  });

  it('leaves unrelated brackets alone', () => {
    expect(applyTagChips('a [note] and [S1]')).toBe('a [note] and [S1]');
  });

  it('runs safely over escaped model output', () => {
    const html = applyTagChips(renderMarkdown('One reading [H] to test. Research shows [S].'));
    expect(html).toContain('class="tag tag-h"');
    expect(html).toContain('class="tag tag-s"');
    // The markers survive only as chip labels, never as bare text.
    expect(html).not.toMatch(/(^|[^>])\[H\]/);
  });
});

describe('section splitting', () => {
  it('recognises every contract heading', () => {
    for (const title of SECTION_TITLES) {
      expect(matchSectionTitle(`## ${title}`)).toBe(title);
    }
  });

  it('tolerates trailing space, extra hashes and a section number', () => {
    expect(matchSectionTitle('##   Levers   ')).toBe('Levers');
    expect(matchSectionTitle('### 5. Levers ###')).toBe('Levers');
    expect(matchSectionTitle('## Something else')).toBeNull();
    expect(matchSectionTitle('Levers')).toBeNull();
  });

  it('splits the body under each heading and keeps a preamble', () => {
    const parts = splitSections(
      'stray intro\n## Under pressure\nFe is the floor.\n## Levers\nTry this.',
    );
    expect(parts.map((p) => p.title)).toEqual([null, 'Under pressure', 'Levers']);
    expect(parts[1].body.trim()).toBe('Fe is the floor.');
    expect(parts[2].body.trim()).toBe('Try this.');
  });

  it('carries all six contract sections, in the server ordering', () => {
    expect(SECTION_TITLES).toEqual([
      'How your processing runs',
      'Where you are right now',
      'Under pressure',
      'Levers',
      'How this reading was made',
      'What this report cannot know',
    ]);
    // The new section sits between Levers and the limits section.
    expect(SECTION_TITLES.indexOf('How this reading was made')).toBe(
      SECTION_TITLES.indexOf('Levers') + 1,
    );
    expect(SECTION_TITLES.indexOf('What this report cannot know')).toBe(
      SECTION_TITLES.indexOf('How this reading was made') + 1,
    );
  });
});

describe('couldContinueHeading', () => {
  it('withholds a heading that has only half arrived', () => {
    expect(couldContinueHeading('#')).toBe(true);
    expect(couldContinueHeading('## Under pre')).toBe(true);
    expect(couldContinueHeading('## How this reading was m')).toBe(true);
    // Ambiguous prefix of two different headings is still withheld.
    expect(couldContinueHeading('## How ')).toBe(true);
  });

  it('withholds a complete heading whose newline has not landed', () => {
    expect(couldContinueHeading('## Levers')).toBe(true);
  });

  it('releases ordinary prose and dead-end hash lines', () => {
    expect(couldContinueHeading('')).toBe(false);
    expect(couldContinueHeading('half a sent')).toBe(false);
    expect(couldContinueHeading('## Not a section')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Incremental splitting (what the streaming view actually runs on)
 * ------------------------------------------------------------------ */

/** A full six-section report, ~2200 words, as the server will now stream it. */
function longReport(): string {
  const words = (n: number, salt: number) =>
    Array.from({ length: n }, (_, i) => `w${salt}x${i}`).join(' ');
  const parts: string[] = ['Preamble line that arrives before any heading.\n'];
  SECTION_TITLES.forEach((title, s) => {
    parts.push(`\n## ${title}\n\n`);
    for (let p = 0; p < 8; p += 1) {
      parts.push(`**Prediction:** ${words(40, s * 10 + p)}. [H]\n\n`);
    }
    parts.push(`- one ${words(6, s)}\n- two ${words(6, s + 1)}\n\n`);
  });
  parts.push('> **What this is — and is not.** This report is structured self-reflection.\n');
  return parts.join('');
}

describe('createSectionSplitter', () => {
  const SIX_SECTION_STREAM =
    'intro\n' +
    SECTION_TITLES.map((title) => `## ${title}\nbody of ${title}.\n`).join('');

  it('produces one section per heading, in order, plus the preamble', () => {
    const { final } = stream(SIX_SECTION_STREAM, 7);
    expect(final.map((s) => s.title)).toEqual([null, ...SECTION_TITLES]);
    expect(final).toHaveLength(7);
    expect(final[5].title).toBe('How this reading was made');
    expect(final[5].body.trim()).toBe('body of How this reading was made.');
    expect(final[6].title).toBe('What this report cannot know');
  });

  it('agrees with the batch splitter at every chunk size', () => {
    const text = longReport();
    const expected = splitSections(text);
    for (const size of [1, 2, 5, 17, 64, 512, text.length]) {
      const { final } = stream(text, size);
      expect(final.map((s) => ({ title: s.title, body: s.body }))).toEqual(expected);
    }
  });

  it('never prints a half-arrived heading as prose', () => {
    // Stop mid-heading and inspect what the view would render right then.
    const splitter = createSectionSplitter();
    splitter.push('body text\n## Under pre');
    const mid = splitter.snapshot();
    expect(mid).toHaveLength(1);
    expect(mid[0].body).toBe('body text');
    // The rest of the heading arrives: now it is a section, not prose.
    splitter.push('ssure\nFe is the floor.');
    splitter.end();
    const done = splitter.snapshot();
    expect(done.map((s) => s.title)).toEqual([null, 'Under pressure']);
    expect(done[1].body).toBe('Fe is the floor.');
  });

  it('streams ordinary prose through immediately, without waiting for a newline', () => {
    const splitter = createSectionSplitter();
    splitter.push('## Levers\nYour tied Ne/Se pair is');
    expect(splitter.snapshot()[1].body).toBe('Your tied Ne/Se pair is');
  });

  /*
   * The performance contract, asserted structurally rather than by clock: a
   * drain reports at most the section in flight plus the one just sealed above
   * it, and a sealed section is never reported again. Re-rendering the whole
   * report on every chunk - the thing this replaced - would put all seven
   * sections in every drain.
   */
  it('reports at most two changed sections per chunk, and never re-reports a sealed one', () => {
    const text = longReport();
    const { drains, final } = stream(text, 30);

    expect(drains.length).toBeGreaterThan(400);
    const settled = new Set<number>();
    for (const drain of drains) {
      expect(drain.length).toBeLessThanOrEqual(2);
      for (const section of drain) {
        expect(settled.has(section.index)).toBe(false);
        if (section.sealed) settled.add(section.index);
      }
    }
    expect(settled.size).toBe(final.length - 1); // every section but the last
  });

  it('handles a multi-thousand-word report without pathological cost', () => {
    const text = longReport();
    expect(text.split(/\s+/).length).toBeGreaterThan(2000);

    const started = Date.now();
    const { final } = stream(text, 24);
    const html = final.map((section) => applyTagChips(renderMarkdown(section.body))).join('');
    const elapsed = Date.now() - started;

    expect(final.map((s) => s.title)).toEqual([null, ...SECTION_TITLES]);
    expect(html).toContain('<blockquote class="disclaimer">');
    expect((html.match(/<p>/g) ?? []).length).toBe(SECTION_TITLES.length * 8 + 2);
    expect((html.match(/class="tag tag-h"/g) ?? []).length).toBe(SECTION_TITLES.length * 8);
    // Generous tripwire: a quadratic regression blows straight through this.
    expect(elapsed).toBeLessThan(5000);
  });
});
