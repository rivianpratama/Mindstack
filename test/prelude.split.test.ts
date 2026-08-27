/**
 * The prelude splitter: the pure boundary-finder for prompted-reasoning mode. Everything
 * before the first canonical heading is the planning pass (thinking); the heading and
 * everything after it is the report (content). Exercised across hostile delta boundaries,
 * because the model's chunking owes it nothing.
 */

import { describe, expect, it } from 'vitest';

import { createPreludeSplitter } from '../src/server/prelude';
import type { StreamReportItem } from '../src/server/deepseek';
import { REPORT_HEADINGS_EN, REPORT_HEADINGS_ID } from '../src/server/prompt/language';

const HEADING = REPORT_HEADINGS_EN[0]; // '## How your mind tends to work'

/** Push every delta, then flush, and return the merged text per kind. */
function run(deltas: string[], headings: readonly string[] = REPORT_HEADINGS_EN) {
  const splitter = createPreludeSplitter(headings);
  const items: StreamReportItem[] = [];
  for (const delta of deltas) items.push(...splitter.push(delta));
  items.push(...splitter.flush());
  const text = (kind: StreamReportItem['kind']) =>
    items
      .filter((item) => item.kind === kind)
      .map((item) => item.text)
      .join('');
  return { items, thinking: text('thinking'), content: text('content'), splitter };
}

describe('prelude splitter, boundary finding', () => {
  it('splits plan from report at the first heading line', () => {
    const { thinking, content } = run([
      '1. NORMAL regime, Ni spike over an Fe cliff.\n2. Compose the loop with the floor.\n',
      `${HEADING}\n\nThe report body.`,
    ]);
    expect(thinking).toBe(
      '1. NORMAL regime, Ni spike over an Fe cliff.\n2. Compose the loop with the floor.\n',
    );
    expect(content).toBe(`${HEADING}\n\nThe report body.`);
  });

  it('reassembles a heading split across delta boundaries', () => {
    const { thinking, content } = run([
      'plan line one\n## How your mi',
      'nd tends to work\n\nBody text.',
    ]);
    expect(thinking).toBe('plan line one\n');
    expect(content).toBe(`${HEADING}\n\nBody text.`);
  });

  it('handles a report with no plan at all: content from the first byte', () => {
    const { thinking, content, splitter } = run([`${HEADING}\n\nStraight to it.`]);
    expect(thinking).toBe('');
    expect(content).toBe(`${HEADING}\n\nStraight to it.`);
    expect(splitter.contentStarted).toBe(true);
  });

  it('passes everything through as content once the boundary is found', () => {
    const splitter = createPreludeSplitter(REPORT_HEADINGS_EN);
    splitter.push(`plan\n${HEADING}\n`);
    // Post-boundary deltas are untouched, even ones that look like plan text or headings.
    expect(splitter.push('more report\n')).toEqual([{ kind: 'content', text: 'more report\n' }]);
    expect(splitter.push(`${REPORT_HEADINGS_EN[1]}\n`)).toEqual([
      { kind: 'content', text: `${REPORT_HEADINGS_EN[1]}\n` },
    ]);
  });

  it('tags a stream that never reaches a heading as thinking, entirely', () => {
    const { thinking, content, splitter } = run(['all plan, ', 'no report, ', 'ever']);
    expect(content).toBe('');
    expect(thinking).toBe('all plan, no report, ever');
    expect(splitter.contentStarted).toBe(false);
  });

  it('never splits on a heading quoted mid-line', () => {
    const { thinking, content } = run([
      `The section "${HEADING}" will carry the spike reading.\n`,
      `${HEADING}\nBody.`,
    ]);
    expect(thinking).toContain('will carry the spike reading');
    expect(content).toBe(`${HEADING}\nBody.`);
  });

  it('splits Indonesian reports on the Indonesian headings', () => {
    const { thinking, content } = run(
      ['rencana dalam bahasa Inggris\n', `${REPORT_HEADINGS_ID[0]}\n\nIsi laporan.`],
      REPORT_HEADINGS_ID,
    );
    expect(thinking).toBe('rencana dalam bahasa Inggris\n');
    expect(content).toBe(`${REPORT_HEADINGS_ID[0]}\n\nIsi laporan.`);
  });

  it('matches any of the six headings as the boundary, not only the first', () => {
    // A STAIRCASE report legitimately starts at a later section's heading.
    const { thinking, content } = run(['short plan\n', `${REPORT_HEADINGS_EN[4]}\n\nProvenance.`]);
    expect(thinking).toBe('short plan\n');
    expect(content).toBe(`${REPORT_HEADINGS_EN[4]}\n\nProvenance.`);
  });
});

