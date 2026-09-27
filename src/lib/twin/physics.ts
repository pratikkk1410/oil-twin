/** ---------------------------------------------------------------------------
 * Baghewala digital-twin physics core.
 *
 * Prototype lumped-parameter models — NOT a CFD/reservoir simulator.
 * Every relationship is a documented assumption calibrated to be
 * qualitatively consistent with published CSS / SRP behaviour.
 * ------------------------------------------------------------------------- */

export const BBL_PER_M3 = 6.2898;

/** Oil density, kg/m³, from °API. */
export function oilDensity(api: number): number {
  return 141500 / (131.5 + api);
}

/**
 * Viscosity–temperature model (Arrhenius form):
 *   μ(T) = A · exp(B / (T + 273.15))
 * Fitted so μ(47 °C) ≈ 5,500 cP (Baghewala-style cold oil) and
 * μ(200 °C) ≈ 24 cP — representative of an ~18 °API asphaltene-rich crude.
 * Assumptions: Newtonian, no dissolved-gas or shear-thinning term.
 */
const MU_A = 2.66e-4; // cP
const MU_B = 5392; // K

export function viscosity(tempC: number): number {
  return MU_A * Math.exp(MU_B / (tempC + 273.15));
}

/** Temperature at which the oil has the given viscosity (for diagnostics). */
export function temperatureForViscosity(mu: number): number {
  return MU_B / Math.log(mu / MU_A) - 273.15;
}

/** Mobility ratio vs a reference temperature: how much easier oil flows. */
export function mobilityFactor(tempC: number, baseTempC: number): number {
  return viscosity(baseTempC) / viscosity(tempC);
}

/* ------------------------------------------------------------------------ */
/* Thermal model (lumped single node)                                        */
/* ------------------------------------------------------------------------ */

/**
 * Effective steam-heated pore/rock volume, m³:
 *   π r² × 25 m pay × 55% sweep — [assumption] fixed pay & sweep.
 */
export function zoneVolume(chamberRadiusM: number): number {
  return Math.PI * chamberRadiusM ** 2 * 25 * 0.55;
}

/** ΔT from injecting `steamTonnes` into the warm zone, °C. */
export function heatInjection(
  steamTonnes: number,
  chamberRadiusM: number,
  constants: { steamEnthalpy: number; steamEfficiency: number; zoneHeatCapacity: number },
): number {
  const heatIn =
    (steamTonnes * constants.steamEnthalpy * constants.steamEfficiency) / // kJ
    (constants.zoneHeatCapacity * zoneVolume(chamberRadiusM)); // kJ/°C
  return heatIn;
}

/**
 * Steam saturation temperature at a given pressure, °C.
 * Prototype fit Tsat ≈ 100 · P^0.25 (P in bar): 100 °C @ 1 bar,
 * ~133 °C @ 3 bar, ~305 °C @ 95 bar. Assumption: dry saturated steam.
 */
export function steamSaturationTemp(pressureBar: number): number {
  return 100 * Math.pow(Math.max(pressureBar, 1), 0.25);
}

/** Soak: heat spreads and part is lost — exponential retention, e^(−k·days). */
export function soakTemperature(
  endInjectionTempC: number,
  soakDays: number,
  farfieldC: number,
  heatRetentionExp: number,
): number {
  return (
    farfieldC +
    (endInjectionTempC - farfieldC) * Math.exp(-heatRetentionExp * soakDays)
  );
}

/** Production/cooling: exponential decay toward the far-field temperature. */
export function cooledTemperature(
  currentTempC: number,
  farfieldC: number,
  coolingDecay: number,
): number {
  return farfieldC + (currentTempC - farfieldC) * Math.exp(-coolingDecay);
}

/** Closed-form peak temperature after injection + soak (used by optimizer). */
export function peakTemperature(
  initialTempC: number,
  steamTonnes: number,
  soakDays: number,
  constants: {
    chamberRadius: number;
    steamEnthalpy: number;
    steamEfficiency: number;
    zoneHeatCapacity: number;
    heatRetentionExp: number;
    farfieldTemperature: number;
  },
): number {
  const afterInjection = initialTempC + heatInjection(steamTonnes, constants.chamberRadius, constants);
  return soakTemperature(
    afterInjection,
    soakDays,
    constants.farfieldTemperature,
    constants.heatRetentionExp,
  );
}

