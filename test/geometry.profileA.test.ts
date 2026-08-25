/**
 * Golden test - profile A, the canonical derivation of 02 §5.
 * "every other component quotes THIS output", so every number below is
 * transcribed from that section rather than from the implementation.
 *
 * Profile: Ni 39.6, Ti 34, Te 31, Fi 30, Ne 25.4, Se 25, Si 21, Fe 8.
 */

import { describe, expect, it } from 'vitest';
import { computeSignature } from '../src/shared/geometry';
import type { AxisKey, FunctionKey, Shape, ShapeId } from '../src/shared/geometry';

const PROFILE_A: Record<FunctionKey, number> = {
  Ni: 39.6,
  Ne: 25.4,
  Si: 21,
  Se: 25,
  Ti: 34,
  Te: 31,
  Fi: 30,
  Fe: 8,
};

const sig = computeSignature(PROFILE_A);

const withId = (id: ShapeId): Shape[] => sig.shapes.filter((s) => s.id === id);
const one = (id: ShapeId): Shape => {
  const found = withId(id);
  expect(found, `expected exactly one ${id}`).toHaveLength(1);
  return found[0]!;
};

describe('02 §5 profile A - steps 1 to 3: regime, sort, gaps', () => {
  it('proceeds past the regime check (differentiation 31.6 > 2B)', () => {
    expect(sig.regime).toBe('NORMAL');
    expect(sig.indices.differentiation.value).toBe(31.6);
  });

  it('sorts Ni · Ti · Te · Fi · Ne · Se · Si · Fe', () => {
    expect(sig.sorted.map((e) => e.fn)).toEqual(['Ni', 'Ti', 'Te', 'Fi', 'Ne', 'Se', 'Si', 'Fe']);
  });

  it('reads gaps 5.6, 3.0, 1.0, 4.6, 0.4, 4.0, 13.0', () => {
    expect(sig.gaps.map((g) => g.value)).toEqual([5.6, 3.0, 1.0, 4.6, 0.4, 4.0, 13.0]);
  });
});

describe('02 §5 profile A - step 4: boundaries', () => {
  it('cuts after Ni and after Si, and nowhere else', () => {
    expect(sig.boundaries.map((b) => b.above)).toEqual(['Ni', 'Si']);
  });

  it('flags the after-Ni boundary MARGINAL (5.6, inside the 5-6 window)', () => {
    const [afterNi] = sig.boundaries;
    expect(afterNi!.gap).toBe(5.6);
    expect(afterNi!.index).toBe(0);
    expect(afterNi!.below).toBe('Ti');
    expect(afterNi!.marginal).toBe(true);
    expect(afterNi!.cliff).toBe(false);
    expect(afterNi!.class).toBe('marginal-gap');
    expect(afterNi!.strength).toBe(0.6);
  });

  it('flags the after-Si boundary a FIRM CLIFF (13.0 > 10, past the 12-point window)', () => {
    const afterSi = sig.boundaries[1]!;
    expect(afterSi.gap).toBe(13.0);
    expect(afterSi.cliff).toBe(true);
    expect(afterSi.marginalCliff).toBe(false);
    expect(afterSi.marginal).toBe(false);
    expect(afterSi.class).toBe('firm-cliff');
  });

  it('treats Fi->Ne (4.6) as a tie, not a boundary', () => {
    expect(sig.gaps[3]!.value).toBe(4.6);
    expect(sig.boundaries.some((b) => b.above === 'Fi')).toBe(false);
    expect(sig.sorted[4]!.noiseTieWithPrev).toBe(true);
  });
});

describe('02 §5 profile A - step 5: segments and tiers (k = 3, reserve EMPTY)', () => {
  it('derives lead {Ni}, support {Ti,Te,Fi,Ne,Se,Si}, shadow {Fe}, reserve empty', () => {
    expect(sig.segments).toHaveLength(3);
    expect(sig.tiers.lead).toEqual(['Ni']);
    expect(sig.tiers.support).toEqual(['Ti', 'Te', 'Fi', 'Ne', 'Se', 'Si']);
    expect(sig.tiers.reserve).toEqual([]);
    expect(sig.tiers.shadow).toEqual(['Fe']);
  });

  it('maps every function to its tier', () => {
    expect(sig.tierOf).toEqual({
      Ni: 'lead',
      Ti: 'support',
      Te: 'support',
      Fi: 'support',
      Ne: 'support',
      Se: 'support',
      Si: 'support',
      Fe: 'shadow',
    });
  });
});

