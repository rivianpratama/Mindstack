/**
 * 02 §3: attitude tilt, axis polarization, judging/perceiving pressure,
 * differentiation, elevation.
 *
 * Detection is arithmetic. The classes named here are consumed verbatim by the
 * shape taxonomy (§4) and by 03 §7; nothing is interpreted in this module.
 */

import {
  AXIS_KEYS,
  AXIS_MEMBERS,
  type AxisClass,
  type AxisIndex,
  type AxisKey,
  type DifferentiationClass,
  type DifferentiationIndex,
  type ElevationClass,
  type ElevationIndex,
  EXTRAVERTED_FUNCTIONS,
  type FunctionKey,
  FUNCTION_KEYS,
  type IndexSums,
  type Indices,
  INTROVERTED_FUNCTIONS,
  type JpComposition,
  type JpIndex,
  JUDGING_FUNCTIONS,
  ORIENTATION_OF,
  type Orientation,
  PERCEIVING_FUNCTIONS,
  type ResolvedGeometryOptions,
  type Scores,
  type TiltClass,
  type TiltIndex,
  deriveThresholds,
  isBorderlinePast,
  r1,
  r2,
} from './types';

export interface IndicesInput {
  scores: Scores;
  /** 02 §2 step 7's active set: the J/P composition check runs on this. */
  activeSet: FunctionKey[];
  /** S[0] - S[7], already rounded by the tier pass. */
  spread: number;
  options: ResolvedGeometryOptions;
}

export function computeIndices(input: IndicesInput): Indices {
  const { scores, activeSet, spread, options } = input;
  const t = deriveThresholds(options);

  const sum = (keys: readonly FunctionKey[]): number =>
    r1(keys.reduce((total, fn) => total + scores[fn], 0));

  const sums: IndexSums = {
    total: sum(FUNCTION_KEYS),
    E: sum(EXTRAVERTED_FUNCTIONS),
    I: sum(INTROVERTED_FUNCTIONS),
    J: sum(JUDGING_FUNCTIONS),
    P: sum(PERCEIVING_FUNCTIONS),
  };

  /* Elevation = mean of the eight scores. Needed before the axis pass, which
   * splits balanced axes by pair mean vs. profile mean. */
  const elevationValue = r2(sums.total / FUNCTION_KEYS.length);
  const allHigh = elevationValue >= t.allHigh;
  const allLow = elevationValue <= t.allLow;
  const elevationClass: ElevationClass = allHigh ? 'all-high' : allLow ? 'all-low' : 'mid';
  const elevation: ElevationIndex = {
    value: elevationValue,
    class: elevationClass,
    allHigh,
    allLow,
  };

  /* Attitude tilt = (SigmaE - SigmaI) / SigmaAll, range -1..+1. */
  const tiltValue = sums.total === 0 ? 0 : r2((sums.E - sums.I) / sums.total);
  const tilt: TiltIndex = {
    value: tiltValue,
    class: classifyRatio(tiltValue, t.tiltNeutral, t.tiltMild),
    direction: tiltValue > 0 ? 'outward' : tiltValue < 0 ? 'inward' : 'even',
    borderline: ratioBorderline(tiltValue, t.tiltNeutral, t.tiltMild),
  };

  /* Axis polarization, per opposing pair; the five-way scale of 02 §3. */
  const axisEntries = AXIS_KEYS.map((axis): AxisIndex => {
    const members = AXIS_MEMBERS[axis];
    const [a, b] = members;
    const pol = r1(Math.abs(scores[a] - scores[b]));
    const pairMean = r1((scores[a] + scores[b]) / 2);
    const aboveProfileMean = pairMean >= elevationValue;

    let cls: AxisClass;
    let borderline = false;
    if (pol <= t.balanced) {
      cls = aboveProfileMean ? 'balanced-high' : 'balanced-low';
    } else if (pol <= t.leaning) {
      cls = 'leaning';
      borderline = isBorderlinePast(pol, t.balanced);
    } else if (pol <= t.polarized) {
      cls = 'polarized';
      borderline = isBorderlinePast(pol, t.leaning);
    } else {
      cls = 'extreme';
      borderline = isBorderlinePast(pol, t.polarized);
    }

    return {
      axis,
      members,
      high: scores[a] >= scores[b] ? a : b,
      low: scores[a] >= scores[b] ? b : a,
      pol,
      class: cls,
      borderline,
      pairMean,
      aboveProfileMean,
      tie: pol <= options.B,
    };
  });

  const axes = Object.fromEntries(axisEntries.map((entry) => [entry.axis, entry])) as Record<
    AxisKey,
    AxisIndex
  >;
  const axisOrder = [...axisEntries]
    .sort((a, b) => b.pol - a.pol || AXIS_KEYS.indexOf(a.axis) - AXIS_KEYS.indexOf(b.axis))
    .map((entry) => entry.axis);

  /* Judging/perceiving: the index is context only, the composition check on the
   * active set is the diagnostic (02 §3). */
  const jpValue = sums.total === 0 ? 0 : r2((sums.J - sums.P) / sums.total);
  const jp: JpIndex = {
    value: jpValue,
    class: classifyRatio(jpValue, t.tiltNeutral, t.tiltMild),
    direction: jpValue > 0 ? 'judging' : jpValue < 0 ? 'perceiving' : 'even',
    borderline: ratioBorderline(jpValue, t.tiltNeutral, t.tiltMild),
    composition: composition(activeSet),
  };

  /* Differentiation index = S[0] - S[7]. */
  let diffClass: DifferentiationClass;
  let diffBorderline = false;
  if (spread <= t.flatSpread) {
    diffClass = 'low';
  } else if (spread <= t.moderateSpread) {
    diffClass = 'moderate';
    diffBorderline = isBorderlinePast(spread, t.flatSpread);
  } else {
    diffClass = 'high';
    diffBorderline = isBorderlinePast(spread, t.moderateSpread);
  }
  const differentiation: DifferentiationIndex = {
    value: spread,
    class: diffClass,
    borderline: diffBorderline,
  };

  return { sums, tilt, axes, axisOrder, jp, differentiation, elevation };
}

