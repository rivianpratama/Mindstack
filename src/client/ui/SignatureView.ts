/**
 * "The math behind this" - the full geometric readout, rendered from the
 * Signature so it can never drift from the arithmetic.
 *
 * This sits BELOW the finished report and only appears once the report is
 * complete: it is the working, not the answer. The report is what the reader
 * came for, and nothing here should push it down the page.
 *
 * Every reading is translated into plain language. The Signature speaks in the
 * vocabulary of 02 (tilt classes, axis polarization, supply grades, shape ids
 * S1-S12); a reader who has never heard of any of that has to be able to follow
 * every line. Codes appear only beside the person's own numbers.
 *
 * FLAT / STAIRCASE profiles have no readable tiers, so those regimes get one
 * honest line instead of an invented stack.
 */

import { AXIS_KEYS, type AxisKey, type FunctionKey, type Signature, type SupplyGrade, type TierName } from '../../shared/geometry/types';
import { AXIS_LABELS, FUNCTION_NAMES } from './InputForm';
import { el } from './dom';

/** Points on the 0-50 scale: integers stay bare, decimals keep one place. */
function pts(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The tiers shown, top to bottom. Reserve appears only when the profile has one. */
const TIER_ORDER: readonly TierName[] = ['lead', 'support', 'reserve', 'shadow'];

const TIER_LABEL: Readonly<Record<TierName, string>> = {
  lead: 'Most used',
  support: 'Often used',
  reserve: 'Sometimes used',
  shadow: 'Least used',
};

/** Plain-English gloss for each of the thirteen recurring shapes (02 §4). */
const SHAPE_PLAIN: Readonly<Record<string, string>> = {
  S1: 'One habit stands clearly ahead of all the others.',
  S2: 'Two habits share the top, close enough that neither really wins.',
  S3: 'Several habits share the top rather than one leading.',
  S3b: 'A smaller group sits together at a level below the top.',
  S4: 'The top habits are bunched tightly together.',
  S5: 'Your habits step down evenly, with no clear break anywhere.',
  S6: 'Your habits all came out at about the same level.',
  S7: 'There is a large drop down to the habit at the bottom.',
  S8: 'Your habits split into a clear upper group and a clear lower group.',
  S9: 'One pair is strongly one-sided.',
  S10: 'One pair is used heavily on both sides.',
  S11: 'One pair is used lightly on both sides.',
  S12: 'Your top habits all face the same direction.',
};

const SUPPLY_PLAIN: Readonly<Record<SupplyGrade, { label: string; note: string }>> = {
  flow: { label: 'Comes easily', note: 'You reach for this without much effort.' },
  'near-flow': { label: 'Comes fairly easily', note: 'Close to effortless, but not quite.' },
  'scaffolded-stretch': {
    label: 'Works with effort',
    note: 'Available to you, but it takes support or preparation.',
  },
  friction: { label: 'Costs real effort', note: 'Using this tends to be tiring.' },
  fork: { label: 'Could go either way', note: 'The numbers do not settle this one.' },
  unrated: { label: 'Not enough to say', note: 'Your scores are too even to grade this.' },
};

/** One function: bold code, a small muted score, and its full name in the tooltip. */
function fnChip(fn: FunctionKey, score: number): HTMLElement {
  const chip = el('span', 'sig-fn');
  chip.title = `${fn}: ${FUNCTION_NAMES[fn]}`;
  chip.appendChild(el('b', undefined, fn));
  chip.appendChild(el('i', 'sig-fn-score', pts(score)));
  return chip;
}

/** A titled block within the readout. */
function block(title: string, blurb?: string): HTMLElement {
  const box = el('section', 'sig-block');
  box.appendChild(el('h3', undefined, title));
  if (blurb) box.appendChild(el('p', 'sig-blurb', blurb));
  return box;
}

/** One label / value line. */
function readout(key: string, value: string, note?: string): HTMLElement {
  const row = el('div', 'readout-row');
  row.appendChild(el('span', 'readout-k', key));
  const right = el('span', 'readout-v');
  right.appendChild(el('b', undefined, value));
  if (note) right.appendChild(el('span', 'readout-note', note));
  row.appendChild(right);
  return row;
}

/** One tier as a single line: a colored tag, then the functions grouped under it. */
function tierRow(tier: TierName, fns: readonly FunctionKey[], sig: Signature): HTMLElement {
  const row = el('div', 'sig-tier');
  row.dataset.tier = tier;
  row.appendChild(el('span', 'sig-tier-tag', TIER_LABEL[tier]));
  const list = el('div', 'sig-fns');
  for (const fn of fns) list.appendChild(fnChip(fn, sig.scores[fn]));
  row.appendChild(list);
  return row;
}

/** A short, plain note for the two regimes where no tier stack is readable. */
function regimeNotice(sig: Signature): HTMLElement | null {
  if (sig.regime === 'NORMAL') return null;
  const box = el('div', 'regime-notice');
  box.appendChild(
    el(
      'p',
      undefined,
      sig.regime === 'FLAT'
        ? 'Your answers came out very even. No habit clearly stands out, so there is no ' +
            'stack to draw. The report stays short and honest instead.'
        : 'Your answers step down gently, with no clear break between them. There is not ' +
            'enough difference to split them into a stack. Only the top few compared to the ' +
            'bottom few is worth reading.',
    ),
  );
  return box;
}

/**
 * The compact tier strip: the headline reading, shown as soon as the numbers
 * validate and kept on screen while the report streams.
 *
 * Each function carries the score it was grouped by, so the grouping can be
 * checked against the numbers without opening anything. The cliffs, the axis
 * readings and everything else stay in the full readout below the report.
 *
 * FLAT and STAIRCASE have no readable tiers, so they get no strip at all rather
 * than an invented one.
 */
export function createTierStrip(sig: Signature): HTMLElement | null {
  const strip = el('div', 'tier-strip t-toast');
  for (const tier of TIER_ORDER) {
    const fns = sig.tiers[tier];
    if (!fns.length) continue;
    const group = el('div', 'tier-strip-group');
    group.dataset.tier = tier;
    group.appendChild(el('span', 'tier-strip-tag', TIER_LABEL[tier]));
    const list = el('span', 'tier-strip-fns');
    for (const fn of fns) {
      const item = el('span', 'tier-strip-fn');
      item.title = `${fn}: ${FUNCTION_NAMES[fn]} — ${pts(sig.scores[fn])} points`;
      item.appendChild(el('b', undefined, fn));
      item.appendChild(el('i', undefined, pts(sig.scores[fn])));
      list.appendChild(item);
    }
    group.appendChild(list);
    strip.appendChild(group);
  }
  return strip.childElementCount ? strip : null;
}

/* ---- the blocks ---- */

function stackBlock(sig: Signature): HTMLElement | null {
  const stack = el('div', 'sig-signature');
  for (const tier of TIER_ORDER) {
    const fns = sig.tiers[tier];
    if (fns.length) stack.appendChild(tierRow(tier, fns, sig));
  }
  if (!stack.childElementCount) return null;

  const box = block(
    'Your eight habits, grouped',
    'Grouped by how far apart your numbers are, from most used down to least used.',
  );
  box.appendChild(stack);

  // A cliff is a genuinely large drop, worth naming in plain terms.
  const cliffs = sig.boundaries.filter((b) => b.cliff);
  if (cliffs.length) {
    const list = el('ul', 'sig-list');
    for (const b of cliffs) {
      list.appendChild(
        el(
          'li',
          undefined,
          `There is a big drop between ${b.above} and ${b.below} — ${pts(b.gap)} points. ` +
            'That is a real break, not rounding.',
        ),
      );
    }
    box.appendChild(list);
  }

  if (sig.sorted.some((entry) => entry.noiseTieWithPrev)) {
    box.appendChild(
      el(
        'p',
        'band-note tie',
        'Some of these are so close together that their order is really a coin toss. ' +
          'Read those as about equal.',
      ),
    );
  }
  return box;
}

function balanceBlock(sig: Signature): HTMLElement {
  const { tilt, jp, differentiation, elevation } = sig.indices;
  const box = block(
    'The balance of your numbers',
    'Four summaries of your eight answers taken as a whole.',
  );
  const rows = el('div', 'readout');

  const tiltWord =
    tilt.direction === 'inward'
      ? 'toward your inner world'
      : tilt.direction === 'outward'
        ? 'toward the outside world'
        : 'evenly between inner and outer';
  const tiltStrength =
    tilt.class === 'strong' ? 'Leans strongly' : tilt.class === 'mild' ? 'Leans a little' : 'Sits';
  rows.appendChild(
    readout(
      'Inner vs outer',
      `${tiltStrength} ${tiltWord}`,
      tilt.borderline ? 'This one is close to the line, so hold it loosely.' : undefined,
    ),
  );

  const jpWord =
    jp.direction === 'judging'
      ? 'toward settling things'
      : jp.direction === 'perceiving'
        ? 'toward keeping options open'
        : 'evenly between the two';
  const jpStrength =
    jp.class === 'strong' ? 'Leans strongly' : jp.class === 'mild' ? 'Leans a little' : 'Sits';
  rows.appendChild(
    readout(
      'Settling vs exploring',
      `${jpStrength} ${jpWord}`,
      jp.borderline ? 'Close to the line — hold it loosely.' : undefined,
    ),
  );

  const diffWord =
    differentiation.class === 'high'
      ? 'Widely spread'
      : differentiation.class === 'moderate'
        ? 'Somewhat spread'
        : 'Close together';
  rows.appendChild(
    readout(
      'How spread out',
      diffWord,
      differentiation.class === 'low'
        ? 'When answers sit this close, small differences are noise, not signal.'
        : 'The wider the spread, the more the ordering above can be trusted.',
    ),
  );

  const elevWord =
    elevation.class === 'all-high'
      ? 'You rated nearly everything high'
      : elevation.class === 'all-low'
        ? 'You rated nearly everything low'
        : 'A normal middle range';
  rows.appendChild(
    readout(
      'Overall level',
      elevWord,
      elevation.class === 'mid'
        ? undefined
        : 'This usually says more about how a person answers questionnaires than about them.',
    ),
  );

  box.appendChild(rows);
  return box;
}

function axesBlock(sig: Signature): HTMLElement {
  const box = block(
    'Your four pairs',
    'Each habit has an opposite. This is how lopsided each pairing came out.',
  );
  const rows = el('div', 'readout');
  const order: readonly AxisKey[] = sig.indices.axisOrder.length ? sig.indices.axisOrder : AXIS_KEYS;

  for (const key of order) {
    const axis = sig.indices.axes[key];
    let value: string;
    if (axis.tie) {
      value = 'Too close to call';
    } else if (axis.class === 'balanced-high') {
      value = 'Both used a lot';
    } else if (axis.class === 'balanced-low') {
      value = 'Both used lightly';
    } else {
      const strength =
        axis.class === 'extreme'
          ? 'Strongly favours'
          : axis.class === 'polarized'
            ? 'Clearly favours'
            : 'Slightly favours';
      value = `${strength} ${axis.high}`;
    }
    rows.appendChild(
      readout(
        AXIS_LABELS[key],
        value,
        axis.tie
          ? 'The two sides are within the noise band.'
          : `${pts(axis.pol)} points apart.` + (axis.borderline ? ' Close to the line.' : ''),
      ),
    );
  }
  box.appendChild(rows);
  return box;
}

function patternsBlock(sig: Signature): HTMLElement | null {
  const named = sig.shapes.filter((shape) => SHAPE_PLAIN[shape.id]);
  if (!named.length && !sig.circuit) return null;

  const box = block(
    'Patterns in the shape',
    'Recurring arrangements the numbers fall into. These are descriptions, not diagnoses.',
  );

  if (named.length) {
    const list = el('ul', 'sig-list');
    for (const shape of named) {
      const item = el('li');
      item.appendChild(el('b', undefined, shape.name));
      item.appendChild(el('span', undefined, ` — ${SHAPE_PLAIN[shape.id]}`));
      if (shape.marginal || shape.hedged) {
        item.appendChild(
          el('span', 'readout-note', 'This one sits near the edge of its window — treat it as a maybe.'),
        );
      }
      list.appendChild(item);
    }
    box.appendChild(list);
  }

  if (sig.circuit) {
    const c = sig.circuit;
    const facing = c.kind === 'internal' ? 'inward' : 'outward';
    const rows = el('div', 'readout');
    rows.appendChild(
      readout(
        'A one-way top',
        c.grade === 'sealed'
          ? `Your most-used habits all face ${facing}, with little pulling the other way`
          : `Your most-used habits mostly face ${facing}`,
        `The strongest habit pulling the other way is ${c.counterweight}, ` +
          `${pts(c.counterweightScore)} points.` +
          (c.marginal ? ' This reading is close to the line.' : ''),
      ),
    );
    box.appendChild(rows);
  }
  return box;
}

function supplyBlock(sig: Signature): HTMLElement | null {
  const graded = (Object.keys(sig.supplyGrades) as FunctionKey[]).filter(
    (fn) => sig.supplyGrades[fn] !== 'unrated',
  );
  if (!graded.length) return null;

  const box = block(
    'How each habit sits right now',
    'Roughly what it costs you to reach for each one today. This can change.',
  );
  const rows = el('div', 'readout');
  const ranked = [...graded].sort((a, b) => sig.scores[b] - sig.scores[a]);

  for (const fn of ranked) {
    const grade = sig.supplyGrades[fn];
    const plain = SUPPLY_PLAIN[grade];
    const fork = sig.supplyForks[fn];
    const key = el('span', 'readout-k');
    key.appendChild(el('b', undefined, fn));
    key.appendChild(el('span', 'readout-fn-name', FUNCTION_NAMES[fn]));

    const row = el('div', 'readout-row');
    row.appendChild(key);
    const right = el('span', 'readout-v');
    right.appendChild(el('b', undefined, plain.label));
    right.appendChild(
      el(
        'span',
        'readout-note',
        fork
          ? `Somewhere between "${SUPPLY_PLAIN[fork[0]].label.toLowerCase()}" and ` +
              `"${SUPPLY_PLAIN[fork[1]].label.toLowerCase()}".`
          : plain.note,
      ),
    );
    row.appendChild(right);
    rows.appendChild(row);
  }
  box.appendChild(rows);
  return box;
}

function stressBlock(sig: Signature): HTMLElement | null {
  const { firm, watch, summaryOnly, capped } = sig.eruption;
  if (!firm.length && !watch.length) return null;

  const box = block(
    'What tends to surface under pressure',
    'Habits sitting far below the rest sometimes show up sideways when you are stretched. ' +
      'This is a guess from the spacing of your numbers, nothing more.',
  );
  const list = el('ul', 'sig-list');

  for (const candidate of firm) {
    const item = el('li');
    item.appendChild(el('b', undefined, `${candidate.fn}: ${FUNCTION_NAMES[candidate.fn]}`));
    item.appendChild(
      el(
        'span',
        undefined,
        ` — sits ${pts(candidate.depth)} points below the group above it.` +
          (candidate.marginal ? ' This is close to the line, so hold it loosely.' : ''),
      ),
    );
    if (candidate.bridge) {
      item.appendChild(
        el(
          'span',
          'readout-note',
          `If you want a way back to it, ${candidate.bridge} is the closest habit that faces the same direction.`,
        ),
      );
    }
    list.appendChild(item);
  }

  for (const candidate of watch) {
    const item = el('li');
    item.appendChild(el('b', undefined, `${candidate.fn}: ${FUNCTION_NAMES[candidate.fn]}`));
    item.appendChild(
      el('span', undefined, ' — worth watching, but the gap is not large enough to be sure.'),
    );
    list.appendChild(item);
  }

  box.appendChild(list);
  if (capped && summaryOnly.length) {
    box.appendChild(
      el(
        'p',
        'band-note',
        `${summaryOnly.length} more sit low enough to qualify. Naming them all would be ` +
          'reading more into the numbers than they support.',
      ),
    );
  }
  return box;
}

export function createSignatureView(sig: Signature): HTMLElement {
  const card = el('section', 'card signature-card');
  card.setAttribute('aria-labelledby', 'sig-title');
  const heading = el('h2', 'card-title', 'The math behind this');
  heading.id = 'sig-title';
  card.appendChild(heading);
  card.appendChild(
    el(
      'p',
      'card-sub',
      'Everything above came from these eight numbers. This is the whole working, in plain ' +
        'language, computed right here in your browser.',
    ),
  );

  const notice = regimeNotice(sig);
  if (notice) card.appendChild(notice);

  const blocks = [
    stackBlock(sig),
    balanceBlock(sig),
    axesBlock(sig),
    patternsBlock(sig),
    supplyBlock(sig),
    stressBlock(sig),
  ];
  for (const b of blocks) if (b) card.appendChild(b);

  return card;
}
