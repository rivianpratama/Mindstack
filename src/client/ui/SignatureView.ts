/**
 * Section 1 - "Your stack signature" (05 §5.1), deliberately minimal.
 *
 * Code-rendered from the Signature so it can never drift from the arithmetic.
 * A super-compact snapshot of the tier structure: which functions currently
 * lead, which support, which sit in the shadow - each shown with the raw score
 * it was grouped by, so the report below can still be checked against it. Every
 * interpretation (axes, circuits, eruption candidates, the indices) lives in the
 * plain-language report, not here.
 *
 * FLAT / STAIRCASE profiles have no readable tiers, so those regimes get one
 * honest line instead of an invented stack.
 */

import type { FunctionKey, Signature, TierName } from '../../shared/geometry/types';
import { FUNCTION_NAMES } from './InputForm';

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

/** The tiers shown, top to bottom. Reserve appears only when the profile has one. */
const TIER_ORDER: readonly TierName[] = ['lead', 'support', 'reserve', 'shadow'];

const TIER_LABEL: Readonly<Record<TierName, string>> = {
  lead: 'Lead',
  support: 'Support',
  reserve: 'Reserve',
  shadow: 'Shadow',
};

/** One function: bold code, a small muted score, and its full name in the tooltip. */
function fnChip(fn: FunctionKey, score: number): HTMLElement {
  const chip = el('span', 'sig-fn');
  chip.title = `${fn} — ${FUNCTION_NAMES[fn]}`;
  chip.appendChild(el('b', undefined, fn));
  chip.appendChild(el('i', 'sig-fn-score', pts(score)));
  return chip;
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
  if (sig.regime === 'FLAT') {
    box.appendChild(
      el(
        'p',
        undefined,
        'Your answers came out very even — no habit clearly stands out, so there is no ' +
          'lead-support-shadow stack to draw. The report below stays short and honest instead.',
      ),
    );
  } else {
    box.appendChild(
      el(
        'p',
        undefined,
        'Your answers step down gently, with no clear break between them — not enough ' +
          'separation to split into a lead-support-shadow stack. Only your top few versus ' +
          'your bottom few is worth reading.',
      ),
    );
  }
  return box;
}

export function createSignatureView(sig: Signature): HTMLElement {
  const card = el('wired-card', 'signature-card');
  card.appendChild(el('h2', 'card-title', 'Your stack signature'));
  card.appendChild(
    el(
      'p',
      'card-sub',
      'Your habits, grouped from most-used (Lead) down to least-used (Shadow) — worked out ' +
        'right here in your browser.',
    ),
  );

  const notice = regimeNotice(sig);
  if (notice) card.appendChild(notice);

  const stack = el('div', 'sig-signature');
  for (const tier of TIER_ORDER) {
    const fns = sig.tiers[tier];
    if (fns.length) stack.appendChild(tierRow(tier, fns, sig));
  }
  if (stack.childElementCount) card.appendChild(stack);

  if (sig.sorted.some((entry) => entry.noiseTieWithPrev)) {
    card.appendChild(
      el(
        'p',
        'band-note tie',
        'Some of these sit so close together that their order is really a coin toss — ' +
          'read those as about equal.',
      ),
    );
  }

  return card;
}
