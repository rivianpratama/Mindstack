/**
 * Regime and edge-case tests: FLAT, STAIRCASE, exact ties, out-of-range flags,
 * smeared-segment supply forks, and B as a live parameter.
 *
 * Spec: 02 §1 (input handling, tie rule), §2 step 0 (regime check), §2.1
 * (supply grades), §2.2 (marginal window), §4 S5/S6, §6 (edge cases).
 */

import { describe, expect, it } from 'vitest';
import { computeSignature, validateScores } from '../src/shared/geometry';
import type { FunctionKey, Scores } from '../src/shared/geometry';

describe('02 §2 step 0 - FLAT regime (honest null)', () => {
  // Spread 4, well inside 2B: no structure the noise band can support.
  const sig = computeSignature({
    Ni: 27,
    Ne: 25,
    Si: 24,
    Se: 23,
    Ti: 26,
    Te: 25,
    Fi: 24,
    Fe: 23,
  });

  it('detects FLAT and asserts no tiers at all', () => {
    expect(sig.regime).toBe('FLAT');
    expect(sig.tiers).toEqual({ lead: [], support: [], reserve: [], shadow: [] });
    expect(sig.boundaries).toEqual([]);
    expect(sig.segments).toEqual([]);
    expect(sig.activeSet).toEqual([]);
    expect(sig.operativeLead).toEqual([]);
    expect(sig.leadAttitudes).toBeNull();
  });

  it('renders S6 and nothing else - flat takes precedence over all shapes', () => {
    expect(sig.shapes.map((s) => s.id)).toEqual(['S6']);
    expect(sig.circuit).toBeNull();
  });

  it('names the single largest gap as a tentative watch item only', () => {
    expect(sig.watchItem).not.toBeNull();
    expect(sig.watchItem!.gap).toBe(1);
    expect(sig.watchItem!.above).toBe('Ni');
    expect(sig.watchItem!.below).toBe('Ti');
  });

  it('reads differentiation as low and fires no eruption candidates', () => {
    expect(sig.indices.differentiation.class).toBe('low');
    expect(sig.eruption.firm).toEqual([]);
    expect(sig.eruption.watch).toEqual([]);
  });

  it('leaves every supply grade unrated - no tier exists to grade from', () => {
    expect(Object.values(sig.supplyGrades).every((g) => g === 'unrated')).toBe(true);
    expect(sig.warnings.some((w) => w.includes('FLAT regime'))).toBe(true);
  });
});

describe('02 §2 step 0 - STAIRCASE regime (extremes only)', () => {
  // Monotone 4-point steps: no adjacent gap exceeds B, but the spread is 28.
  const sig = computeSignature({
    Ni: 40,
    Ne: 36,
    Si: 32,
    Se: 28,
    Ti: 24,
    Te: 20,
    Fi: 16,
    Fe: 12,
  });

  it('detects STAIRCASE: no adjacent gap > B, differentiation > 2B', () => {
    expect(sig.regime).toBe('STAIRCASE');
    expect(sig.gaps.every((g) => g.value === 4)).toBe(true);
    expect(sig.indices.differentiation.value).toBe(28);
    expect(sig.indices.differentiation.class).toBe('high');
  });

  it('asserts one segment and no tier boundaries', () => {
    expect(sig.boundaries).toEqual([]);
    expect(sig.segments).toHaveLength(1);
    expect(sig.segments[0]!.members).toHaveLength(8);
    expect(sig.segments[0]!.smeared).toBe(true);
    expect(sig.tiers).toEqual({ lead: [], support: [], reserve: [], shadow: [] });
  });

  it('exposes only upper-vs-lower-edge contrasts', () => {
    expect(sig.segments[0]!.upperEdge).toEqual(['Ni', 'Ne']);
    expect(sig.segments[0]!.lowerEdge).toEqual(['Fi', 'Fe']);
  });

  it('renders S5 and nothing else', () => {
    expect(sig.shapes.map((s) => s.id)).toEqual(['S5']);
    expect(sig.circuit).toBeNull();
    expect(sig.eruption.firm).toEqual([]);
    expect(Object.values(sig.supplyGrades).every((g) => g === 'unrated')).toBe(true);
  });
});

