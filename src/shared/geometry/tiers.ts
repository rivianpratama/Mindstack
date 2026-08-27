/**
 * 02 §2: regime check -> sort -> gaps -> boundaries -> segments -> smear ->
 * active set. Arithmetic only; no interpretation, no shape names.
 */

import {
  ATTITUDE_OF,
  type Attitude,
  type Boundary,
  type BoundaryClass,
  type FunctionKey,
  type GapReading,
  type LeadAttitudes,
  type Regime,
  type ResolvedGeometryOptions,
  type Scores,
  type Segment,
  type Smear,
  type SortedEntry,
  type PairwiseFact,
  type TierName,
  type Tiers,
  type WatchItem,
  deriveThresholds,
  inputOrder,
  r1,
} from './types';

export interface TierAnalysis {
  regime: Regime;
  sorted: SortedEntry[];
  gaps: GapReading[];
  boundaries: Boundary[];
  segments: Segment[];
  tiers: Tiers;
  tierOf: Record<FunctionKey, TierName | null>;
  smears: Smear[];
  activeSet: FunctionKey[];
  operativeLead: FunctionKey[];
  leadAttitudes: LeadAttitudes;
  balancedLead: boolean;
  /** The cut immediately below the lead cluster, if any. */
  leadBoundary: Boundary | null;
  /** The cut immediately above the shadow floor, if any. */
  shadowBoundary: Boundary | null;
  /** Lead cluster plus every smeared segment's upper edge (02 §6 priority a). */
  elevatedSet: FunctionKey[];
  watchItem: WatchItem | null;
  /** S[0] - S[7]; also the differentiation index (02 §3). */
  spread: number;
  warnings: string[];
}

