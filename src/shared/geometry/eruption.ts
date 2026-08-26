/**
 * 02 §6: the canonical eruption-candidacy rule. 01, 03, 04 and 05 import this
 * rule and define no other.
 *
 * Firm candidate: a shadow-floor function whose boundary above is a cliff.
 * Watch item only: a shadow-floor function above a gap-but-not-cliff boundary.
 * Priority: (a) axis partner in the Lead cluster or an upper edge, then (b) depth.
 * Cap: at most TWO candidates rendered per report.
 */

import {
  AXIS_PARTNER_OF,
  type EruptionCandidate,
  type Eruption,
  type Scores,
  r1,
} from './types';
import { strongestSharingAttitude } from './shapes';
import type { TierAnalysis } from './tiers';

/** 02 §6: "at most two candidates rendered per report". */
export const ERUPTION_CAP = 2;

export interface EruptionInput {
  scores: Scores;
  tiers: TierAnalysis;
}

export interface EruptionOutput extends Eruption {
  warnings: string[];
}

export function computeEruption(input: EruptionInput): EruptionOutput {
  const { scores, tiers: analysis } = input;
  const warnings: string[] = [];
  const empty: EruptionOutput = {
    firm: [],
    watch: [],
    summaryOnly: [],
    capped: false,
    warnings,
  };

  if (analysis.regime !== 'NORMAL') return empty;

  const floor = analysis.tiers.shadow;
  const boundary = analysis.shadowBoundary;
  if (floor.length === 0 || boundary === null) return empty;

  /* The score immediately above the boundary: how deep the floor sits below it. */
  const aboveScore = analysis.sorted[boundary.index]?.score ?? 0;

  const candidates: EruptionCandidate[] = floor.map((fn) => {
    const partner = AXIS_PARTNER_OF[fn];
    const bridge = strongestSharingAttitude(scores, fn);
    return {
      fn,
      grade: boundary.cliff ? 'firm' : 'watch',
      marginal: boundary.cliff ? boundary.marginalCliff : true,
      boundaryGap: boundary.gap,
      depth: r1(aboveScore - scores[fn]),
      axisPartner: partner,
      axisPartnerElevated: analysis.elevatedSet.includes(partner),
      bridge: bridge?.fn ?? null,
      bridgeScore: bridge?.score ?? null,
    };
  });

  /* Priority: (a) elevated axis partner, then (b) depth below the boundary. */
  const prioritized = [...candidates].sort(
    (a, b) =>
      Number(b.axisPartnerElevated) - Number(a.axisPartnerElevated) ||
      b.depth - a.depth ||
      floor.indexOf(a.fn) - floor.indexOf(b.fn),
  );

  const firmAll = prioritized.filter((c) => c.grade === 'firm');
  const watch = prioritized.filter((c) => c.grade === 'watch');

  const firm = firmAll.slice(0, ERUPTION_CAP);
  const summaryOnly = firmAll.slice(ERUPTION_CAP);

  if (summaryOnly.length > 0) {
    warnings.push(
      `Eruption cap: ${firmAll.length} firm candidates qualify, ${ERUPTION_CAP} rendered ` +
        `(${firm.map((c) => c.fn).join(', ')}). Remaining floor members ` +
        `(${summaryOnly.map((c) => c.fn).join(', ')}) get one summary line, never a catalog.`,
    );
  }

  if (watch.length > 0) {
    warnings.push(
      `Shadow floor sits below a gap that is not a cliff (${boundary.gap}): ` +
        `${watch.map((c) => c.fn).join(', ')} is a hedged watch item only - at most one line, ` +
        'never a firm "When things get stressful" feature.',
    );
  }

  return { firm, watch, summaryOnly, capped: summaryOnly.length > 0, warnings };
}
