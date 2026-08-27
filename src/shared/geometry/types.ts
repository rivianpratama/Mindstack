/**
 * Shared vocabulary for the measurement layer.
 *
 * Spec: docs/knowledge/02-profile-geometry.md ("02"), the sole owner of every
 * geometric term and threshold in the knowledge base. Nothing in this module
 * interprets; it only names and measures.
 *
 * Every threshold below derives from the noise band B (02 §1), so changing B
 * re-derives the whole geometry consistently.
 */

/* ------------------------------------------------------------------ *
 * Functions, attitudes, axes (02 §1, §3)
 * ------------------------------------------------------------------ */

/** Canonical order, as listed in 02 §1. Used as the deterministic fallback. */
export const FUNCTION_KEYS = ['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'] as const;

export type FunctionKey = (typeof FUNCTION_KEYS)[number];
export type Scores = Record<FunctionKey, number>;

export type Attitude = 'introverted' | 'extraverted';
export type Orientation = 'judging' | 'perceiving';

/** 02 §3: E = {Ne, Se, Te, Fe}, I = {Ni, Si, Ti, Fi}. */
export const ATTITUDE_OF: Readonly<Record<FunctionKey, Attitude>> = {
  Ni: 'introverted',
  Si: 'introverted',
  Ti: 'introverted',
  Fi: 'introverted',
  Ne: 'extraverted',
  Se: 'extraverted',
  Te: 'extraverted',
  Fe: 'extraverted',
};

/** 02 §3: J = {Ti, Te, Fi, Fe}, P = {Ni, Ne, Si, Se}. */
export const ORIENTATION_OF: Readonly<Record<FunctionKey, Orientation>> = {
  Ni: 'perceiving',
  Ne: 'perceiving',
  Si: 'perceiving',
  Se: 'perceiving',
  Ti: 'judging',
  Te: 'judging',
  Fi: 'judging',
  Fe: 'judging',
};

export const EXTRAVERTED_FUNCTIONS: readonly FunctionKey[] = ['Ne', 'Se', 'Te', 'Fe'];
export const INTROVERTED_FUNCTIONS: readonly FunctionKey[] = ['Ni', 'Si', 'Ti', 'Fi'];
export const JUDGING_FUNCTIONS: readonly FunctionKey[] = ['Ti', 'Te', 'Fi', 'Fe'];
export const PERCEIVING_FUNCTIONS: readonly FunctionKey[] = ['Ni', 'Ne', 'Si', 'Se'];

/** The four opposing pairs of 02 §3, in the order that section lists them. */
export const AXIS_KEYS = ['Ni-Se', 'Ne-Si', 'Ti-Fe', 'Te-Fi'] as const;
export type AxisKey = (typeof AXIS_KEYS)[number];

export const AXIS_MEMBERS: Readonly<Record<AxisKey, readonly [FunctionKey, FunctionKey]>> = {
  'Ni-Se': ['Ni', 'Se'],
  'Ne-Si': ['Ne', 'Si'],
  'Ti-Fe': ['Ti', 'Fe'],
  'Te-Fi': ['Te', 'Fi'],
};

export const AXIS_OF: Readonly<Record<FunctionKey, AxisKey>> = {
  Ni: 'Ni-Se',
  Se: 'Ni-Se',
  Ne: 'Ne-Si',
  Si: 'Ne-Si',
  Ti: 'Ti-Fe',
  Fe: 'Ti-Fe',
  Te: 'Te-Fi',
  Fi: 'Te-Fi',
};

export const AXIS_PARTNER_OF: Readonly<Record<FunctionKey, FunctionKey>> = {
  Ni: 'Se',
  Se: 'Ni',
  Ne: 'Si',
  Si: 'Ne',
  Ti: 'Fe',
  Fe: 'Ti',
  Te: 'Fi',
  Fi: 'Te',
};

export const oppositeAttitude = (attitude: Attitude): Attitude =>
  attitude === 'introverted' ? 'extraverted' : 'introverted';

/* ------------------------------------------------------------------ *
 * Options and thresholds (02 §1, §2, §2.2, §3, §6)
 * ------------------------------------------------------------------ */

/** 02 §1: B = 5 points, default; a stipulated resolution limit, configurable. */
export const DEFAULT_B = 5;

/** 02 §1: scores are roughly 0-50 (the Sakinorva functions test). */
export const DEFAULT_SCALE_MAX = 50;

