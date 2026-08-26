/**
 * Post-generation mechanical audit (05 §5.8) plus the disclaimer guarantee (05 §5.6).
 *
 * Only the *mechanically checkable* prohibitions live here. The judgement-shaped gates
 * (the mirror test, the contrast quota, tier audibility) are asked of the model in the
 * system prompt; this file catches the failures a regex can prove, so a bad draft is
 * reported to the reader rather than passed off as clean.
 *
 * Every check is keyed to the report's language, and the languages never mix: an
 * English report is checked by the English rules against the English disclaimer,
 * exactly as before Indonesian existed; an Indonesian report additionally runs the
 * Indonesian rules (the English set stays on, because codes are language-independent
 * and a slip into English is itself a defect worth catching).
 *
 * A missing disclaimer is a hard fail: `ensureDisclaimer` appends it verbatim.
 */

import {
  DEFAULT_REPORT_LANGUAGE,
  disclaimerFor,
  type ReportLanguage,
} from './prompt/language';

export interface AuditRule {
  id: string;
  pattern: RegExp;
  describe: (match: string) => string;
}

/** 05 §5.8 items 1-5 and the essentialism clause of item 4, as regexes. */
const RULES_EN: readonly AuditRule[] = [
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

/**
 * Indonesian counterparts, run ONLY on an Indonesian report. "gangguan" alone is not
 * flagged: it also means an ordinary interruption, which the scenario vignettes
 * legitimately describe.
 */
const RULES_ID: readonly AuditRule[] = [
  {
    id: 'clinical-id',
    pattern: /\bgangguan (?:jiwa|mental|kepribadian)\b|\brespons trauma\b|\bdepresif?\b|\bnarsisistik\b|\bdidiagnosis\b|\bdiagnosa\b/gi,
    describe: (m) => `prohibited output 3 (clinical vocabulary): "${m}"`,
  },
  {
    id: 'essentialist-id',
    pattern: /\bkamu akan selalu\b|\bkamu tidak akan pernah\b|\bdirimu yang sejati\b|\bsifat aslimu\b|\bjati dirimu yang sebenarnya\b/gi,
    describe: (m) => `prohibited output 4 (essentialist framing): "${m}"`,
  },
  {
    id: 'rarity-id',
    pattern: /\d+\s*% dari (?:orang|profil|populasi)|\bpersentil\b/gi,
    describe: (m) => `prohibited output 5 / gate C6 (no norms): "${m}" is a rarity or percentile claim`,
  },
];

function rulesFor(language: ReportLanguage): readonly AuditRule[] {
  return language === 'id' ? [...RULES_EN, ...RULES_ID] : RULES_EN;
}

/**
 * The sentences that bracket each language's disclaimer block, for stripDisclaimer.
 * They are the block's own first and last sentences; keep in step with the text.
 */
const DISCLAIMER_MARKERS: Readonly<Record<ReportLanguage, { start: string; end: string }>> = {
  en: { start: 'What this is and is not.', end: 'a qualified professional can.' },
  id: { start: 'Apa ini dan apa yang bukan.', end: 'yang berkualifikasi bisa.' },
};

/** Collapse whitespace and markdown emphasis so a reflowed blockquote still matches. */
function normalize(text: string): string {
  return text
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the §5.6 block for this report's language is present verbatim (modulo
 * blockquote markers, emphasis and line wrapping, the three things a streamed markdown
 * draft legitimately varies).
 */
export function hasDisclaimer(
  text: string,
  language: ReportLanguage = DEFAULT_REPORT_LANGUAGE,
): boolean {
  return normalize(text).includes(normalize(disclaimerFor(language)));
}

/**
 * The disclaimer, appended verbatim as a blockquote when the draft lacks it. The return
 * value always starts with `text` unchanged, so a streaming caller can emit the
 * difference as one final chunk (`guarded.slice(draft.length)`).
 */
export function ensureDisclaimer(
  text: string,
  language: ReportLanguage = DEFAULT_REPORT_LANGUAGE,
): string {
  if (hasDisclaimer(text, language)) return text;
  return `${text}\n\n${disclaimerBlock(language)}\n`;
}

/** The disclaimer as it is appended: one markdown blockquote, text verbatim. */
export function disclaimerBlock(language: ReportLanguage = DEFAULT_REPORT_LANGUAGE): string {
  return `> ${disclaimerFor(language)}`;
}

/**
 * Everything a regex can prove about a finished report. Returns one description per
 * violation, deduplicated; an empty array means the mechanical checks passed (it does
 * not mean the report is good).
 *
 * The disclaimer block is excluded from the prohibited-vocabulary scan: it contains the
 * words "not a diagnosis" / "bukan diagnosis" by design.
 */
export function auditReport(
  text: string,
  language: ReportLanguage = DEFAULT_REPORT_LANGUAGE,
): string[] {
  const violations: string[] = [];
  const body = stripDisclaimer(text, language);

  for (const rule of rulesFor(language)) {
    const seen = new Set<string>();
    for (const match of body.matchAll(rule.pattern)) {
      const hit = match[0];
      const key = `${rule.id}:${hit.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push(rule.describe(hit));
    }
  }

  if (!hasDisclaimer(text, language)) {
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
function stripDisclaimer(text: string, language: ReportLanguage): string {
  const { start, end } = DISCLAIMER_MARKERS[language];
  const index = text.indexOf(start);
  if (index === -1) {
    if (language !== 'en') return text;
    // The pre-2025 English block opened with an em-dash variant; still recognized.
    const oldMarker = 'What this is — and is not.';
    const oldIndex = text.indexOf(oldMarker);
    if (oldIndex === -1) return text;
    const oldEnd = text.indexOf(end, oldIndex);
    if (oldEnd === -1) return text.slice(0, oldIndex);
    return text.slice(0, oldIndex) + text.slice(oldEnd + end.length);
  }
  // Keep anything the model wrote after the block: it is prohibited output 12 territory
  // but still has to be audited for vocabulary.
  const endIndex = text.indexOf(end, index);
  if (endIndex === -1) return text.slice(0, index);
  return text.slice(0, index) + text.slice(endIndex + end.length);
}
