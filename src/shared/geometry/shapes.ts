/**
 * 02 §4: the thirteen recurring signature shapes, S1-S12 plus S3b.
 *
 * Detection is arithmetic; the hypotheses those shapes carry live in the
 * knowledge base, not here. Multiple shapes can co-fire on one profile, with
 * one exception: S6 (FLAT) takes precedence over all others.
 */

import {
  ATTITUDE_OF,
  type Attitude,
  type Circuit,
  type CircuitGrade,
  type FunctionKey,
  type Indices,
  ORIENTATION_OF,
  type ResolvedGeometryOptions,
  type Scores,
  type Shape,
  type ShapeId,
  AXIS_PARTNER_OF,
  deriveThresholds,
  inputOrder,
  oppositeAttitude,
  r1,
} from './types';
import type { TierAnalysis } from './tiers';

export interface ShapesInput {
  scores: Scores;
  tiers: TierAnalysis;
  indices: Indices;
  options: ResolvedGeometryOptions;
}

export interface ShapesOutput {
  shapes: Shape[];
  circuit: Circuit | null;
  warnings: string[];
}

const NAMES: Record<ShapeId, string> = {
  S1: 'Lead spike',
  S2: 'Twin peak',
  S3: 'Pluralistic lead cluster',
  S3b: 'Pluralistic sub-cluster',
  S4: 'Compressed top',
  S5: 'Staircase',
  S6: 'Flat',
  S7: 'Cliff floor',
  S8: 'Bimodal split',
  S9: 'Polarized axis',
  S10: 'Balanced-high axis',
  S11: 'Balanced-low axis',
  S12: 'Single-attitude lead (circuit candidate)',
};

function shape(id: ShapeId, partial: Partial<Omit<Shape, 'id' | 'name'>> = {}): Shape {
  return {
    id,
    name: NAMES[id],
    grade: partial.grade ?? null,
    marginal: partial.marginal ?? false,
    hedged: partial.hedged ?? false,
    members: partial.members ?? [],
    detail: partial.detail ?? {},
    ...(partial.axis !== undefined ? { axis: partial.axis } : {}),
    ...(partial.variant !== undefined ? { variant: partial.variant } : {}),
  };
}

