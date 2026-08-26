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
import { el, motionMs, prefersReducedMotion } from './dom';

export type ConfirmChoice = 'confirm' | 'edit';

/** The question the dialog asks about one out-of-range value. */
export function outOfRangeQuestion(
  fn: FunctionKey,
  value: unknown,
  scaleMin: number,
  scaleMax: number,
): string {
  return `${fn} = ${String(value)} is outside the expected ${scaleMin} to ${scaleMax} range. Is that what the test showed?`;
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
    messages.unshift('All eight scores are needed. The result depends on the shape of the whole set.');
  } else if (missing.length > 0) {
    messages.unshift(
      `Still needed: ${missing.join(', ')}. All eight scores are required. The result depends on ` +
        'the shape of the whole set, so a missing value is not a zero.',
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
    /*
     * A native <dialog>, which brings focus trapping, Escape, ::backdrop,
     * top-layer stacking and focus restoration on close - all of which this
     * function used to hand-roll around wired-dialog. It also means the content
     * finally inherits the theme instead of the literal ink colours
     * wired-dialog's white shadow-root card forced.
     */
    const dialog = el('dialog', 'dialog t-modal');
    // role and aria-modal are implicit on a modal <dialog>; stating them
    // explicitly removes the native semantics in some browsers.
    dialog.setAttribute('aria-labelledby', 'confirm-title');

    const body = el('div', 'dialog-body');
    const heading = el(
      'h2',
      undefined,
      questions.length === 1 ? 'One number to confirm' : `${questions.length} numbers to confirm`,
    );
    heading.id = 'confirm-title';
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
        'The Sakinorva functions test normally reports 0 to 50. If that is really what it ' +
          'showed, we will use the number exactly as you entered it. Nothing is changed, ' +
          'cut off, or rounded.',
      ),
    );

    /*
     * form[method=dialog] collapses every exit path onto one `close` event:
     * either button sets returnValue from its own value, and Escape leaves it
     * empty. So Escape reads as 'edit', which is what it has always meant here.
     *
     * Both paths are intercepted first, though: dialog.close() removes the
     * element from the top layer in the same frame, so the scale-out could
     * never play. Dropping .is-open, letting the t-modal tween run, and only
     * then closing is what makes the exit match the entrance.
     */
    /*
     * Every exit funnels into settle(), idempotently. Resolution deliberately
     * does NOT depend on the `close` event: at least one embedded Chromium
     * build never fires it, and a dialog that closes but never resolves leaves
     * the whole submit hanging. The `close` listener below stays as a fallback
     * for any path that skips closeWith.
     */
    let settled = false;
    const settle = (choice: ConfirmChoice): void => {
      if (settled) return;
      settled = true;
      dialog.remove();
      resolve(choice);
    };

    let closing = false;
    const closeWith = (value: string): void => {
      if (closing) return;
      closing = true;
      dialog.classList.remove('is-open');
      const finish = (): void => {
        if (dialog.open) dialog.close(value);
        settle(value === 'confirm' ? 'confirm' : 'edit');
      };
      if (prefersReducedMotion()) finish();
      else setTimeout(finish, motionMs('--modal-close-dur', 200) + 20);
    };

    const actions = el('form', 'dialog-actions');
    actions.setAttribute('method', 'dialog');
    actions.addEventListener('submit', (event) => {
      event.preventDefault();
      const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
      closeWith(submitter?.value ?? '');
    });
    const confirm = el('button', 'btn btn-primary', 'Confirm, use as entered');
    confirm.value = 'confirm';
    confirm.autofocus = true;
    const edit = el('button', 'btn btn-secondary', 'Edit');
    edit.value = 'edit';
    actions.append(confirm, edit);
    body.appendChild(actions);
    dialog.appendChild(body);

    // Escape: cancel would close instantly, so it is routed through the same
    // animated path. Empty returnValue still reads as 'edit'.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeWith('');
    });

    // Fallback only: settle() has usually run by the time this fires.
    dialog.addEventListener('close', () => {
      settle(dialog.returnValue === 'confirm' ? 'confirm' : 'edit');
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    // One frame between showModal() and .is-open so the scale-in actually runs.
    requestAnimationFrame(() => dialog.classList.add('is-open'));
  });
}