describe('02 §2 step 1 / §1 tie rule - exact ties keep input order', () => {
  const base = { Te: 24, Ne: 20, Se: 19, Si: 18, Fi: 6 };

  it('lists Fe before Ti when Fe is given first', () => {
    const sig = computeSignature({ Ni: 40, Fe: 30, Ti: 30, ...base } as Scores);
    expect(sig.sorted.map((e) => e.fn)).toEqual(['Ni', 'Fe', 'Ti', 'Te', 'Ne', 'Se', 'Si', 'Fi']);
    expect(sig.sorted[2]!.tiedWithPrev).toBe(true);
    expect(sig.sorted[2]!.noiseTieWithPrev).toBe(true);
    // The entry above the tie is not itself tied with its predecessor.
    expect(sig.sorted[1]!.tiedWithPrev).toBe(false);
  });

  it('lists Ti before Fe when Ti is given first - same scores, mirrored order', () => {
    const sig = computeSignature({ Ni: 40, Ti: 30, Fe: 30, ...base } as Scores);
    expect(sig.sorted.map((e) => e.fn)).toEqual(['Ni', 'Ti', 'Fe', 'Te', 'Ne', 'Se', 'Si', 'Fi']);
    expect(sig.sorted[2]!.tiedWithPrev).toBe(true);
  });

  it('marks a within-B neighbour as a noise tie without calling it an exact tie', () => {
    const sig = computeSignature({ Ni: 40, Fe: 30, Ti: 30, ...base } as Scores);
    // Te 24 sits 6 below Ti 30: a boundary, so not a noise tie.
    expect(sig.sorted[3]!.fn).toBe('Te');
    expect(sig.sorted[3]!.tiedWithPrev).toBe(false);
    expect(sig.sorted[3]!.noiseTieWithPrev).toBe(false);
    // Ne 20 sits 4 below Te 24: a tie under the hard tie rule.
    expect(sig.sorted[4]!.noiseTieWithPrev).toBe(true);
    expect(sig.sorted[4]!.tiedWithPrev).toBe(false);
  });
});

describe('02 §1 - out-of-range values are FLAGGED, never clamped', () => {
  const raw = { Ni: 39.6, Ne: 25.4, Si: 21, Se: 63, Ti: 34, Te: 31, Fi: 30, Fe: 8 };

  it('flags Se = 63 for confirmation and returns it unchanged', () => {
    const result = validateScores(raw);
    expect(result.ok).toBe(true);
    expect(result.needsConfirmation).toBe(true);
    expect(result.outOfRange).toEqual(['Se']);
    expect(result.scores!.Se).toBe(63);

    const flag = result.flags.find((f) => f.code === 'out-of-range')!;
    expect(flag.fn).toBe('Se');
    expect(flag.value).toBe(63);
    expect(flag.message).toContain('outside 0-50');
  });

  it('computes the signature on the unclamped value and warns', () => {
    const sig = computeSignature(raw as Scores);
    expect(sig.scores.Se).toBe(63);
    expect(sig.sorted[0]!.fn).toBe('Se');
    expect(sig.sorted[0]!.score).toBe(63);
    expect(sig.warnings.some((w) => w.includes('Se = 63') && w.includes('never clamped'))).toBe(
      true,
    );
  });

  it('rejects missing and non-numeric values outright', () => {
    const missing = validateScores({ Ni: 39.6 });
    expect(missing.ok).toBe(false);
    expect(missing.scores).toBeNull();
    expect(missing.flags.filter((f) => f.code === 'missing')).toHaveLength(7);

    const bad = validateScores({ ...raw, Fe: 'lots' });
    expect(bad.ok).toBe(false);
    expect(bad.flags.some((f) => f.code === 'not-numeric' && f.fn === 'Fe')).toBe(true);
  });

  it('accepts the numeric strings a form hands over, and reports unknown keys', () => {
    const result = validateScores({
      Ni: '39.6',
      Ne: '25.4',
      Si: '21',
      Se: '25',
      Ti: '34',
      Te: '31',
      Fi: '30',
      Fe: '8',
      Xx: '5',
    });
    expect(result.ok).toBe(true);
    expect(result.needsConfirmation).toBe(false);
    expect(result.scores!.Ni).toBe(39.6);
    expect(result.flags.some((f) => f.code === 'unknown-key' && f.key === 'Xx')).toBe(true);
  });
});

describe('02 §2.1 - a lower-edge member of a smeared support band forks', () => {
  /*
   * Support {Ti 30, Te 26, Fe 22} spans 8: smeared. Upper edge (>= 25) is
   * {Ti, Te}; lower edge (<= 27) is {Te, Fe}. Te sits in BOTH windows, so its
   * supply grade is a hedged fork between near-flow and scaffolded stretch.
   */
  const sig = computeSignature({
    Ni: 40,
    Ti: 30,
    Te: 26,
    Fe: 22,
    Ne: 16,
    Se: 15,
    Si: 14,
    Fi: 8,
  });

  it('smears the support band and overlaps its edge windows on Te', () => {
    const smear = sig.smears.find((s) => s.tier === 'support')!;
    expect(smear.span).toBe(8);
    expect(smear.upperEdge).toEqual(['Ti', 'Te']);
    expect(smear.lowerEdge).toEqual(['Te', 'Fe']);
  });

  it('grades Ti near-flow, Fe scaffolded stretch, and Te a fork between them', () => {
    expect(sig.supplyGrades.Ti).toBe('near-flow');
    expect(sig.supplyGrades.Fe).toBe('scaffolded-stretch');
    expect(sig.supplyGrades.Te).toBe('fork');
    expect(sig.supplyForks.Te).toEqual(['near-flow', 'scaffolded-stretch']);
  });

  it('never grades a non-shadow member friction', () => {
    const nonShadow = (Object.keys(sig.supplyGrades) as FunctionKey[]).filter(
      (fn) => sig.tierOf[fn] !== 'shadow',
    );
    expect(nonShadow.every((fn) => sig.supplyGrades[fn] !== 'friction')).toBe(true);
  });
});