/** 02 §2.2: "exceeds its threshold by no more than 20% of that threshold". */
export const MARGIN_FACTOR = 1.2;

export interface GeometryOptions {
  /** Noise band. 02 §1 default: 5. */
  B?: number;
  /** Top of the input scale. 02 §1 default: 50. */
  scaleMax?: number;
}

export interface ResolvedGeometryOptions {
  B: number;
  scaleMax: number;
}

export function resolveOptions(opts?: GeometryOptions): ResolvedGeometryOptions {
  const B = opts?.B ?? DEFAULT_B;
  const scaleMax = opts?.scaleMax ?? DEFAULT_SCALE_MAX;
  if (!Number.isFinite(B) || B <= 0) {
    throw new RangeError(`geometry: B must be a positive finite number (received ${String(B)})`);
  }
  if (!Number.isFinite(scaleMax) || scaleMax <= 0) {
    throw new RangeError(
      `geometry: scaleMax must be a positive finite number (received ${String(scaleMax)})`,
    );
  }
  return { B, scaleMax };
}

/**
 * Every number the classifiers compare against, all derived from B.
 * 02 §2 (gap > B, cliff > 2B), §2.2 (marginal = +20%), §3 (index cutoffs),
 * §6 (all-high / all-low elevation edges).
 */
export interface Thresholds {
  B: number;
  scaleMax: number;
  /** A cut exists where the gap exceeds this (02 §2 step 3). */
  gap: number;
  /** Gaps at or below this are marginal (02 §2.2: 5 < g <= 6 at B = 5). */
  marginalGap: number;
  /** A cliff is a gap above this (02 §2 step 3). */
  cliff: number;
  /** Cliffs at or below this are marginal cliffs (02 §2.2: 10 < g <= 12). */
  marginalCliff: number;
  /** Axis polarization: balanced at or below B (02 §3). */
  balanced: number;
  /** Axis polarization: leaning up to 2B. */
  leaning: number;
  /** Axis polarization: polarized up to 4B; extreme above. */
  polarized: number;
  /** Spread at or below this is the FLAT regime: the whole profile fits inside one noise band (02 §2 step 0). */
  flatSpread: number;
  /** Differentiation: low at or below 2B — the NEAR-FLAT low-confidence zone above flatSpread. */
  lowSpread: number;
  /** Differentiation: moderate at or below 4B; high above. */
  moderateSpread: number;
  /** Circuit strength must exceed this to fire (02 §4 S12). */
  circuit: number;
  /** Circuit strength above this is strong (sealed). */
  sealedCircuit: number;
  /** Circuit strength at or below this is a marginal read (02 §2.2). */
  marginalCircuit: number;
  /** Attitude tilt / J-P index: |v| at or below this is neutral (02 §3). */
  tiltNeutral: number;
  /** Attitude tilt / J-P index: |v| at or below this is mild; above is strong. */
  tiltMild: number;
  /** Elevation at or above this is the all-high edge case (02 §6). */
  allHigh: number;
  /** Elevation at or below this is the all-low edge case (02 §6). */
  allLow: number;
}

export function deriveThresholds(options: ResolvedGeometryOptions): Thresholds {
  const { B, scaleMax } = options;
  return {
    B,
    scaleMax,
    gap: B,
    marginalGap: marginOf(B),
    cliff: 2 * B,
    marginalCliff: marginOf(2 * B),
    balanced: B,
    leaning: 2 * B,
    polarized: 4 * B,
    // FLAT only when differences the noise band could fully erase are all there is.
    // The former 2B gate was relaxed (02 §2 step 0): spreads in (B, 2B] now generate,
    // carrying the NEAR-FLAT low-confidence warning instead of the honest null.
    flatSpread: B,
    lowSpread: 2 * B,
    moderateSpread: 4 * B,
    circuit: B,
    sealedCircuit: 2 * B,
    marginalCircuit: marginOf(B),
    // 02 §3 cutoffs are stated on the -1..+1 ratio scale, independent of B.
    tiltNeutral: 0.05,
    tiltMild: 0.15,
    // 02 §6: 37.5 and 12.5 on a 0-50 scale = the upper/lower quarter.
    allHigh: 0.75 * scaleMax,
    allLow: 0.25 * scaleMax,
  };
}

/* ------------------------------------------------------------------ *
 * Numeric discipline
 * ------------------------------------------------------------------ */

