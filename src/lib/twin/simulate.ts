/** ---------------------------------------------------------------------------
 * Cycle simulation: one full CSS cycle with the SRP running through the
 * production phase. Daily time steps, deterministic.
 * ------------------------------------------------------------------------- */

import {
  cooledTemperature,
  deliverability,
  heatInjection,
  pumpDisplacement,
  pumpEfficiency,
  polishedRodPowerKw,
  pumpUnsettingRisk,
  rodFailureRisk,
  rodFloatRisk,
  rodLoads,
  impactLoadingRisk,
  soakTemperature,
  steamSaturationTemp,
  viscosity,
  type SrpGeometry,
} from "./physics";
import {
  riskLevel,
  type CyclePoint,
  type CycleSummary,
  type OperatingParams,
  type SimulationResult,
  type TwinState,
} from "./types";

const GEOMETRY: SrpGeometry = {
  pumpBoreIn: 1.75, // [assumption]
  plungerTravelEfficiency: 0.88,
};

export { GEOMETRY as DEFAULT_GEOMETRY };

const WATER_CUT = 0.18; // [assumption] base water cut
const DRIVE_EFF = 0.8; // motor + VFD + gearbox, combined [assumption]
const BOILER_EFF = 0.9; // steam generation efficiency [assumption]
const OPERATING_HOURS = 8760 * 2; // two run-years of rod fatigue [assumption]

