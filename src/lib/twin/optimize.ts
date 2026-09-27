/** ---------------------------------------------------------------------------
 * Joint well-to-surface optimizer.
 *
 * Prototype approach: deterministic weighted grid search over the coupled
 * CSS + SRP decision space, scored against a baseline reference run.
 * The coupling is real — every candidate is simulated through the same
 * reservoir→wellbore→SRP→surface engine, so CSS choices shift the SRP optimum.
 * ------------------------------------------------------------------------- */

import { simulateCssSrpCycle } from "./simulate";
import type { CycleSummary, OperatingParams, Recommendation, SimulationResult } from "./types";

export interface OptimizationWeights {
  /** Weight on cycle oil production. */
  oil: number;
  /** Weight penalising steam-oil ratio. */
  sor: number;
  /** Weight penalising energy per barrel. */
  energy: number;
  /** Weight penalising worst equipment-risk score. */
  risk: number;
}

export const DEFAULT_WEIGHTS: OptimizationWeights = { oil: 1, sor: 0.8, energy: 0.5, risk: 0.7 };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Scale-free score: relative production minus relative penalties. */
export function objectiveScore(
  summary: CycleSummary,
  ref: { oil: number; sor: number; energyPerBarrel: number },
  w: OptimizationWeights,
): number {
  const oil = summary.oilProduced / Math.max(ref.oil, 1);
  const sor = summary.sor / Math.max(ref.sor, 0.01);
  const epb = summary.energyPerBarrel / Math.max(ref.energyPerBarrel, 1);
  const risk = Math.max(
    summary.worstRodFloatScore,
    summary.worstImpactLoadingScore,
    summary.worstPumpUnsettingScore,
    summary.worstRodFailureScore,
  );
  return w.oil * oil - w.sor * sor - w.energy * epb - w.risk * risk;
}

export interface OptimizerOptions {
  weights?: OptimizationWeights;
  /** Candidate multipliers on the base steam volume. */
  steamGrid?: number[];
  /** Candidate soak durations, days. */
  soakGrid?: number[];
  /** Candidate production-run lengths, days. */
  productionGrid?: number[];
  /** Candidate SPM values. */
  spmGrid?: number[];
  /** Candidate producing BHP, bar. */
  bhpGrid?: number[];
}

function buildCandidate(base: OperatingParams, o: Required<Pick<OptimizerOptions, "steamGrid" | "soakGrid" | "productionGrid" | "spmGrid" | "bhpGrid">>) {
  const out: OperatingParams[] = [];
  for (const steamMult of o.steamGrid) {
    for (const soak of o.soakGrid) {
      for (const prod of o.productionGrid) {
        for (const spm of o.spmGrid) {
          for (const bhp of o.bhpGrid) {
            out.push({
              ...base,
              bhp,
              css: {
                ...base.css,
                steamVolume: Math.round(base.css.steamVolume * steamMult),
                soakDays: soak,
                productionDays: prod,
              },
              srp: { ...base.srp, spm },
            });
          }
        }
      }
    }
  }
  return out;
}

export function optimizeWellToSurface(
  base: OperatingParams,
  options: OptimizerOptions = {},
): { recommendation: Recommendation; best: SimulationResult; baseline: SimulationResult; evaluated: number } {
  const w = options.weights ?? DEFAULT_WEIGHTS;
  const grid = {
    steamGrid: options.steamGrid ?? [0.6, 0.8, 1, 1.2, 1.4],
    soakGrid: options.soakGrid ?? [3, 5, 8, 12],
    productionGrid: options.productionGrid ?? [120, 180, 240, 300],
    spmGrid: options.spmGrid ?? [6, 8, 9.5, 11, 12],
    bhpGrid: options.bhpGrid ?? [12, 16, 20, 24],
  };

  const baseline = simulateCssSrpCycle(base);
  const ref = {
    oil: Math.max(baseline.summary.oilProduced, 1),
    sor: Math.max(baseline.summary.sor, 0.05),
    energyPerBarrel: Math.max(baseline.summary.energyPerBarrel, 1),
  };

  let bestScore = -Infinity;
  let bestParams = base;
  const candidates = buildCandidate(base, grid);
  for (const candidate of candidates) {
    const { summary } = simulateCssSrpCycle(candidate);
    const score = objectiveScore(summary, ref, w);
    if (score > bestScore) {
      bestScore = score;
      bestParams = candidate;
    }
  }

  const best = simulateCssSrpCycle(bestParams);
  const s = best.summary;
  const b = baseline.summary;
  const rationale: string[] = [];
  const pct = (a: number, c: number) =>
    `${a > c ? "+" : ""}${Math.round(((a - c) / Math.max(c, 1e-9)) * 100)}%`;

  if (bestParams.css.steamVolume !== base.css.steamVolume) {
    rationale.push(
      `Steam ${base.css.steamVolume} → ${bestParams.css.steamVolume} t (${pct(bestParams.css.steamVolume, base.css.steamVolume)}): SOR ${b.sor.toFixed(2)} → ${s.sor.toFixed(2)} t/bbl`,
    );
  }
  if (bestParams.css.soakDays !== base.css.soakDays) {
    rationale.push(
      `Soak ${base.css.soakDays} → ${bestParams.css.soakDays} d: peak temp ${b.peakTemperature.toFixed(0)} → ${s.peakTemperature.toFixed(0)} °C`,
    );
  }
  if (bestParams.css.productionDays !== base.css.productionDays) {
    rationale.push(
      `Production run ${base.css.productionDays} → ${bestParams.css.productionDays} d: cut-off reached at ${s.effectiveProductionDays} d`,
    );
  }
  if (bestParams.srp.spm !== base.srp.spm) {
    rationale.push(
      `SPM ${base.srp.spm} → ${bestParams.srp.spm}: rod-float risk ${b.worstRodFloatScore.toFixed(2)} → ${s.worstRodFloatScore.toFixed(2)}`,
    );
  }
  if (bestParams.bhp !== base.bhp) {
    rationale.push(`BHP drawdown ${base.bhp} → ${bestParams.bhp} bar: avg rate ${b.avgOilRate.toFixed(0)} → ${s.avgOilRate.toFixed(0)} bbl/d`);
  }
  rationale.push(
    `Expected: oil ${pct(s.oilProduced, b.oilProduced)}, energy/bbl ${pct(s.energyPerBarrel, b.energyPerBarrel)}, cost/bbl ${pct(s.costPerBarrel, b.costPerBarrel)}`,
  );

  const recommendation: Recommendation = {
    css: bestParams.css,
    srp: bestParams.srp,
    bhp: bestParams.bhp,
    expected: {
      oil: s.oilProduced,
      sor: s.sor,
      energy: s.energy,
      energyPerBarrel: s.energyPerBarrel,
      cost: s.cost,
      costPerBarrel: s.costPerBarrel,
      avgOilRate: s.avgOilRate,
      worstRodFloatScore: s.worstRodFloatScore,
      worstImpactLoadingScore: s.worstImpactLoadingScore,
      worstPumpUnsettingScore: s.worstPumpUnsettingScore,
      worstRodFailureScore: s.worstRodFailureScore,
    },
    rationale,
  };

  return { recommendation, best, baseline, evaluated: candidates.length };
}
