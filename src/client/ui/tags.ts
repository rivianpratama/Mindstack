/**
 * Epistemic tag handling.
 *
 * Tags ([S], [D], [D->H], [H]) are no longer emitted by the model. The confidence
 * level of each claim is conveyed through wording alone. This module is kept for
 * backwards compatibility with any cached reports that still contain tag markers,
 * but `applyTagChips` now strips the markers rather than replacing them with chips.
 */

export type TagId = 'S' | 'D' | 'D->H' | 'H';

export interface TagTier {
  id: TagId;
  label: string;
  cls: string;
  short: string;
  gloss: string;
}

export const TAG_TIERS: readonly TagTier[] = [
  {
    id: 'S',
    label: '[S]',
    cls: 'tag tag-s',
    short: 'backed by research',
    gloss: 'Based on a real scientific study.',
  },
  {
    id: 'D',
    label: '[D]',
    cls: 'tag tag-d',
    short: 'personality-community idea, not tested',
    gloss: 'An idea from personality writers, never scientifically tested.',
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
    gloss: 'Our own guess. Sounds reasonable, but unproven.',
  },
];

const TAG_PATTERN = /\[(D(?:→|->|-&gt;)H|S|D|H)\]/g;

/**
 * Strip any leftover tag markers from escaped HTML. New reports do not contain
 * tags; this handles cached or in-flight reports that still do.
 */
export function applyTagChips(escapedHtml: string): string {
  return escapedHtml.replace(TAG_PATTERN, '');
}