describe('02 §5 profile A - step 6: the smeared support band', () => {
  const smear = sig.smears[0]!;

  it('smears support only (span 34 - 21 = 13 > B)', () => {
    expect(sig.smears).toHaveLength(1);
    expect(smear.tier).toBe('support');
    expect(smear.span).toBe(13);
  });

  it('reads upper edge {Ti,Te,Fi} and lower edge {Ne,Se,Si}', () => {
    expect(smear.upperEdge).toEqual(['Ti', 'Te', 'Fi']);
    expect(smear.lowerEdge).toEqual(['Ne', 'Se', 'Si']);
  });

  it('licenses each of Ti/Te/Fi as genuinely above Si (13, 10, 9)', () => {
    for (const [above, diff] of [
      ['Ti', 13],
      ['Te', 10],
      ['Fi', 9],
    ] as const) {
      const fact = smear.pairwise.find((p) => p.above === above && p.below === 'Si')!;
      expect(fact.diff).toBe(diff);
      expect(fact.genuinelyAbove).toBe(true);
      expect(fact.hedged).toBe(false);
    }
  });

  it('licenses Ti above Ne and Se (8.6, 9.0) unhedged', () => {
    const tiNe = smear.pairwise.find((p) => p.above === 'Ti' && p.below === 'Ne')!;
    const tiSe = smear.pairwise.find((p) => p.above === 'Ti' && p.below === 'Se')!;
    expect([tiNe.diff, tiSe.diff]).toEqual([8.6, 9.0]);
    expect([tiNe.genuinelyAbove, tiSe.genuinelyAbove]).toEqual([true, true]);
    expect([tiNe.hedged, tiSe.hedged]).toEqual([false, false]);
  });

  it("hedges Te's edge over Ne and Se (5.6, 6.0 - inside the marginal window)", () => {
    const teNe = smear.pairwise.find((p) => p.above === 'Te' && p.below === 'Ne')!;
    const teSe = smear.pairwise.find((p) => p.above === 'Te' && p.below === 'Se')!;
    expect([teNe.diff, teSe.diff]).toEqual([5.6, 6.0]);
    expect([teNe.genuinelyAbove, teSe.genuinelyAbove]).toEqual([true, true]);
    expect([teNe.hedged, teSe.hedged]).toEqual([true, true]);
  });

  it('calls Fi-Ne (4.6) and Fi-Se (5.0) ties', () => {
    const fiNe = smear.pairwise.find((p) => p.above === 'Fi' && p.below === 'Ne')!;
    const fiSe = smear.pairwise.find((p) => p.above === 'Fi' && p.below === 'Se')!;
    expect([fiNe.diff, fiSe.diff]).toEqual([4.6, 5.0]);
    expect([fiNe.tie, fiSe.tie]).toEqual([true, true]);
    expect([fiNe.genuinelyAbove, fiSe.genuinelyAbove]).toEqual([false, false]);
  });

  it('does NOT license Si as strictly below Ne/Se (gaps 4.4 and 4.0)', () => {
    const neSi = smear.pairwise.find((p) => p.above === 'Ne' && p.below === 'Si')!;
    const seSi = smear.pairwise.find((p) => p.above === 'Se' && p.below === 'Si')!;
    expect([neSi.diff, seSi.diff]).toEqual([4.4, 4.0]);
    expect([neSi.genuinelyAbove, seSi.genuinelyAbove]).toEqual([false, false]);
    expect([neSi.tie, seSi.tie]).toEqual([true, true]);
  });
});

