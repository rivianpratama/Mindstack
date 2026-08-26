/**
 * Layer 2, deterministic half: turn a computed Signature into (a) the exact set of
 * knowledge-base fragments this geometry triggers, (b) a render plan that decides what
 * gets airtime, and (c) the user message that carries both to the model.
 *
 * The selection table is the one in the implementation plan ("Layer 2: prompt assembly
 * → Selection logic"), row for row. Three facts about the fragment build constrain it:
 *
 *  - `shapes.*` fragments have their detection and grade text stripped, so every grade
 *    quoted to the model comes from the Signature injected here, never from prose.
 *  - `dynamics.development` and `always.development` are the same text (03 §10). It is
 *    injected once, as the always-on block; `dynamics.development` is never selected.
 *  - The demand-weighting rule exists in no fragment (it was lost with 04's assembler
 *    crash), so it is hardcoded in the friction instruction below.
 *
 * Nothing here interprets: it selects, orders, and budgets. The model writes prose; the
 * code decides what the prose is allowed to be about.
 */

import {
  AXIS_OF,
  type AxisKey,
  type FunctionKey,
  type Regime,
  type Signature,
  type SupplyGrade,
  ORIENTATION_OF,
  type Orientation,
  inputOrder,
  strongestSharingAttitude,
} from '../../shared/geometry';
import {
  FRICTION_KEYS,
  getAlways,
  getDisclaimer,
  getDynamic,
  getFriction,
  getFunctionBlock,
  getShape,
  type DynamicKey,
  type FunctionBlock,
  type ShapeId,
} from '../kb/loader';
import { MAX_COMPLETION_TOKENS } from '../deepseek';
import { fullSystemPrompt } from './foundations';

// Extra completion tokens reserved for the model's hidden reasoning pass (thinking is on
// by default). Billed against the same max_tokens as the report, so it is added on top of
// the prose budget rather than shared with it. Clamped by MAX_COMPLETION_TOKENS downstream.
const REASONING_HEADROOM_TOKENS = 24000;

/* ------------------------------------------------------------------ *
 * Public shapes
 * ------------------------------------------------------------------ */

/** The optional context intake (04 §a). Every field is optional; all-empty = absent. */
export interface ContextAnswers {
  who?: string;
  what?: string;
  when?: string;
  where?: string;
  why?: string;
  how?: string;
}

export const CONTEXT_FIELDS = ['who', 'what', 'when', 'where', 'why', 'how'] as const;
export type ContextField = (typeof CONTEXT_FIELDS)[number];

export type RenderMode =
  /** ~350 words, the feature's full treatment, composed with the other fired features. */
  | 'full'
  /** ~350 words, but two labelled hypotheses plus the deciding observation (05 §5.5). */
  | 'fork'
  /** A short paragraph. Fired axes beyond the most polarized one (03 §7 cap, relaxed). */
  | 'short-paragraph'
  /** One or two hedged lines: quiet channels and the licensed composition note. */
  | 'brief'
  /** One line covering several detections at once, never a catalog (02 §6). */
  | 'summary-line';

export type FeatureKind =
  | 'provenance'
  | 'weak-signal'
  | 'shadow-cliff'
  | 'eruption-watch'
  | 'eruption-summary'
  | 'circuit'
  | 'axis'
  | 'balanced-high-axis'
  | 'quiet-axis'
  | 'lead-shape'
  | 'sub-cluster'
  | 'balanced-lead'
  | 'jp-pressure'
  | 'jp-note'
  | 'scenarios';

export interface RenderFeature {
  /** Stable identifier, also used as the merge key. */
  id: string;
  kind: FeatureKind;
  /** One line naming the feature, in the report's own vocabulary. */
  title: string;
  /** Which report section this feature is rendered in (2-7; 1 is code-rendered). */
  section: 2 | 3 | 4 | 5 | 6 | 7;
  /** 05 §5.1 salience: cliffs < circuits < axes < lead shapes < balanced/quiet. */
  salience: number;
  budgetWords: number;
  mode: RenderMode;
  /** 05 §5.5: marginal detections must be rendered as fork statements. */
  forkRequired: boolean;
  axis?: AxisKey;
  functions: FunctionKey[];
  /** Ids of the convergent detections folded into this one feature (03 §7). */
  mergedFrom: string[];
  /** Deterministic instructions: what to say about it, and what not to. */
  instructions: string[];
}

/** Which side of the supply ladder a generated scenario is built to land on. */
export type ScenarioBand = 'flow' | 'stretch' | 'friction' | 'eruption-risk';

/**
 * A hypothetical situation the report generates for itself: one row of 04 §b's demand
 * taxonomy, crossed with this profile's supply grade for the demanded function, plus a
 * compact scene description for the model to open the vignette with.
 *
 * The situation is generic and the demand mapping comes from the taxonomy; only the
 * *prediction* is profile-specific. Nothing here is personalization.
 */
export interface Scenario {
  id: string;
  band: ScenarioBand;
  row: number;
  demandType: string;
  demands: FunctionKey[];
  /** Supply grade of the row's primary demanded function, from the Signature. */
  supplyGrade: SupplyGrade;
  cues: string;
  /** The scene the vignette opens with (04 §a's six fields). */
  frame: Record<ContextField, string>;
  /** 04 §c escalation modifiers overlaid on the frame; only the eruption scenario has any. */
  modifiers: string[];
  /** The firm eruption candidate this scenario is built to load, when that is its job. */
  eruptionFn: FunctionKey | null;
}

export interface SelectedFragment {
  key: string;
  text: string;
  group: 'shapes' | 'dynamics' | 'functions' | 'friction' | 'always';
}

export interface Assembly {
  regime: Regime;
  /** False only for FLAT: the honest-null report is deterministic, no model involved. */
  llm: boolean;
  honestNull: boolean;
  /** The deterministic FLAT report, disclaimer included. Null unless `honestNull`. */
  honestNullReport: string | null;
  fragmentKeys: string[];
  fragments: SelectedFragment[];
  renderPlan: RenderFeature[];
  /**
   * The self-generated scenarios section 3 is built from. Always populated for an
   * LLM path with resolved tiers; empty for STAIRCASE (no supply grades exist) and FLAT.
   */
  scenarios: Scenario[];
  systemPrompt: string;
  /** Empty string when `honestNull`: there is nothing to ask a model. */
  userPrompt: string;
  /** Completion cap sized to the render plan's word budget (05 §5.1). */
  maxTokens: number;
  /** Sum of the render plan's per-feature budgets. */
  budgetWords: number;
  /** Hard floor for a profile with resolved structure; 0 where brevity is honest. */
  minWords: number;
}

/** The comprehensive-format length contract for a NORMAL-regime profile. */
export const MIN_REPORT_WORDS = 2000;
export const TARGET_REPORT_WORDS = [2200, 3000] as const;

/* ------------------------------------------------------------------ *
 * 04 §b demand taxonomy, as data
 * ------------------------------------------------------------------ */

interface TaxonomyRow {
  row: number;
  demandType: string;
  /** Primary demanded function first; the grade is read off the primary. */
  demands: FunctionKey[];
  cues: string;
  /**
   * A generic scene situation that produces this demand, authored from the row's own cue
   * and rationale columns. Generic on purpose: the situation is a hypothetical, and only
   * the prediction about it is keyed to the profile.
   */
  frame: Record<ContextField, string>;
}

/**
 * Rows 1-12 of 04 §b. Row 13 (solitary depth work) demands "the introverted battery"
 * rather than a function, so it cannot carry a supply grade and is not selectable as a
 * default context; the taxonomy fragment still ships it to the model.
 */
