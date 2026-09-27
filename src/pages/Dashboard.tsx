import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ProductionTempChart, RiskChart, CompareChart } from "@/components/twin/Charts";
import { CycleTimeline } from "@/components/twin/CycleTimeline";
import { ReservoirHeatmap } from "@/components/twin/ReservoirHeatmap";
import { WellSchematic } from "@/components/twin/WellSchematic";
import { EffectChip, KpiCard, RiskBadge, SectionLabel } from "@/components/twin/panels";
import {
  DEFAULT_GEOMETRY,
  DEFAULT_PARAMS,
  FIELD,
  forecastFrom,
  optimizeWellToSurface,
  pumpDisplacement,
  RESERVOIR_UNIT,
  riskLevel,
  simulateCssSrpCycle,
  traditionalBaseline,
  WELL_NAME,
  type CyclePoint,
  type OperatingParams,
  type Recommendation,
  type SimulationResult,
} from "@/lib/twin";
import { LogOut, Play, Pause, RotateCcw, Sparkles, Loader2, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router";

const playheadPoint = (sim: SimulationResult, day: number): CyclePoint => {
  let pt = sim.points[0];
  for (const p of sim.points) if (p.day <= day) pt = p;
  return pt;
};

/** Format large numbers with Indian-style digit grouping. */
const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // ---- Twin state ----------------------------------------------------------
  const [params, setParams] = useState<OperatingParams>(DEFAULT_PARAMS);
  const [day, setDay] = useState(20);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState<{ recommendation: Recommendation; baseline: SimulationResult } | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const timer = useRef<number | null>(null);

  const sim = useMemo(() => simulateCssSrpCycle(params), [params]);
  const traditional = useMemo(() => traditionalBaseline(DEFAULT_PARAMS), []);
  const displacement = useMemo(
    () => pumpDisplacement(params.srp.stroke, params.srp.spm, DEFAULT_GEOMETRY),
    [params.srp.stroke, params.srp.spm],
  );

  // --- Playback loop (1 day per tick, ~20 fps) ------------------------------
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setDay((d) => (d + 1 > sim.points[sim.points.length - 1].day ? 0 : d + 1));
    }, 120);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, sim]);

  const point = playheadPoint(sim, day);
  const at = (k: keyof CyclePoint) => point[k] as number;

  const forecast = useMemo(
    () => forecastFrom(params, day, "30d"),
    [params, day],
  );

  const worstRisk: "LOW" | "MEDIUM" | "HIGH" = riskLevel(
    Math.max(point.rodFloatScore, point.impactLoadingScore, point.pumpUnsettingScore, point.rodFailureScore),
  );
  const riskAdvice =
    worstRisk === "HIGH"
      ? "reduce SPM / lower drawdown, then re-run the optimizer for a safer joint plan"
      : "consider the optimizer's plan before risks escalate";

  const applyRec = useCallback((r: Recommendation) => {
    setParams((p) => ({ ...p, css: r.css, srp: r.srp, bhp: r.bhp }));
    setRec(null);
  }, []);

  const runOptimizer = useCallback(() => {
    setOptimizing(true);
    // Yield a frame so the spinner paints before the 100 ms search.
    window.setTimeout(() => {
      const out = optimizeWellToSurface(params);
      setRec({ recommendation: out.recommendation, baseline: out.baseline });
      setOptimizing(false);
    }, 30);
  }, [params]);

  const whatIf = useMemo(() => simulateCssSrpCycle(rec ? { ...params, css: rec.recommendation.css, srp: rec.recommendation.srp, bhp: rec.recommendation.bhp } : params), [params, rec]);

  const status =
    point.phase === "INJECTION" ? "STEAM INJECTION" :
    point.phase === "SOAK" ? "SOAKING" :
    point.phase === "PRODUCTION" ? "PRODUCING" : "COOLING / SHUT-IN";

  const statusTone =
    point.phase === "INJECTION" ? "default" :
    point.phase === "SOAK" ? "secondary" :
    point.phase === "PRODUCTION" ? "good" : "warning";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------------- Header ---------------- */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg">Baghewala Digital Twin</span>
            <span className="font-data text-[11px] text-muted-foreground">
              {WELL_NAME} · {FIELD} · {RESERVOIR_UNIT}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden font-data text-[11px] text-muted-foreground sm:inline">
              signed in as {user?.email ?? "guest"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-16 pt-6">
        {/* ---------------- Status strip ---------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{
                backgroundColor:
                  statusTone === "good" ? "oklch(0.5 0.05 140)" :
                  statusTone === "warning" ? "oklch(0.72 0.05 70)" : "oklch(0.55 0.08 55)",
              }}
            />
            <h1 className="font-display text-2xl">{status}</h1>
            <span className="font-data text-xs text-muted-foreground">PROTOTYPE · MODEL-PREDICTED</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDay(0)}>
              <RotateCcw className="size-3.5" /> Restart cycle
            </Button>
            <Button size="sm" onClick={() => setPlaying((v) => !v)}>
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? "Pause" : "Play cycle"}
            </Button>
          </div>
          <Badge variant="outline" className="font-data">
            day {day} / {sim.points[sim.points.length - 1].day}
          </Badge>
        </div>

        {/* ---------------- KPI strip ---------------- */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Oil rate" value={at("oilRate").toFixed(0)} unit="BOPD" sub={`${(point.liquidRate - point.oilRate).toFixed(0)} bbl/d water`} />
          <KpiCard label="Reservoir temp" value={at("temperature").toFixed(1)} unit="°C" sub={`viscosity ${Math.round(at("viscosity"))} cP`} />
          <KpiCard label="SOR (cum)" value={at("sor") > 0 ? at("sor").toFixed(2) : "—"} unit="t/bbl" sub={`${Math.round(point.cumSteam)} t steam in`} />
          <KpiCard
            label="Energy rate"
            value={at("energy").toFixed(0)}
            unit="kWh/d"
            sub={point.oilRate > 0 ? `${(at("energy") / point.oilRate).toFixed(0)} kWh/bbl` : "no offtake — injection day"}
          />
          <KpiCard
            label="Rod failure risk"
            value={Math.round(point.rodFailureScore * 100) + "%"}
            tone={point.rodFailureScore >= 0.65 ? "critical" : point.rodFailureScore >= 0.35 ? "warning" : "good"}
            sub={`float ${Math.round(point.rodFloatScore * 100)}% · impact ${Math.round(point.impactLoadingScore * 100)}%`}
          />
          <KpiCard label="Pump efficiency" value={(point.pumpEfficiency * 100).toFixed(0)} unit="%" sub={`${params.srp.spm} SPM`} />
        </div>

        {/* ---------------- Visualization row ---------------- */}
        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <Card className="border-border/70 shadow-none lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Well visualization</CardTitle>
            </CardHeader>
            <CardContent className="h-[420px]">
              <WellSchematic
                tempC={point.temperature}
                phase={point.phase}
                fillage={
                  point.phase === "PRODUCTION"
                    ? Math.min(point.liquidRate / Math.max(displacement, 1), 1)
                    : 1
                }
                rodLoadKn={point.rodLoad}
                rodLoadLimitKn={params.srp.rodLoadLimit}
                playing={playing && point.phase === "PRODUCTION"}
                oilRate={point.oilRate}
                liquidRate={point.liquidRate}
              />
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Reservoir heat map</CardTitle>
            </CardHeader>
            <CardContent className="relative h-[420px]">
              <ReservoirHeatmap sim={sim} day={day} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 lg:col-span-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">CSS cycle timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <CycleTimeline
                  injectionDays={params.css.injectionDays}
                  soakDays={params.css.soakDays}
                  productionDays={params.css.productionDays}
                  productionEndDay={
                    params.css.injectionDays +
                    params.css.soakDays +
                    sim.summary.effectiveProductionDays
                  }
                  totalDays={sim.points[sim.points.length - 1].day}
                  day={day}
                  phaseAtDay={point.phase}
                />
                <div className="mt-4 grid grid-cols-2 gap-2 font-data text-[11px] text-muted-foreground">
                  <span>steam {Math.round(point.cumSteam)} t</span>
                  <span>cum oil {Math.round(point.cumOil)} bbl</span>
                  <span>peak T {Math.round(sim.summary.peakTemperature)} °C</span>
                  <span>cutoff at day {sim.summary.cutOffHit ? sim.summary.cutOffHitOnDay : "—"}</span>
                </div>
                <Slider
                  className="mt-5"
                  value={[day]}
                  min={0}
                  max={sim.points[sim.points.length - 1].day}
                  step={1}
                  onValueChange={([v]) => {
                    setPlaying(false);
                    setDay(v);
                  }}
                  aria-label="Cycle day"
                />
                {/* Prediction strip — model-predicted trajectory from this day */}
                {point.phase === "PRODUCTION" && (
                  <div className="mt-4 rounded border border-border bg-muted/30 px-3 py-2.5">
                    <SectionLabel>Model-predicted next 30 days</SectionLabel>
                    <div className="mt-2 grid grid-cols-3 gap-2 font-data text-[11px] tabular">
                      {(
                        [
                          ["oil", `${forecast[2]?.oilRate.toFixed(0)} → ${forecast[forecast.length - 1]?.oilRate.toFixed(0)} bbl/d`],
                          ["temp", `${forecast[0]?.temperature.toFixed(0)} → ${forecast[forecast.length - 1]?.temperature.toFixed(0)} °C`],
                          ["μ", `${Math.round(forecast[0]?.viscosity ?? 0)} → ${Math.round(forecast[forecast.length - 1]?.viscosity ?? 0)} cP`],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-muted-foreground">{k}</span>
                          <div>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">Operating controls</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
                {(
                  [
                    ["SPM", "spm", 4, 16, 0.5, "srp"],
                    ["Steam (t)", "steamVolume", 400, 2400, 40, "css"],
                    ["Soak (d)", "soakDays", 1, 15, 1, "css"],
                    ["Production (d)", "productionDays", 60, 360, 10, "css"],
                    ["BHP (bar)", "bhp", 8, 32, 1, "bhp"],
                    ["Injection pressure (bar)", "injectionPressure", 60, 140, 5, "css"],
                  ] as const
                ).map(([label, key, min, max, step, group]) => {
                  const value = group === "css" ? params.css[key] : group === "srp" ? params.srp[key] : params.bhp;
                  return (
                    <div key={key} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between">
                        <Label className="text-[11px] text-muted-foreground">{label}</Label>
                        <span className="font-data text-[11px] tabular">{value}</span>
                      </div>
                      <Slider
                        value={[value]}
                        min={min}
                        max={max}
                        step={step}
                        onValueChange={([v]) => {
                          setPlaying(false);
                          setParams((p) => {
                            if (group === "css") return { ...p, css: { ...p.css, [key]: v } };
                            if (group === "srp") return { ...p, srp: { ...p.srp, [key]: v } };
                            return { ...p, bhp: v };
                          });
                        }}
                        aria-label={label}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ---------------- Charts ---------------- */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-0">
              <CardTitle className="font-display text-base">Production & temperature</CardTitle>
              <SectionLabel>bbl/d (left) · °C (right)</SectionLabel>
            </CardHeader>
            <CardContent>
              <ProductionTempChart sim={sim} />
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-0">
              <CardTitle className="font-display text-base">Model-predicted equipment risk</CardTitle>
              <SectionLabel>rod float · impact · unset · failure (%)</SectionLabel>
            </CardHeader>
            <CardContent>
              <RiskChart sim={sim} />
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Risk detection ---------------- */}
        <Card className="mt-4 border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Equipment risk detection — day {day}</CardTitle>
            <SectionLabel>model-predicted scores at the playhead, with main contributing factors</SectionLabel>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-10 gap-y-1 md:grid-cols-2">
              <RiskBadge label="Rod floating (downstroke)" level={riskLevel(point.rodFloatScore)} score={point.rodFloatScore} />
              <RiskBadge label="Impact loading (peak load)" level={riskLevel(point.impactLoadingScore)} score={point.impactLoadingScore} />
              <RiskBadge label="Pump unsetting (pump-off slam)" level={riskLevel(point.pumpUnsettingScore)} score={point.pumpUnsettingScore} />
              <RiskBadge label="Rod failure (fatigue proxy)" level={riskLevel(point.rodFailureScore)} score={point.rodFailureScore} />
            </div>
            {worstRisk !== "LOW" && (
              <div className="mt-3 flex items-start gap-2 rounded border border-[oklch(0.72_0.05_70)] bg-[oklch(0.72_0.05_70_/_0.08)] px-3 py-2.5">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[oklch(0.55_0.1_45)]" />
                <div className="text-xs leading-5">
                  <span className="font-medium">⚠ {worstRisk} risk detected</span> — {riskAdvice}
                  <span className="mt-1 block font-data text-[11px] text-muted-foreground">
                    decision-support estimate · not a field-control signal
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------- AI recommendation + what-if ---------------- */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="border-[oklch(0.72_0.05_70)] shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-base">AI recommendation — joint CSS + SRP</CardTitle>
                <Button size="sm" onClick={runOptimizer} disabled={optimizing}>
                  {optimizing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Run optimizer
                </Button>
              </div>
              <SectionLabel>
                grid search over steam × soak × production × SPM × BHP — every candidate re-simulated
              </SectionLabel>
            </CardHeader>
            <CardContent>
              {!rec ? (
                <p className="text-sm text-muted-foreground">
                  Run the joint well-to-surface optimizer to get a recommended injection / soak /
                  production plan and SRP settings for the current reservoir state.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["Steam", rec.recommendation.css.steamVolume, params.css.steamVolume, "t"],
                        ["Soak", rec.recommendation.css.soakDays, params.css.soakDays, "d"],
                        ["Production run", rec.recommendation.css.productionDays, params.css.productionDays, "d"],
                        ["SPM", rec.recommendation.srp.spm, params.srp.spm, ""],
                        ["BHP", rec.recommendation.bhp, params.bhp, "bar"],
                      ] as const
                    ).map(([label, to, from, unit]) => (
                      <div key={label} className="rounded border border-border bg-muted/40 px-2.5 py-2">
                        <SectionLabel>{label}</SectionLabel>
                        <div className="mt-1 font-data text-sm tabular">
                          {String(from)} {unit} → <span className="text-foreground">{String(to)} {unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-border bg-muted/30 px-3 py-2.5">
                    <SectionLabel>Expected effect (model-predicted)</SectionLabel>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <EffectChip dir="up" text={`oil ${Math.round(rec.recommendation.expected.oil)} bbl/cycle (${pct(rec.recommendation.expected.oil, rec.baseline.summary.oilProduced)})`} />
                      <EffectChip dir="down" text={`SOR ${rec.recommendation.expected.sor.toFixed(2)} t/bbl`} />
                      <EffectChip dir="down" text={`energy ${rec.recommendation.expected.energyPerBarrel.toFixed(0)} kWh/bbl`} />
                      <EffectChip dir="down" text={`cost ${inr(rec.recommendation.expected.costPerBarrel)}/bbl`} />
                      <EffectChip dir="down" text={`rod-float ${Math.round(rec.recommendation.expected.worstRodFloatScore * 100)}%`} />
                      <EffectChip dir="down" text={`rod-failure ${Math.round(rec.recommendation.expected.worstRodFailureScore * 100)}%`} />
                    </div>
                  </div>
                  <ul className="list-inside list-disc text-xs leading-5 text-muted-foreground">
                    {rec.recommendation.rationale.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => applyRec(rec.recommendation)}>Apply plan</Button>
                    <Button size="sm" variant="outline" onClick={() => setRec(null)}>Dismiss</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">What-if — current vs simulated</CardTitle>
              <SectionLabel>
                {rec ? "comparing the recommended plan against the current plan" : "adjust controls to compare live"}
              </SectionLabel>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border border-border px-3 py-2.5">
                  <SectionLabel>Current plan</SectionLabel>
                  <div className="mt-2 space-y-1 font-data text-xs tabular">
                    <div className="flex justify-between"><span className="text-muted-foreground">oil</span><span>{Math.round(sim.summary.oilProduced)} bbl</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">SOR</span><span>{sim.summary.sor.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">energy</span><span>{sim.summary.energyPerBarrel.toFixed(0)} kWh/bbl</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">cost</span><span>{inr(sim.summary.costPerBarrel)}/bbl</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">rod float</span><span>{riskLevel(sim.summary.worstRodFloatScore)}</span></div>
                  </div>
                </div>
                <div className="rounded border border-[oklch(0.72_0.05_70)] bg-[oklch(0.72_0.05_70_/_0.06)] px-3 py-2.5">
                  <SectionLabel>Simulated plan</SectionLabel>
                  <div className="mt-2 space-y-1 font-data text-xs tabular">
                    <div className="flex justify-between"><span className="text-muted-foreground">oil</span><span>{Math.round(whatIf.summary.oilProduced)} bbl</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">SOR</span><span>{whatIf.summary.sor.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">energy</span><span>{whatIf.summary.energyPerBarrel.toFixed(0)} kWh/bbl</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">cost</span><span>{inr(whatIf.summary.costPerBarrel)}/bbl</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">rod float</span><span>{riskLevel(whatIf.summary.worstRodFloatScore)}</span></div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <CompareChart baselinePoints={sim.points} candidatePoints={whatIf.points} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Baseline comparison ---------------- */}
        <Card className="mt-4 border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Traditional vs AI-optimized (same reservoir, same engine)</CardTitle>
            <SectionLabel>traditional = manual 12 SPM + fixed 1,200 t plan · AI = optimizer output for the current state</SectionLabel>
          </CardHeader>
          <CardContent>
            <table className="w-full font-data text-xs tabular">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 font-normal">metric</th>
                  <th className="py-1.5 font-normal">traditional</th>
                  <th className="py-1.5 font-normal">AI-optimized</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["oil / cycle", `${Math.round(traditional.summary.oilProduced)} bbl`, rec ? `${Math.round(rec.recommendation.expected.oil)} bbl` : "—"],
                    ["SOR", traditional.summary.sor.toFixed(2), rec ? rec.recommendation.expected.sor.toFixed(2) : "—"],
                    ["energy/bbl", `${traditional.summary.energyPerBarrel.toFixed(0)} kWh`, rec ? `${rec.recommendation.expected.energyPerBarrel.toFixed(0)} kWh` : "—"],
                    ["cost/bbl", inr(traditional.summary.costPerBarrel), rec ? inr(rec.recommendation.expected.costPerBarrel) : "—"],
                    ["rod float", riskLevel(traditional.summary.worstRodFloatScore), rec ? riskLevel(rec.recommendation.expected.worstRodFloatScore) : "—"],
                  ] as const
                ).map(([m, a, b]) => (
                  <tr key={m} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 text-muted-foreground">{m}</td>
                    <td className="py-1.5">{a}</td>
                    <td className="py-1.5">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* ---------------- Assumptions ---------------- */}
        <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
          Prototype decision-support model. All values are simulation-based estimates from lumped-parameter
          models (Arrhenius μ–T, single-node thermal, radial Darcy inflow, polished-rod load proxy) with
          documented assumptions — not a calibrated Baghewala reservoir model and not for field control.
          Steam cost {inr(params.constants.steamCost)}/t · power {inr(params.constants.powerCost)}/kWh ·
          oil price {inr(params.constants.oilPrice)}/bbl (editable in the engine defaults).
        </p>
      </main>
    </div>
  );
}

const pct = (a: number, b: number) => `${a >= b ? "+" : ""}${Math.round(((a - b) / Math.max(b, 1)) * 100)}%`;
