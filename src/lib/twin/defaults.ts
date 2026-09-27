/** ---------------------------------------------------------------------------
 * Default operating point for the Baghewala prototype well.
 *
 * Values marked [SIH BRIEF] come from the problem statement (17-19 °API,
 * 46-48 °C reservoir, low pressure, poor cold mobility). Everything else is a
 * documented prototype assumption — synthetic/calibrated, NOT field data.
 * ------------------------------------------------------------------------- */

import type { ModelConstants, OperatingParams, ReservoirInputs, SrpParams } from "./types";

/** Cost/energy constants — all editable from the console. */
export const DEFAULT_CONSTANTS: ModelConstants = {
  chamberRadius: 9, // m, effective heated-zone radius [assumption]
  steamEfficiency: 0.55, // fraction of steam heat stored in the zone [assumption]
  steamEnthalpy: 2232000, // kJ per tonne of injected steam (2.23 GJ/t)
  zoneHeatCapacity: 2500, // kJ/m³/°C — sand + fluids [assumption]
  heatRetentionExp: 0.04, // soak heat retention, 1/day [assumption]
  farfieldTemperature: 46, // °C [SIH BRIEF: 46-48 °C]
  coolingDecay: 0.008, // 1/day exponential cooling during production [assumption]
  priorCumulative: 25000, // bbl produced over the well's history [assumption]
  steamCost: 2200, // ₹ per tonne steam [assumption]
  powerCost: 7, // ₹ per kWh [assumption]
  maintenanceCost: 4500, // ₹ per day [assumption]
  riskCost: 12000, // ₹ per day at maximum equipment risk [assumption]
  oilPrice: 3200, // ₹ per bbl realised [assumption]
};

export const DEFAULT_RESERVOIR: ReservoirInputs = {
  api: 18, // [SIH BRIEF] 17-19 °API
  permeability: 900, // mD [assumption] high-perm Jodhpur Sandstone
  porosity: 0.3, // [assumption]
  saturation: 0.68, // [assumption]
  thickness: 25, // m net pay [assumption]
  drainageRadius: 120, // m [assumption]
  wellboreRadius: 0.108, // m [assumption]
  skin: 1.5, // [assumption]
  reservoirPressure: 45, // bar — low-pressure reservoir [assumption]
  initialTemperature: 47, // °C [SIH BRIEF] 46-48 °C
  initialViscosity: 5500, // cP at initialTemperature [assumption, model-fitted]
  bhp: 20, // bar producing bottom-hole pressure [assumption]
};

export const DEFAULT_SRP: SrpParams = {
  stroke: 72, // in [assumption]
  spm: 12, // strokes/min — the traditional manual setting
  vfd: 50, // Hz at rated 12 SPM
  rodLoadLimit: 167, // kN polished-rod structural limit [assumption]
};

export const DEFAULT_PARAMS: OperatingParams = {
  css: {
    steamVolume: 1200, // t per cycle [assumption]
    injectionPressure: 95, // bar [assumption]
    injectionDays: 14, // d [assumption]
    soakDays: 5, // d [assumption]
    productionDays: 240, // d [assumption]
    productionCutoff: 12, // bbl/d economic limit [assumption]
  },
  srp: { ...DEFAULT_SRP },
  bhp: DEFAULT_RESERVOIR.bhp,
  constants: { ...DEFAULT_CONSTANTS },
  reservoir: { ...DEFAULT_RESERVOIR },
};

export const WELL_NAME = "BHG-01";
export const FIELD = "Baghewala, Rajasthan";
export const RESERVOIR_UNIT = "Jodhpur Sandstone";
