import { motion } from "framer-motion";
import { ArrowRight, Activity, FlaskConical, Gauge, LineChart, ShieldAlert, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
} as const;

const spread = <T extends object>(s: T): T & Record<string, never> => s as T & Record<string, never>;

const layers = [
  {
    n: "01",
    name: "Reservoir",
    body: "Lumped thermal model tracks steam-chamber temperature cycle-by-cycle; Arrhenius viscosity converts heat into mobility.",
    detail: "46 °C far-field · 18 °API · μ(T) fitted to heavy-crude behaviour",
  },
  {
    n: "02",
    name: "Wellbore",
    body: "Radial Darcy inflow responds to temperature, pressure and drawdown — cold oil barely moves, hot oil flows.",
    detail: "BHP drawdown · skin · Jodhpur Sandstone geometry",
  },
  {
    n: "03",
    name: "SRP",
    body: "Pump displacement, fillage and polished-rod loads are solved daily; rod-floating, impact and unsetting risks are scored.",
    detail: "SPM × stroke · VFD · rod-load limit",
  },
  {
    n: "04",
    name: "Surface",
    body: "Oil and water rates, energy per barrel, steam-oil ratio and operating cost — the numbers the operator is judged on.",
    detail: "SOR · kWh/bbl · ₹/bbl",
  },
];

const capabilities = [
  {
    icon: Workflow,
    title: "One coupled model",
    body: "Steam → temperature → viscosity → inflow → pump → production, solved in a single deterministic simulation. No disconnected spreadsheets.",
  },
  {
    icon: LineChart,
    title: "Cycle playback",
    body: "Scrub or play through injection, soak, production and cooling. Every KPI, risk score and the heat map follow the playhead.",
  },
  {
    icon: Gauge,
    title: "Joint optimizer",
    body: "A weighted grid search re-simulates every candidate plan — CSS and SRP together — and returns the recommended operating point with its rationale.",
  },
  {
    icon: ShieldAlert,
    title: "Equipment risk",
    body: "Model-predicted rod floating, impact loading, pump unsetting and rod-failure scores with thresholds, before they become workovers.",
  },
  {
    icon: FlaskConical,
    title: "What-if, honestly labelled",
    body: "Change steam, soak, SPM or drawdown and compare current vs simulated — every number is a simulation-based estimate, clearly stated as such.",
  },
  {
    icon: Activity,
    title: "Traditional vs optimized",
    body: "The same engine runs the manual historical plan and the optimizer's plan side by side, so the delta is earned, not asserted.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-lg">Baghewala Digital Twin</span>
          <div className="flex items-center gap-3">
            <span className="hidden font-data text-[11px] tracking-label uppercase text-muted-foreground sm:inline">
              CSS · SRP prototype
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link to="/dashboard">Open console</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <Badge variant="outline" className="font-data text-[11px] tracking-label">
            SMART INDIA HACKATHON · PROTOTYPE DIGITAL TWIN
          </Badge>
          <h1 className="mt-6 max-w-3xl font-display text-4xl leading-[1.08] sm:text-6xl">
            A virtual copy of a heavy-oil well —{" "}
            <span className="italic text-[oklch(0.45_0.06_50)]">optimized from reservoir to surface.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">
            Baghewala produces 17–19 °API crude from the Jodhpur Sandstone at 46–48 °C. Cold, the oil
            barely moves; Cyclic Steam Stimulation heats it, and a Sucker Rod Pump lifts it. This
            prototype connects both in one deterministic simulation — then recommends the injection,
            soak and production plan, and the pump settings, together.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link to="/dashboard">
                Enter the operations console <ArrowRight className="size-4" />
              </Link>
            </Button>
            <span className="font-data text-[11px] text-muted-foreground">
              sign-in required · guest access available
            </span>
          </div>
        </motion.div>

        {/* Hero stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.55, ease: "easeOut" }}
          className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4"
        >
          {(
            [
              ["18 °API", "heavy crude, high asphaltene"],
              ["46–48 °C", "cold reservoir temperature"],
              ["1,600", "plans re-simulated per optimization"],
              ["4", "equipment risks scored daily"],
            ] as const
          ).map(([v, l]) => (
            <div key={l} className="bg-card px-5 py-4">
              <div className="font-data text-xl tabular">{v}</div>
              <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{l}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Four layers */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <motion.div {...spread(fade)}>
            <p className="font-data text-[11px] tracking-label uppercase text-muted-foreground">
              The twin in four layers
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl">
              One simulation, from steam at the wellhead to barrels in the tank.
            </h2>
          </motion.div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-2">
            {layers.map((l) => (
              <motion.div key={l.n} {...spread(fade)} className="bg-card p-6">
                <div className="flex items-baseline justify-between">
                  <span className="font-data text-xs text-muted-foreground">{l.n}</span>
                  <span className="font-display text-lg">{l.name}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{l.body}</p>
                <p className="mt-3 font-data text-[10px] tracking-label uppercase text-muted-foreground/70">
                  {l.detail}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <motion.div {...spread(fade)}>
          <p className="font-data text-[11px] tracking-label uppercase text-muted-foreground">
            What the console does
          </p>
          <h2 className="mt-3 font-display text-3xl">Decision support, with its assumptions on the label.</h2>
        </motion.div>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c) => (
            <motion.div key={c.title} {...spread(fade)}>
              <c.icon className="size-5 text-[oklch(0.45_0.06_50)]" strokeWidth={1.5} />
              <h3 className="mt-3 font-display text-lg">{c.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* The loop */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <motion.div {...spread(fade)} className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="font-data text-[11px] tracking-label uppercase text-muted-foreground">
                The closed loop
              </p>
              <h2 className="mt-3 font-display text-3xl">Simulate → predict → optimize → recommend → repeat.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                The twin steps the reservoir day by day, scores equipment risk, projects rates and
                energy, and re-optimizes the plan against the current state. Nothing is hard-coded;
                every number on the console is produced by the model at run time.
              </p>
              <div className="mt-6">
                <Button asChild>
                  <Link to="/dashboard">
                    See it run <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <ol className="w-full max-w-sm space-y-0 overflow-hidden rounded-md border border-border bg-background font-data text-xs">
              {(
                [
                  "SIMULATED WELL STATE",
                  "THERMAL + VISCOSITY + INFLOW",
                  "RISK DETECTION",
                  "JOINT CSS × SRP OPTIMIZER",
                  "RECOMMENDED PLAN",
                  "SIMULATED RESPONSE",
                ] as const
              ).map((s, i) => (
                <li key={s} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
                  <span className="text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>
                  <span className="tracking-label">{s}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-[11px] leading-5 text-muted-foreground">
          Prototype decision-support software built for demonstration. It is not a calibrated model of
          the Baghewala field and does not claim exact reservoir prediction, guaranteed production
          increase or real-time control capability. Physics relationships are documented assumptions;
          synthetic values are labelled as such.
        </p>
      </footer>
    </div>
  );
}
