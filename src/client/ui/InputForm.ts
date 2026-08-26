/**
 * The input surface: eight scores, grouped by axis pair. That is the whole
 * form - the report's situational material is generated server-side from the
 * geometry, so there is nothing for the person to describe.
 *
 * The form never corrects, clamps or reorders anything. It hands raw strings to
 * validateScores (02 §1) and lets the confirm dialog decide what happens to an
 * out-of-range value.
 *
 * Once a report is running the card hides itself completely, leaving only a back
 * button - the report should own the screen without anyone having to scroll past
 * the form to reach it. The back button brings the form back for editing.
 */

import { AXIS_KEYS, AXIS_MEMBERS, type AxisKey, type FunctionKey } from '../../shared/geometry/types';
import {
  DEFAULT_REPORT_LANGUAGE,
  isReportLanguage,
  type ReportLanguage,
} from '../../shared/language';
import type { RawScores } from '../api';
import { createAccordion } from './accordion';
import { attrs, el } from './dom';

/** Code plus the full name, as both the form label and the signature legend. */
export const FUNCTION_NAMES: Readonly<Record<FunctionKey, string>> = {
  Ni: 'introverted intuition',
  Ne: 'extraverted intuition',
  Si: 'introverted sensing',
  Se: 'extraverted sensing',
  Ti: 'introverted thinking',
  Te: 'extraverted thinking',
  Fi: 'introverted feeling',
  Fe: 'extraverted feeling',
};

export const AXIS_LABELS: Readonly<Record<AxisKey, string>> = {
  'Ni-Se': 'Ni – Se',
  'Ne-Si': 'Ne – Si',
  'Ti-Fe': 'Ti – Fe',
  'Te-Fi': 'Te – Fi',
};

/** The worked example threaded through the docs (02 §5 / 05 §5.7, Profile A). */
export const EXAMPLE_SCORES: Readonly<Record<FunctionKey, number>> = {
  Ni: 39.6,
  Ti: 34,
  Te: 31,
  Fi: 30,
  Ne: 25.4,
  Se: 25,
  Si: 21,
  Fe: 8,
};

export interface InputFormApi {
  element: HTMLElement;
  /** Raw, untouched strings - parsing and range checks belong to validation. */
  readScores(): RawScores;
  /** The selected report language. Falls back to English if the DOM is in a weird state. */
  readLanguage(): ReportLanguage;
  setBusy(busy: boolean): void;
  markInvalid(fns: readonly FunctionKey[]): void;
  showErrors(messages: readonly string[]): void;
  focusField(fn: FunctionKey): void;
  fillExample(): void;
  /**
   * Shut the panel and show the read-only chip row, refreshed from the live
   * inputs. Idempotent. Resolves once the height transition has settled, so the
   * caller can schedule a scroll that will not be computed against a stale
   * layout.
   */
  collapse(): Promise<void>;
  /** Reopen for editing. Idempotent. Does not steal focus. */
  expand(): Promise<void>;
  readonly collapsed: boolean;
  /** Flag the report on screen as no longer matching what is in the form. */
  setStale(stale: boolean): void;
}

