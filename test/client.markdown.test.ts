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
  extractHeadline,
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
    expect(renderMarkdown('## Things you can try\n### Experiment')).toBe(
      '<h3>Things you can try</h3><h4>Experiment</h4>',
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
      '> **What this is and is not.** This report is structured self-reflection.',
    );
    expect(html).toBe(
      '<blockquote class="disclaimer"><p><strong>What this is and is not.</strong> ' +
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
  it('strips all four tag markers', () => {
    expect(applyTagChips('[S]')).toBe('');
    expect(applyTagChips('[D]')).toBe('');
    expect(applyTagChips('[H]')).toBe('');
    expect(applyTagChips('[D→H]')).toBe('');
  });

  it('strips the arrow written as -> or already escaped', () => {
    expect(applyTagChips('[D->H]')).toBe('');
    expect(applyTagChips('[D-&gt;H]')).toBe('');
  });

  it('leaves unrelated brackets alone', () => {
    expect(applyTagChips('a [note] and [S1]')).toBe('a [note] and [S1]');
  });

  it('strips tags from escaped model output', () => {
    const html = applyTagChips(renderMarkdown('One reading [H] to test. Research shows [S].'));
    expect(html).not.toContain('[H]');
    expect(html).not.toContain('[S]');
  });
});

describe('section splitting', () => {
  it('recognises every contract heading', () => {
    for (const title of SECTION_TITLES) {
      expect(matchSectionTitle(`## ${title}`)).toBe(title);
    }
  });

  it('tolerates trailing space, extra hashes and a section number', () => {
    expect(matchSectionTitle('##   Things you can try   ')).toBe('Things you can try');
    expect(matchSectionTitle('### 5. Things you can try ###')).toBe('Things you can try');
    expect(matchSectionTitle('## Something else')).toBeNull();
    expect(matchSectionTitle('Things you can try')).toBeNull();
  });

  it('splits the body under each heading and keeps a preamble', () => {
    const parts = splitSections(
      'stray intro\n## When things get stressful\nFe is the floor.\n## Things you can try\nTry this.',
    );
    expect(parts.map((p) => p.title)).toEqual([null, 'When things get stressful', 'Things you can try']);
    expect(parts[1].body.trim()).toBe('Fe is the floor.');
    expect(parts[2].body.trim()).toBe('Try this.');
  });

  it('carries all five contract sections, in the server ordering', () => {
    expect(SECTION_TITLES).toEqual([
      'How your mind tends to work',
      'How you handle different situations',
      'When things get stressful',
      'Things you can try',
      "What this report can't tell you",
    ]);
    // The old section-3 heading is gone from the contract.
    expect(SECTION_TITLES).not.toContain('Where you are right now');
    expect(matchSectionTitle('## Where you are right now')).toBeNull();
    // The provenance section was removed; it is no longer a card the client renders.
    expect(SECTION_TITLES).not.toContain('Where this report comes from');
    expect(matchSectionTitle('## Where this report comes from')).toBeNull();
    // The limits section now follows Things you can try directly.
    expect(SECTION_TITLES.indexOf("What this report can't tell you")).toBe(
      SECTION_TITLES.indexOf('Things you can try') + 1,
    );
  });
});

