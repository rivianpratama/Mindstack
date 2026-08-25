/**
 * 02 §1 input handling: validate that all eight values are numeric; values
 * outside 0-50 are flagged back to the user for confirmation, NEVER silently
 * clamped. Magnitudes are always stored - a bare ordering is never stored,
 * because rank without distance destroys the information.
 */

import {
  DEFAULT_SCALE_MAX,
  FUNCTION_KEYS,
  type FunctionKey,
  type Scores,
} from './geometry/types';

export type ValidationCode =
  /** No value supplied for a function. */
  | 'missing'
  /** Supplied, but not a number (and not a numeric string). */
  | 'not-numeric'
  /** NaN or +/-Infinity. */
  | 'not-finite'
  /** Numeric and finite, but outside the expected scale: needs confirmation. */
  | 'out-of-range'
  /** A key that is not one of the eight functions. Ignored, but reported. */
  | 'unknown-key';

export interface ValidationFlag {
  code: ValidationCode;
  fn?: FunctionKey;
  key?: string;
  value?: unknown;
  message: string;
}

export interface ValidationResult {
  /** True when all eight values are present, numeric and finite. */
  ok: boolean;
  /**
   * The eight parsed values, exactly as given - out-of-range values included,
   * unclamped. Null only when `ok` is false.
   */
  scores: Scores | null;
  flags: ValidationFlag[];
  /** Functions whose value is outside 0-scaleMax: confirm, do not clamp. */
  outOfRange: FunctionKey[];
  /** True when the user must confirm before a report is generated. */
  needsConfirmation: boolean;
}

export interface ValidationOptions {
  /** Top of the expected scale. 02 §1 default: 50. */
  scaleMax?: number;
  /** Bottom of the expected scale. 02 §1 default: 0. */
  scaleMin?: number;
}

/**
 * Parses and checks eight raw inputs. Accepts numbers and numeric strings (the
 * form values arrive in), so the caller can hand over form state directly.
 */
export function validateScores(input: unknown, opts?: ValidationOptions): ValidationResult {
  const scaleMax = opts?.scaleMax ?? DEFAULT_SCALE_MAX;
  const scaleMin = opts?.scaleMin ?? 0;
  const flags: ValidationFlag[] = [];
  const outOfRange: FunctionKey[] = [];

  if (input === null || typeof input !== 'object') {
    return {
      ok: false,
      scores: null,
      flags: [
        {
          code: 'not-numeric',
          message: `Expected an object of eight scores, received ${describe(input)}.`,
          value: input,
        },
      ],
      outOfRange: [],
      needsConfirmation: false,
    };
  }

  const record = input as Record<string, unknown>;
  const known = new Set<string>(FUNCTION_KEYS);
  for (const key of Object.keys(record)) {
    if (!known.has(key)) {
      flags.push({
        code: 'unknown-key',
        key,
        value: record[key],
        message: `"${key}" is not one of the eight cognitive functions; it was ignored.`,
      });
    }
  }

  const parsed: Partial<Record<FunctionKey, number>> = {};
  let hard = false;

  for (const fn of FUNCTION_KEYS) {
    const raw = record[fn];

    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      flags.push({ code: 'missing', fn, value: raw, message: `${fn} is required.` });
      hard = true;
      continue;
    }

    let value: number;
    if (typeof raw === 'number') {
      value = raw;
    } else if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
      value = Number(raw);
    } else {
      flags.push({
        code: 'not-numeric',
        fn,
        value: raw,
        message: `${fn} must be a number (received ${describe(raw)}).`,
      });
      hard = true;
      continue;
    }

    if (!Number.isFinite(value)) {
      flags.push({
        code: 'not-finite',
        fn,
        value: raw,
        message: `${fn} must be a finite number (received ${describe(raw)}).`,
      });
      hard = true;
      continue;
    }

    parsed[fn] = value;

    if (value < scaleMin || value > scaleMax) {
      outOfRange.push(fn);
      flags.push({
        code: 'out-of-range',
        fn,
        value,
        // The wording the UI echoes back: 02 §1 wants confirmation, not a clamp.
        message: `${fn} = ${value} is outside ${scaleMin}-${scaleMax}. Confirm this is what the test reported; the value will be used as given, not adjusted.`,
      });
    }
  }

  if (hard) {
    return { ok: false, scores: null, flags, outOfRange, needsConfirmation: false };
  }

  return {
    ok: true,
    scores: parsed as Scores,
    flags,
    outOfRange,
    needsConfirmation: outOfRange.length > 0,
  };
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  return typeof value;
}