const TAXONOMY: readonly TaxonomyRow[] = [
  {
    row: 1,
    demandType: 'Open-ended ideation',
    demands: ['Ne'],
    cues: 'WHAT = "come up with options"; HOW = free',
    frame: {
      who: 'you, or a small group with no fixed roles',
      what: 'produce a spread of options for a problem nobody has framed yet',
      when: 'open-ended, no clock set by anyone',
      where: 'a setting you can reshape or step away from',
      why: 'nothing is decided yet, and breadth is the point',
      how: 'your own method; nothing is prescribed',
    },
  },
  {
    row: 2,
    demandType: 'Long-horizon synthesis',
    demands: ['Ni'],
    cues: 'WHAT = "figure out where this is going"; WHEN = open',
    frame: {
      who: 'alone, reporting to nobody yet',
      what: 'work out where a messy situation is actually heading',
      when: 'open-ended',
      where: 'private, few interruptions',
      why: 'the direction matters more than the deadline',
      how: 'full autonomy',
    },
  },
  {
    row: 3,
    demandType: 'Real-time responsiveness',
    demands: ['Se'],
    cues: 'WHEN = real time; WHERE = physical',
    frame: {
      who: 'one or two people who look to whoever moves first',
      what: 'handle a live situation while it is still changing',
      when: 'unfolding in real time, seconds to minutes',
      where: 'on site, physical, hard to leave',
      why: 'something concrete is being lost right now',
      how: 'improvise; no procedure covers it',
    },
  },
  {
    row: 4,
    demandType: 'Procedural reliability',
    demands: ['Si'],
    cues: 'HOW = fixed procedure; WHAT = maintenance',
    frame: {
      who: 'a familiar team working to a set standard',
      what: 'run a proven sequence exactly as written',
      when: 'a routine cycle, repeated',
      where: 'the usual place, the usual tools',
      why: 'a deviation means rework for other people',
      how: 'a fixed procedure; substitutions are errors',
    },
  },
  {
    row: 5,
    demandType: 'Precision systems analysis',
    demands: ['Ti'],
    cues: 'WHAT = "why is this broken / is this correct"',
    frame: {
      who: 'alone now, explaining to others later',
      what: 'find out why something is broken, or whether it is correct',
      when: 'enough time to be thorough',
      where: 'wherever you can concentrate',
      why: 'a wrong answer propagates into everything downstream',
      how: 'your own method',
    },
  },
  {
    row: 6,
    demandType: 'Resource mobilization',
    demands: ['Te'],
    cues: 'WHEN = deadline; WHAT = deliverable',
    frame: {
      who: 'a small team, plus somebody waiting on delivery',
      what: 'sequence people, time and tools until a deliverable ships',
      when: 'a hard external deadline',
      where: 'a shared workspace',
      why: 'the delivery is visible to people who count on it',
      how: 'the process is partly imposed on you',
    },
  },
  {
    row: 7,
    demandType: 'Value arbitration',
    demands: ['Fi'],
    cues: 'WHY = personally charged; WHAT = ethical call',
    frame: {
      who: 'one person who will live with the result',
      what: 'decide what you can personally stand behind when two good criteria collide',
      when: 'soon, but you set the clock',
      where: 'a private conversation',
      why: 'you personally care how this lands',
      how: 'no procedure covers it',
    },
  },
  {
    row: 8,
    demandType: 'Group-atmosphere maintenance',
    demands: ['Fe'],
    cues: 'WHO = group, especially with tension',
    frame: {
      who: 'a small group carrying unspoken tension',
      what: 'keep the shared mood workable while the work continues',
      when: 'over days, not minutes',
      where: 'a shared space you cannot simply leave',
      why: 'the tension has started to cost the work',
      how: 'nobody has given you a method',
    },
  },
  {
    row: 9,
    demandType: 'Emotional first response',
    demands: ['Fe', 'Fi'],
    cues: 'WHO = someone upset, now',
    frame: {
      who: 'one person who is upset, in front of you',
      what: 'respond to distress in the moment',
      when: 'immediately; no preparation',
      where: 'wherever it happens to happen',
      why: 'they came to you rather than anyone else',
      how: 'nothing to follow; you improvise',
    },
  },
  {
    row: 10,
    demandType: 'Ambiguity holding',
    demands: ['Ne', 'Ni'],
    cues: 'WHAT = unresolved; WHEN = "too early to decide"',
    frame: {
      who: 'a group that wants an answer today',
      what: 'keep an unresolved question genuinely open',
      when: 'too early to decide well',
      where: 'a recurring meeting',
      why: 'closing early would cost more than waiting',
      how: 'your call how to hold it open',
    },
  },
  {
    row: 11,
    demandType: 'Closure under deadline',
    demands: ['Te', 'Fe'],
    cues: 'WHEN = hard deadline; WHO = waiting audience',
    frame: {
      who: 'an audience waiting on your decision',
      what: 'commit publicly to a decision, on schedule',
      when: 'a hard deadline that is nearly up',
      where: 'a visible forum',
      why: 'the delay itself has become the problem',
      how: 'you state it and you own it',
    },
  },
  {
    row: 12,
    demandType: 'Interruption multiplexing',
    demands: ['Se', 'Ne'],
    cues: 'WHERE = open/shared setting; WHEN = fragmented',
    frame: {
      who: 'several people pinging you independently',
      what: 'reprioritize continuously as new things arrive',
      when: 'fragmented, all day',
      where: 'an open or shared setting',
      why: 'several small things fail quietly if dropped',
      how: 'no protection from interruption',
    },
  },
];

/**
 * The demand-weighting rule. It exists in no fragment (04's §b prose describes the
 * weighted set but the weighting procedure was lost), so it is stated here and shipped
 * verbatim in the friction instruction.
 */
export const DEMAND_WEIGHTING_RULE =
  'The task itself is the primary demand. Cues appearing in multiple scene fields outrank ' +
  'single-field cues. Ties break toward the demand whose function has the LOWEST supply ' +
  'grade. Cap the demand profile at four demands.';

/**
 * 04 §c escalation modifiers, overlaid on the eruption scenario's scene frame. Three of the
 * five, so the "friction + >= 2 modifiers -> flag eruption risk" rule fires by construction.
 */
const ESCALATION_OVERLAY: readonly string[] = [
  'Sustained duration: this repeats every day for two weeks, not once',
  'No exit: you cannot step out of it or reshape it',
  'Evaluative audience: somebody whose opinion of you matters is watching',
];

/**
 * The six headings the client's cards are keyed to, in order. Exact strings: the client
 * matches on them. Sections 2-7 of the report; section 1 is code-rendered.
 */
export const REPORT_HEADINGS = [
  '## How your mind tends to work',
  '## How you handle different situations',
  '## When things get stressful',
  '## Things you can try',
  '## Where this report comes from',
  "## What this report can't tell you",
] as const;

/**
 * Appended to every full-length feature. Implements the two halves of the length rule:
 * spend the budget on the theory the fragments carry, then on composition between fired
 * features, which no fragment states, and which is where originality is licensed.
 */
const DEPTH_CONTRACT =
  'Depth contract for this full-length slot: render the mechanism by name, the Inside and ' +
  'Observable material, BOTH sides of the trade-off, the stress trajectory and the exit ramp ' +
  'or lever. Compose with this profile\'s own functions, never as shape-generic prose. Then ' +
  'go past the fragments: state what THIS feature together with the other fired features in ' +
  'the plan predicts that none of them predicts alone (how this person argues, decides, ' +
  'burns out, recovers). Phrase every composed reading as an offered hypothesis. Every ' +
  'paragraph is grounded in a real feature and a real mechanism. Named to yourself, described to the reader in plain everyday words with no number, grade, or code.';

const BUDGET: Record<RenderMode, number> = {
  full: 350,
  fork: 350,
  'short-paragraph': 140,
  brief: 60,
  'summary-line': 40,
};

/* ------------------------------------------------------------------ *
 * Fragment selection
 * ------------------------------------------------------------------ */

class Selection {
  private readonly order: string[] = [];
  private readonly seen = new Set<string>();

  add(key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.order.push(key);
  }

  shape(id: ShapeId): void {
    this.add(`shapes.${id}`);
  }

  dynamic(key: DynamicKey): void {
    this.add(`dynamics.${key}`);
  }

  fn(fn: FunctionKey, block: FunctionBlock): void {
    this.add(`functions.${fn}.${block}`);
  }

  has(key: string): boolean {
    return this.seen.has(key);
  }

  keys(): string[] {
    return [...this.order];
  }
}

function resolve(keys: string[]): SelectedFragment[] {
  const grouped: SelectedFragment[] = [];
  const pick = (prefix: string, group: SelectedFragment['group']) => {
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      grouped.push({ key, text: textFor(key), group });
    }
  };
  pick('shapes.', 'shapes');
  pick('dynamics.', 'dynamics');
  pick('functions.', 'functions');
  pick('friction.', 'friction');
  pick('always.', 'always');
  return grouped;
}

function textFor(key: string): string {
  const parts = key.split('.');
  switch (parts[0]) {
    case 'shapes':
      return getShape(parts[1] as ShapeId);
    case 'dynamics':
      return getDynamic(parts[1] as DynamicKey);
    case 'functions':
      return getFunctionBlock(parts[1] as FunctionKey, parts[2] as FunctionBlock);
    case 'friction':
      return getFriction(parts[1] as (typeof FRICTION_KEYS)[number]);
    case 'always':
      return getAlways()[parts[1] as 'development' | 'state-honesty'];
    default:
      throw new Error(`assemble: no accessor for fragment key "${key}"`);
  }
}

/* ------------------------------------------------------------------ *
 * Helpers over the Signature
 * ------------------------------------------------------------------ */

const axisLabel = (axis: AxisKey): string => axis.replace('-', '–');

const fnList = (fns: readonly FunctionKey[]): string => fns.join(', ');

