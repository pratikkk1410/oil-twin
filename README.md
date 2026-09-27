# Baghewala Digital Twin — CSS × SRP Optimization Console

A **software-only prototype Digital Twin** for well-to-surface optimization of Cyclic Steam
Stimulation (CSS) and Sucker Rod Pump (SRP) operations on a heavy-oil well modelled on the
Baghewala field profile (17–19 °API, Jodhpur Sandstone, 46–48 °C reservoir).

Built for Smart India Hackathon-style demonstration. **This is a decision-support prototype,
not a real reservoir model and not a control system.**

## What it does

One coupled simulation connects the four layers of the well:

```
Reservoir (thermal node, viscosity) → Wellbore (Darcy inflow)
   → SRP (displacement, fillage, rod loads) → Surface (oil, water, energy, SOR, cost)
```

- **Cycle simulation** — daily stepping through INJECTION → SOAK → PRODUCTION → COOLING,
  with an economic cut-off that shuts the well in when revenue < daily cost.
- **Risk models** — model-predicted rod floating, impact loading, pump unsetting and
  rod-failure scores for every production day.
- **Joint optimizer** — weighted grid search over steam volume × soak × production run ×
  SPM × BHP. Every candidate is re-simulated through the same physics, so CSS choices shift
  the SRP optimum (the core well-to-surface coupling).
- **What-if** — current vs simulated plan comparison, computed live from the model.
- **Traditional vs AI-optimized** — the same engine runs a fixed manual plan and the
  optimizer's plan side by side.

## Run it

```bash
bun install
bun run dev          # the Freebuff platform runs this automatically
bun test tests/twin.test.ts   # 25 engine tests
bun tsc -b --noEmit  # typecheck
```

## Where the model lives

```
src/lib/twin/
├── physics.ts    Arrhenius μ–T, lumped thermal node, steam Tsat cap,
│                 radial Darcy inflow, SRP loads/power, 4 risk models
├── simulate.ts   one CSS cycle + SRP, daily steps, per-day time series
├── optimize.ts   joint weighted grid search + rationale
├── forecast.ts   model-based forward projection (24h/7d/30d)
├── history.ts    synthetic history + traditional baseline (seeded)
├── defaults.ts   the documented default operating point
└── types.ts      DigitalTwinState and friends
```

## Documented assumptions (highlights)

Values marked `[SIH BRIEF]` come from the problem statement (17–19 °API, 46–48 °C, low
pressure). Everything else is a **prototype assumption**, labelled in code:

| Assumption | Value |
|---|---|
| Viscosity model | Arrhenius μ(T) = 2.66e-4 · exp(5392 / (T+273.15)) cP → μ(47 °C) ≈ 5,500 cP, μ(200 °C) ≈ 24 cP |
| Steam enthalpy | 2.232 GJ/t, 55 % stored in the heated zone |
| Steam Tsat cap | Tsat ≈ 100 · P^0.25 °C (95 bar ≈ 311 °C) |
| Heated zone | r = 9 m effective radius, 25 m pay, 55 % sweep |
| Cooling | exponential, 0.008/day toward 46 °C far-field |
| Inflow | steady-state radial Darcy, k = 900 mD, h = 25 m, skin 1.5 |
| Water cut | 18 % constant |
| Rod string | 88 kN dry weight, α = SPM²·stroke/70471 dynamics |
| Economics | steam ₹2,200/t, power ₹7/kWh, oil ₹3,200/bbl (all editable in `defaults.ts`) |

## Responsible-modelling language

The UI deliberately says **model-predicted**, **simulation-based estimate** and
**decision-support recommendation**. Nothing claims exact reservoir prediction, guaranteed
production gains, guaranteed equipment safety or real-time field control.

## Demo flow (2–3 min)

1. **Current state** — KPI strip + well schematic + heat map (console home).
2. **Play the cycle** — press *Play*: injection heats the zone, production lifts hot oil,
   the reservoir cools, mobility falls.
3. **Run optimizer** — the recommendation card shows Current → Recommended → Expected for
   steam/soak/production/SPM/BHP with the model's rationale.
4. **What-if** — the comparison panel shows current vs simulated oil, SOR, energy, cost.
5. **Risk detection** — drag the playhead late in the cycle: viscosity climbs, risks light up,
   and the card lists contributing factors.
6. **Traditional vs AI-optimized** — same engine, same reservoir, earned delta.