/** A left-pointing arrow for the back button. */
function backArrow(): HTMLElement {
  const wrap = el('span', 'back-arrow');
  wrap.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  attrs(svg, {
    viewBox: '0 0 16 16', width: '15', height: '15', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M10 3.5L5.5 8L10 12.5');
  svg.appendChild(path);
  wrap.appendChild(svg);
  return wrap;
}

export function createInputForm(onSubmit: () => void): InputFormApi {
  const acc = createAccordion({
    id: 'scores-panel',
    label: 'Your eight scores',
    className: 'card input-card',
    open: true,
    icon: backArrow,
    iconFirst: true,
  });
  const card = acc.root;
  card.dataset.stale = 'false';

  /*
   * The head is the back button, and CSS gives it height only while the card is
   * shut. So the open state is a plain card with no disclosure chrome, and the
   * shut state is a lone "back" affordance.
   */

  const panel = acc.content;
  panel.appendChild(el('h2', 'card-title', 'Your eight scores'));
  panel.appendChild(
    el(
      'p',
      'card-sub',
      'From the Sakinorva cognitive-functions test. Roughly 0 to 50 each. Nothing is stored. ' +
        'Everything is computed in your browser.',
    ),
  );

  const scoreInputs = new Map<FunctionKey, HTMLInputElement>();
  const fieldWraps = new Map<FunctionKey, HTMLElement>();
  /** No report exists before the first collapse, so nothing can be stale yet. */
  let hasCollapsedOnce = false;

  /*
   * A real <form>, so Enter in any field submits and the enterkeyhint="go" on
   * the last field is a promise the browser can actually keep. Submission is
   * intercepted; the page never navigates.
   */
  const scoreForm = el('form');
  scoreForm.addEventListener('submit', (event) => {
    event.preventDefault();
    onSubmit();
  });

  for (const axis of AXIS_KEYS) {
    const group = el('div', 'axis-group');
    group.appendChild(el('h3', undefined, AXIS_LABELS[axis]));
    const fields = el('div', 'axis-fields');
    for (const fn of AXIS_MEMBERS[axis]) {
      const wrap = el('div', 'field');
      const id = `score-${fn}`;

      const label = el('label', 'field-label');
      label.setAttribute('for', id);
      label.textContent = `${fn}: ${FUNCTION_NAMES[fn]}`;
      wrap.appendChild(label);

      const input = el('input', 'input t-input');
      /*
       * type="text", not type="number", on purpose. A number input reports
       * anything it cannot parse as the empty string, so "39,6" from a
       * comma-decimal locale would reach validateScores as *missing* rather
       * than *non-numeric* and the reader would be told the field is blank.
       * inputmode="decimal" still raises the numeric keypad on mobile.
       *
       * No min/max either: they bring :invalid styling and clamping hints, and
       * this form never clamps (02 §1). The confirm dialog is the only range
       * mechanism.
       */
      attrs(input, {
        id,
        type: 'text',
        inputmode: 'decimal',
        name: fn,
        placeholder: '0–50',
        autocomplete: 'off',
        enterkeyhint: fn === 'Fi' ? 'go' : 'next',
      });
      input.addEventListener('input', () => {
        wrap.classList.remove('invalid');
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
        if (hasCollapsedOnce) api.setStale(true);
      });
      wrap.appendChild(input);

      scoreInputs.set(fn, input);
      fieldWraps.set(fn, wrap);
      fields.appendChild(wrap);
    }
    group.appendChild(fields);
    scoreForm.appendChild(group);
  }

  /* ---- report language ---- */

  /*
   * A native radio group dressed as a segmented control: two options is the
   * whole space, so a select would hide one behind a click. The inputs stay in
   * the DOM (visually covered by their caption) so arrow keys, form semantics
   * and screen readers get the standard radio-group pattern for free; state is
   * the native :checked, no bespoke class.
   */
  const langInputs: HTMLInputElement[] = [];
  const langGroup = el('fieldset', 'lang-group');
  langGroup.appendChild(el('legend', 'lang-legend', 'Report language'));
  const langSeg = el('div', 'lang-seg');
  const addLanguage = (value: ReportLanguage, caption: string): void => {
    const option = el('label', 'lang-opt');
    const input = el('input');
    attrs(input, { type: 'radio', name: 'report-language', value });
    input.checked = value === DEFAULT_REPORT_LANGUAGE;
    input.addEventListener('change', () => {
      // A different language means the report on screen no longer matches.
      if (hasCollapsedOnce) api.setStale(true);
    });
    option.append(input, el('span', 'lang-opt-label', caption));
    langSeg.appendChild(option);
    langInputs.push(input);
  };
  addLanguage('en', 'English');
  addLanguage('id', 'Bahasa Indonesia');
  langGroup.appendChild(langSeg);
  scoreForm.appendChild(langGroup);

  /* ---- actions ---- */

  const errors = el('div', 'form-errors');
  errors.id = 'form-errors';
  errors.hidden = true;
  errors.setAttribute('role', 'alert');

  const actions = el('div', 'form-actions');
  const submit = el('button', 'btn btn-primary', 'Generate my report');
  submit.type = 'submit';
  actions.appendChild(submit);

  const example = el('button', 'example-link', 'fill example (Profile A)');
  example.type = 'button';
  actions.appendChild(example);

  scoreForm.appendChild(actions);
  panel.appendChild(scoreForm);
  panel.appendChild(
    el('p', 'stale-note', 'Edited. Generate again to update the report below.'),
  );
  panel.appendChild(errors);

  const api: InputFormApi = {
    element: card,

    readScores(): RawScores {
      const raw: RawScores = {};
      for (const [fn, input] of scoreInputs) raw[fn] = input.value.trim();
      return raw;
    },

    readLanguage(): ReportLanguage {
      const checked = langInputs.find((input) => input.checked);
      return checked && isReportLanguage(checked.value) ? checked.value : DEFAULT_REPORT_LANGUAGE;
    },

    setBusy(busy: boolean) {
      submit.disabled = busy;
      submit.textContent = busy ? 'Working…' : 'Generate my report';
      /*
       * The eight inputs stay enabled. The card can be reopened mid-run, and a
       * reopened card full of dead fields is a dead end. Nothing re-reads the
       * form during a run - run() captured its scores by value - so editing is
       * safe; the stale note is what keeps it honest.
       *
       * The example link does get disabled: filling it mid-stream would
       * silently desync the form from the report on screen.
       */
      example.disabled = busy;
    },

    markInvalid(fns: readonly FunctionKey[]) {
      for (const [fn, wrap] of fieldWraps) {
        wrap.classList.remove('invalid');
        scoreInputs.get(fn)?.removeAttribute('aria-invalid');
        scoreInputs.get(fn)?.removeAttribute('aria-describedby');
      }
      for (const fn of fns) {
        // shadcn's split: the wrapper class styles the block (label), while
        // aria-invalid on the control drives BOTH the border/halo CSS and the
        // assistive-tech signal, so pixels and announcement cannot drift.
        // aria-describedby links back to the role="alert" error list.
        fieldWraps.get(fn)?.classList.add('invalid');
        const input = scoreInputs.get(fn);
        input?.setAttribute('aria-invalid', 'true');
        input?.setAttribute('aria-describedby', 'form-errors');
      }
    },

    showErrors(messages: readonly string[]) {
      errors.replaceChildren();
      if (messages.length === 0) {
        errors.hidden = true;
        return;
      }
      errors.hidden = false;
      errors.appendChild(el('b', undefined, 'Before we can compute anything:'));
      const list = el('ul');
      for (const message of messages) list.appendChild(el('li', undefined, message));
      errors.appendChild(list);
      // Restart the shake, so a second failed submit is not silent.
      errors.classList.remove('t-shake');
      void errors.offsetWidth;
      errors.classList.add('t-shake');
    },

    focusField(fn: FunctionKey) {
      // inert is cleared synchronously inside set(), so the focus lands in the
      // same tick even though the height is still animating.
      if (api.collapsed) void api.expand();
      scoreInputs.get(fn)?.focus();
    },

    fillExample() {
      for (const [fn, input] of scoreInputs) input.value = String(EXAMPLE_SCORES[fn]);
      api.markInvalid([]);
      api.showErrors([]);
    },

    collapse(): Promise<void> {
      hasCollapsedOnce = true;
      return acc.set(false);
    },

    expand(): Promise<void> {
      return acc.set(true);
    },

    get collapsed(): boolean {
      return !acc.open;
    },

    setStale(stale: boolean) {
      card.dataset.stale = String(stale);
    },
  };

  example.addEventListener('click', () => api.fillExample());
  return api;
}
