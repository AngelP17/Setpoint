"use client";

import { motion, useReducedMotion } from "motion/react";

function BentoCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      {...(reduce
        ? { initial: false }
        : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 } })}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`grain-card relative overflow-hidden p-5 md:p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function Sparkline() {
  // 28-sample simulated drift: 2500 hold, then drop to 999, then back to 2500
  const desired = 2500;
  const points: number[] = [];
  for (let i = 0; i < 28; i++) {
    if (i < 6) points.push(2500);
    else if (i < 9) points.push(2500);
    else if (i < 14) points.push([900, 999, 870, 1100, 950][i - 9] ?? 999);
    else if (i < 18) points.push([870, 920, 990, 2400][i - 14] ?? 2400);
    else points.push(2500);
  }
  const w = 320;
  const h = 120;
  const min = 800;
  const max = 2600;
  const yScale = (v: number) => h - ((v - min) / (max - min)) * h;
  const xScale = (i: number) => (i / (points.length - 1)) * w;
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(" ");
  const desiredY = yScale(desired);

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="h-32 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="driftFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-arc-500)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-arc-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={desiredY} x2={w} y2={desiredY} stroke="var(--color-ok-500)" strokeOpacity="0.4" strokeDasharray="3 4" strokeWidth="1" />
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#driftFill)" />
      <path d={path} fill="none" stroke="var(--color-arc-500)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <text x="4" y={desiredY - 4} fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-ok-500)" opacity="0.7">
        desired · 2500
      </text>
    </svg>
  );
}

function RegisterValueGraph() {
  return (
    <BentoCard className="md:col-span-7 md:row-span-1">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Live · last 28 polls</div>
          <div className="mt-1 font-mono text-sm text-ink-200">conveyor-speed · 4001</div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ok-500">
          <span className="h-1.5 w-1.5 rounded-full bg-ok-500" /> in sync
        </div>
      </div>
      <div className="mt-3">
        <Sparkline />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10.5px] text-ink-400">
        <span>00:00:00</span>
        <span>drift_events = 1 · corrections_applied = 1</span>
        <span>00:01:24</span>
      </div>
    </BentoCard>
  );
}

function CLIBlock() {
  return (
    <BentoCard className="md:col-span-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Run it</div>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-ink-700/60 bg-ink-900/60 p-3 font-mono text-[12px] leading-[1.55] text-ink-100">
        <code>
{`$ make flagship-proof

  ▸ build            ok
  ▸ kind load        ok
  ▸ apply            ok
  ▸ wait converge    ok
  ▸ drift inject     ok
  ▸ capture metrics  ok
  ▸ report.md        ok
  ▸ proof.json       ok

  verdict: PASS`}
        </code>
      </pre>
      <p className="mt-2 text-xs text-ink-400">
        One command, eight steps, one jq gate. Re-runnable in CI.
      </p>
    </BentoCard>
  );
}

function DriftLog() {
  return (
    <BentoCard className="md:col-span-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Drift event log</div>
      <ul className="mt-3 space-y-1.5 font-mono text-[11.5px] leading-relaxed">
        <li className="flex gap-3">
          <span className="text-ink-500">02:14:08</span>
          <span className="text-warn-500">WARN</span>
          <span className="text-ink-300">DriftDetected print-head-position desired=1200 actual=9999</span>
        </li>
        <li className="flex gap-3">
          <span className="text-ink-500">02:14:08</span>
          <span className="text-arc-400">INFO</span>
          <span className="text-ink-300">policy=Alert: no write, monitoring only</span>
        </li>
        <li className="flex gap-3">
          <span className="text-ink-500">02:14:13</span>
          <span className="text-ok-500">OK</span>
          <span className="text-ink-300">conveyor-speed auto-corrected 999 → 2500</span>
        </li>
        <li className="flex gap-3">
          <span className="text-ink-500">02:14:18</span>
          <span className="text-ok-500">OK</span>
          <span className="text-ink-300">aggregate phase = Connected (1 register Alert-held)</span>
        </li>
        <li className="flex gap-3">
          <span className="text-ink-500">02:14:48</span>
          <span className="text-ok-500">OK</span>
          <span className="text-ink-300">proof.json: detection.alert_violations = 0</span>
        </li>
      </ul>
    </BentoCard>
  );
}

function AuditReport() {
  return (
    <BentoCard className="md:col-span-7">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Report excerpt · line-1-printer-plc</div>
          <h3 className="mt-2 text-balance text-xl font-medium leading-tight text-ink-50 md:text-2xl">
            The drift was real. The operator did not write to a register it was told to leave alone.
          </h3>
        </div>
        <div className="hidden shrink-0 rounded-md border border-ok-500/40 bg-ok-500/10 px-3 py-1.5 font-mono text-[11px] text-ok-500 md:block">
          VERIFIED · PASS
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-ink-700/60 pt-4 sm:grid-cols-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Before</div>
          <div className="mt-1 font-mono text-sm tabular-nums text-ink-200">in_sync = true</div>
          <div className="font-mono text-[11px] text-ink-400">drift = 0</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">During</div>
          <div className="mt-1 font-mono text-sm tabular-nums text-warn-500">drift = 1</div>
          <div className="font-mono text-[11px] text-ink-400">policy=Alert respected</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Verdict</div>
          <div className="mt-1 font-mono text-sm tabular-nums text-ok-500">PASS</div>
          <div className="font-mono text-[11px] text-ink-400">reasons = []</div>
        </div>
      </div>
    </BentoCard>
  );
}

export function ProofBento() {
  return (
    <section id="proof" className="relative isolate border-t border-ink-700/40 py-20 md:py-28">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">
          <CLIBlock />
          <RegisterValueGraph />
          <DriftLog />
          <AuditReport />
        </div>
      </div>
    </section>
  );
}