/** Highest-scoring function on one side of the J/P divide, ties by input order. */
function strongestOfOrientation(signature: Signature, orientation: Orientation): FunctionKey | null {
  const candidates = inputOrder(signature.scores).filter(
    (fn) => ORIENTATION_OF[fn] === orientation,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce(
    (best, fn) => (signature.scores[fn] > signature.scores[best] ? fn : best),
    candidates[0]!,
  );
}

/**
 * The pair whose 01 blocks the composition variant must be built from (03 §0 rule of
 * composition): the operative lead, padded to two with the strongest function sharing
 * the lead's attitude when the lead is a single function.
 */
function compositionPair(signature: Signature): FunctionKey[] {
  const lead = signature.operativeLead;
  if (lead.length >= 2) return lead.slice(0, 2);
  if (lead.length === 1) {
    const partner = strongestSharingAttitude(signature.scores, lead[0]!);
    return partner ? [lead[0]!, partner.fn] : [...lead];
  }
  return [];
}

/**
 * Generate the hypothetical situations section 3 is built from: three or four rows of
 * 04 §b's taxonomy, crossed with this profile's supply grades so the set spans the ladder.
 *
 * Coverage contract, in this order:
 *   1. flow:           a demand this profile's lead cluster supplies
 *   2. stretch:        a demand landing in the support or reserve band
 *   3. friction:       a demand landing on the shadow floor
 *   4. eruption-risk:  only when a FIRM eruption candidate exists, a second friction
 *      scenario loading that function, with three 04 §c escalation modifiers overlaid.
 *
 * A band is skipped when this profile has nothing at that grade. A profile with no
 * friction row genuinely has no friction scenario, and inventing one would be a lie.
 */
export function computeScenarios(signature: Signature): Scenario[] {
  const graded = TAXONOMY.map((row) => ({
    row,
    supplyGrade: signature.supplyGrades[row.demands[0]!],
  }));

  const used = new Set<number>();
  const scenarios: Scenario[] = [];

  const build = (
    entry: (typeof graded)[number],
    band: ScenarioBand,
    modifiers: readonly string[] = [],
    eruptionFn: FunctionKey | null = null,
  ): Scenario => ({
    id: `scenario:${band}`,
    band,
    row: entry.row.row,
    demandType: entry.row.demandType,
    demands: [...entry.row.demands],
    supplyGrade: entry.supplyGrade,
    cues: entry.row.cues,
    frame: { ...entry.row.frame },
    modifiers: [...modifiers],
    eruptionFn,
  });

  const takeFirst = (
    band: ScenarioBand,
    grades: readonly SupplyGrade[],
    filter?: (entry: (typeof graded)[number]) => boolean,
  ): void => {
    for (const grade of grades) {
      const hit = graded.find(
        (entry) =>
          entry.supplyGrade === grade && !used.has(entry.row.row) && (!filter || filter(entry)),
      );
      if (hit) {
        used.add(hit.row.row);
        scenarios.push(build(hit, band));
        return;
      }
    }
  };

  takeFirst('flow', ['flow', 'near-flow']);
  takeFirst('stretch', ['scaffolded-stretch', 'near-flow', 'fork']);
  takeFirst('friction', ['friction']);

  /*
   * The eruption scenario exists only where the geometry licenses one: a firm candidate
   * (a floor function below a cliff, per 02 §6). Watch-grade floors get no such scenario.
   */
  const firm = signature.eruption.firm[0];
  if (firm) {
    const loaded = graded.find(
      (entry) => !used.has(entry.row.row) && entry.row.demands.includes(firm.fn),
    );
    if (loaded) {
      used.add(loaded.row.row);
      scenarios.push(build(loaded, 'eruption-risk', ESCALATION_OVERLAY, firm.fn));
    }
  }

  // Never fewer than two situations to reason about, as long as any row is gradeable.
  if (scenarios.length < 2) {
    for (const entry of graded) {
      if (scenarios.length >= 2) break;
      if (used.has(entry.row.row) || entry.supplyGrade === 'unrated') continue;
      used.add(entry.row.row);
      scenarios.push(build(entry, 'stretch'));
    }
  }

  return scenarios;
}

/* ------------------------------------------------------------------ *
 * The assembler
 * ------------------------------------------------------------------ */

export function assemblePrompt(
  signature: Signature,
  /**
   * Accepted for wire compatibility and deliberately unused. The report no longer takes a
   * situation from the reader: it generates its own scene scenarios from the taxonomy and
   * this profile's supply grades (see `computeScenarios`). Passing a context changes
   * nothing about the output.
   */
  _context?: ContextAnswers | null,
): Assembly {

  if (signature.regime === 'FLAT') {
    // Table row 1: no LLM call at all. Nothing is selected, nothing is planned.
    return {
      regime: 'FLAT',
      llm: false,
      honestNull: true,
      honestNullReport: buildHonestNullReport(signature),
      fragmentKeys: [],
      fragments: [],
      renderPlan: [],
      scenarios: [],
      systemPrompt: fullSystemPrompt(),
      userPrompt: '',
      maxTokens: 0,
      budgetWords: 0,
      minWords: 0,
    };
  }

  const selection = new Selection();
  const features: RenderFeature[] = [];
  const push = (
    feature: Omit<RenderFeature, 'budgetWords'>,
    budgetOverride?: number,
  ): RenderFeature => {
    const built = { ...feature, budgetWords: budgetOverride ?? BUDGET[feature.mode] };
    // Every feature that gets a full-length slot gets the same depth contract, so the extra
    // words come from the theory and from composition rather than from filler.
    if (
      (built.mode === 'full' || built.mode === 'fork') &&
      built.kind !== 'provenance' &&
      built.kind !== 'weak-signal' &&
      built.kind !== 'scenarios'
    ) {
      built.instructions = [...built.instructions, DEPTH_CONTRACT];
    }
    features.push(built);
    return built;
  };

  if (signature.regime === 'STAIRCASE') {
    // Table row 2: weak-signal plus the extremes-only instruction; nothing else fires.
    selection.dynamic('weak-signal');
    const staircase = signature.shapes.find((s) => s.id === 'S5');
    const upper = (staircase?.detail.upperEdge as FunctionKey[] | undefined) ?? [];
    const lower = (staircase?.detail.lowerEdge as FunctionKey[] | undefined) ?? [];
    push({
      id: 'weak-signal:staircase',
      kind: 'weak-signal',
      title: 'Staircase geometry, extremes only',
      section: 2,
      salience: 0,
      mode: 'full',
      forkRequired: false,
      functions: [...upper, ...lower],
      mergedFrom: [],
      instructions: [
        'This profile resolves little, so the honest output is SHORT. Do not stretch it: the ' +
          'length rules for a resolved profile do not apply, and section 6 (provenance) is the ' +
          'only part that runs at full length here.',
        'No adjacent rank in this profile is real: no tier boundary exists, so no tiers, ' +
          'no circuit, no shapes, no eruption candidates may be named.',
        `The ONLY licensed content is the contrast between the habits you use most (${fnList(upper)}) ` +
          `and the ones you use least (${fnList(lower)}). Everything between them stays silent. Name ` +
          'them in plain words; never call them "top/bottom", "high/low", or "edges".',
        'Section 3 must say plainly that behaviour-in-situation predictions need bands this ' +
          'profile does not resolve, so no scenarios are offered, and point to the 256-item ' +
          'Sakinorva Domains Test as a richer input; sections 4 and 5 stay short and name no ' +
          'eruption candidate.',
      ],
    });
  } else {
    selectNormal(signature, selection, push);
  }

  // Table row: always-on. `dynamics.development` is the same text (03 §10), once only.
  selection.add('always.development');
  selection.add('always.state-honesty');

  /*
   * Table rows: the friction machinery, minus `friction.intake-schema`. That fragment
   * documents the six questions to ASK a reader, and there is no reader intake any more.
   * Not for STAIRCASE either: the friction classification reads supply grades off tiers,
   * and a staircase asserts none (they come back `unrated`), so there is nothing to grade.
   */
  const scenarios = signature.regime === 'STAIRCASE' ? [] : computeScenarios(signature);
  if (signature.regime !== 'STAIRCASE') {
    for (const key of FRICTION_KEYS) {
      if (key === 'intake-schema') continue;
      selection.add(`friction.${key}`);
    }
    push(
      {
        id: 'scenarios',
        kind: 'scenarios',
        title: `Self-generated scenarios (${scenarios.map((s) => s.band).join(', ')})`,
        section: 3,
        salience: 58,
        mode: 'full',
        forkRequired: false,
        functions: [...new Set(scenarios.flatMap((scenario) => scenario.demands))],
        mergedFrom: [],
        instructions: scenarioInstructions(scenarios),
      },
      // Each vignette carries a scene, three or four if-then signatures and a
      // trade-off line, so this section is budgeted per scenario rather than per feature.
      Math.max(380, scenarios.length * 190),
    );
  }

  // Section 6, every LLM path: how the reading was made. Framework, not profile.
  push({
    id: 'provenance',
    kind: 'provenance',
    title: 'Where this report comes from (framework provenance)',
    section: 6,
    salience: 90,
    mode: 'full',
    forkRequired: false,
    functions: [],
    mergedFrom: [],
    instructions: provenanceInstructions(),
  }, 400);

  const renderPlan = orderPlan(features);
  const fragmentKeys = selection.keys();
  const fragments = resolve(fragmentKeys);
  const budgetWords = renderPlan.reduce((sum, feature) => sum + feature.budgetWords, 0);
  // A STAIRCASE profile resolves almost nothing: no minimum, because padding it would lie.
  const minWords = signature.regime === 'NORMAL' ? MIN_REPORT_WORDS : 0;

  return {
    regime: signature.regime,
    llm: true,
    honestNull: false,
    honestNullReport: null,
    fragmentKeys,
    fragments,
    renderPlan,
    scenarios,
    systemPrompt: fullSystemPrompt(),
    userPrompt: buildUserPrompt({
      signature,
      scenarios,
      renderPlan,
      fragments,
      budgetWords,
      minWords,
    }),
    // Output budget (~2.2 tokens/word + slack) PLUS a reasoning allowance: thinking is on
    // by default and its tokens are billed against the same max_tokens, so a cap sized for
    // the prose alone would let the reasoning pass starve the report and truncate it. The
    // reasoning headroom is added on top, still clamped to MAX_COMPLETION_TOKENS.
    maxTokens: Math.min(
      MAX_COMPLETION_TOKENS,
      Math.max(3000, Math.round(budgetWords * 2.2) + 800) + REASONING_HEADROOM_TOKENS,
    ),
    budgetWords,
    minWords,
  };
}

/* ------------------------------------------------------------------ *
 * NORMAL-regime selection: the table, row by row
 * ------------------------------------------------------------------ */

type Push = (feature: Omit<RenderFeature, 'budgetWords'>) => RenderFeature;

function selectNormal(signature: Signature, selection: Selection, push: Push): void {
  const shapeOf = (id: ShapeId) => signature.shapes.find((s) => s.id === id);

  /* --- shadow floor / eruption (the cliff features, highest salience) ---------- */
  const floorFeatures = new Map<FunctionKey, RenderFeature>();
  const shadowExists = signature.tiers.shadow.length > 0;
  const s7 = shapeOf('S7');
  const s8 = shapeOf('S8');

  if (shadowExists) {
    selection.dynamic('shadow-floor');
    if (s7) selection.shape('S7');
    if (s8) selection.shape('S8');

    const rendered = [...signature.eruption.firm, ...signature.eruption.watch];
    const floors: FunctionKey[] = rendered.length
      ? rendered.map((candidate) => candidate.fn)
      : [...signature.tiers.shadow];

    for (const fn of floors) {
      selection.fn(fn, 'd');
      const candidate = rendered.find((entry) => entry.fn === fn);
      const firm = candidate?.grade === 'firm';
      if (firm) selection.fn(fn, 'e');

      const bridge = candidate?.bridge ?? strongestSharingAttitude(signature.scores, fn)?.fn ?? null;
      const marginal = candidate?.marginal ?? false;
      const instructions = [
        `${fn} sits on the shadow floor. Hold all three hypotheses for the boundary above ` +
          'it (suppression, avoidance, simple non-development) and never pick one.',
        bridge
          ? `Route any lever through the bridge function ${bridge} (strongest function sharing ` +
            `${fn}'s attitude). The bridge is NOT the circuit counterweight; never call it one, ` +
            'and never advise developing the floor directly.'
          : `No same-attitude bridge exists for ${fn}; say so rather than inventing a route.`,
      ];
      if (firm) {
        instructions.push(
          `Firm eruption candidate: describe how ${fn} shows up in a rough, clumsy form under strain, ` +
            'in plain everyday behaviour (say "it bursts out in a rough, clumsy form", never "erupts" ' +
            'or "eruption"), plus the early-warning line. The first sign is that your usual strong ' +
            'habits go foggy, before any of the rough behaviour appears.',
          'Full depth (this is a capped, high-salience feature, so spend the budget): the ' +
            'repression-rebound mechanism and why the gap size matters; what systematic ' +
            'avoidance of this domain looks like day to day; the honest benefit side (not ' +
            'funding this channel frees budget for the lead); at least two early-warning signs ' +
            'the reader could notice this month; the bridge-function route with its activation ' +
            'conditions; and boundary design (pre-arranged cover for contexts that demand ' +
            `${fn}). Never advise developing the floor directly.`,
        );
      } else {
        instructions.push(
          `Watch-item grade only (the boundary above ${fn} is a gap, not a cliff): at most one ` +
            'hedged line, and no eruptive-expression catalog.',
        );
      }
      if (candidate?.axisPartnerElevated) {
        instructions.push(
          `${fn}'s axis partner sits in the lead cluster or an upper edge, so polarization ` +
            'compounds the isolation. This is the strongest form of the reading.',
        );
      }

      const feature = push({
        id: `floor:${fn}`,
        kind: firm ? 'shadow-cliff' : 'eruption-watch',
        title: firm
          ? `${fn} shadow floor below a cliff, firm eruption candidate`
          : `${fn} shadow floor below a gap, hedged watch item`,
        section: 4,
        salience: firm ? 10 : 48,
        mode: firm ? (marginal ? 'fork' : 'full') : 'brief',
        forkRequired: firm ? marginal : true,
        functions: [fn],
        mergedFrom: [],
        instructions,
      });
      floorFeatures.set(fn, feature);
    }

    if (signature.eruption.summaryOnly.length > 0) {
      push({
        id: 'floor:summary',
        kind: 'eruption-summary',
        title: 'Remaining floor members, one summary line',
        section: 4,
        salience: 49,
        mode: 'summary-line',
        forkRequired: false,
        functions: signature.eruption.summaryOnly.map((entry) => entry.fn),
        mergedFrom: [],
        instructions: [
          `The eruption cap bit: ${fnList(signature.eruption.summaryOnly.map((e) => e.fn))} ` +
            'qualify but are NOT rendered individually. One sentence covering them as a set, ' +
            'never a catalog, never their eruptive expressions.',
        ],
      });
    }
  }

  /* --- circuit (S12) ----------------------------------------------------------- */
  const circuit = signature.circuit;
  if (circuit) {
    selection.shape('S12');
    selection.dynamic(circuit.kind === 'internal' ? 'internal-circuit' : 'external-circuit');
    selection.fn(circuit.counterweight, 'h');
    const pair = compositionPair(signature);
    push({
      id: 'circuit',
      kind: 'circuit',
      title: `${circuit.kind === 'internal' ? 'Internal' : 'External'} closed circuit (${circuit.grade}), counterweight ${circuit.counterweight}`,
      section: 2,
      salience: circuit.grade === 'sealed' ? 20 : 25,
      mode: circuit.marginal ? 'fork' : 'full',
      forkRequired: circuit.marginal,
      functions: [...circuit.lead, circuit.counterweight],
      mergedFrom: [],
      instructions: [
        `Private evidence, never print: the loop reads ${circuit.grade} (strength ${circuit.strength}); its ` +
          `members are ${fnList(circuit.lead)} and the way back in is ${circuit.counterweight}. In the report, ` +
          `describe two habits that team up and crowd the others out, name each habit in ` +
          `everyday words, and call ${circuit.counterweight} a gentle way back toward balance. No number, no ` +
          `grade word, no code, and never the words "circuit", "counterweight", "closed loop" or "loop".`,
        `Compose the variant from ${pair.join('/')} using those functions' own blocks (rule of ` +
          'composition): if that pair matches one of the named composition variants use it, ' +
          'otherwise build the variant from these two functions. Never ship shape-generic prose.',
        `Name the counterweight's activation conditions in its own currency, in section 5.`,
        circuit.fromSmearedLead
          ? 'The lead was read off a smeared top segment\'s upper edge. Say that the reading rests on it.'
          : 'Do not order the lead members if there is more than one; they are a set.',
      ],
    });
  } else if (signature.balancedLead) {
    /* --- lead carries both attitudes (03 §3) ---------------------------------- */
    selection.dynamic('balanced-lead');
    push({
      id: 'balanced-lead',
      kind: 'balanced-lead',
      title: 'Attitude-balanced lead, no circuit fires',
      section: 2,
      salience: 42,
      mode: 'full',
      forkRequired: false,
      functions: [...signature.operativeLead],
      mergedFrom: [],
      instructions: [
        `The lead (${fnList(signature.operativeLead)}) carries both attitudes, so no circuit ` +
          'reading is available. Mutually exclusive by construction. Never name a counterweight.',
        'Balance is not praise: name the switching overhead and the genuine indecision under ' +
          'time pressure, and give the behavioral tell (the same decision re-made once in each ' +
          'channel within days), not a felt sense.',
        'Name arbitration conditions rather than exit ramps: which contexts get the inner ' +
          "channel's final vote and which the outer's.",
      ],
    });
  }

  /* --- lead cardinality shapes S1-S4, and the S3b sub-cluster ------------------ */
  const s1 = shapeOf('S1');
  if (s1) {
    selection.shape('S1');
    selection.dynamic('lead-spike');
    const leadFn = s1.members[0]!;
    selection.fn(leadFn, 'b');
    const axis = signature.indices.axes[AXIS_OF[leadFn]];
    const overEngaged = axis.class === 'polarized' || axis.class === 'extreme';
    if (overEngaged) selection.fn(leadFn, 'c');
    push({
      id: 'lead:S1',
      kind: 'lead-shape',
      title: `Lead spike: ${leadFn} (${String(s1.grade)})`,
      section: 2,
      salience: 40,
      mode: s1.marginal ? 'fork' : 'full',
      forkRequired: s1.marginal,
      functions: [leadFn],
      mergedFrom: [],
      instructions: [
        `Private evidence, never print: the lead reads ${String(s1.grade)}, standing ${String(s1.detail.gap)} above the next habit. Translate that into how strongly one habit leads ("clearly out in front" vs "only just ahead") with no number and no grade word.`,
        s1.marginal
          ? 'Marginal: render as a fork. (A) a single lead feeding the band below it, (B) no ' +
            'true lead but a wider working cluster. Plus the observation that decides it. ' +
            'One-sided rendering here is a generation error.'
          : 'Firm enough to state as a pattern, still as a hypothesis to test.',
        overEngaged
          ? `The ${axisLabel(axis.axis)} axis is ${axis.class}, which licenses ${leadFn}'s ` +
            'over-engaged block: pair the engaged reading with its over-engaged cost.'
          : `The ${axisLabel(axis.axis)} axis is ${axis.class}, so the over-engaged reading is NOT ` +
            'licensed. Engaged expression only.',
        'The geometry shows over-reliance, not talent. A spike over a strong band is resilient; ' +
          'a spike over a desert is brittle. Say which this is.',
      ],
    });
  }

  for (const [id, dynamic] of [
    ['S2', 'pluralistic'],
    ['S3', 'pluralistic'],
  ] as const) {
    const shape = shapeOf(id);
    if (!shape) continue;
    selection.shape(id);
    selection.dynamic(dynamic);
    for (const fn of shape.members) selection.fn(fn, 'b');
    push({
      id: `lead:${id}`,
      kind: 'lead-shape',
      title: id === 'S2' ? `Twin-peak lead: ${fnList(shape.members)}` : `Pluralistic lead cluster: ${fnList(shape.members)}`,
      section: 2,
      salience: 40,
      mode: shape.hedged ? 'fork' : 'full',
      forkRequired: shape.hedged,
      functions: [...shape.members],
      mergedFrom: [],
      instructions: [
        `Members are a set: ${fnList(shape.members)}. Too close to tell apart, treat ` +
          'them as roughly equal, with no clear front-runner, never rank or adjective-rank them.',
        'Hold both hypotheses at once: deliberative flexibility versus decision friction. The ' +
          'flattering read never ships without the friction read.',
        shape.variant
          ? `Composition variant from the Signature: ${shape.variant}.`
          : 'Compose from the members\' own blocks, not from generic cluster prose.',
      ],
    });
  }

  const s3b = shapeOf('S3b');
  if (s3b) {
    selection.shape('S3b');
    selection.dynamic('pluralistic');
    for (const fn of s3b.members) selection.fn(fn, 'h');
    push({
      id: 'lead:S3b',
      kind: 'sub-cluster',
      title: `Pluralistic sub-cluster (watch item): ${fnList(s3b.members)}`,
      section: 2,
      salience: 45,
      mode: 'fork',
      forkRequired: true,
      functions: [...s3b.members],
      mergedFrom: [],
      instructions: [
        `Never call ${fnList(s3b.members)} a lead cluster. Membership rests on a marginal ` +
          `boundary and edge windows (source: ${String(s3b.detail.source)}, span ${String(s3b.detail.span)}), ` +
          'so the whole reading is watch-item grade and must be a fork.',
        'Order is unknown. The members are a set, interpreted through their supporting blocks.',
      ],
    });
  }

  const s4 = shapeOf('S4');
  if (s4) {
    selection.shape('S4');
    push({
      id: 'lead:S4',
      kind: 'lead-shape',
      title: `Compressed top: ${fnList(s4.members)}`,
      section: 2,
      salience: 41,
      mode: 'full',
      forkRequired: false,
      functions: [...s4.members],
      mergedFrom: [],
      instructions: [
        'Four or more functions share the top segment: no lead is resolvable. Say that plainly ' +
          'rather than picking one, and never rank inside the segment.',
      ],
    });
  }

  if (s8) {
    push({
      id: 'bimodal:S8',
      kind: 'shadow-cliff',
      title: `Bimodal split across a cliff of ${String(s8.detail.gap)}`,
      section: 2,
      salience: 12,
      mode: s8.marginal ? 'fork' : 'full',
      forkRequired: s8.marginal,
      functions: [...s8.members],
      mergedFrom: [],
      instructions: [
        `Two clear clusters with a big drop between: the habits you use most ` +
          `(${fnList(s8.detail.highGroup as FunctionKey[])}) and the ones you rarely turn to ` +
          `(${fnList(s8.detail.lowGroup as FunctionKey[])}), with little in between. In the report, ` +
          'name each habit in plain words and describe "the ones you lean on" versus "the ones you ' +
          'rarely reach for". Never "high group", "low group", "top", "bottom", or "shadow floor". ' +
          'The rarely-used ones are the habits that can burst out roughly under strain; keep to two.',
      ],
    });
  }

  /* --- axes: S9 polarized/extreme, S10 balanced-high, S11 balanced-low -------- */
  const polarizedAxes = signature.indices.axisOrder.filter((axis) => {
    const cls = signature.indices.axes[axis].class;
    return cls === 'polarized' || cls === 'extreme';
  });

  if (polarizedAxes.length > 0) {
    selection.dynamic('polarized-axes');
    selection.shape('S9');
  }

  let axisRenderedInFull = false;
  for (const axisKey of polarizedAxes) {
    const axis = signature.indices.axes[axisKey];
    const perAxisLine = `in plain everyday words, ${axis.high} is the far stronger side and ${axis.low} the neglected one. Say what each habit is. Never print a code, an arrow, or a number`;
    // Convergence merging: a polarized axis whose low pole is also an eruption candidate
    // is ONE feature, reported once and strongly, never twice (03 §7).
    const converged = floorFeatures.get(axis.low);
    if (converged) {
      const takesFullTreatment = !axisRenderedInFull;
      converged.axis = axisKey;
      converged.mergedFrom.push(`axis:${axisKey}`, converged.id);
      converged.salience = Math.min(converged.salience, axis.class === 'extreme' ? 30 : 35);
      converged.title = `${converged.title}, convergent with the ${axisLabel(axisKey)} ${axis.class} axis (${axis.pol})`;
      converged.functions = [...new Set([...converged.functions, axis.high, axis.low])];
      converged.instructions.push(
        `Convergent detection (private): the ${axisLabel(axisKey)} pair is ${axis.class}, and ` +
          `its low side is this least-used habit. Report the two as ONE reading, once and strongly. ` +
          `Never as two separate findings. Say it in plain words: ${perAxisLine}.`,
        `Attach the cost to the very same lopsidedness that buys the strength, in plain words: ` +
          `the same strong lean toward ${axis.high} and away from ${axis.low} that gives its power ` +
          `is what costs on the other side. Name both sides in everyday words; never print a number.`,
      );
      if (takesFullTreatment) {
        // The axis half of the merged feature is the one axis rendered in full, so the
        // feature gets a full budget even when the floor half is watch-grade.
        setMode(converged, converged.forkRequired || axis.borderline ? 'fork' : 'full');
        if (converged.kind === 'eruption-watch') {
          converged.instructions.push(
            'The axis half of this feature carries the full treatment; the floor half stays one ' +
              'hedged watch line inside it. A gap, not a cliff, licenses nothing firmer.',
          );
        }
      } else {
        converged.instructions.push(
          `Rendering cap: the ${axisLabel(polarizedAxes[0]!)} axis already took the fullest axis ` +
            'treatment, so this axis contributes a short paragraph inside this feature, no more.',
        );
      }
      axisRenderedInFull = true;
      continue;
    }

    const full = !axisRenderedInFull;
    axisRenderedInFull = true;
    push({
      id: `axis:${axisKey}`,
      kind: 'axis',
      title: `${axisLabel(axisKey)} ${axis.class} (${axis.pol})`,
      section: 2,
      salience: axis.class === 'extreme' ? 30 : 35,
      mode: full ? (axis.borderline ? 'fork' : 'full') : 'short-paragraph',
      forkRequired: full ? axis.borderline : false,
      axis: axisKey,
      functions: [axis.high, axis.low],
      mergedFrom: [],
      instructions: full
        ? [
            `Most polarized axis, the one rendered in full. Say it in plain words: ${perAxisLine}.`,
            `Leaning hard on one side is specialization: name in plain words the strength on the ` +
              `${axis.high} side and the blind spot on the ${axis.low} side, tied to that same one lean.`,
            'Full depth: the contrarian-influence mechanism (the disowned pole still shapes the ' +
              'worldview through what gets defined as unimportant), what the axis-failure ' +
              'signature looks like in ordinary weeks, the graded low-stakes exposure that is ' +
              'the only licensed exit, and what fluent handling of the low pole would falsify.',
            axis.borderline
              ? 'Borderline past its threshold: render as a fork, not a firm pattern.'
              : 'The starved pole is repressed rather than absent. It still shapes the worldview ' +
                'through what gets disowned or defined as unimportant.',
          ]
        : [
            `Rendering cap, relaxed for the comprehensive format: a SHORT PARAGRAPH (not one ` +
              `sentence, not a full treatment; the ${axisLabel(polarizedAxes[0]!)} axis already ` +
              `took that). Say it in plain words: ${perAxisLine}. Name the mechanism and one ` +
              'observable marker, and stop.',
          ],
    });
  }

  const balancedHigh = signature.indices.axisOrder.filter(
    (axis) => signature.indices.axes[axis].class === 'balanced-high',
  );
  balancedHigh.forEach((axisKey, index) => {
    const axis = signature.indices.axes[axisKey];
    if (index === 0) selection.shape('S10');
    push({
      id: `axis:${axisKey}`,
      kind: 'balanced-high-axis',
      title: `${axisLabel(axisKey)} balanced-high (${axis.pol})`,
      section: 2,
      salience: 60,
      mode: index === 0 ? 'fork' : 'short-paragraph',
      forkRequired: index === 0,
      axis: axisKey,
      functions: [...axis.members],
      mergedFrom: [],
      instructions:
        index === 0
          ? [
              'The one balanced-high fork allowed: flexible switching OR unresolved tension. ' +
                'Adjudicate with behavioral markers: a stable context-keyed assignment versus ' +
                'observable re-decision. Never with a felt sense of being torn.',
              `The two poles (${fnList(axis.members)}) are within the noise band: too close to ` +
                'tell apart, treat them as roughly equal, with no clear front-runner.',
            ]
          : [
              'Beyond the one-fork cap: a short paragraph at most, and no second fork. ' +
                'name the mechanism and one behavioral marker, then stop.',
            ],
    });
  });

  const balancedLow = signature.indices.axisOrder.filter(
    (axis) => signature.indices.axes[axis].class === 'balanced-low',
  );
  if (balancedLow.length > 0) {
    selection.shape('S11');
    for (const axisKey of balancedLow) {
      const axis = signature.indices.axes[axisKey];
      push({
        id: `axis:${axisKey}`,
        kind: 'quiet-axis',
        title: `${axisLabel(axisKey)} balanced-low (${axis.pol}), quiet channel`,
        section: 2,
        salience: 65,
        mode: 'brief',
        forkRequired: false,
        axis: axisKey,
        functions: [...axis.members],
        mergedFrom: [],
        instructions: [
          `Quiet pair: one or two plain lines, then stop. Both of these two opposite habits ` +
            `(${fnList(axis.members)}) are ones you rarely lean on right now. Say so gently and ` +
            `move on. This is not a fault or a verdict about ability. Name the two habits in plain ` +
            `words; never call this "low", a "quiet channel", or "balanced-low", and attach no ` +
            `number. The two are too close to tell apart. Treat them as roughly equal, with no clear front-runner.`,
        ],
      });
    }
  }

  /* --- J/P composition (03 §8) ------------------------------------------------ */
  const jp = signature.indices.jp.composition;
  if (jp.fires) {
    selection.dynamic('jp-pressure');
    const lever = jp.starvedSide ? strongestOfOrientation(signature, jp.starvedSide) : null;
    if (lever) selection.fn(lever, 'h');
    push({
      id: 'jp-pressure',
      kind: 'jp-pressure',
      title: `${jp.fires === 'judging-pressure' ? 'Judging' : 'Perceiving'} pressure (active set ${fnList(jp.activeSet)})`,
      section: 2,
      salience: 55,
      mode: 'full',
      forkRequired: false,
      functions: [...jp.activeSet, ...(lever ? [lever] : [])],
      mergedFrom: [],
      instructions: [
        `The active set is uniform (${fnList(jp.activeSet)}), so ${jp.fires} fires. Neither reading ` +
          'is the flattering one: decisiveness bought with accuracy, or openness bought with paralysis. ' +
          "Describe it as a habit of mind in plain words (for example, 'you put more energy into " +
          "settling things than into gathering what is around you'); never label it 'judging vs " +
          "perceiving', 'deciding vs taking in', or an 'inward/outward side'.",
        lever
          ? `Starved-side lever: ${lever}, the strongest ${jp.starvedSide} function. Name its ` +
            'activation conditions in section 5 (intake rituals before decisions, or artificial ' +
            'closure devices), never a personality prescription.'
          : 'No starved-side lever is computable; say so rather than inventing one.',
      ],
    });
  } else if (jp.note) {
    // Table row: jp mixed gets the one licensed hedged note and NO fragment.
    push({
      id: 'jp-note',
      kind: 'jp-note',
      title: 'Mixed active set, one hedged composition note',
      section: 2,
      salience: 66,
      mode: 'brief',
      forkRequired: false,
      functions: [...jp.activeSet],
      mergedFrom: [],
      instructions: [
        `Neither judging nor perceiving pressure fires: the active set is mixed. The single ` +
          `licensed note, watch-item grade: "${jp.note}". No pressure dynamic, no fragment, ` +
          'no second sentence.',
      ],
    });
  }
}

/* ------------------------------------------------------------------ *
 * Render plan ordering (05 §5.1 salience)
 * ------------------------------------------------------------------ */

/** Change a feature's rendering mode after the fact, keeping its budget in step. */
function setMode(feature: RenderFeature, mode: RenderMode): void {
  feature.mode = mode;
  feature.budgetWords = BUDGET[mode];
}

function orderPlan(features: RenderFeature[]): RenderFeature[] {
  return features
    .map((feature, index) => ({ feature, index }))
    .sort((a, b) =>
      a.feature.salience === b.feature.salience
        ? a.index - b.index
        : a.feature.salience - b.feature.salience,
    )
    .map((entry) => entry.feature);
}

/* ------------------------------------------------------------------ *
 * Friction instruction
 * ------------------------------------------------------------------ */

/**
 * Section 6. Framework provenance, not profile content: the same facts the reader-facing
 * static text below carries, handed to the model as instructions so it can write them in
 * this report's own voice and reading level.
 */
function provenanceInstructions(): string[] {
  return [
    '300-500 words. This section says nothing about the person. It explains where ' +
      'the method comes from and what we did with it. No numbers, no predictions.',
    'Sources (community ideas): we took ideas from four guides on ' +
      'mbti-notes.tumblr.com (Type Fundamentals, Function Theory, Type Development, ' +
      'Type Spotting) and from Naomi Quenk\'s "grip" idea. These are personality-community ' +
      'writing. They have never been tested by science. Say that plainly.',
    'What we changed (our guess): those sources tie their patterns to 16 fixed types. ' +
      'We kept the patterns but read them from the person\'s quiz scores instead. We look ' +
      'at the gaps between scores, and we ignore the fixed type order. Real quiz results ' +
      'almost never match one of the 16 classic orders (only 16 out of 40,320 possible ' +
      'orders are "classic"). This change is our own guess. It has never been tested.',
    'Why we give no type label: eight separate scores tell more than 16 boxes. Published ' +
      'research rejected fixed function order (Reynierse 2009). A type label would be a ' +
      'claim we cannot back up.',
    'What rests on real science: the "if this situation, then this response" idea comes ' +
      'from Mischel and Shoda (1995). The finding that people move through many states ' +
      'comes from Fleeson (2001). The if-then shape is real science. Every guess about ' +
      'which habit fits which situation is still ours.',
    'Be honest about the input: the eight scores come from a hobby quiz that has never ' +
      'been tested for accuracy. People often get different results on retake.',
    'Use the simplest words possible. Keep sentences under 15 words. ' +
      'Say "this tool" or "this method" or "the quiz," never "pipeline" or "framework" or ' +
      '"instrument" or "validity evidence." Say "your answers" or "your results," never ' +
      '"your scores" or "ranked." The disclaimer block at the end is fixed. Copy it ' +
      'exactly as given. Keep confidence levels clear here too. This section is where the ' +
      'reader learns which parts are science and which are our guesses.',
  ];
}

/**
 * Section 3. The report invents its own situations and predicts behaviour in each, which
 * is what "if a certain scenario, how does this person tend to behave" asks for.
 *
 * The vignette is a hypothetical the model may furnish with everyday texture; the demand
 * mapping comes from the taxonomy and the supply grade comes from the Signature, and
 * neither is negotiable.
 */
function scenarioInstructions(scenarios: readonly Scenario[]): string[] {
  const instructions: string[] = [
    `Render ALL ${scenarios.length} scenarios below, each as its own vignette, in this order. ` +
      'Add no scenario and drop none.',
    'Open every vignette by setting the scene naturally. Paint the situation so the reader ' +
      'can picture who is there, what needs doing, when and where it happens, why it matters, ' +
      'and how the person has to handle it. Weave all of this into two or three tight sentences. ' +
      'Do not use labels like "Who", "What", "When". The scene given for each scenario is the ' +
      'seed: keep its substance. You may add concrete everyday texture to make it feel like a ' +
      'real situation (that texture is invented, so phrase it as a guess).',
    'Then, for each scenario, THREE TO FOUR if-then signatures in the canonical template: ' +
      '"When [situation detail], you likely [observable prediction]; if instead you find ' +
      '[counter-observation], that would tell us [revision]." No falsifier, no signature. ' +
      'Vary what the signatures read: the demand itself, the workaround substitution it ' +
      'invites, the modifiers stacked on it, and what it bills afterwards.',
    'Then close each scenario with one trade-off line. What this situation costs this ' +
      'profile, attached to the same feature that makes it easy or hard.',
    'One honest line for the section, in your own words: these situations are hypothetical ' +
      'and were built from the profile itself, so the reader should test them against real ' +
      'life rather than take them as descriptions of their actual week. Do not claim they ' +
      'were personalised, and do not pretend the reader described any situation.',
    'Each scenario is a DIFFERENT supply grade on purpose, so the vignettes must read ' +
      'differently: flow, stretch and friction predict different failures. A flow verdict is ' +
      'not praise. Name what that situation is NOT exercising.',
    `Demand weighting, a PRIVATE procedure for choosing what each scenario demands ` +
      `(hardcoded rule, follow exactly; never mention weighting, grades, or any of this to the reader): ${DEMAND_WEIGHTING_RULE}`,
    'The demand-to-function mapping comes from the taxonomy fragment; the supply grade comes ' +
      'from supplyGrades[function] in the Signature. Never re-derive a grade, never infer one ' +
      'from a raw score, and NEVER print the grade word. Translate each grade into how the ' +
      'situation is likely to feel: flow = comes easily; near-flow = mostly comfortable; ' +
      'scaffolded-stretch = doable with effort and support; friction = a real strain. Name every ' +
      'demanded habit in everyday words (Rule 0.5).',
  ];

  for (const scenario of scenarios) {
    const scene = [
      `People: ${scenario.frame.who}`,
      `Task: ${scenario.frame.what}`,
      `Timing: ${scenario.frame.when}`,
      `Setting: ${scenario.frame.where}`,
      `Stakes: ${scenario.frame.why}`,
      `Approach: ${scenario.frame.how}`,
    ].join('. ');
    const line =
      `SCENARIO ${scenario.band.toUpperCase()} (all of this is PRIVATE, translate to plain words, ` +
      `print none of it): ${scenario.demandType}; demands ${fnList(scenario.demands)}; supply grade of ` +
      `${scenario.demands[0]}: ${scenario.supplyGrade} (say how it FEELS, never the grade word). Scene: ${scene}`;
    instructions.push(line);
    if (scenario.band === 'eruption-risk' && scenario.eruptionFn) {
      instructions.push(
        `  ...and overlay these escalation modifiers on that scene: ${scenario.modifiers.join('; ')}. ` +
          `That is three modifiers on a friction demand, so eruption risk is FLAGGED for ` +
          `${scenario.eruptionFn}: predict its crude form under depletion, name the ` +
          'early-warning sign to watch for first (the loss of ordinary lead-function quality, ' +
          'before any of the crude behaviour), and keep it hedged. This is a generalized ' +
          'community concept, not a finding.',
      );
    }
  }

  return instructions;
}

/* ------------------------------------------------------------------ *
 * FLAT: the deterministic honest-null report (05 §5.5, 03 §9)
 * ------------------------------------------------------------------ */

/**
 * Reader-facing provenance explainer, plain language, static. The model writes its own
 * version of this for section 6 of an LLM report; a FLAT report has no model in the loop,
 * so it ships this text verbatim instead. Same facts either way.
 *
 * Contains no type codes, no clinical vocabulary and no claim about the reader, so it
 * passes `auditReport` unchanged.
 */
export const FRAMEWORK_PROVENANCE_TEXT = [
  'We built this report from a small set of sources. Some are strong. Some are not. Here is what comes from where.',
  '',
  'Most of the ideas come from personality-community writing. Four guides on ' +
    'mbti-notes.tumblr.com (Type Fundamentals, Function Theory, Type Development, ' +
    'Type Spotting) and Naomi Quenk\'s idea of the "grip." These writers deserve credit. ' +
    'But none of this has been tested by science.',
  '',
  'Those sources describe patterns they call "loops" and "grips." These are about which ' +
    'mental habits you use together, which you avoid, and which come out when you are tired. ' +
    'The original sources tie these patterns to 16 fixed types.',
  '',
  'We did something different. We kept the patterns but stopped tying them to fixed types. ' +
    'Instead, we read them from your quiz scores. We look at the gaps between your numbers. ' +
    'We do this because real scores almost never match one of the 16 fixed orders. There are ' +
    '40,320 possible orders, and only 16 are the "classic" ones. This change is our own ' +
    'guess. It has never been tested.',
  '',
  'That is also why we give you no four-letter type label. Eight separate scores tell us ' +
    'more than one box out of 16. Published research also rejected the idea of a fixed ' +
    'order (Reynierse, 2009). A type label would be a claim we cannot back up.',
  '',
  'One part of this report does rest on real science. The idea that people act in ' +
    '"if this situation, then this response" patterns comes from Mischel and Shoda (1995). ' +
    'The finding that people move through many states, not just one fixed personality, comes ' +
    'from Fleeson (2001). That is why this report does not describe you in general. It ' +
    'builds specific situations and guesses how you would act in each one. The "if-then" ' +
    'shape is real science. Every guess about which habit fits which situation is still ours.',
  '',
  'Last: your eight scores come from a hobby quiz with no published proof that it works. ' +
    'People often get different results when they take it again.',
].join('\n');

/**
 * No LLM, no trait content. The single largest gap is the only structure a FLAT profile
 * may name, and it is named as a tentative watch item (02 §2 step 0).
 *
 * Two of the canonical headings, so the client's cards still match: the provenance
 * explainer (real content, no lie in it) and then the limits plus the disclaimer.
 */
export function buildHonestNullReport(signature: Signature): string {
  const watch = signature.watchItem;
  /** Plain everyday words for each habit, so the FLAT report names no bare codes. */
  const PLAIN: Record<FunctionKey, string> = {
    Ni: 'your gut sense of where things are heading',
    Ne: 'your knack for new ideas and what-ifs',
    Si: 'your habit of leaning on what has worked before',
    Se: 'your focus on what is right in front of you',
    Ti: 'your habit of working things out in your own head',
    Te: 'your habit of organizing and getting things done',
    Fi: 'your inner sense of what feels right',
    Fe: 'your habit of tuning into how other people feel',
  };
  const lines: string[] = [
    REPORT_HEADINGS[4],
    '',
    FRAMEWORK_PROVENANCE_TEXT,
    '',
    REPORT_HEADINGS[5],
    '',
    'Your eight answers came out very close together. The differences between them are too ' +
      'small for this quiz to read clearly. We cannot write a useful report from these results. ' +
      'Anything we said would be true of almost anyone.',
    '',
    'We cannot say which habit you lean on most, which ones work together, or which one you ' +
      'avoid. All of those readings need bigger differences than your answers show. A flat ' +
      'result usually means the quiz did a poor job, and three explanations are equally ' +
      'possible: you may truly shift with the situation, you may have answered near the middle ' +
      'each time, or you may have rushed through the quiz that day. This says nothing about ' +
      'your ability, your mental health, or your worth.',
    '',
  ];

  if (watch) {
    lines.push(
      `One small thing worth noting: the biggest gap between any two of your answers is ` +
        `${PLAIN[watch.above]} sitting just above ${PLAIN[watch.below]}. This is a small ` +
        'hint, and it could just be noise. If you take the quiz again and this gap gets ' +
        'bigger, it would be worth a closer look.',
      '',
    );
  }

  lines.push(
    'What might help: take the quiz again on a different day. Or try the longer Sakinorva ' +
      'Domains Test (256 questions), which can pick up smaller differences. Either one gives ' +
      'a better chance of getting results with a clear shape.',
    '',
    `> ${getDisclaimer()}`,
    '',
  );

  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * User message
 * ------------------------------------------------------------------ */

interface UserPromptInput {
  signature: Signature;
  scenarios: Scenario[];
  renderPlan: RenderFeature[];
  fragments: SelectedFragment[];
  budgetWords: number;
  minWords: number;
}

const GROUP_TITLES: Record<SelectedFragment['group'], string> = {
  shapes: 'Shapes (02 §4 hypotheses, detection and grades stripped; grades come from the Signature above)',
  dynamics: 'Dynamics (03, shape skeletons; compose them with the functions named in the render plan)',
  functions: 'Functions (01, per-function engagement states)',
  friction: 'Friction machinery (04 §b-§d, the intake schema is omitted: there is no reader intake)',
  always: 'Always on (03 §10, 04 §f, these frame every other section)',
};

function buildUserPrompt(input: UserPromptInput): string {
  const { signature, scenarios, renderPlan, fragments } = input;
  const { budgetWords, minWords } = input;
  const out: string[] = [];

  out.push('# 1. STACK SIGNATURE (computed, authoritative)');
  out.push('');
  out.push(
    'All geometry is here. Treat every number, grade, and code as PRIVATE EVIDENCE for your reasoning only; never print, quote, or cite any of it in the report. Translate each into plain everyday words (Rule 0.5). Never re-derive a number and never rank functions that sit inside a tie.',
  );
  out.push('');
  out.push('```json');
  out.push(JSON.stringify(signature, null, 2));
  out.push('```');
  out.push('');

  out.push('# 2. RAW SCORES AND GENERATED SCENARIOS (all PRIVATE, never printed to the reader)');
  out.push('');
  out.push(
    'Scores as entered, never clamped or normalized (PRIVATE EVIDENCE, never print or cite a number): ' +
      inputOrder(signature.scores)
        .map((fn) => `${fn} ${signature.scores[fn]}`)
        .join(' · '),
  );
  out.push('');
  if (signature.warnings.length > 0) {
    out.push('Measurement warnings carried from the computation:');
    for (const warning of signature.warnings) out.push(`- ${warning}`);
    out.push('');
  }

  if (scenarios.length > 0) {
    out.push(
      `Section 3 asks one question: if a certain situation, how does this person tend to ` +
        `behave? The report supplies the situations itself. These ${scenarios.length} were ` +
        'computed by crossing the demand taxonomy with this profile\'s supply grades, so the ' +
        'set spans the ladder on purpose. Everything in the list below (the demands, the supply ' +
        'grades, the row labels) is PRIVATE evidence: translate it into how each situation is ' +
        'likely to FEEL, name every habit in everyday words, and print none of the labels, grades, ' +
        'or codes:',
    );
    out.push('');
    for (const scenario of scenarios) {
      out.push(
        `- ${scenario.band} (private), ${scenario.demandType}; ` +
          `demands ${fnList(scenario.demands)}; supply grade of ${scenario.demands[0]}: ` +
          `${scenario.supplyGrade} (translate to a feeling-word; never print it).`,
      );
      out.push(`    - People: ${scenario.frame.who}`);
      out.push(`    - Task: ${scenario.frame.what}`);
      out.push(`    - Timing: ${scenario.frame.when}`);
      out.push(`    - Setting: ${scenario.frame.where}`);
      out.push(`    - Stakes: ${scenario.frame.why}`);
      out.push(`    - Approach: ${scenario.frame.how}`);
      if (scenario.modifiers.length > 0) {
        out.push(`    - ESCALATION OVERLAY: ${scenario.modifiers.join('; ')}`);
      }
    }
    out.push('');
    out.push(
      'These situations are hypothetical and generic; only the predictions about them are ' +
        'keyed to this profile. Never imply the reader described any of them.',
    );
  } else {
    out.push(
      'No scenarios were generated: this profile resolves no bands, so no demand can be ' +
        'graded against it. Say that plainly in section 3 and invent nothing.',
    );
  }
  out.push('');

  out.push('# 3. RENDER PLAN (computed, the airtime allocation)');
  out.push('');
  out.push(
    'Ordered by salience. Render every feature, in the section named, at roughly its word ' +
      'budget; add no feature that is not listed and drop none that is. Fork-required features ' +
      'must be rendered as fork statements.',
  );
  out.push('');
  out.push(
    `Total allocated budget: ~${budgetWords} words across ${renderPlan.length} features.`,
  );
  if (minWords > 0) {
    out.push(
      `**Length contract: HARD MINIMUM ${minWords} words. Target: this plan's own total, ` +
        `~${budgetWords} words. A typical resolved profile lands in ` +
        `${TARGET_REPORT_WORDS[0]}–${TARGET_REPORT_WORDS[1]}.** This profile resolves real ` +
        'structure, so a short report would waste it. Buy the length with depth on the ' +
        'features below and with composition between them (Rule 0 and the inventiveness ' +
        'license in your instructions). Never with generic prose, never with a feature this ' +
        'plan does not list.',
    );
  } else {
    out.push(
      '**No length minimum applies.** This profile resolves little; the honest output is ' +
        'short. Only the provenance section runs at full length. Padding here would be a ' +
        'generation error.',
    );
  }
  out.push('');
  out.push(
    'HOW TO READ THIS PLAN (critical): every feature title and instruction below is INTERNAL ' +
      'shorthand for you. Titles, tier names, grades, the two-letter habit codes (Ni, Ti, …), ' +
      'internal terms (shadow floor, bridge, counterweight, active set, axis, polarized, cliff, ' +
      'gap, circuit, supply grade) and every number are PRIVATE EVIDENCE. Never reproduce a title, ' +
      'a code, an internal term, or a figure in the report. Replace every code with its everyday ' +
      'words (Rule 0.5) and every internal term with a plain description; print no number about the ' +
      'person. The word budgets are for you; never mention them.',
  );
  out.push('');
  renderPlan.forEach((feature, index) => {
    out.push(
      `${index + 1}. **${feature.title}**, section ${feature.section} · mode: ${feature.mode} · ` +
        `budget ~${feature.budgetWords} words${feature.forkRequired ? ' · FORK REQUIRED (render as a fork statement)' : ''}` +
        `${feature.mergedFrom.length > 0 ? ' · MERGED convergent detection: render once, not twice' : ''}`,
    );
    for (const instruction of feature.instructions) out.push(`   - ${instruction}`);
  });
  out.push('');

  out.push('# 4. KNOWLEDGE-BASE FRAGMENTS (the only interpretive material licensed here)');
  out.push('');
  let currentGroup: SelectedFragment['group'] | null = null;
  for (const fragment of fragments) {
    if (fragment.group !== currentGroup) {
      currentGroup = fragment.group;
      out.push(`## ${GROUP_TITLES[currentGroup]}`);
      out.push('');
    }
    out.push(`### ${fragment.key}`);
    out.push('');
    out.push(fragment.text);
    out.push('');
  }

  out.push('# 5. RENDER INSTRUCTION');
  out.push('');
  out.push(
    'Write Sections 2–7 ONLY. Section 1 is rendered client-side from the Signature above; ' +
      'do not restate it. Use EXACTLY these markdown headings, in this order, with nothing ' +
      'before the first one (the client matches these strings to render its cards):',
  );
  out.push('');
  for (const heading of REPORT_HEADINGS) out.push(`- \`${heading}\``);
  out.push('');
  out.push(
    'Obey the render plan\'s ordering, modes and word budgets. Ground every paragraph in a ' +
      'named feature of the Signature plus a named mechanism (Rule 0), and compose the fired ' +
      'features into readings no single fragment states. Phrase those composed readings as guesses. ' +
      'Keep every confidence level audible. Print no number, score, grade, or two-letter habit code anywhere in the report, ' +
      'and name every mental habit with its everyday words (Rule 0.5). End the report with this ' +
      'disclaimer block, reproduced verbatim as a markdown blockquote, and write nothing after it:',
  );
  out.push('');
  out.push(`> ${getDisclaimer()}`);
  out.push('');

  return out.join('\n');
}

