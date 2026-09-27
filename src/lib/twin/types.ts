/** ---------------------------------------------------------------------------
 * Digital-twin value types for the Baghewala CSS + SRP prototype.
 * Units: t = tonnes steam, bbl = barrels, °C, cP, m3/d, kW, INR.
 * ------------------------------------------------------------------------- */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type CyclePhase = "INJECTION" | "SOAK" | "PRODUCTION" | "COOLING";

/** Physics + economics constants the user may re-tune from the UI. */
export interface ModelConstants {
  /** Steam chamber heating radius, m (prototype lumped approximation). */
  chamberRadius: number;
  /** Fraction of injected steam heat usefully stored in the reservoir, 0-1. */
  steamEfficiency: number;
  /** Net enthalpy of injected steam per tonne, kWh/t. */
  steamEnthalpy: number;
  /** Heat capacity of the warmed reservoir zone, kWh/°C (per m³ effective). */
  zoneHeatCapacity: number;
  /** Empirical exponent for heat retention vs chamber radius. */
  heatRetentionExp: number;
  /** Reservoir-rock temperature, °C (far-field). */
  farfieldTemperature: number;
  /** Exponential cooling decay, 1/day. */
  coolingDecay: number;
  /** Baseline cumulative production over the prior life of the well, bbl. */
  priorCumulative: number;
  /** Steam cost, ₹ per tonne. */
  steamCost: number;
  /** Electricity cost, ₹ per kWh. */
  powerCost: number;
  /** Maintenance + fixed daily opex, ₹ per day. */
  maintenanceCost: number;
  /** Extra cost per day of operating at elevated equipment risk, ₹/day. */
  riskCost: number;
  /** Realised heavy-crude price, ₹ per bbl (revenue side of the optimizer). */
  oilPrice: number;
}

/** Reservoir + fluid description of Baghewala-style heavy oil. */
export interface ReservoirInputs {
  /** Oil API gravity, °API (17-19 for Baghewala). */
  api: number;
  /** Permeability, mD. */
  permeability: number;
  /** Porosity, fraction. */
  porosity: number;
  /** Current oil saturation, fraction. */
  saturation: number;
  /** Reservoir thickness (net pay), m. */
  thickness: number;
  /** Drainage radius, m. */
  drainageRadius: number;
  /** Wellbore radius, m. */
  wellboreRadius: number;
  /** Skin factor near the wellbore. */
  skin: number;
  /** Static reservoir pressure at start of the simulated cycle, bar. */
  reservoirPressure: number;
  /** Initial reservoir temperature before the cycle, °C. */
  initialTemperature: number;
  /** Initial in-situ oil viscosity at initialTemperature, cP. */
  initialViscosity: number;
  /** Producing bottom-hole pressure the SRP draws down to, bar. */
  bhp: number;
}

/** SRP configuration (what the operator sets). */
export interface SrpParams {
  /** Stroke length, inches. */
  stroke: number;
  /** Strokes per minute. */
  spm: number;
  /** VFD frequency, Hz (50 Hz ≈ rated speed; SPM scales with VFD). */
  vfd: number;
  /** Polished-rod load limit, kN. */
  rodLoadLimit: number;
}

/** CSS plan for one cycle (what the steam side sets). */
export interface CssParams {
  /** Steam injected, cold-water-equivalent tonnes. */
  steamVolume: number;
  /** Injection pressure, bar. */
  injectionPressure: number;
  /** Injection duration, days. */
  injectionDays: number;
  /** Soak duration, days. */
  soakDays: number;
  /** Maximum production-run length before the next cycle, days. */
  productionDays: number;
  /** Stop producing when the rate falls below this, bbl/d (economic limit). */
  productionCutoff: number;
}

/** Everything the user can change for a what-if / optimization run. */
export interface OperatingParams {
  css: CssParams;
  srp: SrpParams;
  /** Producing BHP target, bar. */
  bhp: number;
  constants: ModelConstants;
  reservoir: ReservoirInputs;
}

