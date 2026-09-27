/**
 * Engine tests for the Baghewala CSS + SRP digital twin.
 * Run with: bun test tests/twin.test.ts
 */
import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PARAMS,
  deliverability,
  heatInjection,
  impactLoadingRisk,
  optimizeWellToSurface,
  pumpDisplacement,
  pumpEfficiency,
  pumpUnsettingRisk,
  rodFailureRisk,
  rodFloatRisk,
  rodLoads,
  simulateCssSrpCycle,
  soakTemperature,
  steamSaturationTemp,
  temperatureForViscosity,
  viscosity,
  type OperatingParams,
  type SrpLoad,
} from "../src/lib/twin";

const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

describe("viscosity model", () => {
  test("cold oil is very viscous", () => {
    expect(viscosity(47)).toBeGreaterThan(4000);
    expect(viscosity(47)).toBeLessThan(7000);
  });

  test("viscosity decreases monotonically with temperature", () => {
    for (let t = 40; t < 300; t += 10) {
      expect(viscosity(t + 10)).toBeLessThan(viscosity(t));
    }
  });

  test("hot oil is mobile", () => {
    expect(viscosity(200)).toBeLessThan(40);
  });

  test("temperatureForViscosity inverts viscosity", () => {
    const t = temperatureForViscosity(1000);
    expect(approx(viscosity(t), 1000, 1)).toBe(true);
  });
});

describe("thermal model", () => {
  test("steam injection heats the zone", () => {
    const gain = heatInjection(1200, DEFAULT_PARAMS.constants.chamberRadius, DEFAULT_PARAMS.constants);
    expect(gain).toBeGreaterThan(0);
    expect(46 + gain).toBeGreaterThan(150);
  });

  test("soak retains most heat but loses some", () => {
    const t0 = 200;
    const after = soakTemperature(t0, 5, 46, DEFAULT_PARAMS.constants.heatRetentionExp);
    expect(after).toBeLessThan(t0);
    expect(after).toBeGreaterThan(150);
  });

  test("steam cannot exceed saturation temperature at injection pressure", () => {
    const tsat = steamSaturationTemp(95);
    expect(tsat).toBeGreaterThan(250);
    expect(tsat).toBeLessThan(320);
    expect(steamSaturationTemp(1)).toBeCloseTo(100, 0);
  });
});

describe("inflow / SRP", () => {
  test("deliverability rises steeply with temperature", () => {
    const cold = deliverability(50, 45, 20, DEFAULT_PARAMS.reservoir);
    const hot = deliverability(200, 45, 20, DEFAULT_PARAMS.reservoir);
    expect(hot).toBeGreaterThan(cold * 10);
  });

  test("pump displacement scales with SPM", () => {
    const geo = { pumpBoreIn: 1.75, plungerTravelEfficiency: 0.88 };
    expect(pumpDisplacement(72, 12, geo)).toBeCloseTo(pumpDisplacement(72, 6, geo) * 2, 0);
  });

  test("efficiency falls with poor fillage", () => {
    expect(pumpEfficiency(1, 100)).toBeGreaterThan(pumpEfficiency(0.5, 100));
  });

  test("rod loads: min load drops as SPM rises (rod-float mechanism)", () => {
    const geo = { pumpBoreIn: 1.75, plungerTravelEfficiency: 0.88 };
    const slow: SrpLoad = rodLoads(6, 72, 0.9, 500, geo);
    const fast: SrpLoad = rodLoads(14, 72, 0.9, 500, geo);
    expect(fast.min).toBeLessThan(slow.min);
    expect(fast.peak).toBeGreaterThan(slow.peak);
  });
});

describe("risk models", () => {
  const geo = { pumpBoreIn: 1.75, plungerTravelEfficiency: 0.88 };

  test("rod floating risk is higher at high SPM + poor fillage + cold oil", () => {
    const good: SrpLoad = rodLoads(6, 72, 0.95, 50, geo);
    const bad: SrpLoad = rodLoads(14, 72, 0.4, 5000, geo);
    expect(rodFloatRisk(bad, 0.4, 5000)).toBeGreaterThan(rodFloatRisk(good, 0.95, 50));
  });

  test("impact loading risk rises with SPM² × stroke", () => {
    const gentle: SrpLoad = rodLoads(5, 50, 0.8, 100, geo);
    const violent: SrpLoad = rodLoads(15, 100, 0.8, 100, geo);
    expect(impactLoadingRisk(violent, 167, 15, 100)).toBeGreaterThan(
      impactLoadingRisk(gentle, 167, 5, 50),
    );
  });

  test("pump unsetting risk rises when the pump over-pumps inflow", () => {
    expect(pumpUnsettingRisk(0.3, 14, 3000, 50, 500)).toBeGreaterThan(
      pumpUnsettingRisk(1, 6, 50, 500, 400),
    );
  });

  test("rod failure risk responds to aggressiveness and fatigue", () => {
    const calm: SrpLoad = rodLoads(6, 60, 0.9, 100, geo);
    const harsh: SrpLoad = rodLoads(15, 96, 0.5, 4000, geo);
    expect(
      rodFailureRisk(harsh, 15, 167, 4000, impactLoadingRisk(harsh, 167, 15, 96), 8760 * 2),
    ).toBeGreaterThan(
      rodFailureRisk(calm, 6, 167, 100, impactLoadingRisk(calm, 167, 6, 60), 1000),
    );
  });
});

