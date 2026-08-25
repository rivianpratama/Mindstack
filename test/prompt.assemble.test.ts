/**
 * Layer-2 selection tests: does the computed geometry pull exactly the right knowledge-base
 * fragments, and does the render plan allocate airtime the way 05 §5.1 says it must?
 *
 * Signatures are computed in-test via `computeSignature` — never transcribed — so a change
 * in Layer 1 surfaces here as a selection failure rather than a silently stale expectation.
 */

import { describe, expect, it } from 'vitest';

import { computeSignature } from '../src/shared/geometry';
import type { FunctionKey, Signature } from '../src/shared/geometry';
import {
  assemblePrompt,
  computeDefaultContexts,
  DEMAND_WEIGHTING_RULE,
  FRAMEWORK_PROVENANCE_TEXT,
  MIN_REPORT_WORDS,
  REPORT_HEADINGS,
  TARGET_REPORT_WORDS,
  type RenderFeature,
} from '../src/server/prompt/assemble';
import { SYSTEM_PROMPT } from '../src/server/prompt/system-prompt';
import { MAX_COMPLETION_TOKENS } from '../src/server/deepseek';
import { auditReport, hasDisclaimer } from '../src/server/guards';

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

const PROFILE_B: Record<FunctionKey, number> = {
  Se: 41,
  Ne: 38,
  Te: 31,
  Fe: 27,
  Ni: 21,
  Si: 19,
  Ti: 16,
  Fi: 8,
};

/** Mixed-attitude lead: Ni and Te alone in the top segment, everything else far below. */
const PROFILE_MIXED_LEAD: Record<FunctionKey, number> = {
  Ni: 40,
  Te: 38,
  Ti: 25,
  Fi: 20,
  Ne: 15,
  Se: 10,
  Si: 8,
  Fe: 5,
};

/** Every score inside one noise band: the FLAT regime. */
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

const sigA: Signature = computeSignature(PROFILE_A);
const sigB: Signature = computeSignature(PROFILE_B);
const sigMixed: Signature = computeSignature(PROFILE_MIXED_LEAD);
const sigFlat: Signature = computeSignature(PROFILE_FLAT);

const assemblyA = assemblePrompt(sigA, null);
const assemblyB = assemblePrompt(sigB, null);
const assemblyMixed = assemblePrompt(sigMixed, null);
const assemblyFlat = assemblePrompt(sigFlat, null);

const feature = (plan: RenderFeature[], id: string): RenderFeature => {
  const found = plan.find((entry) => entry.id === id);
  expect(found, `expected render feature "${id}" in [${plan.map((f) => f.id).join(', ')}]`).toBeDefined();
  return found!;
};

/* ------------------------------------------------------------------ *
 * Profile A — the canonical derivation of 02 §5
 * ------------------------------------------------------------------ */

