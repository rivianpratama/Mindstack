/**
 * The input surface: eight scores grouped by axis pair, plus the optional 5W1H
 * intake (04 §a, questions quoted verbatim).
 *
 * The form never corrects, clamps or reorders anything. It hands raw strings to
 * validateScores (02 §1) and lets the confirm dialog decide what happens to an
 * out-of-range value.
 */

import { AXIS_KEYS, AXIS_MEMBERS, type AxisKey, type FunctionKey } from '../../shared/geometry/types';
import { CONTEXT_KEYS, type ContextKey, type RawScores, type ReportContext } from '../api';

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

/** 04 §a, verbatim: the six questions and what each one feeds. */
interface ContextField {
  key: ContextKey;
  label: string;
  question: string;
}

const CONTEXT_FIELDS: readonly ContextField[] = [
  {
    key: 'who',
    label: 'WHO — relational field',
    question:
      'Who is in this with you, and what do they expect of you? (alone / one familiar person / small team / strangers / an evaluator or authority)',
  },
  {
    key: 'what',
    label: 'WHAT — task type',
    question: 'What must you actually produce or handle? One sentence.',
  },
  {
    key: 'when',
    label: 'WHEN — timeframe and pressure',
    question:
      'How much time is there, and who set the clock? (open-ended / self-imposed / hard external deadline / unfolding in real time)',
  },
  {
    key: 'where',
    label: 'WHERE — setting and constraints',
    question: 'Where does this happen — and can you leave, pause, or reshape the setting?',
  },
  {
    key: 'why',
    label: 'WHY — stakes and motivation',
    question:
      'What happens if it goes badly? Do you personally care, or is the pressure external?',
  },
  {
    key: 'how',
    label: 'HOW — methods and autonomy',
    question:
      'Can you choose your own method and pace, or must you follow someone else’s procedure and tools?',
  },
];

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

/** wired-input exposes value/disabled as properties, not attributes. */
type ValueElement = HTMLElement & { value: string; disabled: boolean };

