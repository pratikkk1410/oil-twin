import type { CyclePhase } from "@/lib/twin";

export function CycleTimeline({
  injectionDays,
  soakDays,
  productionDays,
  productionEndDay,
  totalDays,
  day,
  phaseAtDay,
}: {
  injectionDays: number;
  soakDays: number;
  productionDays: number;
  productionEndDay: number;
  totalDays: number;
  day: number;
  phaseAtDay: CyclePhase;
}) {
  const seg = (w: number) => `${(w / totalDays) * 100}%`;
  const playheadPct = Math.min((day / totalDays) * 100, 100);

  return (
    <div className="w-full">
      <div className="relative flex h-8 w-full overflow-hidden rounded border border-border bg-muted/40">
        <div
          className="flex items-center justify-center bg-[oklch(0.72_0.05_70)] text-[10px] font-medium text-[oklch(0.25_0.02_60)]"
          style={{ width: seg(injectionDays) }}
        >
          {injectionDays > totalDays / 14 ? "STEAM INJECTION" : ""}
        </div>
        <div
          className="flex items-center justify-center bg-[oklch(0.82_0.04_75)] text-[10px] font-medium text-[oklch(0.3_0.02_60)]"
          style={{ width: seg(soakDays) }}
        >
          {soakDays > totalDays / 16 ? "SOAK" : ""}
        </div>
        <div
          className="flex items-center justify-center bg-[oklch(0.62_0.08_55)] text-[10px] font-medium text-white"
          style={{ width: seg(productionEndDay - injectionDays - soakDays) }}
        >
          PRODUCTION
        </div>
        <div
          className="flex items-center justify-center bg-muted text-[10px] text-muted-foreground"
          style={{ width: seg(totalDays - productionEndDay) }}
        >
          {totalDays - productionEndDay > totalDays / 12 ? "COOLING / SHUT-IN" : ""}
        </div>

        {/* playhead */}
        <div
          className="pointer-events-none absolute top-0 h-full w-0.5 bg-foreground"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-foreground" />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between font-data text-[10px] text-muted-foreground">
        <span>DAY {day} · {phaseAtDay}</span>
        <span>
          {injectionDays}d inj · {soakDays}d soak · {productionEndDay - injectionDays - soakDays}d prod
        </span>
      </div>
    </div>
  );
}
