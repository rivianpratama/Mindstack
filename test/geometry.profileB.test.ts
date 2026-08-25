/**
 * Golden test - profile B, the contrast profile of 02 §7. It "exists so that no
 * generator anchors on a single introverted exemplar", so the extraverted lead,
 * the sealed external circuit and the watch-not-firm floor all matter.
 *
 * Profile: Se 41, Ne 38, Te 31, Fe 27, Ni 21, Si 19, Ti 16, Fi 8.
 */

import { describe, expect, it } from 'vitest';
import { computeSignature } from '../src/shared/geometry';
import type { FunctionKey, Shape, ShapeId } from '../src/shared/geometry';

const PROFILE_B: Record<FunctionKey, number> = {
  Ni: 21,
  Ne: 38,
  Si: 19,
  Se: 41,
  Ti: 16,
  Te: 31,
  Fi: 8,
  Fe: 27,
};

const sig = computeSignature(PROFILE_B);

const withId = (id: ShapeId): Shape[] => sig.shapes.filter((s) => s.id === id);
const one = (id: ShapeId): Shape => {
  const found = withId(id);
  expect(found, `expected exactly one ${id}`).toHaveLength(1);
  return found[0]!;
};

describe('02 §7 profile B - step 1: regime, sort, gaps', () => {
  it('proceeds past the regime check (differentiation 33 > 2B)', () => {
    expect(sig.regime).toBe('NORMAL');
    expect(sig.indices.differentiation.value).toBe(33);
  });

  it('sorts Se · Ne · Te · Fe · Ni · Si · Ti · Fi with gaps 3, 7, 4, 6, 2, 3, 8', () => {
    expect(sig.sorted.map((e) => e.fn)).toEqual(['Se', 'Ne', 'Te', 'Fe', 'Ni', 'Si', 'Ti', 'Fi']);
    expect(sig.gaps.map((g) => g.value)).toEqual([3, 7, 4, 6, 2, 3, 8]);
  });
});

describe('02 §7 profile B - step 2: boundaries', () => {
  it('cuts after Ne (7, firm), after Fe (6, marginal), after Ti (8, firm gap-not-cliff)', () => {
    expect(sig.boundaries.map((b) => b.above)).toEqual(['Ne', 'Fe', 'Ti']);
    const [afterNe, afterFe, afterTi] = sig.boundaries;

    expect(afterNe!.gap).toBe(7);
    expect(afterNe!.marginal).toBe(false);
    expect(afterNe!.class).toBe('firm-gap');

    expect(afterFe!.gap).toBe(6);
    expect(afterFe!.marginal).toBe(true);
    expect(afterFe!.class).toBe('marginal-gap');

    expect(afterTi!.gap).toBe(8);
    expect(afterTi!.marginal).toBe(false);
    // A gap, NOT a cliff: 8 does not exceed 2B = 10.
    expect(afterTi!.cliff).toBe(false);
    expect(afterTi!.class).toBe('firm-gap');
  });
});

describe('02 §7 profile B - step 3: segments and tiers (k = 4, no smears)', () => {
  it('derives lead {Se,Ne}, support {Te,Fe}, reserve {Ni,Si,Ti}, shadow {Fi}', () => {
    expect(sig.segments).toHaveLength(4);
    expect(sig.tiers.lead).toEqual(['Se', 'Ne']);
    expect(sig.tiers.support).toEqual(['Te', 'Fe']);
    expect(sig.tiers.reserve).toEqual(['Ni', 'Si', 'Ti']);
    expect(sig.tiers.shadow).toEqual(['Fi']);
  });

  it('smears nothing - segment spans 3, 4, 5, 0, none exceeding B', () => {
    expect(sig.segments.map((s) => s.span)).toEqual([3, 4, 5, 0]);
    expect(sig.segments.every((s) => !s.smeared)).toBe(true);
    expect(sig.smears).toEqual([]);
  });
});

describe('02 §7 profile B - step 4: active set', () => {
  it('is the lead alone, the lead boundary being firm', () => {
    expect(sig.activeSet).toEqual(['Se', 'Ne']);
    expect(sig.operativeLead).toEqual(['Se', 'Ne']);
    expect(sig.leadAttitudes).toBe('extraverted');
    expect(sig.balancedLead).toBe(false);
  });
});

