/**
 * The UI half of 02 §1's input rule: everything that is missing or non-numeric
 * blocks the run, and everything merely out of range asks for confirmation.
 *
 * The one thing this module must never do is fix a number. An out-of-range score
 * is echoed back, confirmed by the person who typed it, and then passed through
 * completely unchanged - no clamping, no rescaling, no rounding.
 */

import { DEFAULT_SCALE_MAX, type FunctionKey } from '../../shared/geometry/types';
import type { ValidationResult } from '../../shared/validation';

export type ConfirmChoice = 'confirm' | 'edit';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The question the dialog asks about one out-of-range value. */
export function outOfRangeQuestion(
  fn: FunctionKey,
  value: unknown,
  scaleMin: number,
  scaleMax: number,
): string {
  return `${fn} = ${String(value)} is outside the expected ${scaleMin}–${scaleMax} range — confirm it's what the test showed?`;
}

export interface ValidationSummary {
  /** Hard blockers, phrased for a person. */
  messages: string[];
  /** The fields to mark. */
  invalid: FunctionKey[];
}

/** Turns validateScores' flags into something the form can show. */
export function summarizeFlags(result: ValidationResult): ValidationSummary {
  const messages: string[] = [];
  const invalid: FunctionKey[] = [];
  const missing: FunctionKey[] = [];

  for (const flag of result.flags) {
    if (flag.code === 'out-of-range' || flag.code === 'unknown-key') continue;
    if (flag.fn) invalid.push(flag.fn);
    if (flag.code === 'missing' && flag.fn) {
      missing.push(flag.fn);
      continue;
    }
    messages.push(flag.message);
  }

  if (missing.length === 8) {
    messages.unshift('All eight scores are needed — the geometry is the shape of the whole set.');
  } else if (missing.length > 0) {
    messages.unshift(
      `Still needed: ${missing.join(', ')}. All eight scores are required — the geometry is the ` +
        'shape of the whole set, so a missing value is not a zero.',
    );
  }

  return { messages, invalid };
}

export interface ConfirmOptions {
  scaleMin?: number;
  scaleMax?: number;
}

/**
 * Ask about every out-of-range value at once. Resolves 'confirm' to run with the
 * values exactly as typed, or 'edit' to go back to the form.
 */
export function confirmOutOfRange(
  result: ValidationResult,
  options: ConfirmOptions = {},
): Promise<ConfirmChoice> {
  const scaleMin = options.scaleMin ?? 0;
  const scaleMax = options.scaleMax ?? DEFAULT_SCALE_MAX;
  const questions = result.flags
    .filter((flag) => flag.code === 'out-of-range' && flag.fn)
    .map((flag) => outOfRangeQuestion(flag.fn as FunctionKey, flag.value, scaleMin, scaleMax));

  if (questions.length === 0) return Promise.resolve<ConfirmChoice>('confirm');

  return new Promise<ConfirmChoice>((resolve) => {
    const dialog = document.createElement('wired-dialog') as HTMLElement & { open: boolean };
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const body = el('div', 'dialog-body');
    const heading = el(
      'h2',
      undefined,
      questions.length === 1 ? 'One number to confirm' : `${questions.length} numbers to confirm`,
    );
    body.appendChild(heading);

    if (questions.length === 1) {
      body.appendChild(el('p', undefined, questions[0]));
    } else {
      const list = el('ul');
      for (const question of questions) list.appendChild(el('li', undefined, question));
      body.appendChild(list);
    }

    body.appendChild(
      el(
        'p',
        'fine',
        'The Sakinorva functions test normally reports 0–50. If that is genuinely what it ' +
          'showed, we will use the number exactly as you entered it — nothing is clamped, ' +
          'rescaled or rounded.',
      ),
    );

    const actions = el('div', 'dialog-actions');
    const confirm = el('wired-button', undefined, 'Confirm — use as entered');
    const edit = el('wired-button', undefined, 'Edit');
    actions.append(confirm, edit);
    body.appendChild(actions);
    dialog.appendChild(body);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const close = (choice: ConfirmChoice) => {
      document.removeEventListener('keydown', onKey, true);
      dialog.open = false;
      dialog.remove();
      previouslyFocused?.focus?.();
      resolve(choice);
    };

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close('edit');
      }
    }

    confirm.addEventListener('click', () => close('confirm'));
    edit.addEventListener('click', () => close('edit'));
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(dialog);
    // Open on the next frame so the card's slide-in transition actually runs.
    requestAnimationFrame(() => {
      dialog.open = true;
      requestAnimationFrame(() => confirm.focus());
    });
  });
}