export interface InputFormApi {
  element: HTMLElement;
  /** Raw, untouched strings - parsing and range checks belong to validation. */
  readScores(): RawScores;
  /** Null when all six fields are blank. */
  readContext(): ReportContext | null;
  setBusy(busy: boolean): void;
  markInvalid(fns: readonly FunctionKey[]): void;
  showErrors(messages: readonly string[]): void;
  focusField(fn: FunctionKey): void;
  fillExample(): void;
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setValue(input: ValueElement, value: string): void {
  // Before the element's first render the property is stashed; the attribute is
  // the documented fallback, so set both and let whichever exists win.
  input.setAttribute('value', value);
  input.value = value;
}

export function createInputForm(onSubmit: () => void): InputFormApi {
  const card = el('wired-card', 'input-card');
  card.appendChild(el('h2', 'card-title', 'Your eight scores'));
  card.appendChild(
    el(
      'p',
      'card-sub',
      'From the Sakinorva cognitive-functions test — roughly 0–50 each. Nothing is stored; ' +
        'the geometry is computed in your browser.',
    ),
  );

  const scoreInputs = new Map<FunctionKey, ValueElement>();
  const fieldWraps = new Map<FunctionKey, HTMLElement>();

  for (const axis of AXIS_KEYS) {
    const group = el('div', 'axis-group');
    group.appendChild(el('h3', undefined, AXIS_LABELS[axis]));
    const fields = el('div', 'axis-fields');
    for (const fn of AXIS_MEMBERS[axis]) {
      const wrap = el('div', 'field');
      const id = `score-${fn}`;

      const label = el('label', 'field-label');
      label.setAttribute('for', id);
      label.textContent = `${fn} — ${FUNCTION_NAMES[fn]}`;
      wrap.appendChild(label);

      const input = document.createElement('wired-input') as ValueElement;
      input.setAttribute('id', id);
      input.setAttribute('type', 'number');
      input.setAttribute('step', 'any');
      input.setAttribute('inputmode', 'decimal');
      input.setAttribute('name', fn);
      input.setAttribute('placeholder', '0–50');
      input.setAttribute('aria-label', `${fn}, ${FUNCTION_NAMES[fn]}`);
      input.addEventListener('input', () => {
        wrap.classList.remove('invalid');
      });
      wrap.appendChild(input);

      scoreInputs.set(fn, input);
      fieldWraps.set(fn, wrap);
      fields.appendChild(wrap);
    }
    group.appendChild(fields);
    card.appendChild(group);
  }

  /* ---- optional 5W1H intake ---- */

  const details = el('details', 'context');
  const summary = el('summary');
  summary.appendChild(el('span', undefined, 'Your current situation (optional)'));
  details.appendChild(summary);

  const body = el('div', 'context-body');
  body.appendChild(
    el(
      'p',
      'card-sub',
      'Skip this and the report uses two or three common contexts and says so. Fill it in and ' +
        'section 3 is built around your actual situation.',
    ),
  );

  const contextInputs = new Map<ContextKey, ValueElement>();
  for (const field of CONTEXT_FIELDS) {
    const wrap = el('div', 'field');
    const id = `ctx-${field.key}`;

    const label = el('label', 'field-label');
    label.setAttribute('for', id);
    label.textContent = field.label;
    wrap.appendChild(label);
    wrap.appendChild(el('span', 'q', field.question));

    const area = document.createElement('wired-textarea') as ValueElement;
    area.setAttribute('id', id);
    area.setAttribute('rows', '2');
    area.setAttribute('name', field.key);
    area.setAttribute('aria-label', field.label);
    wrap.appendChild(area);

    contextInputs.set(field.key, area);
    body.appendChild(wrap);
  }
  details.appendChild(body);
  card.appendChild(details);

  /* ---- actions ---- */

  const errors = el('div', 'form-errors');
  errors.hidden = true;
  errors.setAttribute('role', 'alert');

  const actions = el('div', 'form-actions');
  const submit = document.createElement('wired-button') as HTMLElement & { disabled: boolean };
  submit.textContent = 'Generate my report';
  submit.addEventListener('click', () => {
    if (!submit.disabled) onSubmit();
  });
  actions.appendChild(submit);

  const example = el('button', 'example-link', 'fill example (Profile A)');
  example.setAttribute('type', 'button');
  actions.appendChild(example);

  card.appendChild(actions);
  card.appendChild(errors);

  const api: InputFormApi = {
    element: card,

    readScores(): RawScores {
      const raw: RawScores = {};
      for (const [fn, input] of scoreInputs) raw[fn] = input.value.trim();
      return raw;
    },

    readContext(): ReportContext | null {
      const context = {} as ReportContext;
      let filled = false;
      for (const key of CONTEXT_KEYS) {
        const value = (contextInputs.get(key)?.value ?? '').trim();
        context[key] = value;
        if (value !== '') filled = true;
      }
      return filled ? context : null;
    },

    setBusy(busy: boolean) {
      submit.disabled = busy;
      submit.textContent = busy ? 'Working…' : 'Generate my report';
      for (const input of scoreInputs.values()) input.disabled = busy;
    },

    markInvalid(fns: readonly FunctionKey[]) {
      for (const wrap of fieldWraps.values()) wrap.classList.remove('invalid');
      for (const fn of fns) fieldWraps.get(fn)?.classList.add('invalid');
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
    },

    focusField(fn: FunctionKey) {
      scoreInputs.get(fn)?.focus();
    },

    fillExample() {
      for (const [fn, input] of scoreInputs) setValue(input, String(EXAMPLE_SCORES[fn]));
      api.markInvalid([]);
      api.showErrors([]);
    },
  };

  example.addEventListener('click', () => api.fillExample());
  return api;
}