describe('profile A selection (02 §5 geometry)', () => {
  it('computes the geometry the selection depends on', () => {
    expect(sigA.regime).toBe('NORMAL');
    expect(sigA.circuit?.kind).toBe('internal');
    expect(sigA.circuit?.counterweight).toBe('Te');
    expect(sigA.eruption.firm.map((c) => c.fn)).toEqual(['Fe']);
    expect(sigA.indices.jp.composition.fires).toBeNull();
  });

  it('includes the circuit, its counterweight and the shadow floor', () => {
    expect(assemblyA.fragmentKeys).toContain('dynamics.internal-circuit');
    // The counterweight's supporting block: the exit ramp, in its own currency.
    expect(assemblyA.fragmentKeys).toContain('functions.Te.h');
    expect(assemblyA.fragmentKeys).toContain('dynamics.shadow-floor');
    expect(assemblyA.fragmentKeys).toContain('functions.Fe.d');
    // Fe is a FIRM candidate (13-point cliff), so the eruptive block is licensed.
    expect(assemblyA.fragmentKeys).toContain('functions.Fe.e');
  });

  it('includes the polarized axes, the sub-cluster and its members’ supporting blocks', () => {
    expect(assemblyA.fragmentKeys).toContain('dynamics.polarized-axes');
    expect(assemblyA.fragmentKeys).toContain('shapes.S3b');
    expect(assemblyA.fragmentKeys).toContain('dynamics.pluralistic');
    expect(assemblyA.fragmentKeys).toContain('functions.Ti.h');
    expect(assemblyA.fragmentKeys).toContain('functions.Te.h');
    expect(assemblyA.fragmentKeys).toContain('functions.Fi.h');
  });

  it('includes Ni engaged AND over-engaged, because Ni–Se is polarized', () => {
    expect(sigA.indices.axes['Ni-Se'].class).toBe('polarized');
    expect(assemblyA.fragmentKeys).toContain('functions.Ni.b');
    expect(assemblyA.fragmentKeys).toContain('functions.Ni.c');
  });

  it('injects the always-on block once, and never the identical dynamics copy', () => {
    expect(assemblyA.fragmentKeys).toContain('always.development');
    expect(assemblyA.fragmentKeys).toContain('always.state-honesty');
    // 03 §10 is byte-identical to always.development; shipping both would double-bill it.
    expect(assemblyA.fragmentKeys).not.toContain('dynamics.development');
    expect(assemblyA.fragmentKeys.filter((k) => k.endsWith('development'))).toHaveLength(1);
  });

  it('excludes the dynamics this geometry does not fire', () => {
    expect(assemblyA.fragmentKeys).not.toContain('dynamics.external-circuit');
    // Active set {Ni, Ti, Te, Fi} is mixed (1 P : 3 J): no pressure fires.
    expect(assemblyA.fragmentKeys).not.toContain('dynamics.jp-pressure');
    expect(assemblyA.fragmentKeys).not.toContain('dynamics.balanced-lead');
    // The judging trio is an S3b sub-cluster, never an S3 lead cluster.
    expect(assemblyA.fragmentKeys).not.toContain('shapes.S3');
    expect(assemblyA.fragmentKeys).not.toContain('dynamics.weak-signal');
  });

  it('carries the mixed active set as a note rather than a fragment', () => {
    const note = feature(assemblyA.renderPlan, 'jp-note');
    expect(note.mode).toBe('brief');
    expect(note.instructions.join(' ')).toContain('mixed');
  });

  it('ships no 04 §e content and no geometry numbers inside any fragment', () => {
    const text = assemblyA.fragments.map((f) => f.text).join('\n');
    for (const marker of ['five-person team', 'burst pipe', 'Scenario 1', 'Scenario 2', 'Running example']) {
      expect(text).not.toContain(marker);
    }
    for (const number of ['39.6', '25.4', '89.4', '124.6']) {
      expect(text).not.toContain(number);
    }
    expect(assemblyA.fragmentKeys.some((key) => key.startsWith('friction.scenario'))).toBe(false);
  });
});

