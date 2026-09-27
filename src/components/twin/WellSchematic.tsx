import type { CyclePhase } from "@/lib/twin";

/** Schematic depth positions, fractional 0(surface)-1(bottom). */
const D = {
  reservoirTop: 0.86,
  pump: 0.7,
};

const heatColor = (tempC: number) => {
  // 46°C cold → slate; 250°C hot → ember glow.
  const t = Math.min(Math.max((tempC - 46) / 200, 0), 1);
  const l = 0.55 + 0.25 * t;
  return `oklch(0.62 ${0.02 + 0.11 * t} ${55 - 12 * t})`;
};

export function WellSchematic({
  tempC,
  phase,
  fillage,
  rodLoadKn,
  rodLoadLimitKn,
  playing,
  oilRate,
  liquidRate,
}: {
  tempC: number;
  phase: CyclePhase;
  fillage: number;
  rodLoadKn: number;
  rodLoadLimitKn: number;
  playing: boolean;
  oilRate: number;
  liquidRate: number;
}) {
  const stroke = 0.55 + 0.45 * Math.min(fillage, 1);
  const loadFrac = Math.min(rodLoadKn / rodLoadLimitKn, 1);
  const color = heatColor(tempC);

  return (
    <svg viewBox="0 0 300 560" className="h-full w-full" role="img" aria-label="Well schematic">
      <defs>
        <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="steamGlow" cx="0.5" cy="0.95" r="0.75">
          <stop offset="0%" stopColor={color} stopOpacity={phase === "INJECTION" ? 0.75 : 0.4} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* steam glow rising from reservoir */}
      <rect x="0" y="0" width="300" height={560 * D.pump} fill="url(#steamGlow)" opacity={playing ? 1 : 0.8} />

      {/* surface line + ground */}
      <line x1="20" y1="40" x2="280" y2="40" className="stroke-border" strokeWidth="2" />
      <text x="150" y="30" textAnchor="middle" className="fill-muted-foreground font-data" fontSize="10" letterSpacing="2">
        SURFACE · 0 m
      </text>

      {/* derrick */}
      <path d="M110 40 L150 8 L190 40" fill="none" className="stroke-foreground/40" strokeWidth="2" />
      {/* pumpjack (4-bar mechanism) */}
      <g>
        <path d="M118 46 L182 46 L196 30 L112 30 Z" fill="none" className="stroke-foreground/50" strokeWidth="1.5" />
        <circle cx="150" cy="46" r="4" className="fill-foreground/60" />
        {/* counterweight pin — SMIL animation so it moves smoothly */}
        <circle cx="150" cy="34" r="6" className="fill-primary">
          {playing && (
            <animate attributeName="cy" values="34;25;34" dur="0.9s" repeatCount="indefinite" />
          )}
        </circle>
        {/* bridle + polished rod */}
        <line x1="150" y1="52" x2="150" y2={560 * D.pump} className="stroke-foreground/70" strokeWidth={2.5} strokeDasharray={playing ? "6 4" : undefined}>
          {playing && (
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
          )}
        </line>
      </g>

      {/* casing walls */}
      <line x1="118" y1="60" x2="118" y2={560 * D.reservoirTop} className="stroke-border" strokeWidth="2" />
      <line x1="182" y1="60" x2="182" y2={560 * D.reservoirTop} className="stroke-border" strokeWidth="2" />

      {/* tubing fluid column */}
      <rect
        x="121"
        y={560 * D.pump}
        width="58"
        height={560 * (D.reservoirTop - D.pump) * Math.min(fillage, 1)}
        fill={color}
        opacity={0.5}
      />

      {/* pump barrel */}
      <rect
        x="121"
        y={560 * D.pump - 10}
        width="58"
        height="26"
        rx="3"
        fill="none"
        className="stroke-foreground/60"
        strokeWidth="2"
      />
      <rect
        x="124"
        y={560 * D.pump - 7}
        width="52"
        height="20"
        rx="2"
        fill={color}
        opacity={0.35 + 0.5 * Math.min(fillage, 1)}
      />
      <text x="150" y={560 * D.pump + 32} textAnchor="middle" className="fill-muted-foreground font-data" fontSize="9" letterSpacing="1.5">
        PUMP · {Math.round(fillage * 100)}% FILL
      </text>

      {/* reservoir */}
      <rect x="20" y={560 * D.reservoirTop} width="260" height="58" fill="url(#resGrad)" />
      <path
        d={`M20 ${560 * D.reservoirTop} q30 -8 60 0 t60 0 t60 0 t60 0 t20 0 V ${560 * D.reservoirTop + 58} H20 Z`}
        fill={color}
        opacity="0.35"
      />
      <text x="150" y={560 * D.reservoirTop + 30} textAnchor="middle" className="fill-background font-data" fontSize="10" letterSpacing="2">
        RESERVOIR · {Math.round(tempC)} °C
      </text>

      {/* production bubbles */}
      {(playing && phase === "PRODUCTION" && liquidRate > 0) &&
        [0, 1, 2].map((i) => (
          <circle key={i} cx={128 + i * 22} r={3 + i} fill={color} opacity="0.7">
            <animate attributeName="cy" from={560 * D.pump} to="70" dur={`${2.4 + i * 0.5}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0.1" dur={`${2.4 + i * 0.5}s`} repeatCount="indefinite" />
          </circle>
        ))}

      {/* annotations */}
      <text x="24" y="80" className="fill-muted-foreground font-data" fontSize="9">
        {phase} · {Math.round(oilRate)} BOPD
      </text>
      <text x="24" y="94" className="fill-muted-foreground font-data" fontSize="9">
        ROD LOAD {Math.round(rodLoadKn)} / {rodLoadLimitKn} kN
      </text>
      <rect x="24" y="100" width="120" height="4" rx="2" className="fill-border" />
      <rect x="24" y="100" width={120 * loadFrac} height="4" rx="2" fill={loadFrac > 0.85 ? "oklch(0.55 0.16 25)" : "oklch(0.55 0.08 55)"} />
      {/* viscosity stroke meter */}
      <text x="276" y="80" textAnchor="end" className="fill-muted-foreground font-data" fontSize="9">
        MOBILITY {stroke > 0.8 ? "HIGH" : stroke > 0.5 ? "MED" : "LOW"}
      </text>
    </svg>
  );
}