/**
 * Round half-away-from-zero, with a nudge that absorbs binary-float artifacts
 * (39.6 - 34 is 5.600000000000001 in IEEE-754).
 *
 * Every derived quantity - gap, span, polarization, circuit strength - is
 * rounded before it is classified, so a 13.0 vs 12 comparison is decided by
 * the decimal the spec wrote down, never by representation noise.
 */
export function roundTo(value: number, dp: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** dp;
  const scaled = value * factor;
  const nudge = Math.abs(scaled) * Number.EPSILON * 8 + 1e-9;
  const rounded = scaled >= 0 ? Math.round(scaled + nudge) : -Math.round(-scaled + nudge);
  return rounded / factor;
}

/** Point quantities on the 0-50 scale: gaps, spans, polarizations, strengths. */
export const r1 = (value: number): number => roundTo(value, 1);

/** Ratio quantities: attitude tilt, J/P index, elevation. */
export const r2 = (value: number): number => roundTo(value, 2);

/** The marginal window's upper edge for a threshold (02 §2.2). */
export const marginOf = (threshold: number): number => roundTo(threshold * MARGIN_FACTOR, 6);

/**
 * 02 §2.2 mirror rule for index cutoffs: a value within 20% past its cutoff
 * carries a "borderline" qualifier.
 */
export function isBorderlinePast(value: number, cutoff: number): boolean {
  return value > cutoff && value <= marginOf(cutoff);
}

/**
 * The order in which equal scores are listed (02 §2 step 1: "exact ties keep
 * input order"). Honours the caller's key order, then fills in anything absent
 * from the canonical 02 §1 order.
 */
export function inputOrder(scores: Scores): FunctionKey[] {
  const known = new Set<string>(FUNCTION_KEYS);
  const seen = new Set<FunctionKey>();
  const order: FunctionKey[] = [];
  for (const key of Object.keys(scores)) {
    if (known.has(key) && !seen.has(key as FunctionKey)) {
      seen.add(key as FunctionKey);
      order.push(key as FunctionKey);
    }
  }
  for (const key of FUNCTION_KEYS) {
    if (!seen.has(key)) order.push(key);
  }
  return order;
}

/* ------------------------------------------------------------------ *
 * Tier structures (02 §2)
 * ------------------------------------------------------------------ */

export type Regime = 'FLAT' | 'STAIRCASE' | 'NORMAL';
export type TierName = 'lead' | 'support' | 'reserve' | 'shadow';

export interface SortedEntry {
  fn: FunctionKey;
  score: number;
  /** 0-based position in the descending sort. Never verbalized as rank. */
  rank: number;
  /** Exactly equal to the entry above (02 §2 step 1: "marked tied"). */
  tiedWithPrev: boolean;
  /** Within B of the entry above - a tie under 02 §1's hard tie rule. */
  noiseTieWithPrev: boolean;
}

export interface GapReading {
  /** g[index] = S[index] - S[index + 1] (02 §2 step 2). */
  index: number;
  above: FunctionKey;
  below: FunctionKey;
  value: number;
}

export type BoundaryClass = 'marginal-gap' | 'firm-gap' | 'marginal-cliff' | 'firm-cliff';

export interface Boundary {
  /** The cut sits after sorted position `index` (02 §2 step 3). */
  index: number;
  above: FunctionKey;
  below: FunctionKey;
  gap: number;
  /** g - B, descriptive only (02 §2 step 3). */
  strength: number;
  /** g <= 1.2B: inside the marginal window (02 §2.2). */
  marginal: boolean;
  /** g > 2B. */
  cliff: boolean;
  /** A cliff inside the 2B-2.4B window (02 §2.2). */
  marginalCliff: boolean;
  class: BoundaryClass;
}

export interface PairwiseFact {
  above: FunctionKey;
  below: FunctionKey;
  diff: number;
  /** 02 §2 step 6: X genuinely above Y iff s[X] - s[Y] > B. */
  genuinelyAbove: boolean;
  /** Licensed but inside the marginal window (5 < d <= 6) - hedge it. */
  hedged: boolean;
  /** Within B: a tie. Order must never be verbalized as rank (02 §1). */
  tie: boolean;
}

export interface Segment {
  /** 0-based segment index; T1 is 0 (02 §2 step 4). */
  index: number;
  tier: TierName | null;
  members: FunctionKey[];
  max: number;
  min: number;
  span: number;
  /** Internal span > B (02 §2 step 6). */
  smeared: boolean;
  /** Members within B of the segment max. */
  upperEdge: FunctionKey[];
  /** Members within B of the segment min. Windows may overlap. */
  lowerEdge: FunctionKey[];
}