describe('02 §5 profile A - step 7: active set', () => {
  it('is {Ni, Ti, Te, Fi} - lead plus T2 upper edge, the lead boundary being marginal', () => {
    expect(sig.activeSet).toEqual(['Ni', 'Ti', 'Te', 'Fi']);
  });

  it('keeps the operative lead a single introverted function', () => {
    expect(sig.operativeLead).toEqual(['Ni']);
    expect(sig.leadAttitudes).toBe('introverted');
    expect(sig.balancedLead).toBe(false);
  });
});

describe('02 §5 profile A - step 8: indices', () => {
  it('sums to 214', () => {
    expect(sig.indices.sums.total).toBe(214);
    expect(sig.indices.sums.E).toBe(89.4);
    expect(sig.indices.sums.I).toBe(124.6);
    expect(sig.indices.sums.J).toBe(103);
    expect(sig.indices.sums.P).toBe(111);
  });

  it('tilts -0.16: strong inward, borderline just past the .15 cutoff', () => {
    expect(sig.indices.tilt.value).toBe(-0.16);
    expect(sig.indices.tilt.class).toBe('strong');
    expect(sig.indices.tilt.direction).toBe('inward');
    expect(sig.indices.tilt.borderline).toBe(true);
  });

  it('reads J/P index -0.04 neutral, and fires NO pressure dynamic (mixed active set)', () => {
    expect(sig.indices.jp.value).toBe(-0.04);
    expect(sig.indices.jp.class).toBe('neutral');
    expect(sig.indices.jp.composition.fires).toBeNull();
    expect(sig.indices.jp.composition.starvedSide).toBeNull();
    expect(sig.indices.jp.composition.judging).toEqual(['Ti', 'Te', 'Fi']);
    expect(sig.indices.jp.composition.perceiving).toEqual(['Ni']);
    // The one licensed hedged note: judging-heavy, 3 J : 1 P.
    expect(sig.indices.jp.composition.note).toBe('judging-heavy active set (3 J : 1 P)');
  });

  it('polarizes Ti-Fe 26 extreme, Ni-Se 14.6 polarized, Ne-Si 4.4 balanced-low, Te-Fi 1.0 balanced-high', () => {
    const expected: Record<AxisKey, { pol: number; cls: string }> = {
      'Ti-Fe': { pol: 26, cls: 'extreme' },
      'Ni-Se': { pol: 14.6, cls: 'polarized' },
      'Ne-Si': { pol: 4.4, cls: 'balanced-low' },
      'Te-Fi': { pol: 1.0, cls: 'balanced-high' },
    };
    for (const [axis, { pol, cls }] of Object.entries(expected) as [
      AxisKey,
      { pol: number; cls: string },
    ][]) {
      expect(sig.indices.axes[axis].pol, axis).toBe(pol);
      expect(sig.indices.axes[axis].class, axis).toBe(cls);
    }
    // Neither polarized axis is borderline: 26 > 24 and 14.6 > 12.
    expect(sig.indices.axes['Ti-Fe'].borderline).toBe(false);
    expect(sig.indices.axes['Ni-Se'].borderline).toBe(false);
    // The balanced pair means are what split high from low against 26.75.
    expect(sig.indices.axes['Ne-Si'].pairMean).toBe(23.2);
    expect(sig.indices.axes['Te-Fi'].pairMean).toBe(30.5);
  });

  it('reads differentiation 31.6 high and elevation 26.75 mid', () => {
    expect(sig.indices.differentiation.value).toBe(31.6);
    expect(sig.indices.differentiation.class).toBe('high');
    expect(sig.indices.elevation.value).toBe(26.75);
    expect(sig.indices.elevation.class).toBe('mid');
    expect(sig.indices.elevation.allHigh).toBe(false);
    expect(sig.indices.elevation.allLow).toBe(false);
  });
});

