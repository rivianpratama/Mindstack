/**
 * Layer 1 - the measurement layer. Pure, deterministic, no secrets, no network.
 * Runs on the client (instant Section-1 preview) and on the server (the
 * authoritative copy).
 *
 * Spec: docs/knowledge/02-profile-geometry.md, the sole owner of every
 * geometric term and threshold. Where 01/03/04/05 name a threshold they restate
 * 02, and 02 wins on any discrepancy (docs/knowledge/KNOWN-ISSUES.md).
 *
 * Arithmetic first, hypotheses second. Nothing in this module interprets.
 */

import {
  FUNCTION_KEYS,
  type GeometryOptions,
  type Scores,
  type Signature,
  deriveThresholds,
  resolveOptions,
} from './types';
import { analyzeTiers } from './tiers';
import { computeIndices } from './indices';
import { computeShapes } from './shapes';
import { computeEruption } from './eruption';
import { computeSupplyGrades } from './supply';

export * from './types';
export { analyzeTiers, type TierAnalysis } from './tiers';
export { computeIndices, type IndicesInput } from './indices';
export { computeShapes, strongestSharingAttitude } from './shapes';
export { computeEruption, ERUPTION_CAP } from './eruption';
export { computeSupplyGrades } from './supply';
export * from '../validation';

/**
 * Eight scores in, one stack signature out.
 *
 * Scores are never clamped or normalized (02 §1): out-of-range values are
 * carried through and reported in `warnings`. Run `validateScores` first if the
 * input came from a human.
 */
export function computeSignature(scores: Scores, opts?: GeometryOptions): Signature {
  const options = resolveOptions(opts);
  const thresholds = deriveThresholds(options);
  const warnings: string[] = [];

  for (const fn of FUNCTION_KEYS) {
    const value = scores[fn];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(
        `geometry: ${fn} must be a finite number (received ${String(value)}). ` +
          'Run validateScores() on user input before computing a signature.',
      );
    }
    if (value < 0 || value > options.scaleMax) {
      // 02 §1: flagged back to the user for confirmation, never silently clamped.
      warnings.push(
        `${fn} = ${value} is outside the expected 0-${options.scaleMax} range. ` +
          'The value is used as given, never clamped; confirm the transcription.',
      );
    }
  }

  const tiers = analyzeTiers(scores, options);
  warnings.push(...tiers.warnings);

  const indices = computeIndices({
    scores,
    activeSet: tiers.activeSet,
    spread: tiers.spread,
    options,
  });

  const { shapes, circuit, warnings: shapeWarnings } = computeShapes({
    scores,
    tiers,
    indices,
    options,
  });
  warnings.push(...shapeWarnings);

  const eruption = computeEruption({ scores, tiers });
  warnings.push(...eruption.warnings);

  const supply = computeSupplyGrades({ regime: tiers.regime, segments: tiers.segments });
  warnings.push(...supply.warnings);

  if (indices.elevation.allHigh) {
    warnings.push(
      `Elevation ${indices.elevation.value} is at or above the all-high edge ` +
        `(${thresholds.allHigh}): interpret shape only - elevation is confounded with ` +
        'response style, and is never overall ability, health or development (02 §6).',
    );
  }
  if (indices.elevation.allLow) {
    warnings.push(
      `Elevation ${indices.elevation.value} is at or below the all-low edge ` +
        `(${thresholds.allLow}): interpret shape only. Never read low elevation as ` +
        'deficiency or distress - no diagnosis (02 §6).',
    );
  }
  if (indices.differentiation.class === 'low' && tiers.regime !== 'FLAT') {
    warnings.push(
      'Low differentiation: a weak signal the report must state plainly rather than ' +
        'fill with content (02 §3).',
    );
  }

  return {
    regime: tiers.regime,
    scores: { ...scores },
    options,
    thresholds,
    sorted: tiers.sorted,
    gaps: tiers.gaps,
    boundaries: tiers.boundaries,
    segments: tiers.segments,
    tiers: tiers.tiers,
    tierOf: tiers.tierOf,
    smears: tiers.smears,
    activeSet: tiers.activeSet,
    operativeLead: tiers.operativeLead,
    leadAttitudes: tiers.leadAttitudes,
    balancedLead: tiers.balancedLead,
    indices,
    shapes,
    circuit,
    eruption: {
      firm: eruption.firm,
      watch: eruption.watch,
      summaryOnly: eruption.summaryOnly,
      capped: eruption.capped,
    },
    supplyGrades: supply.grades,
    supplyForks: supply.forks,
    watchItem: tiers.watchItem,
    warnings,
  };
}
