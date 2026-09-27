import type { ReactNode } from "react";
import type { RiskLevel } from "@/lib/twin";
import { cn } from "@/lib/utils";

/** Section label in the studio-console style. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-data text-[10px] tracking-label uppercase text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** KPI card with hairline framing. */
export function KpiCard({
  label,
  value,
  unit,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: "default" | "warning" | "critical" | "good";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card px-4 py-3",
        tone === "warning" && "border-[oklch(0.72_0.05_70)]",
        tone === "critical" && "border-[oklch(0.55_0.16_25)]",
        tone === "good" && "border-[oklch(0.5_0.05_140)]",
        className,
      )}
    >
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-data text-xl leading-none tabular text-foreground">{value}</span>
        {unit && <span className="font-data text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      {sub && <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{sub}</p>}
    </div>
  );
}

const riskTone: Record<RiskLevel, string> = {
  LOW: "oklch(0.5 0.05 140)",
  MEDIUM: "oklch(0.72 0.05 70)",
  HIGH: "oklch(0.55 0.16 25)",
};

export function RiskBadge({ label, level, score }: { label: string; level: RiskLevel; score: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(score * 100)}%`, backgroundColor: riskTone[level] }}
          />
        </div>
        <span className="font-data text-[10px] tabular text-muted-foreground">{Math.round(score * 100)}%</span>
        <span
          className="rounded-sm px-1.5 py-0.5 font-data text-[10px] font-medium"
          style={{ color: riskTone[level], backgroundColor: `${riskTone[level]}18` }}
        >
          {level}
        </span>
      </div>
    </div>
  );
}

/** Expected-effect chip used in recommendation rows. */
export function EffectChip({ dir, text }: { dir: "up" | "down" | "flat"; text: string }) {
  const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  const tone = dir === "up" ? "text-[oklch(0.5_0.05_140)]" : dir === "down" ? "text-[oklch(0.5_0.05_140)]" : "text-muted-foreground";
  return (
    <span className={cn("font-data text-[11px] tabular", tone)}>
      {arrow} {text}
    </span>
  );
}