export interface Smear {
  tier: TierName | null;
  segmentIndex: number;
  members: FunctionKey[];
  span: number;
  upperEdge: FunctionKey[];
  lowerEdge: FunctionKey[];
  /** Which internal comparisons the noise band licenses (02 §2 step 6). */
  pairwise: PairwiseFact[];
}

export interface Tiers {
  lead: FunctionKey[];
  support: FunctionKey[];
  reserve: FunctionKey[];
  shadow: FunctionKey[];
}

/** The single largest gap, the only structure a FLAT profile may name (02 §2 step 0). */
export interface WatchItem {
  above: FunctionKey;
  below: FunctionKey;
  gap: number;
  note: string;
}

export type LeadAttitudes = Attitude | 'mixed' | null;

/* ------------------------------------------------------------------ *
 * Indices (02 §3)
 * ------------------------------------------------------------------ */

export type TiltClass = 'neutral' | 'mild' | 'strong';
export type TiltDirection = 'inward' | 'outward' | 'even';

export interface TiltIndex {
  value: number;
  class: TiltClass;
  direction: TiltDirection;
  borderline: boolean;
}

export type AxisClass = 'balanced-high' | 'balanced-low' | 'leaning' | 'polarized' | 'extreme';

export interface AxisIndex {
  axis: AxisKey;
  members: readonly [FunctionKey, FunctionKey];
  high: FunctionKey;
  low: FunctionKey;
  /** pol = |a - b| (02 §3). */
  pol: number;
  class: AxisClass;
  borderline: boolean;
  pairMean: number;
  /** Whether the pair mean sits at or above the profile mean (02 §3). */
  aboveProfileMean: boolean;
  /** The two poles are within B - order is uninterpretable (02 §1). */
  tie: boolean;
}

export type JpPressure = 'judging-pressure' | 'perceiving-pressure' | null;

export interface JpComposition {
  activeSet: FunctionKey[];
  judging: FunctionKey[];
  perceiving: FunctionKey[];
  allJudging: boolean;
  allPerceiving: boolean;
  /** The diagnostic (02 §3): fires only on a uniform active set. */
  fires: JpPressure;
  /** Which side goes hungry when a pressure fires; null when nothing fires. */
  starvedSide: Orientation | null;
  /** The one licensed hedged note when the active set is mixed. */
  note: string | null;
}

export interface JpIndex {
  /** Context only; the diagnostic is `composition` (02 §3). */
  value: number;
  class: TiltClass;
  direction: Orientation | 'even';
  borderline: boolean;
  composition: JpComposition;
}

export type DifferentiationClass = 'low' | 'moderate' | 'high';

export interface DifferentiationIndex {
  value: number;
  class: DifferentiationClass;
  borderline: boolean;
}

export type ElevationClass = 'all-low' | 'mid' | 'all-high';

export interface ElevationIndex {
  /** Mean of the eight scores. Never an ability, health or development claim. */
  value: number;
  class: ElevationClass;
  allHigh: boolean;
  allLow: boolean;
}

export interface IndexSums {
  total: number;
  E: number;
  I: number;
  J: number;
  P: number;
}

export interface Indices {
  sums: IndexSums;
  tilt: TiltIndex;
  axes: Record<AxisKey, AxisIndex>;
  /** The same axis readings, most polarized first (rendering salience). */
  axisOrder: AxisKey[];
  jp: JpIndex;
  differentiation: DifferentiationIndex;
  elevation: ElevationIndex;
}

/* ------------------------------------------------------------------ *
 * Shapes and circuit (02 §4)
 * ------------------------------------------------------------------ */

export type ShapeId =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S3b'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'
  | 'S9'
  | 'S10'
  | 'S11'
  | 'S12';

export type ShapeDetail = Record<string, string | number | boolean | null | FunctionKey[]>;

export interface Shape {
  id: ShapeId;
  name: string;
  /** The grade named by 02 §4 for this shape, or null where it grades none. */
  grade: string | null;
  /** Inside the detection's marginal window (02 §2.2) - render as a fork. */
  marginal: boolean;
  /**
   * Structurally hedged for a reason other than the marginal window: the
   * reading rests on a smear or an edge window (02 §2 step 6, §4 S3b).
   */
  hedged: boolean;
  members: FunctionKey[];
  axis?: AxisKey;
  variant?: string;
  detail: ShapeDetail;
}