/* ------------------------------------------------------------------------ */
/* Inflow                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Radial steady-state inflow (Darcy), bbl/d:
 *   q = 2π k h Δp / (μ ln((re/rw)·e^s))   [SI, converted]
 * Assumptions: no gas saturation, no thermal swelling term, single-layer.
 */
export function deliverability(
  tempC: number,
  reservoirPressureBar: number,
  bhpBar: number,
  reservoir: {
    permeability: number;
    thickness: number;
    drainageRadius: number;
    wellboreRadius: number;
    skin: number;
  },
): number {
  const muPaS = viscosity(tempC) * 1e-3;
  const drawdown = Math.max(reservoirPressureBar - bhpBar, 0.5);
  const geo = (reservoir.drainageRadius / reservoir.wellboreRadius) * Math.exp(reservoir.skin);
  const qM3Day =
    ((2 * Math.PI *
      reservoir.permeability * 9.869e-16 * // mD → m²
      reservoir.thickness *
      drawdown * 1e5) / // bar → Pa
      (muPaS * Math.log(geo))) *
    86400; // s → d
  return qM3Day * BBL_PER_M3;
}

/* ------------------------------------------------------------------------ */
/* SRP                                                                       */
/* ------------------------------------------------------------------------ */

export interface SrpGeometry {
  pumpBoreIn: number;
  /** Travel/barrel volumetric efficiency before fillage. */
  plungerTravelEfficiency: number;
}

/** Polished-rod pump displacement at 100% fillage, bbl/d. */
export function pumpDisplacement(
  strokeIn: number,
  spm: number,
  geometry: SrpGeometry,
): number {
  const area = (Math.PI / 4) * (geometry.pumpBoreIn * 0.0254) ** 2; // m²
  const perStrokeM3 = area * strokeIn * 0.0254 * geometry.plungerTravelEfficiency;
  return perStrokeM3 * spm * 1440 * BBL_PER_M3;
}

export interface SrpLoad {
  /** Peak polished-rod load, kN (upstroke). */
  peak: number;
  /** Minimum polished-rod load, kN (downstroke — rod-float indicator). */
  min: number;
  /** Dynamic (acceleration) load amplitude, kN. */
  dynamic: number;
  /** Fluid column + viscous friction load, kN. */
  fluid: number;
}

/** Rod-string dry weight, kN — [assumption] tapered 7/8″ + 3/4″, ~1200 m. */
const ROD_WEIGHT_KN = 88;
/** Buoyant upforce on the string, kN. */
const BUOYANCY_KN = 14;
/** Full fluid-column load above the pump, kN, at 100% liquid. */
const FULL_COLUMN_KN = 46;

/**
 * Simplified polished-rod load model. Dynamics use the classic
 * dimensionless acceleration factor α = (SPM² · stroke[in]) / 70471.
 */
export function rodLoads(
  spm: number,
  strokeIn: number,
  fluidFraction: number,
  viscosityCp: number,
  geometry: SrpGeometry,
): SrpLoad {
  const alpha = (spm * spm * strokeIn) / 70471;
  const column = FULL_COLUMN_KN * Math.min(Math.max(fluidFraction, 0), 1);
  const friction =
    2.4 * Math.log10(Math.max(viscosityCp, 1)) * (geometry.pumpBoreIn / 1.5) ** 2;
  const fluid = column + friction;
  const dynamic = alpha * (ROD_WEIGHT_KN * 0.85 + fluid);
  return {
    peak: ROD_WEIGHT_KN - BUOYANCY_KN + dynamic + fluid,
    min: ROD_WEIGHT_KN - BUOYANCY_KN - dynamic,
    dynamic,
    fluid,
  };
}