/** Point-in-time simulated state of the well. */
export interface TwinState {
  reservoir: {
    temperature: number;
    pressure: number;
    viscosity: number;
    saturation: number;
  };
  wellbore: {
    bhp: number;
    temperature: number;
    flowRate: number;
    rodLoad: number;
    pumpFillage: number;
  };
  srp: {
    spm: number;
    stroke: number;
    vfd: number;
    efficiency: number;
    power: number;
  };
  surface: {
    oilRate: number;
    waterRate: number;
    liquidRate: number;
    steamUsed: number;
  };
  risk: {
    rodFloat: RiskLevel;
    rodFloatScore: number;
    impactLoading: RiskLevel;
    impactLoadingScore: number;
    pumpUnsetting: RiskLevel;
    pumpUnsettingScore: number;
    rodFailure: RiskLevel;
    rodFailureScore: number;
  };
  economics: {
    energy: number;
    energyPerBarrel: number;
    cost: number;
    costPerBarrel: number;
  };
}

export interface CyclePoint {
  /** Day index from cycle start (0 = injection start). */
  day: number;
  phase: CyclePhase;
  temperature: number;
  viscosity: number;
  oilRate: number;
  waterRate: number;
  liquidRate: number;
  /** Cumulative oil since injection start, bbl. */
  cumOil: number;
  /** Cumulative steam injected since cycle start, t. */
  cumSteam: number;
  energy: number;
  rodLoad: number;
  pumpEfficiency: number;
  spm: number;
  /** Model-predicted risk scores on this day, 0-1 (0 outside production). */
  rodFloatScore: number;
  impactLoadingScore: number;
  pumpUnsettingScore: number;
  rodFailureScore: number;
  /** Cumulative steam-oil ratio to this day (0 before any oil). */
  sor: number;
}

export interface SimulationResult {
  params: OperatingParams;
  points: CyclePoint[];
  /** Final / end-of-cycle summary state. */
  state: TwinState;
  summary: CycleSummary;
}

export interface CycleSummary {
  /** Total oil produced during the production phase, bbl. */
  oilProduced: number;
  /** Total liquid produced, bbl. */
  liquidProduced: number;
  steamInjected: number;
  /** Steam-oil ratio, t steam per bbl oil. */
  sor: number;
  /** Peak reservoir temperature reached, °C. */
  peakTemperature: number;
  /** Viscosity at production start, cP. */
  viscosityAtStart: number;
  /** Average oil rate during production phase, bbl/d. */
  avgOilRate: number;
  /** Peak instantaneous pump power, kW. */
  peakPower: number;
  /** Average pump efficiency across the production phase, 0-1. */
  avgEfficiency: number;
  energy: number;
  energyPerBarrel: number;
  cost: number;
  costPerBarrel: number;
  worstRodFloat: RiskLevel;
  worstImpactLoading: RiskLevel;
  worstPumpUnsetting: RiskLevel;
  worstRodFailure: RiskLevel;
  worstRodFloatScore: number;
  worstImpactLoadingScore: number;
  worstPumpUnsettingScore: number;
  worstRodFailureScore: number;
  /** Days until the economic cutoff was hit (or productionDays if never). */
  effectiveProductionDays: number;
  /** True when the economic cut-off shut the well in before the planned end. */
  cutOffHit: boolean;
  /** Day on which the economic cut-off triggered (0 if never). */
  cutOffHitOnDay: number;
  /** Risk score at the highest-load production day. */
  peakRiskDay: number;
}

export interface Recommendation {  css: CssParams;
  srp: SrpParams;
  bhp: number;
  expected: {
    oil: number;
    sor: number;
    energy: number;
    energyPerBarrel: number;
    cost: number;
    costPerBarrel: number;
    avgOilRate: number;
    worstRodFloatScore: number;
    worstImpactLoadingScore: number;
    worstPumpUnsettingScore: number;
    worstRodFailureScore: number;
  };
  rationale: string[];
}

export const RISK_THRESHOLDS = { low: 0.35, high: 0.65 } as const;

export function riskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.high) return "HIGH";
  if (score >= RISK_THRESHOLDS.low) return "MEDIUM";
  return "LOW";
}
