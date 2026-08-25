/**
 * Section 1 - "Your stack signature" (05 §5.1).
 *
 * Code-rendered from the Signature object, never from the model, so it cannot
 * drift from the arithmetic and every later claim has something auditable to
 * point at. This module reads the Signature and formats it; it computes no
 * geometry, derives no threshold and asserts nothing the Signature did not
 * already assert.
 *
 * Honesty rules it implements literally:
 *  - ties are rendered as SETS, with the mandatory phrasing of 05 §5.5
 *    ("statistically indistinguishable - treat their order as unknown");
 *  - boundaries carry their gap size plus "cliff" / "marginal (retest-fragile)";
 *  - borderline indices are flagged;
 *  - FLAT / STAIRCASE print a regime notice instead of a tier structure;
 *  - order inside a band is never called a rank.
 */

import type {
  Boundary,
  FunctionKey,
  Segment,
  Signature,
  Smear,
  SortedEntry,
} from '../../shared/geometry/types';
import { FUNCTION_NAMES } from './InputForm';

const TIE_PHRASE = 'statistically indistinguishable — treat their order as unknown';
const RETEST = 'marginal (retest-fragile)';

const TIER_LABELS: Record<string, string> = {
  lead: 'Lead',
  support: 'Support',
  reserve: 'Reserve',
  shadow: 'Shadow',
};

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Points on the 0-50 scale: integers stay bare, decimals keep one place. */
function pts(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Ratio indices: always signed, always two places, real minus sign. */
function ratio(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

function fnList(fns: readonly FunctionKey[]): string {
  return fns.join(', ');
}

function flag(text: string): HTMLElement {
  return el('span', 'flag', text);
}

function joinNodes(parent: HTMLElement, nodes: (Node | string)[], separator = ' · '): void {
  nodes.forEach((node, i) => {
    if (i > 0) parent.appendChild(document.createTextNode(separator));
    parent.appendChild(typeof node === 'string' ? document.createTextNode(node) : node);
  });
}

/* ------------------------------------------------------------------ *
 * Score rows and bands
 * ------------------------------------------------------------------ */

function scoreRow(entry: SortedEntry, scaleMax: number): HTMLElement {
  const row = el('div', 'score-row');
  row.appendChild(el('span', 'fn', entry.fn));
  row.appendChild(el('span', 'val', pts(entry.score)));
  row.appendChild(el('span', 'fn-name', FUNCTION_NAMES[entry.fn]));

  const bar = el('div', 'bar');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `${pts(entry.score)} of ${pts(scaleMax)}`);
  const fill = el('i');
  const ratioOfScale = scaleMax > 0 ? entry.score / scaleMax : 0;
  fill.style.width = `${Math.max(0, Math.min(1, ratioOfScale)) * 100}%`;
  bar.appendChild(fill);
  row.appendChild(bar);

  if (entry.score < 0 || entry.score > scaleMax) {
    row.appendChild(flag(`outside 0–${pts(scaleMax)}, used as entered`));
  }
  return row;
}

function tieNote(segment: Segment, smear: Smear | undefined, B: number): HTMLElement[] {
  const notes: HTMLElement[] = [];

  if (!smear) {
    if (segment.members.length >= 2) {
      // Unsmeared: the whole band spans <= B, so every pair inside it is a tie.
      notes.push(
        el(
          'p',
          'band-note tie',
          `${fnList(segment.members)} — ${TIE_PHRASE}. Read them as one set.`,
        ),
      );
    }
    return notes;
  }

  notes.push(
    el(
      'p',
      'band-note tie',
      `Chained near-ties: this band spans ${pts(smear.span)}, wider than the ${pts(B)}-point ` +
        'noise band, but no internal gap is big enough to cut it. The order shown is not a ranking.',
    ),
  );

  const ties = smear.pairwise.filter((pair) => pair.tie);
  const separations = smear.pairwise.filter((pair) => pair.genuinelyAbove);

  if (ties.length) {
    const note = el('p', 'band-note');
    note.appendChild(el('b', undefined, `${TIE_PHRASE}:`));
    const list = el('ul');
    for (const pair of ties) {
      list.appendChild(
        el('li', undefined, `${pair.above} and ${pair.below} — ${pts(pair.diff)} apart`),
      );
    }
    note.appendChild(list);
    notes.push(note);
  }

  if (separations.length) {
    // The full pairwise table is what makes later claims auditable, but it grows
    // as n^2 - so it is present and collapsed rather than absent or overwhelming.
    const note = el('details', 'band-note notes');
    note.appendChild(
      el('summary', undefined, `Separations the noise band does license (${separations.length})`),
    );
    const list = el('ul');
    for (const pair of separations) {
      const suffix = pair.hedged ? ` — ${RETEST}` : '';
      list.appendChild(
        el(
          'li',
          undefined,
          `${pair.above} above ${pair.below} by ${pts(pair.diff)}${suffix}`,
        ),
      );
    }
    note.appendChild(list);
    notes.push(note);
  }

  notes.push(
    el(
      'p',
      'band-note',
      `Upper edge: ${fnList(smear.upperEdge)} · lower edge: ${fnList(smear.lowerEdge)} ` +
        '(the two ends the band can be read from; the windows may overlap).',
    ),
  );

  return notes;
}

function bandBlock(
  segment: Segment,
  sig: Signature,
  entriesByFn: Map<FunctionKey, SortedEntry>,
): HTMLElement {
  const band = el('div', 'tier-band');
  band.dataset.tier = segment.tier ?? 'none';

  const head = el('div', 'tier-band-head');
  head.appendChild(el('span', 'tier-tag', TIER_LABELS[segment.tier ?? ''] ?? 'Unresolved'));
  const meta =
    segment.members.length === 1
      ? 'one function, alone in its band'
      : `span ${pts(segment.span)}${segment.smeared ? ' · smeared' : ''}`;
  head.appendChild(el('span', 'tier-band-meta', meta));
  band.appendChild(head);

  for (const fn of segment.members) {
    const entry = entriesByFn.get(fn);
    if (entry) band.appendChild(scoreRow(entry, sig.options.scaleMax));
  }

  const smear = sig.smears.find((candidate) => candidate.segmentIndex === segment.index);
  for (const note of tieNote(segment, smear, sig.options.B)) band.appendChild(note);

  return band;
}

function boundaryRow(boundary: Boundary): HTMLElement {
  const row = el('div', `boundary${boundary.cliff ? ' cliff' : ''}`);
  const parts: string[] = [`${boundary.above} → ${boundary.below}`, `gap ${pts(boundary.gap)}`];
  if (boundary.cliff) parts.push(boundary.marginalCliff ? `cliff · ${RETEST}` : 'cliff');
  else parts.push(boundary.marginal ? `boundary · ${RETEST}` : 'boundary');
  row.appendChild(el('span', undefined, parts.join(' · ')));
  return row;
}

/* ------------------------------------------------------------------ *
 * Indices
 * ------------------------------------------------------------------ */

function indexRow(key: string, value: (v: HTMLElement) => void): HTMLElement {
  const row = el('div', 'index-row');
  row.appendChild(el('span', 'k', key));
  const box = el('span', 'v');
  value(box);
  row.appendChild(box);
  return row;
}

function indicesBlock(sig: Signature): HTMLElement {
  const wrap = el('div', 'index-rows');
  const { tilt, axes, axisOrder, jp, differentiation, elevation, sums } = sig.indices;

  wrap.appendChild(
    indexRow('Attitude tilt', (box) => {
      const nodes: (Node | string)[] = [
        `${ratio(tilt.value)} · ${tilt.class} ${tilt.direction}`,
      ];
      if (tilt.borderline) nodes.push(flag('borderline'));
      joinNodes(box, nodes);
      box.appendChild(
        el(
          'span',
          'aside',
          `outward (E) ${pts(sums.E)} vs inward (I) ${pts(sums.I)} of ${pts(sums.total)}`,
        ),
      );
    }),
  );

  for (const axisKey of axisOrder) {
    const axis = axes[axisKey];
    wrap.appendChild(
      indexRow(`${axis.members[0]} – ${axis.members[1]}`, (box) => {
        const nodes: (Node | string)[] = [`${pts(axis.pol)} apart · ${axis.class}`];
        if (axis.tie) nodes.push(flag('within the noise band'));
        if (axis.borderline) nodes.push(flag('borderline'));
        joinNodes(box, nodes);
        const detail = axis.tie
          ? `${TIE_PHRASE}. Pair mean ${pts(axis.pairMean)}, ` +
            `${axis.aboveProfileMean ? 'at or above' : 'below'} the profile mean.`
          : `${axis.high} high, ${axis.low} low · pair mean ${pts(axis.pairMean)}, ` +
            `${axis.aboveProfileMean ? 'at or above' : 'below'} the profile mean.`;
        box.appendChild(el('span', 'aside', detail));
      }),
    );
  }

  wrap.appendChild(
    indexRow('J / P composition', (box) => {
      const composition = jp.composition;
      const verdict = composition.fires
        ? composition.fires === 'judging-pressure'
          ? 'judging pressure fires — the perceiving side is the one going hungry'
          : 'perceiving pressure fires — the judging side is the one going hungry'
        : 'nothing fires — the active set is mixed';
      box.appendChild(document.createTextNode(verdict));
      const active = composition.activeSet.length ? fnList(composition.activeSet) : 'none asserted';
      box.appendChild(
        el(
          'span',
          'aside',
          `active set: ${active} · judging ${composition.judging.length}, ` +
            `perceiving ${composition.perceiving.length} · J/P index ${ratio(jp.value)} ` +
            `(${jp.class} ${jp.direction}, context only)`,
        ),
      );
      if (composition.note) box.appendChild(el('span', 'aside', composition.note));
    }),
  );

  wrap.appendChild(
    indexRow('Differentiation', (box) => {
      const nodes: (Node | string)[] = [
        `${pts(differentiation.value)} · ${differentiation.class}`,
      ];
      if (differentiation.borderline) nodes.push(flag('borderline'));
      joinNodes(box, nodes);
      box.appendChild(el('span', 'aside', 'top-to-bottom spread of the eight scores'));
    }),
  );

  wrap.appendChild(
    indexRow('Elevation', (box) => {
      const nodes: (Node | string)[] = [`${pts(elevation.value)} · ${elevation.class}`];
      if (elevation.allHigh || elevation.allLow) nodes.push(flag('edge case: read shape only'));
      joinNodes(box, nodes);
      box.appendChild(
        el(
          'span',
          'aside',
          'mean of the eight — as much a response-style artifact as anything about you; ' +
            'never ability, health or worth',
        ),
      );
    }),
  );

  return wrap;
}

/* ------------------------------------------------------------------ *
 * Detections
 * ------------------------------------------------------------------ */

function detectionsBlock(sig: Signature): HTMLElement | null {
  const hasShapes = sig.shapes.length > 0;
  const hasCircuit = sig.circuit !== null;
  const hasEruption = sig.eruption.firm.length > 0 || sig.eruption.watch.length > 0;
  if (!hasShapes && !hasCircuit && !hasEruption) return null;

  const wrap = el('div');
  wrap.appendChild(el('h3', 'sub-title', 'What the arithmetic detected'));
  wrap.appendChild(
    el('p', 'card-sub', 'Names of shapes, not readings of them. The report below does the reading.'),
  );

  if (hasShapes) {
    const chips = el('div', 'chip-row');
    for (const shape of sig.shapes) {
      const chip = el('span', 'shape-chip');
      const label = shape.members.length
        ? `${shape.id} · ${shape.name} (${fnList(shape.members)})`
        : `${shape.id} · ${shape.name}`;
      chip.appendChild(document.createTextNode(label));
      if (shape.grade) chip.appendChild(flag(shape.grade));
      if (shape.marginal) chip.appendChild(flag(`${RETEST} — fork required`));
      else if (shape.hedged) chip.appendChild(flag('hedged'));
      chips.appendChild(chip);
    }
    wrap.appendChild(chips);
  }

  const rows = el('div', 'index-rows');

  if (sig.circuit) {
    const circuit = sig.circuit;
    rows.appendChild(
      indexRow('Closed circuit', (box) => {
        const nodes: (Node | string)[] = [
          `${circuit.kind} · ${circuit.grade} · strength ${pts(circuit.strength)}`,
        ];
        if (circuit.marginal) nodes.push(flag(RETEST));
        if (circuit.fromSmearedLead) nodes.push(flag('read off a smeared lead'));
        joinNodes(box, nodes);
        box.appendChild(
          el(
            'span',
            'aside',
            `lead ${fnList(circuit.lead)} (${circuit.leadAttitude}, floor ${pts(circuit.leadMinimum)}) ` +
              `vs counterweight ${circuit.counterweight} ${pts(circuit.counterweightScore)}`,
          ),
        );
      }),
    );
  }

  for (const candidate of [...sig.eruption.firm, ...sig.eruption.watch, ...sig.eruption.summaryOnly]) {
    rows.appendChild(
      indexRow('Shadow floor', (box) => {
        const nodes: (Node | string)[] = [`${candidate.fn} · ${candidate.grade} candidate`];
        if (candidate.marginal) nodes.push(flag(RETEST));
        joinNodes(box, nodes);
        const bridge =
          candidate.bridge && candidate.bridgeScore !== null
            ? `${candidate.bridge} ${pts(candidate.bridgeScore)}`
            : 'none';
        box.appendChild(
          el(
            'span',
            'aside',
            `${pts(candidate.boundaryGap)} below the band above it · axis partner ` +
              `${candidate.axisPartner}${candidate.axisPartnerElevated ? ' (elevated)' : ''} · ` +
              `same-attitude bridge ${bridge}`,
          ),
        );
      }),
    );
  }

  if (rows.childElementCount > 0) wrap.appendChild(rows);
  return wrap;
}

/* ------------------------------------------------------------------ *
 * Regime notices
 * ------------------------------------------------------------------ */

function regimeNotice(sig: Signature): HTMLElement | null {
  if (sig.regime === 'NORMAL') return null;
  const box = el('div', 'regime-notice');

  if (sig.regime === 'FLAT') {
    box.appendChild(el('b', undefined, 'FLAT — no tiers asserted. '));
    box.appendChild(
      document.createTextNode(
        `Top-to-bottom spread is ${pts(sig.indices.differentiation.value)}, inside the reach of ` +
          `a ${pts(sig.options.B)}-point noise band (≤ ${pts(sig.thresholds.flatSpread)}). ` +
          'No tier boundary can be claimed, so none is shown.',
      ),
    );
    if (sig.watchItem) {
      box.appendChild(
        el(
          'p',
          undefined,
          `Largest single gap: ${sig.watchItem.above} → ${sig.watchItem.below}, ` +
            `${pts(sig.watchItem.gap)}. A tentative watch item, not a boundary.`,
        ),
      );
    }
    return box;
  }

  box.appendChild(el('b', undefined, 'STAIRCASE — no tier boundary exists. '));
  box.appendChild(
    document.createTextNode(
      `The profile descends by steps: nothing adjacent is more than ${pts(sig.options.B)} apart, ` +
        `while the whole spread is ${pts(sig.indices.differentiation.value)}. Only the contrast ` +
        'between the top and bottom ends is interpretable — everything between them is a chain ' +
        'of near-ties.',
    ),
  );
  return box;
}

/* ------------------------------------------------------------------ *
 * The card
 * ------------------------------------------------------------------ */

export function createSignatureView(sig: Signature): HTMLElement {
  const card = el('wired-card', 'signature-card');
  card.appendChild(el('h2', 'card-title', 'Your stack signature'));
  card.appendChild(
    el(
      'p',
      'card-sub',
      'Arithmetic and detection only, computed in your browser from the eight numbers you ' +
        'entered — no interpretation on this card. Everything the report says below has to ' +
        'point back to something here.',
    ),
  );

  const notice = regimeNotice(sig);
  if (notice) card.appendChild(notice);

  const entriesByFn = new Map(sig.sorted.map((entry) => [entry.fn, entry]));
  const stack = el('div', 'stack');

  if (sig.segments.length === 0) {
    // FLAT: one undifferentiated block, sorted but explicitly not ranked.
    const band = el('div', 'tier-band');
    band.dataset.tier = 'none';
    const head = el('div', 'tier-band-head');
    head.appendChild(el('span', 'tier-tag', 'Unresolved'));
    head.appendChild(
      el('span', 'tier-band-meta', `spread ${pts(sig.indices.differentiation.value)}`),
    );
    band.appendChild(head);
    for (const entry of sig.sorted) band.appendChild(scoreRow(entry, sig.options.scaleMax));
    band.appendChild(
      el(
        'p',
        'band-note tie',
        'Listed high to low for legibility only. With no boundary to stand on, this order is ' +
          'not a ranking.',
      ),
    );
    stack.appendChild(band);
  } else {
    sig.segments.forEach((segment, i) => {
      stack.appendChild(bandBlock(segment, sig, entriesByFn));
      const boundary = sig.boundaries[i];
      if (boundary && i < sig.segments.length - 1) stack.appendChild(boundaryRow(boundary));
    });
  }
  card.appendChild(stack);

  if (sig.activeSet.length) {
    card.appendChild(
      el(
        'p',
        'band-note',
        `Active set: ${fnList(sig.activeSet)}${
          sig.operativeLead.length && fnList(sig.operativeLead) !== fnList(sig.activeSet)
            ? ` · operative lead reading: ${fnList(sig.operativeLead)}`
            : ''
        }.`,
      ),
    );
  }

  card.appendChild(el('h3', 'sub-title', 'Indices'));
  card.appendChild(indicesBlock(sig));

  const detections = detectionsBlock(sig);
  if (detections) card.appendChild(detections);

  if (sig.warnings.length) {
    const notes = el('details', 'notes');
    notes.appendChild(
      el('summary', undefined, `Measurement notes (${sig.warnings.length})`),
    );
    const list = el('ul');
    for (const warning of sig.warnings) list.appendChild(el('li', undefined, warning));
    notes.appendChild(list);
    card.appendChild(notes);
  }

  return card;
}