describe('profile A render plan (05 §5.1 salience and caps)', () => {
  it('merges the Ti–Fe extreme axis and the Fe cliff into one feature', () => {
    const merged = feature(assemblyA.renderPlan, 'floor:Fe');
    expect(merged.axis).toBe('Ti-Fe');
    expect(merged.mergedFrom).toContain('axis:Ti-Fe');
    expect(merged.mergedFrom).toContain('floor:Fe');
    expect(merged.instructions.join(' ')).toContain('ONE reading');
    // ...and the axis therefore gets no second feature of its own.
    expect(assemblyA.renderPlan.filter((f) => f.id === 'axis:Ti-Fe')).toHaveLength(0);
  });

  it('marks the marginal Ni spike and the S3b sub-cluster fork-required', () => {
    expect(feature(assemblyA.renderPlan, 'lead:S1').forkRequired).toBe(true);
    expect(feature(assemblyA.renderPlan, 'lead:S1').mode).toBe('fork');
    expect(feature(assemblyA.renderPlan, 'lead:S3b').forkRequired).toBe(true);
    expect(feature(assemblyA.renderPlan, 'lead:S3b').mode).toBe('fork');
  });

  it('gives the most polarized axis the fullest treatment and a short paragraph to the rest', () => {
    const axisFeatures = assemblyA.renderPlan.filter((f) => f.axis !== undefined);
    expect(axisFeatures.filter((f) => f.mode === 'full')).toHaveLength(1);
    // Cap relaxed for the comprehensive format: a short paragraph, no longer one sentence.
    expect(feature(assemblyA.renderPlan, 'axis:Ni-Se').mode).toBe('short-paragraph');
    expect(feature(assemblyA.renderPlan, 'axis:Ni-Se').instructions.join(' ')).toContain(
      'SHORT PARAGRAPH',
    );
    // A balanced-low channel stays quiet even in the long format (03 §7).
    expect(feature(assemblyA.renderPlan, 'axis:Ne-Si').mode).toBe('brief');
    // 03 §7 allows exactly one balanced-high fork alongside the full axis.
    expect(axisFeatures.filter((f) => f.mode === 'fork')).toHaveLength(1);
  });

  it('caps eruption candidates at the one firm candidate', () => {
    const eruption = assemblyA.renderPlan.filter(
      (f) => f.kind === 'shadow-cliff' || f.kind === 'eruption-watch',
    );
    expect(eruption.map((f) => f.functions[0])).toEqual(['Fe']);
    expect(assemblyA.renderPlan.some((f) => f.kind === 'eruption-summary')).toBe(false);
  });

  it('orders the plan cliffs first, then circuits, then axes, then lead shapes', () => {
    const ids = assemblyA.renderPlan.map((f) => f.id);
    expect(ids[0]).toBe('floor:Fe');
    expect(ids.indexOf('circuit')).toBeLessThan(ids.indexOf('axis:Ni-Se'));
    expect(ids.indexOf('axis:Ni-Se')).toBeLessThan(ids.indexOf('lead:S1'));
    expect(ids.indexOf('lead:S1')).toBeLessThan(ids.indexOf('axis:Ne-Si'));
  });

  it('budgets 300-400 words per full feature, less for the compressed ones', () => {
    for (const f of assemblyA.renderPlan) {
      if (f.mode === 'short-paragraph') expect(f.budgetWords).toBe(140);
      if (f.mode === 'brief') expect(f.budgetWords).toBe(60);
      if (f.mode === 'full' || f.mode === 'fork') {
        expect(f.budgetWords).toBeGreaterThanOrEqual(300);
        expect(f.budgetWords).toBeLessThanOrEqual(600);
      }
    }
  });

  it('attaches the depth contract to every full-length profile feature', () => {
    for (const f of assemblyA.renderPlan) {
      if (f.mode !== 'full' && f.mode !== 'fork') continue;
      if (f.kind === 'provenance' || f.kind === 'friction-map') continue;
      const text = f.instructions.join(' ');
      expect(text, `${f.id} is missing the depth contract`).toContain('Depth contract');
      expect(text).toContain('predicts that none of them predicts alone');
    }
  });
});

/* ------------------------------------------------------------------ *
 * Profile B — the contrast profile of 02 §7
 * ------------------------------------------------------------------ */

describe('profile B selection (02 §7 geometry)', () => {
  it('computes the geometry the selection depends on', () => {
    expect(sigB.circuit?.kind).toBe('external');
    expect(sigB.circuit?.grade).toBe('sealed');
    expect(sigB.indices.jp.composition.fires).toBe('perceiving-pressure');
    expect(sigB.eruption.firm).toHaveLength(0);
    expect(sigB.eruption.watch.map((c) => c.fn)).toEqual(['Fi']);
  });

  it('includes the external circuit and the perceiving-pressure lever', () => {
    expect(assemblyB.fragmentKeys).toContain('dynamics.external-circuit');
    expect(assemblyB.fragmentKeys).not.toContain('dynamics.internal-circuit');
    expect(assemblyB.fragmentKeys).toContain('dynamics.jp-pressure');
    // Starved side is judging; its strongest member is Te.
    expect(assemblyB.fragmentKeys).toContain('functions.Te.h');
  });

  it('renders the Fi floor as a watch item — (d) without (e)', () => {
    expect(assemblyB.fragmentKeys).toContain('functions.Fi.d');
    expect(assemblyB.fragmentKeys).not.toContain('functions.Fi.e');
    const floor = feature(assemblyB.renderPlan, 'floor:Fi');
    expect(floor.kind).toBe('eruption-watch');
    expect(floor.forkRequired).toBe(true);
    expect(floor.instructions.join(' ')).toContain('hedged watch line');
  });

  it('keeps the polarized-axis cap: one axis fullest, the others a short paragraph', () => {
    const axisFeatures = assemblyB.renderPlan.filter((f) => f.axis !== undefined);
    expect(axisFeatures.filter((f) => f.mode === 'full' || f.mode === 'fork')).toHaveLength(1);
    expect(axisFeatures.filter((f) => f.mode === 'short-paragraph')).toHaveLength(3);
  });
});

