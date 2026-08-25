/**
 * 02 §2.1: the supply-grade contract exported to the friction map (04).
 *
 * Ladder: flow > near-flow > scaffolded-stretch > friction.
 * Base grades by tier; inside a smeared segment the edge windows adjust them.
 * These grades are the ONLY licensed downstream use of edge windows - the
 * windows remain descriptive, never tiers, never a rank.
 */

import {
  type FunctionKey,
  FUNCTION_KEYS,
  type Regime,
  SUPPLY_LADDER,
  type Segment,
  type SupplyGrade,
  type TierName,
} from './types';

export interface SupplyInput {
  regime: Regime;
  segments: Segment[];
}

export interface SupplyOutput {
  grades: Record<FunctionKey, SupplyGrade>;
  forks: Partial<Record<FunctionKey, readonly [SupplyGrade, SupplyGrade]>>;
  warnings: string[];
}

const BASE_GRADE: Record<TierName, SupplyGrade> = {
  lead: 'flow',
  support: 'near-flow',
  reserve: 'scaffolded-stretch',
  shadow: 'friction',
};

/**
 * One grade lower, "floored at scaffolded stretch (friction is reserved for
 * shadow-floor membership)" (02 §2.1). A shadow-floor member is already at the
 * bottom of the ladder, so demoting it is a no-op.
 */
function demote(grade: SupplyGrade): SupplyGrade {
  if (grade === 'friction') return 'friction';
  const i = SUPPLY_LADDER.indexOf(grade);
  if (i < 0) return grade;
  const next = SUPPLY_LADDER[i + 1];
  if (next === undefined || next === 'friction') return 'scaffolded-stretch';
  return next;
}

export function computeSupplyGrades(input: SupplyInput): SupplyOutput {
  const grades = Object.fromEntries(FUNCTION_KEYS.map((fn) => [fn, 'unrated'])) as Record<
    FunctionKey,
    SupplyGrade
  >;
  const forks: Partial<Record<FunctionKey, readonly [SupplyGrade, SupplyGrade]>> = {};
  const warnings: string[] = [];

  if (input.regime !== 'NORMAL') {
    /* No tiers exist, so no tier can supply a base grade (02 §2 step 0). */
    warnings.push(
      `Supply grades unrated: the ${input.regime} regime asserts no tiers, so 02 §2.1's ` +
        'base-grade-by-tier rule has nothing to read from.',
    );
    return { grades, forks, warnings };
  }

  for (const segment of input.segments) {
    if (segment.tier === null) continue;
    const base = BASE_GRADE[segment.tier];

    for (const fn of segment.members) {
      if (!segment.smeared) {
        grades[fn] = base;
        continue;
      }

      const inUpper = segment.upperEdge.includes(fn);
      const inLower = segment.lowerEdge.includes(fn);
      const lowered = demote(base);

      if (inUpper && !inLower) {
        // Upper-edge member takes the segment's base grade.
        grades[fn] = base;
      } else if (inLower && !inUpper) {
        // Lower-edge member takes one grade lower, floored.
        grades[fn] = lowered;
      } else if (base === lowered) {
        // Both windows (or neither), but the fork would name one grade twice.
        grades[fn] = base;
      } else {
        // In both windows or in neither: a hedged fork between the two grades.
        grades[fn] = 'fork';
        forks[fn] = [base, lowered];
        warnings.push(
          `${fn} sits ${inUpper ? 'in both edge windows' : 'in neither edge window'} of a ` +
            `smeared ${segment.tier}: supply grade is a hedged fork between ${base} and ${lowered}.`,
        );
      }
    }
  }

  return { grades, forks, warnings };
}
