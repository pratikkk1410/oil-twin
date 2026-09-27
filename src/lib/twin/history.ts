/** ---------------------------------------------------------------------------
 * Synthetic history generator + traditional-operation baseline.
 * Clearly synthetic: deterministic seeded noise on top of the twin physics so
 * relationships stay logically consistent (steam→temp→viscosity→rate→load).
 * ------------------------------------------------------------------------- */

import { simulateCssSrpCycle } from "./simulate";
import type { OperatingParams, SimulationResult } from "./types";

/** Deterministic PRNG (mulberry32) so the demo is reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate `n` synthetic past cycles: the "traditional" operation the field
 * would run without the twin — fixed manual settings each cycle, mild random
 * walk in reservoir pressure, seeded so the demo is reproducible.
 */
export function generateSyntheticHistory(base: OperatingParams, n = 4): SimulationResult[] {
  const rng = mulberry32(20260927);
  const history: SimulationResult[] = [];
  let pressure = base.reservoir.reservoirPressure;
  for (let i = 0; i < n; i++) {
    const drift = 1 - i * 0.03; // gentle decline across past cycles [assumption]
    const params: OperatingParams = {
      ...base,
      reservoir: { ...base.reservoir, reservoirPressure: pressure * drift },
      css: { ...base.css, steamVolume: base.css.steamVolume * (0.95 + rng() * 0.1) },
      srp: { ...base.srp, spm: 12 },
    };
    history.push(simulateCssSrpCycle(params));
    pressure *= 0.985; // [assumption] cycle-over-cycle pressure decline
  }
  return history;
}

/** The traditional-baseline cycle: manual settings, no optimization. */
export function traditionalBaseline(base: OperatingParams): SimulationResult {
  return simulateCssSrpCycle({
    ...base,
    srp: { ...base.srp, spm: 12 },
    bhp: base.reservoir.bhp,
    css: { ...base.css },
  });
}
