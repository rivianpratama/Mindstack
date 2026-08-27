/**
 * The report-language contract, both halves:
 *
 *  - EQUIVALENCE: the Indonesian surface is structurally the same report as the
 *    English one - same six headings in the same order, same disclaimer claims,
 *    same honest-null facts - so the client's cards and the guards work
 *    identically in either language.
 *
 *  - ISOLATION (zero cross-language contamination, a hard requirement): an
 *    English request never sees a word of Indonesian. Not in the system prompt,
 *    not in the user prompt, not in the guard rules that run over its output.
 */

import { describe, expect, it } from 'vitest';

import { computeSignature } from '../src/shared/geometry';
import type { FunctionKey } from '../src/shared/geometry';
import {
  DEFAULT_REPORT_LANGUAGE,
  isReportLanguage,
  REPORT_LANGUAGES,
} from '../src/shared/language';
import {
  buildHonestNullReportId,
  DISCLAIMER_ID,
  disclaimerFor,
  FRAMEWORK_PROVENANCE_TEXT_ID,
  headingsFor,
  languageDirective,
  REPORT_HEADINGS_EN,
  REPORT_HEADINGS_ID,
} from '../src/server/prompt/language';
import { assemblePrompt, REPORT_HEADINGS } from '../src/server/prompt/assemble';
import { SYSTEM_PROMPT } from '../src/server/prompt/system-prompt';
import { auditReport, ensureDisclaimer, hasDisclaimer } from '../src/server/guards';
import { getDisclaimer } from '../src/server/kb/loader';
import {
  couldContinueHeading,
  matchSectionTitle,
  SECTION_TITLES,
  SECTION_TITLES_ID,
} from '../src/client/ui/ReportView';

const PROFILE_A: Record<FunctionKey, number> = {
  Ni: 39.6,
  Ti: 34,
  Te: 31,
  Fi: 30,
  Ne: 25.4,
  Se: 25,
  Si: 21,
  Fe: 8,
};

const PROFILE_FLAT: Record<FunctionKey, number> = {
  Ti: 27,
  Se: 26,
  Ni: 25,
  Te: 25,
  Ne: 24,
  Fi: 24,
  Si: 23,
  Fe: 23,
};

const sigA = computeSignature(PROFILE_A);
const en = assemblePrompt(sigA, null);
const enExplicit = assemblePrompt(sigA, null, 'en');
const id = assemblePrompt(sigA, null, 'id');

/* ------------------------------------------------------------------ *
 * Wire contract
 * ------------------------------------------------------------------ */