/** Volumetric pump efficiency from fillage × slippage. Returns 0-0.97. */
export function pumpEfficiency(
  fillage: number,
  viscosityCp: number,
): number {
  const slippage = 1 - 0.12 * Math.min(Math.log10(Math.max(viscosityCp, 1)) / 3, 1);
  return Math.max(Math.min(fillage * Math.max(slippage, 0.5), 0.97), 0.05);
}

/** Polished-rod hydraulic power, kW: net stroke work per minute. */
export function polishedRodPowerKw(
  load: SrpLoad,
  strokeIn: number,
  spm: number,
): number {
  const strokeM = strokeIn * 0.0254;
  return Math.max(load.fluid, 0) * strokeM * (spm / 60);
}

/* ------------------------------------------------------------------------ */
/* Risk models (model-predicted indicators, 0-1 scores)                      */
/* ------------------------------------------------------------------------ */

/**
 * Rod-floating risk — the downstroke outruns the fluid: poor fillage, high
 * speed, low minimum load in a viscous well.
 */
export function rodFloatRisk(
  load: SrpLoad,
  fillage: number,
  viscosityCp: number,
): number {
  const lowLoadFactor = 1 - Math.min(Math.max(load.min, 0) / 45, 1);
  const fillageFactor = 1 - Math.min(Math.max(fillage, 0), 1);
  const viscousFactor = Math.min(Math.log10(Math.max(viscosityCp, 1)) / 3.8, 1);
  return Math.min(lowLoadFactor * 0.45 + fillageFactor * 0.35 + viscousFactor * 0.2, 1);
}

/**
 * Impact-loading risk — peak loads near the structural limit with strong
 * acceleration; the precursor of rod/tubing wear and parted rods.
 */
export function impactLoadingRisk(
  load: SrpLoad,
  rodLoadLimitKn: number,
  spm: number,
  strokeIn: number,
): number {
  const utilisation = load.peak / Math.max(rodLoadLimitKn, 1);
  const alpha = (spm * spm * strokeIn) / 70471;
  const severity = Math.min(alpha / 0.35, 1);
  const overLimit = utilisation > 0.7 ? (utilisation - 0.7) / 0.3 : 0;
  return Math.min(overLimit * 0.7 + severity * 0.3, 1);
}

/**
 * Pump-unsetting risk — pump-off slam / travel-barrel interference when the
 * pump runs fast against a low inflow or very viscous fluid.
 */
export function pumpUnsettingRisk(
  fillage: number,
  spm: number,
  viscosityCp: number,
  inflowBblDay: number,
  displacementBblDay: number,
): number {
  const overpump =
    displacementBblDay > 0
      ? Math.min(Math.max(displacementBblDay / Math.max(inflowBblDay, 1) - 1, 0), 2)
      : 1;
  return Math.min(
    Math.min(overpump / 2, 1) * 0.45 +
      Math.min(Math.log10(Math.max(viscosityCp, 1)) / 3.8, 1) * 0.25 +
      (1 - fillage) * 0.2 +
      Math.min(spm / 14, 1) * 0.1,
    1,
  );
}

/**
 * Rod-failure risk — model-predicted probability proxy from operating
 * aggressiveness and cumulative fatigue. NOT an industrial-certainty forecast.
 */
export function rodFailureRisk(
  load: SrpLoad,
  spm: number,
  rodLoadLimitKn: number,
  viscosityCp: number,
  impactScore: number,
  operatingHours: number,
): number {
  const utilisation = Math.min(load.peak / Math.max(rodLoadLimitKn, 1), 1.2);
  const utilisationFactor = Math.max((utilisation - 0.6) / 0.5, 0);
  const speedFactor = Math.min(spm / 16, 1);
  const viscousFactor = Math.min(Math.log10(Math.max(viscosityCp, 1)) / 3.8, 1);
  const fatigue = Math.min(operatingHours / 8760, 1); // one run-year
  return Math.min(
    utilisationFactor * 0.35 +
      speedFactor * 0.15 +
      viscousFactor * 0.2 +
      impactScore * 0.2 +
      fatigue * 0.1,
    1,
  );
}