export function analyzeTiers(scores: Scores, options: ResolvedGeometryOptions): TierAnalysis {
  const t = deriveThresholds(options);
  const B = options.B;
  const warnings: string[] = [];

  /* 1. SORT descending. Exact ties keep input order (02 §2 step 1). */
  const order = inputOrder(scores);
  const ranked = order
    .map((fn, inputIndex) => ({ fn, score: scores[fn], inputIndex }))
    .sort((a, b) => b.score - a.score || a.inputIndex - b.inputIndex);

  const sorted: SortedEntry[] = ranked.map((entry, i) => {
    const prev = i > 0 ? ranked[i - 1] : null;
    return {
      fn: entry.fn,
      score: entry.score,
      rank: i,
      tiedWithPrev: prev !== null && prev.score === entry.score,
      noiseTieWithPrev: prev !== null && r1(prev.score - entry.score) <= B,
    };
  });

  /* 2. GAPS: g[i] = S[i] - S[i+1] (02 §2 step 2). */
  const gaps: GapReading[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    gaps.push({
      index: i,
      above: sorted[i].fn,
      below: sorted[i + 1].fn,
      value: r1(sorted[i].score - sorted[i + 1].score),
    });
  }

  const spread = r1(sorted[0].score - sorted[sorted.length - 1].score);

  /* 0. REGIME CHECK, before any tier is asserted (02 §2 step 0). */
  const anyCut = gaps.some((gap) => gap.value > t.gap);
  let regime: Regime = 'NORMAL';
  if (spread <= t.flatSpread) regime = 'FLAT';
  else if (!anyCut) regime = 'STAIRCASE';

  /*
   * NEAR-FLAT low-confidence zone (02 §2 step 0): the profile clears the honest-null
   * gate but its whole spread still fits inside two noise bands. The reading proceeds,
   * carrying a warning the prompt ships to the model verbatim.
   */
  if (regime !== 'FLAT' && spread <= t.lowSpread) {
    warnings.push(
      `NEAR-FLAT: spread ${spread} is at most two noise bands (<= ${t.lowSpread}). Every ` +
        "reading here rests on differences close to the quiz's noise floor, so the whole " +
        'report is low-confidence: say so plainly near the start, hedge every claim, and ' +
        'expect a retake to reshuffle the order.',
    );
  }

  const emptyTiers: Tiers = { lead: [], support: [], reserve: [], shadow: [] };
  const noTierOf = Object.fromEntries(order.map((fn) => [fn, null])) as Record<
    FunctionKey,
    TierName | null
  >;

  if (regime === 'FLAT') {
    /*
     * Honest null. No tiers are asserted even though a boundary may
     * technically exist; the single largest gap may be named only as a
     * tentative watch item (02 §2 step 0, §4 S6).
     */
    const largest = gaps.reduce((best, gap) => (gap.value > best.value ? gap : best), gaps[0]);
    warnings.push(
      `FLAT regime: the whole profile fits inside one noise band (spread ${spread} <= ${t.flatSpread}). ` +
        'No tiers asserted; weak signal must be stated plainly rather than interpreted.',
    );
    return {
      regime,
      sorted,
      gaps,
      boundaries: [],
      segments: [],
      tiers: emptyTiers,
      tierOf: noTierOf,
      smears: [],
      activeSet: [],
      operativeLead: [],
      leadAttitudes: null,
      balancedLead: false,
      leadBoundary: null,
      shadowBoundary: null,
      elevatedSet: [],
      watchItem: {
        above: largest.above,
        below: largest.below,
        gap: largest.value,
        note: 'Largest gap in a FLAT profile: a tentative watch item, not a tier boundary.',
      },
      spread,
      warnings,
    };
  }

  if (regime === 'STAIRCASE') {
    /*
     * One segment, no tier boundaries; only upper-vs-lower-edge contrasts are
     * interpretable (02 §2 step 0, §4 S5).
     */
    const segment = makeSegment(0, sorted, null, B);
    warnings.push(
      'STAIRCASE regime: no adjacent gap exceeds the noise band, so no tier boundary exists. ' +
        'Only upper-edge vs lower-edge contrasts are interpretable (extremes-only reporting).',
    );
    return {
      regime,
      sorted,
      gaps,
      boundaries: [],
      segments: [segment],
      tiers: emptyTiers,
      tierOf: noTierOf,
      smears: [toSmear(segment, sorted, B)],
      activeSet: [],
      operativeLead: [],
      leadAttitudes: null,
      balancedLead: false,
      leadBoundary: null,
      shadowBoundary: null,
      elevatedSet: [],
      watchItem: null,
      spread,
      warnings,
    };
  }

  /* 3. BOUNDARIES: cut after position i wherever g[i] > B (02 §2 step 3). */
  const boundaries: Boundary[] = gaps
    .filter((gap) => gap.value > t.gap)
    .map((gap) => {
      const cliff = gap.value > t.cliff;
      const marginalCliff = cliff && gap.value <= t.marginalCliff;
      const marginal = gap.value <= t.marginalGap;
      let cls: BoundaryClass;
      if (cliff) cls = marginalCliff ? 'marginal-cliff' : 'firm-cliff';
      else cls = marginal ? 'marginal-gap' : 'firm-gap';
      return {
        index: gap.index,
        above: gap.above,
        below: gap.below,
        gap: gap.value,
        strength: r1(gap.value - t.gap),
        marginal,
        cliff,
        marginalCliff,
        class: cls,
      };
    });

  /* 4. SEGMENTS: split the sorted list at the cuts (02 §2 step 4). */
  const cutAfter = new Set(boundaries.map((b) => b.index));
  const rawSegments: SortedEntry[][] = [];
  let current: SortedEntry[] = [];
  sorted.forEach((entry, i) => {
    current.push(entry);
    if (cutAfter.has(i) || i === sorted.length - 1) {
      rawSegments.push(current);
      current = [];
    }
  });

  /* 5. TIERS (02 §2 step 5). */
  const k = rawSegments.length;
  const segments = rawSegments.map((members, i) =>
    makeSegment(i, members, tierNameForSegment(i, k), B),
  );

  const tiers: Tiers = {
    lead: segments[0].members,
    support: k >= 3 ? segments[1].members : [],
    reserve: k >= 4 ? segments.slice(2, k - 1).flatMap((s) => s.members) : [],
    shadow: k >= 2 ? segments[k - 1].members : [],
  };

  const tierOf = { ...noTierOf };
  for (const segment of segments) {
    for (const fn of segment.members) tierOf[fn] = segment.tier;
  }

  /* 6. SMEAR CHECK (02 §2 step 6). */
  const smears = segments
    .filter((segment) => segment.smeared)
    .map((segment) => toSmear(segment, sorted, B));

  for (const smear of smears) {
    warnings.push(
      `Smeared ${smear.tier ?? 'segment'} (span ${smear.span} > B): chained near-ties, ` +
        'no clean internal cut. Only the pairwise rule and edge windows are licensed.',
    );
  }

  /* 7. ACTIVE SET (02 §2 step 7). */
  const leadBoundary = boundaries.length > 0 ? boundaries[0] : null;
  const activeSet = [...tiers.lead];
  if (leadBoundary?.marginal && segments.length > 1) {
    for (const fn of segments[1].upperEdge) {
      if (!activeSet.includes(fn)) activeSet.push(fn);
    }
  }

  /* A smeared T1's operative Lead reading is its upper edge (02 §2 step 6). */
  const leadSegment = segments[0];
  const operativeLead = leadSegment.smeared ? leadSegment.upperEdge : leadSegment.members;
  if (leadSegment.smeared) {
    warnings.push(
      'Lead cluster is smeared: the operative Lead reading is its upper edge ' +
        `(${leadSegment.upperEdge.join(', ')}); the report must hedge accordingly.`,
    );
  }

  const leadAttitudeSet = new Set<Attitude>(operativeLead.map((fn) => ATTITUDE_OF[fn]));
  const leadAttitudes: LeadAttitudes =
    leadAttitudeSet.size === 1 ? [...leadAttitudeSet][0] : 'mixed';
  const balancedLead = leadAttitudeSet.size > 1;

  /*
   * 02 §6 priority (a) reads "Lead cluster or upper edge". The upper edges that
   * exist are those of smeared segments, so the elevated set is the lead plus
   * every smeared segment's upper edge.
   */
  const elevatedSet = [...tiers.lead];
  for (const smear of smears) {
    for (const fn of smear.upperEdge) {
      if (!elevatedSet.includes(fn)) elevatedSet.push(fn);
    }
  }

  const shadowBoundary = boundaries.length > 0 ? boundaries[boundaries.length - 1] : null;

  if (boundaries.filter((b) => b.cliff).length >= 2) {
    warnings.push(
      'Multiple cliffs: a stratified profile. Each cliff is a separate interpretable ' +
        'feature; never rank functions inside any tier (02 §6).',
    );
  }

  return {
    regime,
    sorted,
    gaps,
    boundaries,
    segments,
    tiers,
    tierOf,
    smears,
    activeSet,
    operativeLead,
    leadAttitudes,
    balancedLead,
    leadBoundary,
    shadowBoundary,
    elevatedSet,
    watchItem: null,
    spread,
    warnings,
  };
}