export function computeShapes(input: ShapesInput): ShapesOutput {
  const { scores, tiers: analysis, indices, options } = input;
  const t = deriveThresholds(options);
  const warnings: string[] = [];

  /*
   * S6 - Flat. "Takes precedence over ALL other shapes; when it holds, no other
   * shape is rendered even if a boundary technically exists" (02 §4 S6).
   */
  if (analysis.regime === 'FLAT') {
    return {
      shapes: [
        shape('S6', {
          hedged: true,
          detail: {
            differentiation: indices.differentiation.value,
            largestGap: analysis.watchItem?.gap ?? null,
            note: 'Weak signal - honest null. No marker is derivable, which is the sentence the report must contain.',
          },
        }),
      ],
      circuit: null,
      warnings,
    };
  }

  /*
   * S5 - Staircase. No tier boundary exists, so the cardinality shapes, the
   * cliff shapes and the circuit all have nothing to read; reporting is
   * extremes-only (02 §4 S5, §2 step 0).
   */
  if (analysis.regime === 'STAIRCASE') {
    const segment = analysis.segments[0];
    return {
      shapes: [
        shape('S5', {
          hedged: true,
          members: segment?.members ?? [],
          detail: {
            differentiation: indices.differentiation.value,
            upperEdge: segment?.upperEdge ?? [],
            lowerEdge: segment?.lowerEdge ?? [],
            note: 'No adjacent rank is real; only upper-vs-lower-edge contrasts are interpretable.',
          },
        }),
      ],
      circuit: null,
      warnings,
    };
  }

  const shapes: Shape[] = [];
  const { tiers, segments, boundaries, leadBoundary, shadowBoundary, operativeLead } = analysis;
  const leadSegment = segments[0];
  const lead = tiers.lead;
  const k = segments.length;

  /*
   * Cardinality shapes S1-S4 read |Lead| off the canonical T1 segment, not the
   * upper edge: the segment rule is canonical for tier lines (02 §2 step 6),
   * and S4's compressed-top signal is a property of the whole segment. Where T1
   * is smeared the shape carries `hedged` and names the operative upper edge.
   */
  const leadHedged = leadSegment.smeared;
  const leadDetail = {
    leadSize: lead.length,
    leadSmeared: leadHedged,
    operativeLead,
  };

  if (lead.length === 1) {
    /* S1 - Lead spike. Grades by g[0]. */
    const g0 = leadBoundary?.gap ?? 0;
    let grade = 'hard spike';
    if (g0 <= t.marginalGap) grade = 'marginal spike';
    else if (g0 <= t.cliff) grade = 'clear spike';
    shapes.push(
      shape('S1', {
        grade,
        marginal: g0 <= t.marginalGap,
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, gap: g0 },
      }),
    );
  } else if (lead.length === 2) {
    /* S2 - Twin peak. Variants: axis partners, same attitude, mixed. */
    const [a, b] = lead as [FunctionKey, FunctionKey];
    const axisPartners = AXIS_PARTNER_OF[a] === b;
    const sameAttitude = ATTITUDE_OF[a] === ATTITUDE_OF[b];
    const variant = axisPartners ? 'axis-partners' : sameAttitude ? 'same-attitude' : 'mixed';
    shapes.push(
      shape('S2', {
        variant,
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, axisPartners, sameAttitude },
      }),
    );
  } else if (lead.length === 3) {
    /* S3 - Pluralistic lead cluster. */
    const allJudging = lead.every((fn) => ORIENTATION_OF[fn] === 'judging');
    shapes.push(
      shape('S3', {
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, allJudging },
      }),
    );
  } else if (lead.length >= 4) {
    /* S4 - Compressed top. */
    shapes.push(
      shape('S4', {
        hedged: leadHedged,
        members: [...lead],
        detail: { ...leadDetail, elevation: indices.elevation.value },
      }),
    );
  }

  /*
   * S3b - Pluralistic sub-cluster: three or more functions mutually within one
   * noise band forming the upper edge of T2 while the lead boundary is MARGINAL,
   * or forming the upper edge of a smeared T1. Watch-item grade, always a fork.
   */
  const subCluster = detectSubCluster(analysis, options.B);
  if (subCluster) {
    shapes.push(
      shape('S3b', {
        grade: 'watch item',
        marginal: true,
        hedged: true,
        members: subCluster.members,
        variant: subCluster.source,
        detail: {
          source: subCluster.source,
          span: subCluster.span,
          note: 'Membership rests on a marginal boundary and edge windows - never call it a lead cluster.',
        },
      }),
    );
  }

  /*
   * S7 - Cliff floor: |Shadow| = 1 and the final gap > 2B (marginal cliff if
   * <= 2.4B).
   */
  if (tiers.shadow.length === 1 && shadowBoundary?.cliff) {
    shapes.push(
      shape('S7', {
        grade: shadowBoundary.marginalCliff ? 'marginal' : 'firm',
        marginal: shadowBoundary.marginalCliff,
        members: [...tiers.shadow],
        detail: {
          gap: shadowBoundary.gap,
          above: shadowBoundary.above,
          note: 'Hold all three hypotheses: suppression, avoidance, simple non-development.',
        },
      }),
    );
  }

  /* S8 - Bimodal split (hollow middle): k = 2 and the single boundary is a cliff. */
  if (k === 2 && boundaries.length === 1 && boundaries[0].cliff) {
    shapes.push(
      shape('S8', {
        grade: boundaries[0].marginalCliff ? 'marginal' : 'firm',
        marginal: boundaries[0].marginalCliff,
        members: [...tiers.lead, ...tiers.shadow],
        detail: {
          gap: boundaries[0].gap,
          highGroup: [...tiers.lead],
          lowGroup: [...tiers.shadow],
          note: 'The entire lower group is the shadow floor; rendered eruption candidates are capped per 02 §6.',
        },
      }),
    );
  }

  /* S9/S10/S11 - the axis shapes, most polarized first (rendering salience). */
  for (const axisKey of indices.axisOrder) {
    const axis = indices.axes[axisKey];
    if (axis.class === 'polarized' || axis.class === 'extreme') {
      shapes.push(
        shape('S9', {
          axis: axisKey,
          grade: axis.class,
          marginal: axis.borderline,
          members: [axis.high, axis.low],
          detail: {
            pol: axis.pol,
            high: axis.high,
            low: axis.low,
            borderline: axis.borderline,
          },
        }),
      );
    } else if (axis.class === 'balanced-high') {
      shapes.push(
        shape('S10', {
          axis: axisKey,
          members: [...axis.members],
          detail: {
            pol: axis.pol,
            pairMean: axis.pairMean,
            profileMean: indices.elevation.value,
            note: 'Behavioural markers adjudicate; a felt sense of being torn decides nothing.',
          },
        }),
      );
    } else if (axis.class === 'balanced-low') {
      shapes.push(
        shape('S11', {
          axis: axisKey,
          members: [...axis.members],
          detail: {
            pol: axis.pol,
            pairMean: axis.pairMean,
            profileMean: indices.elevation.value,
          },
        }),
      );
    }
  }

  /*
   * S12 - Single-attitude lead (circuit candidate). All Lead members (upper
   * edge, if T1 is smeared) share one attitude AND circuit strength > B, where
   * counterweight = the highest-scoring opposite-attitude function and strength
   * = Lead minimum - counterweight score.
   */
  let circuit: Circuit | null = null;
  if (analysis.leadAttitudes !== 'mixed' && analysis.leadAttitudes !== null) {
    const leadAttitude: Attitude = analysis.leadAttitudes;
    const counterweight = highestOfAttitude(scores, oppositeAttitude(leadAttitude));
    const leadMinimum = Math.min(...operativeLead.map((fn) => scores[fn]));
    const strength = r1(leadMinimum - scores[counterweight]);

    if (strength > t.circuit) {
      const grade: CircuitGrade = strength <= t.sealedCircuit ? 'moderate' : 'sealed';
      const marginal = strength <= t.marginalCircuit;
      circuit = {
        kind: leadAttitude === 'introverted' ? 'internal' : 'external',
        leadAttitude,
        lead: [...operativeLead],
        counterweight,
        counterweightScore: scores[counterweight],
        leadMinimum,
        strength,
        grade,
        marginal,
        fromSmearedLead: leadHedged,
      };
      shapes.push(
        shape('S12', {
          grade,
          marginal,
          hedged: leadHedged,
          members: [...operativeLead],
          variant: circuit.kind,
          detail: {
            kind: circuit.kind,
            leadAttitude,
            counterweight,
            counterweightScore: circuit.counterweightScore,
            leadMinimum,
            strength,
          },
        }),
      );
    } else {
      /* 02 §4 S12: strength <= B fires no circuit; one clause at most. */
      warnings.push(
        `Attitude-uniform lead (${leadAttitude}) but circuit strength ${strength} does not ` +
          `exceed B: no circuit fires. At most one clause may note the uniform attitude.`,
      );
    }
  } else if (analysis.balancedLead) {
    warnings.push(
      'Lead carries both attitudes: the balanced-lead dynamic applies (03 §3), ' +
        'mutually exclusive with a circuit reading.',
    );
  }

  return { shapes, circuit, warnings };
}

