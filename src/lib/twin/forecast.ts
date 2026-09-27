/** ---------------------------------------------------------------------------
 * Model-based forward prediction (deterministic twin projection, not ML).
 * Labeled "model-predicted" everywhere in the UI.
 * ------------------------------------------------------------------------- */

import { simulateCssSrpCycle } from "./simulate";
import type { CyclePoint, OperatingParams } from "./types";

export type Horizon = "24h" | "7d" | "30d";

/** Forecast at an operating point that is `elapsedDays` into its production run. */
export function forecastFrom(
  params: OperatingParams,
  elapsedDays: number,
  horizon: Horizon,
): CyclePoint[] {
  // Simulate from the cycle start, then look ahead from elapsedDays.
  const full = simulateCssSrpCycle(params);
  const horizonDays = horizon === "24h" ? 1 : horizon === "7d" ? 7 : 30;
  const start = Math.min(Math.max(Math.round(elapsedDays), 0), full.points.length - 2);
  const end = Math.min(start + horizonDays, full.points.length - 1);
  const from = full.points[start];
  const to = full.points[end];
  const steps = 12;
  const out: CyclePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const lerp = (a: number, b: number) => a + (b - a) * f;
    out.push({
      day: start + lerp(0, end - start),
      phase: "PRODUCTION",
      temperature: lerp(from.temperature, to.temperature),
      viscosity: lerp(from.viscosity, to.viscosity),
      oilRate: lerp(from.oilRate, to.oilRate),
      waterRate: lerp(from.waterRate, to.waterRate),
      liquidRate: lerp(from.liquidRate, to.liquidRate),
      cumOil: lerp(from.cumOil, to.cumOil),
      cumSteam: lerp(from.cumSteam, to.cumSteam),
      energy: lerp(from.energy, to.energy),
      rodLoad: lerp(from.rodLoad, to.rodLoad),
      pumpEfficiency: lerp(from.pumpEfficiency, to.pumpEfficiency),
      spm: params.srp.spm,
      rodFloatScore: lerp(from.rodFloatScore, to.rodFloatScore),
      impactLoadingScore: lerp(from.impactLoadingScore, to.impactLoadingScore),
      pumpUnsettingScore: lerp(from.pumpUnsettingScore, to.pumpUnsettingScore),
      rodFailureScore: lerp(from.rodFailureScore, to.rodFailureScore),
      sor: lerp(from.sor, to.sor),
    });
  }
  return out;
}
