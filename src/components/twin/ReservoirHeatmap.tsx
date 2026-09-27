import { useMemo } from "react";
import type { SimulationResult } from "@/lib/twin";

const tempColor = (t: number) => {
  // 46 °C slate-sand → 250 °C ember. Interpolated oklch heat ramp.
  const x = Math.min(Math.max((t - 46) / 200, 0), 1);
  const l = 0.86 - 0.33 * x;
  const c = 0.015 + 0.115 * x;
  const h = 80 - 30 * x;
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
};

export function ReservoirHeatmap({
  sim,
  day,
}: {
  sim: SimulationResult;
  day: number;
}) {
  const { color, mobility } = useMemo(() => {
    // Temperature at the requested day (nearest recorded point).
    const pts = sim.points;
    let pt = pts[0];
    for (const p of pts) if (p.day <= day) pt = p;
    const t = pt.temperature;
    const mu = pt.viscosity;
    // Mobility proxy: cold oil barely moves, hot oil flows freely.
    const mob = Math.min(Math.max(Math.log10(Math.max(mu, 1)) / 3.8, 0), 1);
    return { color: tempColor(t), mobility: 1 - mob };
  }, [sim, day]);



  const hotRadius = useMemo(() => {
    const pts = sim.points;
    let pt = pts[0];
    for (const p of pts) if (p.day <= day) pt = p;
    return Math.min(Math.max((pt.temperature - 46) / 200, 0), 1);
  }, [sim, day]);

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 240 240" className="h-full w-full" role="img" aria-label="Reservoir heat map">
        <defs>
          <radialGradient id="heatR" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="55%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* cold reservoir background */}
        <rect x="0" y="0" width="240" height="240" fill="oklch(0.9 0.01 80)" />

        {/* heated zone */}
        <circle
          cx="120"
          cy="120"
          r={20 + 92 * hotRadius}
          fill="url(#heatR)"
        />

        {/* grid hairlines */}
        {Array.from({ length: 7 }).map((_, i) => (
          <g key={i} className="stroke-border/60">
            <line x1={20 + i * 33.3} y1="0" x2={20 + i * 33.3} y2="240" strokeWidth="0.5" />
            <line x1="0" y1={20 + i * 33.3} x2="240" y2={20 + i * 33.3} strokeWidth="0.5" />
          </g>
        ))}

        {/* well */}
        <circle cx="120" cy="120" r="4" className="fill-foreground" />
        <circle cx="120" cy="120" r="8" fill="none" className="stroke-foreground/50" strokeWidth="1.5" />

        {/* labels */}
        <text x="6" y="14" className="fill-muted-foreground font-data" fontSize="8">
          TOP VIEW
        </text>
        <text x="120" y="232" textAnchor="middle" className="fill-muted-foreground font-data" fontSize="8">
          STEAM ZONE r ≈ {Math.round(9 * (0.3 + hotRadius))} m
        </text>
      </svg>

      {/* mobility readout */}
      <div className="absolute bottom-1 right-1 flex flex-col items-end gap-0.5 font-data text-[10px] text-muted-foreground">
        <span>OIL MOBILITY</span>
        <span className="text-foreground tabular">{Math.round(mobility * 100)}%</span>
      </div>
    </div>
  );
}