interface SubCluster {
  members: FunctionKey[];
  span: number;
  source: 'support-upper-edge' | 'smeared-lead-upper-edge';
}

function detectSubCluster(analysis: TierAnalysis, B: number): SubCluster | null {
  const leadSegment = analysis.segments[0];

  // Branch two: the upper edge of a smeared T1.
  if (leadSegment?.smeared && leadSegment.upperEdge.length >= 3) {
    const span = edgeSpan(leadSegment.upperEdge, analysis);
    if (span <= B) {
      return { members: [...leadSegment.upperEdge], span, source: 'smeared-lead-upper-edge' };
    }
  }

  // Branch one: the upper edge of T2 while the lead boundary is MARGINAL.
  const support = analysis.segments[1];
  if (analysis.leadBoundary?.marginal && support && support.upperEdge.length >= 3) {
    const span = edgeSpan(support.upperEdge, analysis);
    if (span <= B) {
      return { members: [...support.upperEdge], span, source: 'support-upper-edge' };
    }
  }

  return null;
}

function edgeSpan(members: FunctionKey[], analysis: TierAnalysis): number {
  const scoreOf = new Map(analysis.sorted.map((entry) => [entry.fn, entry.score]));
  const values = members.map((fn) => scoreOf.get(fn) ?? 0);
  return r1(Math.max(...values) - Math.min(...values));
}

/** Highest-scoring function of an attitude; exact ties fall back to input order. */
function highestOfAttitude(scores: Scores, attitude: Attitude): FunctionKey {
  const order = inputOrder(scores);
  const candidates = order.filter((fn) => ATTITUDE_OF[fn] === attitude);
  return candidates.reduce((best, fn) => (scores[fn] > scores[best] ? fn : best), candidates[0]);
}

/** Exported for the eruption pass: the strongest same-attitude function. */
export function strongestSharingAttitude(
  scores: Scores,
  fn: FunctionKey,
): { fn: FunctionKey; score: number } | null {
  const attitude = ATTITUDE_OF[fn];
  const order = inputOrder(scores).filter(
    (candidate) => candidate !== fn && ATTITUDE_OF[candidate] === attitude,
  );
  if (order.length === 0) return null;
  const best = order.reduce(
    (winner, candidate) => (scores[candidate] > scores[winner] ? candidate : winner),
    order[0],
  );
  return { fn: best, score: scores[best] };
}

/**
 * Every shape id, for callers that key fragments or render plans by shape
 * (the KB's `shapes.{S1..S12,S3b}` namespace).
 */
export const SHAPE_IDS = Object.keys(NAMES) as ShapeId[];