describe('couldContinueHeading', () => {
  it('withholds a heading that has only half arrived', () => {
    expect(couldContinueHeading('#')).toBe(true);
    expect(couldContinueHeading('## When thing')).toBe(true);
    expect(couldContinueHeading('## What this report can')).toBe(true);
    // Two headings now begin "How ", and both share "How you" - an
    // ambiguous prefix must be withheld until it resolves.
    expect(couldContinueHeading('## How ')).toBe(true);
    expect(couldContinueHeading('## How you')).toBe(true);
    expect(couldContinueHeading('## How you handle different')).toBe(true);
  });

  it('resolves headings that share a long prefix', () => {
    // "How your mind tends to work" and "How you handle different situations"
    // diverge only at the 7th character.
    expect(matchSectionTitle('## How your mind tends to work')).toBe('How your mind tends to work');
    expect(matchSectionTitle('## How you handle different situations')).toBe(
      'How you handle different situations',
    );
    const splitter = createSectionSplitter();
    for (const piece of '## How you'.split('')) splitter.push(piece);
    expect(splitter.snapshot()).toHaveLength(1);
    splitter.push('r mind tends to work\nbody.');
    expect(splitter.snapshot().map((s) => s.title)).toEqual([null, 'How your mind tends to work']);
  });

  it('withholds a complete heading whose newline has not landed', () => {
    expect(couldContinueHeading('## Things you can try')).toBe(true);
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

/** A full five-section report, ~2200 words, as the server will now stream it. */
function longReport(): string {
  const words = (n: number, salt: number) =>
    Array.from({ length: n }, (_, i) => `w${salt}x${i}`).join(' ');
  const parts: string[] = ['Preamble line that arrives before any heading.\n'];
  SECTION_TITLES.forEach((title, s) => {
    parts.push(`\n## ${title}\n\n`);
    for (let p = 0; p < 8; p += 1) {
      parts.push(`**Prediction:** ${words(52, s * 10 + p)}. [H]\n\n`);
    }
    parts.push(`- one ${words(6, s)}\n- two ${words(6, s + 1)}\n\n`);
  });
  parts.push('> **What this is and is not.** This report is structured self-reflection.\n');
  return parts.join('');
}

describe('createSectionSplitter', () => {
  const FIVE_SECTION_STREAM =
    'intro\n' +
    SECTION_TITLES.map((title) => `## ${title}\nbody of ${title}.\n`).join('');

  it('produces one section per heading, in order, plus the preamble', () => {
    const { final } = stream(FIVE_SECTION_STREAM, 7);
    expect(final.map((s) => s.title)).toEqual([null, ...SECTION_TITLES]);
    expect(final).toHaveLength(6);
    expect(final[5].title).toBe("What this report can't tell you");
    expect(final[5].body.trim()).toBe("body of What this report can't tell you.");
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
    splitter.push('body text\n## When thing');
    const mid = splitter.snapshot();
    expect(mid).toHaveLength(1);
    expect(mid[0].body).toBe('body text');
    // The rest of the heading arrives: now it is a section, not prose.
    splitter.push('s get stressful\nFe is the floor.');
    splitter.end();
    const done = splitter.snapshot();
    expect(done.map((s) => s.title)).toEqual([null, 'When things get stressful']);
    expect(done[1].body).toBe('Fe is the floor.');
  });

  it('streams ordinary prose through immediately, without waiting for a newline', () => {
    const splitter = createSectionSplitter();
    splitter.push('## Things you can try\nYour tied Ne/Se pair is');
    expect(splitter.snapshot()[1].body).toBe('Your tied Ne/Se pair is');
  });

  /*
   * The performance contract, asserted structurally rather than by clock: a
   * drain reports at most the section in flight plus the one just sealed above
   * it, and a sealed section is never reported again. Re-rendering the whole
   * report on every chunk - the thing this replaced - would put all five
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
    expect(html).not.toMatch(/class="tag tag-/);
    expect(html).not.toContain('[H]');
    // Generous tripwire: a quadratic regression blows straight through this.
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('the report headline (a single-# preamble line)', () => {
  it('withholds a streaming single-# tail whatever its text', () => {
    expect(couldContinueHeading('# ')).toBe(true);
    expect(couldContinueHeading('# A Mind That Che')).toBe(true);
    expect(couldContinueHeading('#')).toBe(true);
  });

  it('extracts the headline and hands back the remaining preamble', () => {
    expect(extractHeadline('# Quick Mind, Slow Heart\n')).toEqual({
      headline: 'Quick Mind, Slow Heart',
      rest: '',
    });
    expect(extractHeadline('\n\n# A Headline ##\nleft over')).toEqual({
      headline: 'A Headline',
      rest: 'left over',
    });
    // Emphasis markers never reach textContent as literal asterisks.
    expect(extractHeadline('# **Bold Claim, Quiet Cost**\n').headline).toBe(
      'Bold Claim, Quiet Cost',
    );
  });

  it('leaves everything that is not a single-# first line untouched', () => {
    for (const preamble of ['plain preamble text', '## Not a headline', '#nospace', '', '   ', '# ']) {
      expect(extractHeadline(preamble)).toEqual({ headline: null, rest: preamble });
    }
  });

  it('keeps the headline line inside the preamble section, never a section card', () => {
    const splitter = createSectionSplitter();
    splitter.push(`# The Headline\n\n## ${SECTION_TITLES[0]}\nBody.\n`);
    splitter.end();
    const sections = splitter.snapshot();
    expect(sections[0]!.title).toBeNull();
    expect(extractHeadline(sections[0]!.body).headline).toBe('The Headline');
    expect(sections[1]!.title).toBe(SECTION_TITLES[0]);
  });
});