describe('report-language wire contract', () => {
  it('offers exactly English and Indonesian, defaulting to English', () => {
    expect(REPORT_LANGUAGES).toEqual(['en', 'id']);
    expect(DEFAULT_REPORT_LANGUAGE).toBe('en');
    expect(isReportLanguage('en')).toBe(true);
    expect(isReportLanguage('id')).toBe(true);
    expect(isReportLanguage('fr')).toBe(false);
    expect(isReportLanguage('')).toBe(false);
    expect(isReportLanguage(undefined)).toBe(false);
    expect(isReportLanguage(null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Headings: server and client agree, per language
 * ------------------------------------------------------------------ */

describe('headings, both languages', () => {
  it('keeps the English set canonical and six long in each language', () => {
    expect(REPORT_HEADINGS).toEqual(REPORT_HEADINGS_EN);
    expect(REPORT_HEADINGS_EN).toHaveLength(6);
    expect(REPORT_HEADINGS_ID).toHaveLength(6);
    expect(headingsFor('en')).toEqual(REPORT_HEADINGS_EN);
    expect(headingsFor('id')).toEqual(REPORT_HEADINGS_ID);
  });

  it('matches the client card titles exactly, in order, per language', () => {
    expect([...REPORT_HEADINGS_EN]).toEqual(SECTION_TITLES.map((title) => `## ${title}`));
    expect([...REPORT_HEADINGS_ID]).toEqual(SECTION_TITLES_ID.map((title) => `## ${title}`));
  });

  it('never reuses a title within or across languages (matching is language-blind)', () => {
    const all = [...SECTION_TITLES, ...SECTION_TITLES_ID].map((title) => title.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });

  it('is matched by the client splitter in either language', () => {
    for (const title of SECTION_TITLES_ID) {
      expect(matchSectionTitle(`## ${title}`)).toBe(title);
    }
    expect(matchSectionTitle('### 2. Cara kamu menghadapi berbagai situasi ###')).toBe(
      'Cara kamu menghadapi berbagai situasi',
    );
    // English still matches; Indonesian prose is not mistaken for a heading.
    expect(matchSectionTitle('## Things you can try')).toBe('Things you can try');
    expect(matchSectionTitle('## Sesuatu yang lain')).toBeNull();
  });

  it('withholds a half-arrived Indonesian heading instead of printing it', () => {
    expect(couldContinueHeading('## Cara')).toBe(true);
    expect(couldContinueHeading('## Saat keadaan penuh')).toBe(true);
    // A complete heading whose newline has not arrived is still withheld.
    expect(couldContinueHeading('## Hal yang bisa kamu coba')).toBe(true);
    expect(couldContinueHeading('## Sesuatu yang lain')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Disclaimer: one block per language, never mixed
 * ------------------------------------------------------------------ */

describe('the disclaimer, per language', () => {
  it('serves the kb block for English and the translation for Indonesian', () => {
    expect(disclaimerFor('en')).toBe(getDisclaimer());
    expect(disclaimerFor('id')).toBe(DISCLAIMER_ID);
  });

  it('translates the same claims: the anchors survive', () => {
    // The bracketing sentences double as stripDisclaimer's markers.
    expect(DISCLAIMER_ID.startsWith('**Apa ini dan apa yang bukan.**')).toBe(true);
    expect(DISCLAIMER_ID.endsWith('yang berkualifikasi bisa.')).toBe(true);
    expect(DISCLAIMER_ID).toContain('AERA/APA/NCME, 2014');
    expect(DISCLAIMER_ID).toContain('bukan diagnosis');
    expect(DISCLAIMER_ID).not.toContain('What this is');
  });

  it('keeps the English markers exact substrings of the kb block too', () => {
    // Same contract as the Indonesian anchors above; a case drift here silently
    // exempts post-disclaimer text from the audit (that bug shipped once).
    expect(getDisclaimer()).toContain('What this is and is not.');
    expect(getDisclaimer().endsWith('A qualified professional can.')).toBe(true);
  });

  it('still audits text the model writes AFTER the disclaimer, in both languages', () => {
    const enReport = `Clean body.\n\n> ${getDisclaimer()}\n\nYou are an INTJ.`;
    expect(auditReport(enReport).join(' ')).toContain('INTJ');
    const idReport = `Isi bersih.\n\n> ${DISCLAIMER_ID}\n\nKamu itu INTJ.`;
    expect(auditReport(idReport, 'id').join(' ')).toContain('INTJ');
  });

  it('reports one violation per word even when both rule sets match it', () => {
    // "diagnosis" trips the English AND the Indonesian clinical rule on the
    // 'id' path; the reader must not see the identical message twice.
    const report = `Ini bukan sebuah diagnosis medis.\n\n> ${DISCLAIMER_ID}`;
    const violations = auditReport(report, 'id');
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('diagnosis');
  });

  it('recognizes only its own language\'s block', () => {
    expect(hasDisclaimer(`> ${getDisclaimer()}`)).toBe(true);
    expect(hasDisclaimer(`> ${DISCLAIMER_ID}`, 'id')).toBe(true);
    // Cross-language blocks do NOT satisfy the guarantee.
    expect(hasDisclaimer(`> ${DISCLAIMER_ID}`)).toBe(false);
    expect(hasDisclaimer(`> ${getDisclaimer()}`, 'id')).toBe(false);
  });

  it('appends the Indonesian block to an Indonesian draft that lacks it', () => {
    const guarded = ensureDisclaimer('Isi laporan.', 'id');
    expect(guarded.startsWith('Isi laporan.')).toBe(true);
    expect(guarded).toContain(`> ${DISCLAIMER_ID}`);
    expect(guarded).not.toContain('What this is and is not.');
  });
});

/* ------------------------------------------------------------------ *
 * Audit: rules keyed to the report's language
 * ------------------------------------------------------------------ */

describe('the audit, per language', () => {
  const dirtyId =
    'Kamu punya gangguan kepribadian dan sifat aslimu tidak akan berubah. ' +
    'Hanya 3% dari orang mendapat hasil ini.';

  it('flags Indonesian clinical, essentialist and rarity claims on an Indonesian report', () => {
    const violations = auditReport(`${dirtyId}\n\n> ${DISCLAIMER_ID}`, 'id');
    const joined = violations.join(' ');
    expect(joined).toContain('gangguan kepribadian');
    expect(joined).toContain('sifat aslimu');
    expect(joined).toContain('3% dari orang');
  });

  it('keeps the English rule set running on an Indonesian report (a slip into English is a defect)', () => {
    const slipped = `Kamu itu INTJ sejati.\n\n> ${DISCLAIMER_ID}`;
    expect(auditReport(slipped, 'id').join(' ')).toContain('INTJ');
  });

  it('runs NO Indonesian rule on an English report (zero contamination)', () => {
    // The same Indonesian text passes the English audit untouched: the English
    // path behaves byte-for-byte as it did before Indonesian existed.
    const violations = auditReport(`${dirtyId}\n\n> ${getDisclaimer()}`);
    expect(violations).toEqual([]);
  });

  it('excludes the Indonesian disclaimer\'s own vocabulary from the scan', () => {
    // "diagnosis" appears inside the block by design; stripped before the scan.
    expect(auditReport(`Isi bersih.\n\n> ${DISCLAIMER_ID}`, 'id')).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Assembly threading and prompt isolation
 * ------------------------------------------------------------------ */

describe('assemblePrompt, language threading', () => {
  it('defaults to English and is byte-identical to explicit English', () => {
    expect(en.language).toBe('en');
    expect(enExplicit.userPrompt).toBe(en.userPrompt);
    expect(id.language).toBe('id');
  });

  it('keeps ONE system prompt across languages (DeepSeek prefix caching)', () => {
    expect(id.systemPrompt).toBe(en.systemPrompt);
  });

  it('names the language in the render instruction, both ways', () => {
    expect(en.userPrompt).toContain('Report language: ENGLISH');
    expect(id.userPrompt).toContain('Report language: INDONESIAN (Bahasa Indonesia)');
    expect(languageDirective('en')).toHaveLength(1);
    expect(languageDirective('id').length).toBeGreaterThan(3);
  });

  it('carries no Indonesian anywhere in an English request', () => {
    for (const text of [en.userPrompt, SYSTEM_PROMPT]) {
      expect(text).not.toContain('Indonesia');
      expect(text).not.toContain('INDONESIAN');
      expect(text).not.toMatch(/\bkamu\b/i);
      expect(text).not.toContain('Apa ini dan apa yang bukan');
      for (const heading of REPORT_HEADINGS_ID) expect(text).not.toContain(heading);
    }
    for (const heading of REPORT_HEADINGS_EN) expect(en.userPrompt).toContain(heading);
    expect(hasDisclaimer(en.userPrompt)).toBe(true);
    expect(en.userPrompt).not.toContain(DISCLAIMER_ID);
  });

  it('gives an Indonesian request the Indonesian surface and no English one', () => {
    const positions = REPORT_HEADINGS_ID.map((heading) => id.userPrompt.indexOf(heading));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const heading of REPORT_HEADINGS_EN) expect(id.userPrompt).not.toContain(heading);
    expect(hasDisclaimer(id.userPrompt, 'id')).toBe(true);
    expect(id.userPrompt).not.toContain(getDisclaimer());
    // The working kit rides along: habit glosses, confidence stems, the template.
    expect(id.userPrompt).toContain('firasat halus');
    expect(id.userPrompt).toContain('Penelitian menemukan bahwa');
    expect(id.userPrompt).toContain('tapi kalau kamu melihat');
  });

  it('keeps the analytical machinery English on the Indonesian path', () => {
    // Only the reader-facing surface switches; the plan and fragments do not.
    expect(id.userPrompt).toContain('# 3. RENDER PLAN');
    expect(id.userPrompt).toContain('PRIVATE EVIDENCE');
    expect(id.fragmentKeys).toEqual(en.fragmentKeys);
    expect(id.renderPlan).toEqual(en.renderPlan);
    expect(id.scenarios).toEqual(en.scenarios);
  });
});

/* ------------------------------------------------------------------ *
 * FLAT honest-null, Indonesian
 * ------------------------------------------------------------------ */

describe('FLAT honest-null, Indonesian', () => {
  const sigFlat = computeSignature(PROFILE_FLAT);
  const flatId = assemblePrompt(sigFlat, null, 'id');
  const report = flatId.honestNullReport ?? '';

  it('is deterministic, Indonesian, and still no LLM', () => {
    expect(flatId.honestNull).toBe(true);
    expect(flatId.llm).toBe(false);
    expect(flatId.language).toBe('id');
    expect(report).toBe(buildHonestNullReportId(sigFlat));
  });

  it('carries both canonical Indonesian headings, in report order', () => {
    expect(report.indexOf('## Dari mana laporan ini berasal')).toBeGreaterThanOrEqual(0);
    expect(report.indexOf('## Dari mana laporan ini berasal')).toBeLessThan(
      report.indexOf('## Apa yang tidak bisa dikatakan laporan ini'),
    );
    expect(report).toContain(FRAMEWORK_PROVENANCE_TEXT_ID);
  });

  it('translates the same facts the English null report states', () => {
    for (const fact of [
      'mbti-notes.tumblr.com',
      'Type Spotting',
      'Quenk',
      '40.320', // Indonesian thousands separator
      'Reynierse',
      'Mischel dan Shoda',
      'Fleeson',
      '256 pertanyaan',
    ]) {
      expect(report).toContain(fact);
    }
    // The one licensed structure: the single largest gap, as a hedged watch item.
    expect(report).toContain('bisa jadi hanya kebetulan');
  });

  it('ends with the verbatim Indonesian disclaimer and passes its own audit', () => {
    expect(hasDisclaimer(report, 'id')).toBe(true);
    expect(report).not.toContain('What this is and is not.');
    expect(auditReport(report, 'id')).toEqual([]);
  });
});