describe('02 §5 profile A - step 9: shapes fired', () => {
  it('fires exactly S1, S3b, S7, S9 x2, S10, S11, S12', () => {
    expect(sig.shapes.map((s) => s.id).sort()).toEqual(
      ['S1', 'S3b', 'S7', 'S9', 'S9', 'S10', 'S11', 'S12'].sort(),
    );
  });

  it('S1: a MARGINAL spike on Ni (g[0] = 5.6) - hedge it', () => {
    const s1 = one('S1');
    expect(s1.grade).toBe('marginal spike');
    expect(s1.marginal).toBe(true);
    expect(s1.members).toEqual(['Ni']);
  });

  it('S3b: pluralistic sub-cluster {Ti, Te, Fi} at watch-item grade', () => {
    const s3b = one('S3b');
    expect(s3b.members).toEqual(['Ti', 'Te', 'Fi']);
    expect(s3b.marginal).toBe(true);
    expect(s3b.hedged).toBe(true);
    expect(s3b.variant).toBe('support-upper-edge');
  });

  it('does NOT fire S3 - a sub-cluster is never a lead cluster', () => {
    expect(withId('S3')).toHaveLength(0);
  });

  it('S7: cliff floor on Fe, 13 points below Si, FIRM', () => {
    const s7 = one('S7');
    expect(s7.members).toEqual(['Fe']);
    expect(s7.grade).toBe('firm');
    expect(s7.marginal).toBe(false);
    expect(s7.detail.gap).toBe(13);
  });

  it('S9 x2: Ti-Fe extreme first, then Ni-Se polarized', () => {
    const s9s = withId('S9');
    expect(s9s.map((s) => s.axis)).toEqual(['Ti-Fe', 'Ni-Se']);
    expect(s9s.map((s) => s.grade)).toEqual(['extreme', 'polarized']);
  });

  it('S10 on Te-Fi and S11 on Ne-Si', () => {
    expect(one('S10').axis).toBe('Te-Fi');
    expect(one('S11').axis).toBe('Ne-Si');
  });

  it('S12: internal circuit, counterweight Te, strength 8.6, moderate and firm', () => {
    const s12 = one('S12');
    expect(s12.grade).toBe('moderate');
    expect(s12.marginal).toBe(false);

    expect(sig.circuit).not.toBeNull();
    expect(sig.circuit!.kind).toBe('internal');
    expect(sig.circuit!.counterweight).toBe('Te');
    expect(sig.circuit!.counterweightScore).toBe(31);
    expect(sig.circuit!.strength).toBe(8.6);
    expect(sig.circuit!.grade).toBe('moderate');
    // Past the 6-point marginal window, so firm.
    expect(sig.circuit!.marginal).toBe(false);
  });
});

describe('02 §5 profile A - step 10: supply grades (the contract with 04)', () => {
  it('grades Ni flow, Ti/Te/Fi near-flow, Ne/Se/Si scaffolded stretch, Fe friction', () => {
    expect(sig.supplyGrades).toEqual({
      Ni: 'flow',
      Ti: 'near-flow',
      Te: 'near-flow',
      Fi: 'near-flow',
      Ne: 'scaffolded-stretch',
      Se: 'scaffolded-stretch',
      Si: 'scaffolded-stretch',
      Fe: 'friction',
    });
    expect(sig.supplyForks).toEqual({});
  });
});

describe('02 §6 profile A - eruption candidacy', () => {
  it('makes Fe the one firm candidate, with Te as its bridge', () => {
    expect(sig.eruption.firm).toHaveLength(1);
    const fe = sig.eruption.firm[0]!;
    expect(fe.fn).toBe('Fe');
    expect(fe.grade).toBe('firm');
    expect(fe.marginal).toBe(false);
    expect(fe.depth).toBe(13);
    // Prime candidate: its axis partner Ti sits in the upper edge.
    expect(fe.axisPartner).toBe('Ti');
    expect(fe.axisPartnerElevated).toBe(true);
    // The bridge is the strongest function sharing Fe's (extraverted) attitude.
    expect(fe.bridge).toBe('Te');
    expect(fe.bridgeScore).toBe(31);
  });

  it('leaves the watch list empty and the cap unused', () => {
    expect(sig.eruption.watch).toEqual([]);
    expect(sig.eruption.summaryOnly).toEqual([]);
    expect(sig.eruption.capped).toBe(false);
  });
});
