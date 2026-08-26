/**
 * Epistemic tags (00 legend, 05 §5.3).
 *
 * The model prefixes tagged claims with a bare [S] / [D] / [D->H] / [H] marker.
 * The client swaps those markers for chips and prints one persistent legend, so
 * the reader can rank the confidence of every claim without reading the docs.
 *
 * `applyTagChips` runs on ALREADY-ESCAPED html (see ReportView.renderMarkdown):
 * the markers contain no HTML-special characters, and nothing this app emits
 * puts a square bracket inside a tag or attribute, so the substitution cannot
 * reach into markup.
 */

export type TagId = 'S' | 'D' | 'D->H' | 'H';

export interface TagTier {
  id: TagId;
  /** What the chip prints. */
  label: string;
  /** CSS class carrying the colour. */
  cls: string;
  /** The one-line gloss in the legend card. */
  short: string;
  gloss: string;
}

export const TAG_TIERS: readonly TagTier[] = [
  {
    id: 'S',
    label: '[S]',
    cls: 'tag tag-s',
    short: 'backed by research',
    gloss: 'Based on a real scientific study - the most reliable thing in this report.',
  },
  {
    id: 'D',
    label: '[D]',
    cls: 'tag tag-d',
    short: 'personality-community idea, not tested',
    gloss: 'An idea from personality writers - credited to them, but never scientifically tested.',
  },
  {
    id: 'D->H',
    label: '[D→H]',
    cls: 'tag tag-dh',
    short: 'borrowed idea, stretched by us',
    gloss: 'A personality-community idea that we stretched beyond what its source actually claimed.',
  },
  {
    id: 'H',
    label: '[H]',
    cls: 'tag tag-h',
    short: 'our best guess',
    gloss: 'Our own guess - sounds reasonable, but unproven. See if it matches your life.',
  },
];

const CHIP_OF: Record<string, TagTier> = {
  S: TAG_TIERS[0],
  D: TAG_TIERS[1],
  'D->H': TAG_TIERS[2],
  H: TAG_TIERS[3],
};

/*
 * The arrow reaches us as a literal U+2192, as '->' or as '-&gt;' (escapeHtml
 * has already run on '>'). Longest alternatives first so [D->H] never matches
 * as a bare [D].
 */
const TAG_PATTERN = /\[(D(?:→|->|-&gt;)H|S|D|H)\]/g;

function chipHtml(tier: TagTier): string {
  return `<span class="${tier.cls}" title="${tier.short}">${tier.label}</span>`;
}

/** Swap every inline marker in an escaped-HTML string for its chip. */
export function applyTagChips(escapedHtml: string): string {
  return escapedHtml.replace(TAG_PATTERN, (match, body: string) => {
    const key = body.replace(/→|-&gt;|->/, '->');
    const tier = CHIP_OF[key];
    return tier ? chipHtml(tier) : match;
  });
}
