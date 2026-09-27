import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CyclePoint } from "@/lib/twin";

const tooltipStyle = {
  backgroundColor: "oklch(0.995 0.003 90)",
  border: "1px solid oklch(0.885 0.008 75)",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  padding: "6px 10px",
};

function PhaseBand({ sim }: { sim: { points: CyclePoint[] } }) {
  const pts = sim.points;
  if (!pts.length) return null;
  const find = (pred: (p: CyclePoint) => boolean, fallback: number) => {
    const p = pts.find(pred);
    return p ? p.day : fallback;
  };
  const injEnd = find((p) => p.phase !== "INJECTION", pts[pts.length - 1].day);
  const soakEnd = find((p) => p.phase === "PRODUCTION" || p.phase === "COOLING", injEnd);
  const bands: { x1: number; x2: number; fill: string }[] = [];
  if (injEnd > 0) bands.push({ x1: 0, x2: injEnd, fill: "oklch(0.72 0.05 70 / 0.14)" });
  if (soakEnd > injEnd) bands.push({ x1: injEnd, x2: soakEnd, fill: "oklch(0.82 0.04 75 / 0.12)" });
  return (
    <>
      {bands.map((b, i) => (
        <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill={b.fill} stroke="none" />
      ))}
      <ReferenceLine x={injEnd} stroke="oklch(0.885 0.008 75)" strokeDasharray="3 3" />
    </>
  );
}

export function ProductionTempChart({ sim, height = 220 }: { sim: { points: CyclePoint[] }; height?: number }) {
  const data = sim.points.map((p) => ({
    day: p.day,
    oil: Math.round(p.oilRate * 10) / 10,
    temp: Math.round(p.temperature),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="oklch(0.885 0.008 75 / 0.5)" strokeDasharray="2 4" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          stroke="oklch(0.5 0.012 60)"
          tickLine={false}
        />
        <YAxis yAxisId="oil" tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} stroke="oklch(0.5 0.012 60)" tickLine={false} width={44} />
        <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} stroke="oklch(0.5 0.012 60)" tickLine={false} width={36} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string, n: string) => [n === "oil" ? `${v} bbl/d` : `${v} °C`, n === "oil" ? "Oil rate" : "Reservoir temp"]} />
        <PhaseBand sim={sim} />
        <Line yAxisId="oil" type="monotone" dataKey="oil" stroke="oklch(0.55 0.08 55)" strokeWidth="2" dot={false} />
        <Line yAxisId="temp" type="monotone" dataKey="temp" stroke="oklch(0.58 0.09 45)" strokeWidth="1.5" strokeDasharray="4 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RiskChart({ sim, height = 180 }: { sim: { points: CyclePoint[] }; height?: number }) {
  const data = sim.points.map((p) => ({
    day: p.day,
    float: Math.round(p.rodFloatScore * 100),
    impact: Math.round(p.impactLoadingScore * 100),
    unset: Math.round(p.pumpUnsettingScore * 100),
    failure: Math.round(p.rodFailureScore * 100),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="oklch(0.885 0.008 75 / 0.5)" strokeDasharray="2 4" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} stroke="oklch(0.5 0.012 60)" tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} stroke="oklch(0.5 0.012 60)" tickLine={false} width={38} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string, n: string) => [`${v}%`, n]} />
        <ReferenceLine y={35} stroke="oklch(0.72 0.05 70)" strokeDasharray="3 3" />
        <ReferenceLine y={65} stroke="oklch(0.55 0.16 25 / 0.6)" strokeDasharray="3 3" />
        <Line type="monotone" dataKey="float" name="Rod float" stroke="oklch(0.55 0.08 55)" strokeWidth="1.75" dot={false} />
        <Line type="monotone" dataKey="impact" name="Impact load" stroke="oklch(0.58 0.09 45)" strokeWidth="1.75" dot={false} />
        <Line type="monotone" dataKey="unset" name="Pump unset" stroke="oklch(0.5 0.05 140)" strokeWidth="1.75" dot={false} />
        <Line type="monotone" dataKey="failure" name="Rod failure" stroke="oklch(0.45 0.04 250)" strokeWidth="1.75" strokeDasharray="4 3" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareChart({
  baselinePoints,
  candidatePoints,
  height = 200,
}: {
  baselinePoints: CyclePoint[];
  candidatePoints: CyclePoint[];
  height?: number;
}) {
  const days = Math.min(baselinePoints.length, candidatePoints.length);
  const data = Array.from({ length: days }, (_, i) => ({
    day: baselinePoints[i].day,
    current: Math.round(baselinePoints[i].oilRate * 10) / 10,
    simulated: Math.round(candidatePoints[i].oilRate * 10) / 10,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="oklch(0.885 0.008 75 / 0.5)" strokeDasharray="2 4" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} stroke="oklch(0.5 0.012 60)" tickLine={false} />
        <YAxis tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }} stroke="oklch(0.5 0.012 60)" tickLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string, n: string) => [`${v} bbl/d`, n === "current" ? "Current plan" : "Simulated plan"]} />
        <Line type="monotone" dataKey="current" name="Current" stroke="oklch(0.5 0.012 60)" strokeWidth="1.5" strokeDasharray="5 4" dot={false} />
        <Line type="monotone" dataKey="simulated" name="Simulated" stroke="oklch(0.55 0.08 55)" strokeWidth="2" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