describe('02 §1 - every threshold re-derives from B', () => {
  const PROFILE_A: Scores = {
    Ni: 39.6,
    Ne: 25.4,
    Si: 21,
    Se: 25,
    Ti: 34,
    Te: 31,
    Fi: 30,
    Fe: 8,
  };

  it('re-reads profile A wholesale at B = 10', () => {
    const sig = computeSignature(PROFILE_A, { B: 10 });

    // Only the 13-point gap now exceeds B, and 13 no longer clears a 20-point cliff.
    expect(sig.boundaries).toHaveLength(1);
    expect(sig.boundaries[0]!.above).toBe('Si');
    expect(sig.boundaries[0]!.cliff).toBe(false);
    expect(sig.boundaries[0]!.marginal).toBe(false);

    // One boundary, so a seven-member lead and a single-member floor.
    expect(sig.tiers.lead).toHaveLength(7);
    expect(sig.tiers.shadow).toEqual(['Fe']);
    expect(sig.shapes.some((s) => s.id === 'S4')).toBe(true);
    expect(sig.shapes.some((s) => s.id === 'S1')).toBe(false);

    // Fe drops from firm candidate to watch item: the cliff threshold moved.
    expect(sig.eruption.firm).toEqual([]);
    expect(sig.eruption.watch.map((c) => c.fn)).toEqual(['Fe']);

    expect(sig.thresholds).toMatchObject({
      B: 10,
      gap: 10,
      marginalGap: 12,
      cliff: 20,
      marginalCliff: 24,
    });
  });

  it('keeps the derived thresholds consistent at the default B = 5', () => {
    const sig = computeSignature(PROFILE_A);
    expect(sig.thresholds).toMatchObject({
      B: 5,
      gap: 5,
      marginalGap: 6,
      cliff: 10,
      marginalCliff: 12,
      balanced: 5,
      leaning: 10,
      polarized: 20,
      allHigh: 37.5,
      allLow: 12.5,
    });
  });
});

describe('02 §6 - elevation edge cases are shape-only, never a verdict', () => {
  it('flags an all-high profile without reading it as ability', () => {
    // Mean 39.25, at or above the 37.5 upper-quarter edge.
    const sig = computeSignature({
      Ni: 48,
      Ne: 46,
      Si: 44,
      Se: 42,
      Ti: 40,
      Te: 38,
      Fi: 36,
      Fe: 20,
    });
    expect(sig.indices.elevation.value).toBe(39.25);
    expect(sig.indices.elevation.allHigh).toBe(true);
    expect(sig.indices.elevation.class).toBe('all-high');
    expect(sig.warnings.some((w) => w.includes('interpret shape only'))).toBe(true);
  });

  it('flags an all-low profile without reading it as deficiency', () => {
    const sig = computeSignature({
      Ni: 22,
      Ne: 18,
      Si: 14,
      Se: 12,
      Ti: 10,
      Te: 8,
      Fi: 6,
      Fe: 1,
    });
    expect(sig.indices.elevation.allLow).toBe(true);
    expect(sig.indices.elevation.class).toBe('all-low');
    expect(sig.warnings.some((w) => w.includes('no diagnosis'))).toBe(true);
  });
});

describe('02 §4 S12 / 03 §3 - a both-attitudes lead fires no circuit', () => {
  it('marks the lead mixed so the balanced-lead dynamic can fire instead', () => {
    // Lead {Ni 40, Te 38} carries both attitudes.
    const sig = computeSignature({
      Ni: 40,
      Te: 38,
      Ti: 24,
      Ne: 22,
      Se: 20,
      Si: 18,
      Fi: 16,
      Fe: 10,
    });
    expect(sig.tiers.lead).toEqual(['Ni', 'Te']);
    expect(sig.leadAttitudes).toBe('mixed');
    expect(sig.balancedLead).toBe(true);
    expect(sig.circuit).toBeNull();
    expect(sig.shapes.some((s) => s.id === 'S12')).toBe(false);
    expect(sig.shapes.find((s) => s.id === 'S2')!.variant).toBe('mixed');
  });
});
