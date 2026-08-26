/**
 * Post-generation mechanical audit (05 §5.8) plus the disclaimer guarantee (05 §5.6).
 *
 * Only the *mechanically checkable* prohibitions live here. The judgement-shaped gates
 * (the mirror test, the contrast quota, tier audibility) are asked of the model in the
 * system prompt; this file catches the failures a regex can prove, so a bad draft is
 * reported to the reader rather than passed off as clean.
 *
 * A missing disclaimer is a hard fail: `ensureDisclaimer` appends it verbatim.
 */

import { getDisclaimer } from './kb/loader';

export interface AuditRule {
  id: string;
  pattern: RegExp;
  describe: (match: string) => string;
}

/** 05 §5.8 items 1-5 and the essentialism clause of item 4, as regexes. */
const RULES: readonly AuditRule[] = [
  {
    id: 'type-code',
    pattern: /\b[IE][NS][TF][JP]\b/g,
    describe: (m) => `prohibited output 1 (type codes): "${m}" is a 16-type code`,
  },
  {
    id: 'type-noun',
    pattern: /\b(?:Ni|Ne|Si|Se|Ti|Te|Fi|Fe)[- ]doms?\b|\b(?:Ni|Ne|Si|Se|Ti|Te|Fi|Fe)[- ]dominants?\b/gi,
    describe: (m) => `prohibited output 1 (type nouns): "${m}" turns a function into an identity noun`,
  },
  {
    id: 'type-noun-prefixed',
    pattern: /\b(?:dom|aux|auxiliary|inferior|tertiary)\s+(?:Ni|Ne|Si|Se|Ti|Te|Fi|Fe)\b/gi,
    describe: (m) => `prohibited output 1 (type nouns): "${m}" names a stack position`,
  },
  {
    id: 'rarity',
    pattern: /\d+\s*% of (?:people|profiles)|percentile/gi,
    describe: (m) => `prohibited output 5 / gate C6 (no norms): "${m}" is a rarity or percentile claim`,
  },
  {
    id: 'clinical',
    pattern: /\b(?:disorders?|trauma response|depressive|narcissistic|diagnos(?:is|es|ed|ing))\b/gi,
    describe: (m) => `prohibited output 3 (clinical vocabulary): "${m}"`,
  },
  {
    id: 'essentialist',
    pattern: /\byou will (?:always|never)\b|\byour true (?:self|nature)\b|\byou are and always will be\b/gi,
    describe: (m) => `prohibited output 4 (essentialist framing): "${m}"`,
  },
];

/** Collapse whitespace and markdown emphasis so a reflowed blockquote still matches. */
function normalize(text: string): string {
  return text
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the §5.6 block is present verbatim (modulo blockquote markers, emphasis and
 * line wrapping, the three things a streamed markdown draft legitimately varies).
 */
export function hasDisclaimer(text: string): boolean {
  return normalize(text).includes(normalize(getDisclaimer()));
}

/**
 * The disclaimer, appended verbatim as a blockquote when the draft lacks it. The return
 * value always starts with `text` unchanged, so a streaming caller can emit the
 * difference as one final chunk (`guarded.slice(draft.length)`).
 */
export function ensureDisclaimer(text: string): string {
  if (hasDisclaimer(text)) return text;
  return `${text}\n\n${disclaimerBlock()}\n`;
}

/** The disclaimer as it is appended: one markdown blockquote, text verbatim. */
export function disclaimerBlock(): string {
  return `> ${getDisclaimer()}`;
}

/**
 * Everything a regex can prove about a finished report. Returns one description per
 * violation, deduplicated; an empty array means the mechanical checks passed (it does
 * not mean the report is good).
 *
 * The disclaimer block is excluded from the prohibited-vocabulary scan: it contains the
 * words "not a diagnosis" and "not a psychological assessment" by design.
 */
export function auditReport(text: string): string[] {
  const violations: string[] = [];
  const body = stripDisclaimer(text);

  for (const rule of RULES) {
    const seen = new Set<string>();
    for (const match of body.matchAll(rule.pattern)) {
      const hit = match[0];
      const key = `${rule.id}:${hit.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push(rule.describe(hit));
    }
  }

  if (!hasDisclaimer(text)) {
    violations.push(
      'prohibited output 12: the report did not end with the required disclaimer block ' +
        '(05 §5.6). It was appended by the server',
    );
  }

  return violations;
}

/**
 * Drop the disclaimer block from a report so its own required vocabulary does not trip
 * the audit. Falls back to the untouched text when the block is absent.
 */
function stripDisclaimer(text: string): string {
  const marker = 'What this is and is not.';
  const index = text.indexOf(marker);
  if (index === -1) {
    const oldMarker = 'What this is — and is not.';
    const oldIndex = text.indexOf(oldMarker);
    if (oldIndex === -1) return text;
    const end = text.indexOf('a qualified professional can.', oldIndex);
    if (end === -1) return text.slice(0, oldIndex);
    return text.slice(0, oldIndex) + text.slice(end + 'a qualified professional can.'.length);
  }
  // Keep anything the model wrote after the block: it is prohibited output 12 territory
  // but still has to be audited for vocabulary.
  const end = text.indexOf('a qualified professional can.', index);
  if (end === -1) return text.slice(0, index);
  return text.slice(0, index) + text.slice(end + 'a qualified professional can.'.length);
}