describe('02 §7 profile B - step 5: indices', () => {
  it('sums to 201', () => {
    expect(sig.indices.sums.total).toBe(201);
    expect(sig.indices.sums.E).toBe(137);
    expect(sig.indices.sums.I).toBe(64);
    expect(sig.indices.sums.J).toBe(82);
    expect(sig.indices.sums.P).toBe(119);
  });

  it('tilts +0.36: strong outward, not borderline', () => {
    expect(sig.indices.tilt.value).toBe(0.36);
    expect(sig.indices.tilt.class).toBe('strong');
    expect(sig.indices.tilt.direction).toBe('outward');
    expect(sig.indices.tilt.borderline).toBe(false);
  });

  it('reads J/P index -0.18 and FIRES perceiving pressure (all-perceiving active set)', () => {
    expect(sig.indices.jp.value).toBe(-0.18);
    expect(sig.indices.jp.composition.allPerceiving).toBe(true);
    expect(sig.indices.jp.composition.fires).toBe('perceiving-pressure');
    // Intake without closure: the judging side is the starved one.
    expect(sig.indices.jp.composition.starvedSide).toBe('judging');
    expect(sig.indices.jp.composition.note).toBeNull();
  });

  it('polarizes Te-Fi 23 extreme borderline, Ni-Se 20 and Ne-Si 19 polarized, Ti-Fe 11 polarized borderline', () => {
    expect(sig.indices.axes['Te-Fi'].pol).toBe(23);
    expect(sig.indices.axes['Te-Fi'].class).toBe('extreme');
    // Just past the 20 cutoff, inside the 24-point window.
    expect(sig.indices.axes['Te-Fi'].borderline).toBe(true);

    expect(sig.indices.axes['Ni-Se'].pol).toBe(20);
    expect(sig.indices.axes['Ni-Se'].class).toBe('polarized');
    expect(sig.indices.axes['Ni-Se'].borderline).toBe(false);

    expect(sig.indices.axes['Ne-Si'].pol).toBe(19);
    expect(sig.indices.axes['Ne-Si'].class).toBe('polarized');
    expect(sig.indices.axes['Ne-Si'].borderline).toBe(false);

    expect(sig.indices.axes['Ti-Fe'].pol).toBe(11);
    expect(sig.indices.axes['Ti-Fe'].class).toBe('polarized');
    // Just past the 10 cutoff, inside the 12-point window.
    expect(sig.indices.axes['Ti-Fe'].borderline).toBe(true);
  });

  it('reads differentiation 33 high and elevation ~25.1 mid', () => {
    expect(sig.indices.differentiation.value).toBe(33);
    expect(sig.indices.differentiation.class).toBe('high');
    // 02 §7 prints 25.1; the exact mean is 201/8 = 25.125.
    expect(sig.indices.elevation.value).toBeCloseTo(25.1, 1);
    expect(sig.indices.elevation.class).toBe('mid');
  });
});

describe('02 §7 profile B - step 6: shapes fired', () => {
  it('fires S2 twin peak in its same-attitude variant', () => {
    const s2 = one('S2');
    expect(s2.members).toEqual(['Se', 'Ne']);
    expect(s2.variant).toBe('same-attitude');
    expect(s2.detail.sameAttitude).toBe(true);
    expect(s2.detail.axisPartners).toBe(false);
  });

  it('fires S12 as a strong (sealed) EXTERNAL circuit: counterweight Ni, strength 17', () => {
    const s12 = one('S12');
    expect(s12.grade).toBe('sealed');
    expect(s12.variant).toBe('external');

    expect(sig.circuit).not.toBeNull();
    expect(sig.circuit!.kind).toBe('external');
    expect(sig.circuit!.counterweight).toBe('Ni');
    expect(sig.circuit!.counterweightScore).toBe(21);
    expect(sig.circuit!.leadMinimum).toBe(38);
    expect(sig.circuit!.strength).toBe(17);
    expect(sig.circuit!.grade).toBe('sealed');
    expect(sig.circuit!.marginal).toBe(false);
  });

  it('fires S9 on Te-Fi as extreme and borderline', () => {
    const teFi = withId('S9').find((s) => s.axis === 'Te-Fi')!;
    expect(teFi.grade).toBe('extreme');
    expect(teFi.marginal).toBe(true);
    expect(teFi.detail.borderline).toBe(true);
  });

  it('fires no S7 - the floor sits below a gap, not a cliff', () => {
    expect(withId('S7')).toHaveLength(0);
  });

  it('fires no S1/S3/S3b/S4/S5/S6/S8, and no balanced axis shapes', () => {
    for (const id of ['S1', 'S3', 'S3b', 'S4', 'S5', 'S6', 'S8', 'S10', 'S11'] as ShapeId[]) {
      expect(withId(id), id).toHaveLength(0);
    }
  });
});

describe('02 §7 profile B - step 7: supply grades', () => {
  it('grades Se/Ne flow, Te/Fe near-flow, Ni/Si/Ti scaffolded stretch, Fi friction', () => {
    expect(sig.supplyGrades).toEqual({
      Se: 'flow',
      Ne: 'flow',
      Te: 'near-flow',
      Fe: 'near-flow',
      Ni: 'scaffolded-stretch',
      Si: 'scaffolded-stretch',
      Ti: 'scaffolded-stretch',
      Fi: 'friction',
    });
  });

  it('leaves a hedge trail for Fe: the boundary below it is marginal', () => {
    expect(sig.boundaries[1]!.above).toBe('Fe');
    expect(sig.boundaries[1]!.marginal).toBe(true);
  });
});

describe('02 §7 profile B - eruption candidacy: watch, not firm', () => {
  it('makes Fi a hedged watch item and NO firm candidate (8 < 10)', () => {
    expect(sig.eruption.firm).toEqual([]);
    expect(sig.eruption.watch).toHaveLength(1);
    const fi = sig.eruption.watch[0]!;
    expect(fi.fn).toBe('Fi');
    expect(fi.grade).toBe('watch');
    expect(fi.boundaryGap).toBe(8);
    expect(fi.axisPartner).toBe('Te');
  });
});