/* ------------------------------------------------------------------ *
 * Mixed-attitude lead, FLAT, and the default-context path
 * ------------------------------------------------------------------ */

describe('mixed-attitude lead (03 §3, the contrast case)', () => {
  it('fires balanced-lead and no circuit at all', () => {
    expect(sigMixed.balancedLead).toBe(true);
    expect(sigMixed.circuit).toBeNull();
    expect(assemblyMixed.fragmentKeys).toContain('dynamics.balanced-lead');
    expect(assemblyMixed.fragmentKeys).not.toContain('dynamics.internal-circuit');
    expect(assemblyMixed.fragmentKeys).not.toContain('dynamics.external-circuit');
    expect(assemblyMixed.fragmentKeys).not.toContain('shapes.S12');
    const balanced = feature(assemblyMixed.renderPlan, 'balanced-lead');
    expect(balanced.instructions.join(' ')).toContain('Never name a counterweight');
  });
});

describe('5W1H absent → computed default contexts (04 §b)', () => {
  it('picks two or three taxonomy rows spanning distinct supply grades', () => {
    for (const assembly of [assemblyA, assemblyB, assemblyMixed]) {
      const rows = assembly.defaultContexts;
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.length).toBeLessThanOrEqual(3);
      const grades = new Set(rows.map((row) => row.supplyGrade));
      expect(grades.size).toBe(rows.length);
      for (const row of rows) {
        expect(row.supplyGrade).toBe(assembly === assemblyA ? sigA.supplyGrades[row.demands[0]!] : row.supplyGrade);
      }
    }
  });

  it('prefers one flow, one stretch and one friction row where all three exist', () => {
    expect(computeDefaultContexts(sigA).map((row) => row.supplyGrade)).toEqual([
      'flow',
      'scaffolded-stretch',
      'friction',
    ]);
  });

  it('tells the model plainly that these are common contexts, not personalization', () => {
    expect(assemblyA.contextProvided).toBe(false);
    expect(assemblyA.userPrompt).toContain('common contexts');
    expect(assemblyA.userPrompt).toContain('not personalization');
    expect(feature(assemblyA.renderPlan, 'friction-map').instructions.join(' ')).toContain(
      DEMAND_WEIGHTING_RULE,
    );
  });

  it('uses the supplied 5W1H instead when one arrives', () => {
    const withContext = assemblePrompt(sigA, {
      what: 'ship a joint product with a feuding team',
      when: 'hard external deadline, two weeks',
    });
    expect(withContext.contextProvided).toBe(true);
    expect(withContext.defaultContexts).toHaveLength(0);
    expect(withContext.userPrompt).toContain('hard external deadline, two weeks');
    expect(withContext.fragmentKeys).toContain('friction.demand-taxonomy');
    expect(withContext.fragmentKeys).toContain('friction.template');
  });
});

describe('FLAT regime → honest null, no fragments, no LLM', () => {
  it('returns the honest-null marker instead of a prompt', () => {
    expect(sigFlat.regime).toBe('FLAT');
    expect(assemblyFlat.honestNull).toBe(true);
    expect(assemblyFlat.llm).toBe(false);
    expect(assemblyFlat.fragmentKeys).toEqual([]);
    expect(assemblyFlat.fragments).toEqual([]);
    expect(assemblyFlat.renderPlan).toEqual([]);
    expect(assemblyFlat.userPrompt).toBe('');
    expect(assemblyFlat.maxTokens).toBe(0);
  });

  it('still explains the framework, so a flat report is substantial without lying', () => {
    const report = assemblyFlat.honestNullReport ?? '';
    // Both canonical headings, in report order, so the client's cards still match.
    expect(report.indexOf('## How this reading was made')).toBeGreaterThanOrEqual(0);
    expect(report.indexOf('## How this reading was made')).toBeLessThan(
      report.indexOf('## What this report cannot know'),
    );
    expect(report).toContain(FRAMEWORK_PROVENANCE_TEXT);
    for (const fact of [
      'mbti-notes.tumblr.com',
      'Type Spotting',
      'Quenk',
      '40,320',
      'Reynierse',
      'Mischel and Shoda',
      'Fleeson',
      'unvalidated hobbyist questionnaire',
    ]) {
      expect(report).toContain(fact);
    }
    // Explaining the method is not a claim about the reader: still no trait content.
    expect(FRAMEWORK_PROVENANCE_TEXT).not.toContain('you likely');
    expect(auditReport(FRAMEWORK_PROVENANCE_TEXT).filter((v) => !v.includes('disclaimer'))).toEqual(
      [],
    );
    expect(report.split(/\s+/).length).toBeGreaterThan(600);
  });

  it('carries a deterministic report with the verbatim disclaimer and no trait content', () => {
    const report = assemblyFlat.honestNullReport ?? '';
    expect(report).toContain('too flat for this instrument to resolve structure');
    expect(report).toContain('256-item Sakinorva Domains Test');
    expect(hasDisclaimer(report)).toBe(true);
    expect(auditReport(report)).toEqual([]);
    // The single largest gap is the only structure a FLAT profile may name.
    expect(report).toContain('watch item, not a tier boundary');
    // No trait content: nothing above the disclaimer asserts a tier, a shape or an essence.
    const body = report.slice(0, report.indexOf('What this is — and is not.')).toLowerCase();
    for (const banned of ['lead cluster', 'your true', 'you will always', 'you tend to', 'erupt']) {
      expect(body).not.toContain(banned);
    }
  });
});

