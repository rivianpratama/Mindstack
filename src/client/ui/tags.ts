/**
 * Epistemic tag handling.
 *
 * Tags ([S], [D], [D->H], [H]) are no longer emitted by the model. The confidence
 * level of each claim is conveyed through wording alone. This module survives
 * only for backwards compatibility with cached or in-flight reports that still
 * contain tag markers: `applyTagChips` strips them. The chip metadata that once
 * rendered them (TAG_TIERS et al.) was dead code with no stylesheet behind it
 * and was removed; test/client.markdown.test.ts pins the stripping behaviour.
 */

const TAG_PATTERN = /\[(D(?:→|->|-&gt;)H|S|D|H)\]/g;

/**
 * Strip any leftover tag markers from escaped HTML. New reports do not contain
 * tags; this handles cached or in-flight reports that still do.
 */
export function applyTagChips(escapedHtml: string): string {
  return escapedHtml.replace(TAG_PATTERN, '');
}