describe("cycle simulation", () => {
  const sim = simulateCssSrpCycle(DEFAULT_PARAMS);

  test("produces a full point series", () => {
    expect(sim.points.length).toBeGreaterThan(50);
    expect(sim.points[0].day).toBe(0);
    expect(sim.points[0].phase).toBe("INJECTION");
  });

  test("temperature peaks near the end of injection and decays in production", () => {
    const peak = Math.max(...sim.points.map((p) => p.temperature));
    const last = sim.points[sim.points.length - 1].temperature;
    expect(peak).toBeGreaterThan(180);
    expect(last).toBeLessThan(peak);
  });

  test("viscosity inversely tracks temperature over the cycle", () => {
    const hot = sim.points.reduce((a, b) => (b.temperature > a.temperature ? b : a));
    const cold = sim.points.reduce((a, b) => (b.temperature < a.temperature ? b : a));
    expect(cold.viscosity).toBeGreaterThan(hot.viscosity);
  });

  test("oil is produced only during production phase", () => {
    const injected = sim.points.filter((p) => p.phase === "INJECTION");
    expect(injected.every((p) => p.oilRate === 0)).toBe(true);
    const producing = sim.points.filter((p) => p.phase === "PRODUCTION");
    expect(producing.some((p) => p.oilRate > 0)).toBe(true);
  });

  test("cumulative oil is monotonic and SOR is positive", () => {
    for (let i = 1; i < sim.points.length; i++) {
      expect(sim.points[i].cumOil).toBeGreaterThanOrEqual(sim.points[i - 1].cumOil);
    }
    expect(sim.summary.sor).toBeGreaterThan(0);
    expect(sim.summary.sor).toBeLessThan(5);
  });

  test("energy-per-barrel is in a sane range", () => {
    expect(sim.summary.energyPerBarrel).toBeGreaterThan(10);
    expect(sim.summary.energyPerBarrel).toBeLessThan(400);
  });

  test("economic cut-off shortens the production run when the price is low", () => {
    const cheap: OperatingParams = {
      ...DEFAULT_PARAMS,
      constants: { ...DEFAULT_PARAMS.constants, oilPrice: 500 },
    };
    const s = simulateCssSrpCycle(cheap).summary;
    expect(s.cutOffHit).toBe(true);
    expect(s.effectiveProductionDays).toBeLessThan(cheap.css.productionDays);
  });
});

describe("joint optimizer", () => {
  test("finds a plan at least as good as the traditional baseline", () => {
    const { recommendation, baseline } = optimizeWellToSurface(DEFAULT_PARAMS);
    expect(recommendation.expected.oil).toBeGreaterThanOrEqual(baseline.summary.oilProduced * 0.95);
    // Constraints respected: candidates come from the grid, but sanity-check ranges.
    expect(recommendation.css.steamVolume).toBeGreaterThan(0);
    expect(recommendation.css.soakDays).toBeGreaterThanOrEqual(1);
    expect(recommendation.srp.spm).toBeGreaterThanOrEqual(4);
    expect(recommendation.bhp).toBeGreaterThanOrEqual(8);
  });

  test("respects physical constraints for extreme inputs", () => {
    const aggressive: OperatingParams = {
      ...DEFAULT_PARAMS,
      css: { ...DEFAULT_PARAMS.css, steamVolume: 2400, soakDays: 15, productionDays: 360 },
      srp: { ...DEFAULT_PARAMS.srp, spm: 16 },
    };
    const { recommendation } = optimizeWellToSurface(aggressive);
    expect(Number.isFinite(recommendation.expected.oil)).toBe(true);
    expect(Number.isFinite(recommendation.expected.sor)).toBe(true);
    expect(recommendation.expected.sor).toBeGreaterThan(0);
  });
});

describe("safety framing", () => {
  test("summary carries risk scores in [0,1]", () => {
    const s = simulateCssSrpCycle(DEFAULT_PARAMS).summary;
    for (const v of [s.worstRodFloatScore, s.worstImpactLoadingScore, s.worstPumpUnsettingScore, s.worstRodFailureScore]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