function tierNameForSegment(index: number, k: number): TierName | null {
  if (index === 0) return 'lead';
  if (index === k - 1) return 'shadow';
  // Support band = T2 (if k >= 3); Reserve band = T3..T(k-1), merged (if k >= 4).
  if (index === 1) return 'support';
  return 'reserve';
}

function makeSegment(
  index: number,
  members: SortedEntry[],
  tier: TierName | null,
  B: number,
): Segment {
  const scores = members.map((m) => m.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const span = r1(max - min);
  return {
    index,
    tier,
    members: members.map((m) => m.fn),
    max,
    min,
    span,
    smeared: span > B,
    // Edge windows are defined inside a smeared segment (02 §2 step 6). In an
    // unsmeared segment every member is within B of both ends, so both windows
    // are the whole segment - which is what step 7 needs of an unsmeared T2.
    upperEdge: members.filter((m) => r1(max - m.score) <= B).map((m) => m.fn),
    lowerEdge: members.filter((m) => r1(m.score - min) <= B).map((m) => m.fn),
  };
}

function toSmear(segment: Segment, sorted: SortedEntry[], B: number): Smear {
  const scoreOf = new Map(sorted.map((entry) => [entry.fn, entry.score]));
  const pairwise: PairwiseFact[] = [];
  for (let i = 0; i < segment.members.length; i += 1) {
    for (let j = i + 1; j < segment.members.length; j += 1) {
      const above = segment.members[i];
      const below = segment.members[j];
      const diff = r1((scoreOf.get(above) ?? 0) - (scoreOf.get(below) ?? 0));
      const genuinelyAbove = diff > B;
      pairwise.push({
        above,
        below,
        diff,
        genuinelyAbove,
        hedged: genuinelyAbove && diff <= r1(B * 1.2),
        tie: diff <= B,
      });
    }
  }
  return {
    tier: segment.tier,
    segmentIndex: segment.index,
    members: segment.members,
    span: segment.span,
    upperEdge: segment.upperEdge,
    lowerEdge: segment.lowerEdge,
    pairwise,
  };
}