export function simulateCssSrpCycle(params: OperatingParams): SimulationResult {
  const { reservoir, constants, css, srp, bhp } = params;
  const displacement = pumpDisplacement(srp.stroke, srp.spm, GEOMETRY);
  const totalDays = css.injectionDays + css.soakDays + css.productionDays;
  const stride = Math.max(1, Math.ceil(totalDays / 380));

  const points: CyclePoint[] = [];
  let cumOil = 0;
  let cumLiquid = 0;
  let cumSteam = 0;
  let cumEnergy = 0;
  let cumCost = 0;
  let temp = reservoir.initialTemperature;
  let pressure = reservoir.reservoirPressure;
  let peakTemp = temp;
  const viscosityAtStart = viscosity(temp);
  let prodDays = 0;
  let prodRateSum = 0;
  let effSum = 0;
  let peakPower = 0;
  let cutOffHit = false;
  let cutOffHitOnDay = 0;
  const worst = { float: 0, impact: 0, unset: 0, failure: 0 };
  let peakRiskDay = 0;
  let peakRiskLoad = 0;

  for (let day = 0; day < totalDays; day++) {
    let phase: CyclePoint["phase"] =
      day < css.injectionDays
        ? "INJECTION"
        : day < css.injectionDays + css.soakDays
          ? "SOAK"
          : "PRODUCTION";
    if (phase === "PRODUCTION" && cutOffHit) phase = "COOLING";

    // --- Thermal node ------------------------------------------------------
    if (phase === "INJECTION") {
      const dailySteam = css.steamVolume / css.injectionDays;
      temp += heatInjection(dailySteam, constants.chamberRadius, constants);
      cumSteam += dailySteam;
      // Steam cannot heat the zone past its saturation temperature.
      const tsat = steamSaturationTemp(css.injectionPressure);
      if (temp > tsat) temp = tsat;
      temp =
        constants.farfieldTemperature +
        (temp - constants.farfieldTemperature) * Math.exp(-constants.coolingDecay);
    } else if (phase === "SOAK") {
      temp = soakTemperature(temp, 1, constants.farfieldTemperature, constants.heatRetentionExp);
    } else {
      temp = cooledTemperature(temp, constants.farfieldTemperature, constants.coolingDecay);
    }
    if (temp > peakTemp) peakTemp = temp;

    // --- Reservoir pressure: builds during injection/soak, declines in production ---
    if (phase === "PRODUCTION") {
      prodDays += 1;
      pressure = reservoir.reservoirPressure * Math.exp(-0.0009 * prodDays);
    } else {
      pressure = reservoir.reservoirPressure * (0.55 + 0.45 * Math.exp(-day / 30));
    }

    // --- Production & SRP response -----------------------------------------
    let oilRate = 0;
    let waterRate = 0;
    let liquidRate = 0;
    let eff = 0;
    let dayEnergy = 0;
    let dayCost = 0;
    let rodLoad = 0;
    const mu = viscosity(temp);

    if (phase === "PRODUCTION") {
      const inflow = deliverability(temp, pressure, bhp, reservoir);
      const fillage = Math.min(inflow / displacement, 1);
      eff = pumpEfficiency(fillage, mu);

      const loads = rodLoads(srp.spm, srp.stroke, fillage, mu, GEOMETRY);
      const pumpPowerKw = polishedRodPowerKw(loads, srp.stroke, srp.spm) / DRIVE_EFF;
      const probePower = pumpPowerKw * 24;

      // Economic cut-off: shut the well in when rate × price < daily cost.
      const oilHere = inflow * eff * (1 - WATER_CUT);
      if (oilHere * constants.oilPrice < probePower * constants.powerCost + constants.maintenanceCost) {
        cutOffHit = true;
        cutOffHitOnDay = day;
        phase = "COOLING";
      } else {
        rodLoad = loads.peak;
        const impact = impactLoadingRisk(loads, srp.rodLoadLimit, srp.spm, srp.stroke);
        const float = rodFloatRisk(loads, fillage, mu);
        const unset = pumpUnsettingRisk(fillage, srp.spm, mu, inflow, displacement);
        const failure = rodFailureRisk(loads, srp.spm, srp.rodLoadLimit, mu, impact, OPERATING_HOURS);
        if (float > worst.float) worst.float = float;
        if (impact > worst.impact) worst.impact = impact;
        if (unset > worst.unset) worst.unset = unset;
        if (failure > worst.failure) worst.failure = failure;
        if (loads.peak > peakRiskLoad) {
          peakRiskLoad = loads.peak;
          peakRiskDay = day;
        }

        const lifted = Math.min(inflow, displacement) * eff; // total liquid, bbl/d
        liquidRate = lifted;
        oilRate = lifted * (1 - WATER_CUT);
        waterRate = lifted * WATER_CUT;

        const powerKwh = pumpPowerKw * 24;
        const riskFactor = Math.max(float, impact, unset, failure);
        dayEnergy = powerKwh;
        dayCost =
          powerKwh * constants.powerCost +
          constants.maintenanceCost +
          riskFactor * constants.riskCost;

        cumOil += oilRate;
        cumLiquid += liquidRate;
        prodRateSum += oilRate;
        effSum += eff;
        if (powerKwh > peakPower) peakPower = powerKwh;
      }
    } else if (phase === "INJECTION") {
      const steamDay = css.steamVolume / css.injectionDays;
      const steamEnergy =
        (steamDay * constants.steamEnthalpy) / BOILER_EFF / 3600; // kJ → kWh
      dayEnergy += steamEnergy;
      dayCost += steamDay * constants.steamCost + constants.maintenanceCost / 2;
    }

    cumEnergy += dayEnergy;
    cumCost += dayCost;

    if (day % stride === 0 || day === totalDays - 1) {
      points.push({
        day,
        phase,
        temperature: temp,
        viscosity: mu,
        oilRate,
        waterRate,
        liquidRate,
        cumOil,
        cumSteam,
        energy: dayEnergy,
        rodLoad,
        pumpEfficiency: eff,
        spm: srp.spm,
        rodFloatScore: worst.float,
        impactLoadingScore: worst.impact,
        pumpUnsettingScore: worst.unset,
        rodFailureScore: worst.failure,
        sor: cumOil > 0 ? cumSteam / cumOil : 0,
      });
    }
  }

  // --- End-of-cycle twin state ----------------------------------------------
  const finalMu = viscosity(temp);
  const finalInflow = deliverability(temp, pressure, bhp, reservoir);
  const finalFillage = Math.min(finalInflow / displacement, 1);
  const finalLoads = rodLoads(srp.spm, srp.stroke, finalFillage, finalMu, GEOMETRY);
  const finalEff = pumpEfficiency(finalFillage, finalMu);
  const finalPowerKw = polishedRodPowerKw(finalLoads, srp.stroke, srp.spm) / DRIVE_EFF;

  const state: TwinState = {
    reservoir: {
      temperature: temp,
      pressure,
      viscosity: finalMu,
      saturation: reservoir.saturation,
    },
    wellbore: {
      bhp,
      temperature: temp - 8, // [assumption] wellbore heat loss gradient
      flowRate: points[points.length - 1]?.liquidRate ?? 0,
      rodLoad: finalLoads.peak,
      pumpFillage: finalFillage,
    },
    srp: {
      spm: srp.spm,
      stroke: srp.stroke,
      vfd: srp.vfd,
      efficiency: finalEff,
      power: finalPowerKw,
    },
    surface: {
      oilRate: points[points.length - 1]?.oilRate ?? 0,
      waterRate: points[points.length - 1]?.waterRate ?? 0,
      liquidRate: points[points.length - 1]?.liquidRate ?? 0,
      steamUsed: cumSteam,
    },
    risk: {
      rodFloat: riskLevel(worst.float),
      rodFloatScore: worst.float,
      impactLoading: riskLevel(worst.impact),
      impactLoadingScore: worst.impact,
      pumpUnsetting: riskLevel(worst.unset),
      pumpUnsettingScore: worst.unset,
      rodFailure: riskLevel(worst.failure),
      rodFailureScore: worst.failure,
    },
    economics: {
      energy: cumEnergy,
      energyPerBarrel: cumOil > 0 ? cumEnergy / cumOil : 0,
      cost: cumCost,
      costPerBarrel: cumOil > 0 ? cumCost / cumOil : 0,
    },
  };

  const summary: CycleSummary = {
    oilProduced: cumOil,
    liquidProduced: cumLiquid,
    steamInjected: cumSteam,
    sor: cumOil > 0 ? cumSteam / cumOil : 99,
    peakTemperature: peakTemp,
    viscosityAtStart,
    avgOilRate: prodDays > 0 ? prodRateSum / prodDays : 0,
    peakPower,
    avgEfficiency: prodDays > 0 ? effSum / prodDays : 0,
    energy: cumEnergy,
    energyPerBarrel: cumOil > 0 ? cumEnergy / cumOil : 0,
    cost: cumCost,
    costPerBarrel: cumOil > 0 ? cumCost / cumOil : 0,
    worstRodFloat: riskLevel(worst.float),
    worstImpactLoading: riskLevel(worst.impact),
    worstPumpUnsetting: riskLevel(worst.unset),
    worstRodFailure: riskLevel(worst.failure),
    worstRodFloatScore: worst.float,
    worstImpactLoadingScore: worst.impact,
    worstPumpUnsettingScore: worst.unset,
    worstRodFailureScore: worst.failure,
    effectiveProductionDays: prodDays,
    cutOffHit,
    cutOffHitOnDay,
    peakRiskDay,
  };

  return { params, points, state, summary };
}