function classifyRatio(value: number, neutral: number, mild: number): TiltClass {
  const magnitude = Math.abs(value);
  if (magnitude <= neutral) return 'neutral';
  if (magnitude <= mild) return 'mild';
  return 'strong';
}

/** 02 §2.2 mirror rule: within 20% past the cutoff it just cleared. */
function ratioBorderline(value: number, neutral: number, mild: number): boolean {
  const magnitude = Math.abs(value);
  if (magnitude <= neutral) return false;
  if (magnitude <= mild) return isBorderlinePast(magnitude, neutral);
  return isBorderlinePast(magnitude, mild);
}

function composition(activeSet: FunctionKey[]): JpComposition {
  const judging = activeSet.filter((fn) => ORIENTATION_OF[fn] === 'judging');
  const perceiving = activeSet.filter((fn) => ORIENTATION_OF[fn] === 'perceiving');
  const populated = activeSet.length > 0;
  const allJudging = populated && perceiving.length === 0;
  const allPerceiving = populated && judging.length === 0;

  let fires: JpComposition['fires'] = null;
  let starvedSide: Orientation | null = null;
  if (allJudging) {
    fires = 'judging-pressure';
    starvedSide = 'perceiving';
  } else if (allPerceiving) {
    fires = 'perceiving-pressure';
    starvedSide = 'judging';
  }

  /*
   * Mixed active set: no pressure dynamic fires, and at most ONE hedged
   * composition note may be rendered (02 §3).
   */
  let note: string | null = null;
  if (populated && fires === null) {
    const heavier = judging.length >= perceiving.length ? 'judging' : 'perceiving';
    note = `${heavier}-heavy active set (${judging.length} J : ${perceiving.length} P)`;
  }

  return {
    activeSet: [...activeSet],
    judging,
    perceiving,
    allJudging,
    allPerceiving,
    fires,
    starvedSide,
    note,
  };
}