describe('prelude splitter, streaming liveness', () => {
  it('emits a partial line live once it can no longer become a heading', () => {
    const splitter = createPreludeSplitter(REPORT_HEADINGS_EN);
    // 'thinking about' shares no prefix with '## ...': it must stream immediately,
    // not sit in a buffer waiting for its newline.
    const first = splitter.push('thinking about');
    expect(first).toEqual([{ kind: 'thinking', text: 'thinking about' }]);
    // The rest of that line streams too, even a piece that looks heading-like:
    // headings only count at line starts.
    const second = splitter.push(` the phrase ${HEADING}`);
    expect(second).toEqual([{ kind: 'thinking', text: ` the phrase ${HEADING}` }]);
    // The next line is heading-checked again.
    splitter.push('\n');
    const third = splitter.push(`${HEADING}\nBody.`);
    expect(third).toEqual([{ kind: 'content', text: `${HEADING}\nBody.` }]);
  });

  it('holds back only a genuine heading prefix', () => {
    const splitter = createPreludeSplitter(REPORT_HEADINGS_EN);
    // '## How' is a prefix of a real heading: held, nothing emitted yet.
    expect(splitter.push('## How')).toEqual([]);
    // It diverges ('## However...' is no heading): released as thinking.
    expect(splitter.push('ever, first the plan.\n')).toEqual([
      { kind: 'thinking', text: '## However, first the plan.\n' },
    ]);
  });

  it('flushes a held heading prefix as thinking at end of stream', () => {
    const splitter = createPreludeSplitter(REPORT_HEADINGS_EN);
    expect(splitter.push('## How your')).toEqual([]);
    expect(splitter.flush()).toEqual([{ kind: 'thinking', text: '## How your' }]);
    expect(splitter.contentStarted).toBe(false);
  });

  it('recognizes a complete heading before its newline arrives', () => {
    const splitter = createPreludeSplitter(REPORT_HEADINGS_EN);
    expect(splitter.push(HEADING)).toEqual([{ kind: 'content', text: HEADING }]);
    expect(splitter.contentStarted).toBe(true);
    expect(splitter.flush()).toEqual([]);
  });

  it('meters preludeChars for the runaway guard: thinking only, never content', () => {
    const splitter = createPreludeSplitter(REPORT_HEADINGS_EN);
    splitter.push('0123456789\n');
    expect(splitter.preludeChars).toBe(11);
    splitter.push(`${HEADING}\nreport body`);
    expect(splitter.preludeChars).toBe(11);
  });

  it('handles empty deltas and single-character drip-feeding', () => {
    const deltas = ['', ...`plan\n${HEADING}\nBody.`.split(''), ''];
    const { thinking, content } = run(deltas);
    expect(thinking).toBe('plan\n');
    expect(content).toBe(`${HEADING}\nBody.`);
  });
});

describe('the headline line as the boundary (reportHeadings gains "# ")', () => {
  const WITH_HEADLINE = ['# ', ...REPORT_HEADINGS_EN];

  it('starts content at the headline line, before any canonical heading', () => {
    const { thinking, content } = run(
      ['plan line\n# A Mind That Checks Twice\n\n', `${HEADING}\n\nBody.`],
      WITH_HEADLINE,
    );
    expect(thinking).toBe('plan line\n');
    expect(content).toBe(`# A Mind That Checks Twice\n\n${HEADING}\n\nBody.`);
  });

  it('holds a bare "#" until the next delta resolves it into the headline', () => {
    const { thinking, content } = run(['plan\n#', ' A Headline\nrest'], WITH_HEADLINE);
    expect(thinking).toBe('plan\n');
    expect(content).toBe('# A Headline\nrest');
  });

  it('still splits at a canonical heading when the model skips the headline', () => {
    const { thinking, content } = run(['plan\n', `${HEADING}\n\nBody.`], WITH_HEADLINE);
    expect(thinking).toBe('plan\n');
    expect(content).toBe(`${HEADING}\n\nBody.`);
  });
});