describe('STAIRCASE regime → weak signal only', () => {
  it('fires the weak-signal dynamic and nothing else', () => {
    const staircase = computeSignature({
      Ni: 40,
      Te: 36,
      Ti: 32,
      Fi: 28,
      Ne: 24,
      Se: 20,
      Si: 16,
      Fe: 12,
    });
    expect(staircase.regime).toBe('STAIRCASE');
    const assembly = assemblePrompt(staircase, null);
    expect(assembly.llm).toBe(true);
    expect(assembly.fragmentKeys).toEqual([
      'dynamics.weak-signal',
      'always.development',
      'always.state-honesty',
    ]);
    // The weak-signal feature plus the framework-provenance section, and nothing else.
    expect(assembly.renderPlan.map((f) => f.id)).toEqual(['weak-signal:staircase', 'provenance']);
    expect(assembly.renderPlan[0]!.instructions.join(' ')).toContain('upper edge');
    expect(assembly.renderPlan[0]!.instructions.join(' ')).toContain('the honest output is SHORT');
    expect(assembly.defaultContexts).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Prompt hygiene
 * ------------------------------------------------------------------ */

describe('user prompt hygiene', () => {
  it('never names the worked example, and quotes raw scores only where they belong', () => {
    expect(assemblyA.userPrompt).not.toContain('Profile A');
    expect(assemblyA.userPrompt).not.toContain('profile A');

    const planStart = assemblyA.userPrompt.indexOf('# 3. RENDER PLAN');
    expect(planStart).toBeGreaterThan(0);
    // Ni's raw score may appear in the signature JSON and the raw-scores block, nowhere else:
    // the render plan and the instructions cite gaps, polarizations and grades instead.
    expect(assemblyA.userPrompt.slice(planStart)).not.toContain('39.6');

    const signatureBlock = assemblyA.userPrompt.slice(0, planStart);
    expect(signatureBlock).toContain('39.6');
    expect(signatureBlock).toContain('never re-derive or rank inside ties');
  });

  it('names the six headings, in order, and ends with the disclaimer', () => {
    const positions = REPORT_HEADINGS.map((heading) => assemblyA.userPrompt.indexOf(heading));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(assemblyA.userPrompt).toContain('Write Sections 2–7 ONLY');
    expect(hasDisclaimer(assemblyA.userPrompt)).toBe(true);
  });

  it('groups fragments shapes → dynamics → functions → friction → always-on', () => {
    const groups = assemblyA.fragments.map((f) => f.group);
    const firstIndexOf = (group: (typeof groups)[number]) => groups.indexOf(group);
    expect(firstIndexOf('shapes')).toBeLessThan(firstIndexOf('dynamics'));
    expect(firstIndexOf('dynamics')).toBeLessThan(firstIndexOf('functions'));
    expect(firstIndexOf('functions')).toBeLessThan(firstIndexOf('friction'));
    expect(firstIndexOf('friction')).toBeLessThan(firstIndexOf('always'));
    // Every selected key resolved to real text.
    expect(assemblyA.fragments).toHaveLength(assemblyA.fragmentKeys.length);
    for (const fragment of assemblyA.fragments) expect(fragment.text.length).toBeGreaterThan(20);
  });

  it('sizes the completion cap to the render plan’s word budget', () => {
    const words = assemblyA.renderPlan.reduce((sum, f) => sum + f.budgetWords, 0);
    expect(assemblyA.budgetWords).toBe(words);
    expect(assemblyA.maxTokens).toBeGreaterThan(words);
    expect(assemblyA.maxTokens).toBeLessThanOrEqual(MAX_COMPLETION_TOKENS);
    // 2000+ words of output needs materially more headroom than the old 4096 cap.
    expect(MAX_COMPLETION_TOKENS).toBe(8000);
    expect(assemblyA.maxTokens).toBeGreaterThan(4096);
  });
});

/* ------------------------------------------------------------------ *
 * Comprehensive format: length contract, depth, and the provenance section
 * ------------------------------------------------------------------ */

describe('comprehensive format — length contract', () => {
  it('allocates a budget above the hard minimum for every resolved profile', () => {
    for (const assembly of [assemblyA, assemblyB, assemblyMixed]) {
      expect(assembly.minWords).toBe(MIN_REPORT_WORDS);
      expect(assembly.minWords).toBe(2000);
      expect(assembly.budgetWords).toBeGreaterThanOrEqual(MIN_REPORT_WORDS);
    }
  });

  it('states the minimum, the target and the anti-filler rule in the prompt', () => {
    expect(assemblyA.userPrompt).toContain(`HARD MINIMUM ${MIN_REPORT_WORDS} words`);
    expect(assemblyA.userPrompt).toContain(
      `target ${TARGET_REPORT_WORDS[0]}–${TARGET_REPORT_WORDS[1]}`,
    );
    expect(assemblyA.userPrompt).toContain(`Total allocated budget: ~${assemblyA.budgetWords} words`);
    expect(assemblyA.userPrompt).toContain('never with generic prose');
  });

  it('imposes no minimum where the geometry resolves little', () => {
    const staircase = assemblePrompt(
      computeSignature({ Ni: 40, Te: 36, Ti: 32, Fi: 28, Ne: 24, Se: 20, Si: 16, Fe: 12 }),
      null,
    );
    expect(staircase.minWords).toBe(0);
    expect(staircase.userPrompt).toContain('No length minimum applies');
    expect(staircase.userPrompt).toContain('Padding here would be a generation error');
  });

  it('deepens section 3 rather than padding it', () => {
    const withContext = assemblePrompt(sigA, { what: 'ship a joint product', when: 'two weeks' });
    const supplied = feature(withContext.renderPlan, 'friction-map');
    expect(supplied.instructions.join(' ')).toContain('THREE TO FOUR if-then signatures per demand');
    expect(supplied.budgetWords).toBeGreaterThanOrEqual(500);

    const defaults = feature(assemblyA.renderPlan, 'friction-map');
    expect(defaults.instructions.join(' ')).toContain(
      `render ALL ${assemblyA.defaultContexts.length} contexts FULLY`,
    );
    expect(defaults.budgetWords).toBeGreaterThanOrEqual(360);
  });

  it('gives each firm eruption candidate full depth, still capped at two', () => {
    const firm = assemblyMixed.renderPlan.filter((f) => f.kind === 'shadow-cliff' && f.functions.length > 0);
    expect(assemblyMixed.renderPlan.filter((f) => f.id.startsWith('floor:') && f.mode === 'full')).toHaveLength(2);
    expect(firm.length).toBeGreaterThan(0);
    const fe = feature(assemblyMixed.renderPlan, 'floor:Fe').instructions.join(' ');
    expect(fe).toContain('early-warning signs');
    expect(fe).toContain('bridge-function route');
    expect(fe).toContain('boundary design');
    // The cap still bites: everything beyond two firm candidates is one summary line.
    expect(feature(assemblyMixed.renderPlan, 'floor:summary').mode).toBe('summary-line');
  });
});

describe('section 6 — "How this reading was made"', () => {
  it('names the exact heading, after Levers and before the limits section', () => {
    expect(REPORT_HEADINGS).toHaveLength(6);
    expect(REPORT_HEADINGS[4]).toBe('## How this reading was made');
    expect(REPORT_HEADINGS.indexOf('## How this reading was made')).toBe(
      REPORT_HEADINGS.indexOf('## Levers') + 1,
    );
    expect(REPORT_HEADINGS.indexOf('## What this report cannot know')).toBe(
      REPORT_HEADINGS.indexOf('## How this reading was made') + 1,
    );
  });

  it('is a planned feature on every LLM path, in section 6', () => {
    const staircase = assemblePrompt(
      computeSignature({ Ni: 40, Te: 36, Ti: 32, Fi: 28, Ne: 24, Se: 20, Si: 16, Fe: 12 }),
      null,
    );
    for (const assembly of [assemblyA, assemblyB, assemblyMixed, staircase]) {
      const provenance = feature(assembly.renderPlan, 'provenance');
      expect(provenance.section).toBe(6);
      expect(provenance.kind).toBe('provenance');
      expect(provenance.budgetWords).toBe(400);
      expect(provenance.functions).toEqual([]);
    }
  });

  it('carries the provenance facts, with the right epistemic tiers', () => {
    const text = feature(assemblyA.renderPlan, 'provenance').instructions.join(' ');
    expect(text).toContain('300–500 words');
    for (const source of ['Type Fundamentals', 'Function Theory', 'Type Development', 'Type Spotting']) {
      expect(text).toContain(source);
    }
    expect(text).toContain('mbti-notes.tumblr.com');
    expect(text).toContain('Quenk');
    expect(text).toContain('engagement states');
    expect(text).toContain('40,320');
    expect(text).toContain('Reynierse 2009');
    expect(text).toContain('Mischel & Shoda 1995');
    expect(text).toContain('Fleeson 2001');
    expect(text).toContain('unvalidated hobbyist');
    // The section explains the method; it must make no claim about the person.
    expect(text).toContain('NO claim about the person');
  });

  it('tells the model to write sections 2–7 with the exact headings', () => {
    expect(assemblyA.userPrompt).toContain('Write Sections 2–7 ONLY');
    for (const heading of REPORT_HEADINGS) {
      expect(assemblyA.userPrompt).toContain(`\`${heading}\``);
    }
  });
});

describe('system prompt — rule hierarchy', () => {
  it('states grounding as the supreme rule, above the gates', () => {
    expect(SYSTEM_PROMPT).toContain('Rule 0 — GROUNDING');
    expect(SYSTEM_PROMPT.indexOf('Rule 0 — GROUNDING')).toBeLessThan(
      SYSTEM_PROMPT.indexOf('C1 — Falsifiability quota'),
    );
    expect(SYSTEM_PROMPT).toContain('the theory mechanism it applies');
    for (const mechanism of [
      'function engagement states',
      'avoidance economics',
      'attitude starvation',
      'repression-rebound eruption',
      'contrarian influence',
      'demand-versus-supply friction',
      'pluralistic arbitration',
    ]) {
      expect(SYSTEM_PROMPT).toContain(mechanism);
    }
  });

  it('licenses grounded inventiveness', () => {
    expect(SYSTEM_PROMPT).toContain('Inventiveness is encouraged');
    expect(SYSTEM_PROMPT).toContain('Compose fired dynamics into interaction readings');
    expect(SYSTEM_PROMPT).toContain('Derive bold, specific predictions');
    expect(SYSTEM_PROMPT).toContain('Depth and originality of composition are quality criteria');
  });

  it('downgrades the mirror test and keeps the falsifier quota at one per section', () => {
    expect(SYSTEM_PROMPT).toContain('C4 — ADVISORY, not a delete gate');
    expect(SYSTEM_PROMPT).toContain('C1 — hard, at one per section');
    expect(SYSTEM_PROMPT).toContain('strong guidance rather than a hard gate');
  });

  it('keeps the hard rules hard', () => {
    for (const rule of [
      'Geometry-anchor rule',
      'C2 — hard, unchanged',
      'C5 — hard, unchanged',
      'C6 — hard, unchanged',
      'Tier audibility rule',
      'ASD-STE100',
      'IELTS 6.0',
      'Type codes or type nouns',
    ]) {
      expect(SYSTEM_PROMPT).toContain(rule);
    }
  });

  it('carries the compact provenance block for every section', () => {
    expect(SYSTEM_PROMPT).toContain('# Framework provenance');
    expect(SYSTEM_PROMPT).toContain('Type Spotting');
    expect(SYSTEM_PROMPT).toContain('40,320');
    expect(SYSTEM_PROMPT).toContain('Reynierse 2009');
  });
});