export type CircuitKind = 'internal' | 'external';
export type CircuitGrade = 'moderate' | 'sealed';

export interface Circuit {
  kind: CircuitKind;
  leadAttitude: Attitude;
  /** The lead members the reading rests on (upper edge if T1 is smeared). */
  lead: FunctionKey[];
  /** Highest-scoring opposite-attitude function (02 §4 S12). */
  counterweight: FunctionKey;
  counterweightScore: number;
  leadMinimum: number;
  /** Lead minimum - counterweight score. Fires only above B. */
  strength: number;
  grade: CircuitGrade;
  marginal: boolean;
  /** True when the lead was read off a smeared T1's upper edge. */
  fromSmearedLead: boolean;
}

/* ------------------------------------------------------------------ *
 * Eruption candidacy (02 §6)
 * ------------------------------------------------------------------ */

export type EruptionGrade = 'firm' | 'watch';

export interface EruptionCandidate {
  fn: FunctionKey;
  /** firm = below a cliff; watch = below a gap that is not a cliff (02 §6). */
  grade: EruptionGrade;
  /** A firm candidate inside the 2B-2.4B cliff window - hedge it. */
  marginal: boolean;
  /** The gap immediately above the shadow floor. */
  boundaryGap: number;
  /** How far below the boundary this function sits. */
  depth: number;
  axisPartner: FunctionKey;
  /** Priority (a) of 02 §6: partner in the Lead cluster or an upper edge. */
  axisPartnerElevated: boolean;
  /**
   * Strongest function sharing this candidate's attitude - the route back in
   * (03 §6). A distinct concept from the circuit counterweight.
   */
  bridge: FunctionKey | null;
  bridgeScore: number | null;
}

export interface Eruption {
  /** Firm candidates, prioritized per 02 §6 and capped at two. */
  firm: EruptionCandidate[];
  /** Gap-but-not-cliff floor members: at most one hedged line. */
  watch: EruptionCandidate[];
  /** Firm candidates beyond the cap: one summary line, no catalog. */
  summaryOnly: EruptionCandidate[];
  /** Whether the cap actually bit. */
  capped: boolean;
}

/* ------------------------------------------------------------------ *
 * Supply grades (02 §2.1)
 * ------------------------------------------------------------------ */

/** The ladder of 02 §2.1: flow > near-flow > scaffolded-stretch > friction. */
export type SupplyGrade =
  | 'flow'
  | 'near-flow'
  | 'scaffolded-stretch'
  | 'friction'
  /** A hedged fork between two adjacent grades (both windows, or neither). */
  | 'fork'
  /** No tiers exist to grade from (FLAT / STAIRCASE). */
  | 'unrated';

export const SUPPLY_LADDER: readonly SupplyGrade[] = [
  'flow',
  'near-flow',
  'scaffolded-stretch',
  'friction',
];

/* ------------------------------------------------------------------ *
 * The signature
 * ------------------------------------------------------------------ */

export interface Signature {
  regime: Regime;
  /** The scores as given. Magnitudes are always stored (02 §1). */
  scores: Scores;
  options: ResolvedGeometryOptions;
  thresholds: Thresholds;
  sorted: SortedEntry[];
  gaps: GapReading[];
  boundaries: Boundary[];
  segments: Segment[];
  tiers: Tiers;
  tierOf: Record<FunctionKey, TierName | null>;
  smears: Smear[];
  /** 02 §2 step 7: lead, plus T2's upper edge when the lead boundary is marginal. */
  activeSet: FunctionKey[];
  /** The operative Lead reading: T1's upper edge when T1 is smeared (02 §2 step 6). */
  operativeLead: FunctionKey[];
  leadAttitudes: LeadAttitudes;
  /** Both attitudes in the lead: the balanced-lead dynamic, not a circuit (03 §3). */
  balancedLead: boolean;
  indices: Indices;
  shapes: Shape[];
  circuit: Circuit | null;
  eruption: Eruption;
  supplyGrades: Record<FunctionKey, SupplyGrade>;
  /** For every 'fork' grade, the two adjacent grades it forks between. */
  supplyForks: Partial<Record<FunctionKey, readonly [SupplyGrade, SupplyGrade]>>;
  /** FLAT only: the single largest gap, nameable as a tentative watch item. */
  watchItem: WatchItem | null;
  warnings: string[];
}
