"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

function HeroTrace() {
  // Stylized register trace mirroring the proof.bento sparkline shape.
  const desired = 2500;
  const points: number[] = [];
  for (let i = 0; i < 28; i++) {
    if (i < 9) points.push(2500);
    else if (i < 14) points.push([900, 999, 870, 1100, 950][i - 9] ?? 999);
    else if (i < 18) points.push([870, 920, 990, 2400][i - 14] ?? 2400);
    else points.push(2500);
  }
  const w = 360;
  const h = 180;
  const min = 800;
  const max = 2600;
  const yScale = (v: number) => h - ((v - min) / (max - min)) * h;
  const xScale = (i: number) => (i / (points.length - 1)) * w;
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(" ");
  const desiredY = yScale(desired);

  return (
    <svg
      viewBox={`0 0 ${w} ${h + 30}`}
      className="h-full w-full"
      role="img"
      aria-label="Register trace from a flagship proof run"
    >
      <defs>
        <linearGradient id="heroDriftFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-arc-500)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-arc-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1={desiredY}
        x2={w}
        y2={desiredY}
        stroke="var(--color-ok-500)"
        strokeOpacity="0.4"
        strokeDasharray="3 4"
        strokeWidth="1"
      />
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#heroDriftFill)" />
      <path
        d={path}
        fill="none"
        stroke="var(--color-arc-500)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <text
        x="4"
        y={desiredY - 4}
        fontFamily="var(--font-mono)"
        fontSize="9"
        fill="var(--color-ok-500)"
        opacity="0.7"
      >
        desired | 2500
      </text>
    </svg>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const enter = reduce
    ? { initial: false, animate: {} }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <section className="relative isolate overflow-hidden pb-20 pt-24 md:pb-28 md:pt-24">
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-16 right-0 -z-10 h-[34rem] w-[34rem] rounded-full opacity-45 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-arc-400) 20%, transparent), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-60 bg-gradient-to-b from-arc-500/8 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 items-center gap-12 px-6 pt-16 lg:grid-cols-12 lg:gap-10 lg:pt-8">
        <motion.div
          {...enter}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7"
        >
          <div className="inline-flex items-center gap-2 rounded-pill border border-arc-400/20 bg-arc-500/10 px-3 py-1 font-mono text-[11px] text-arc-200">
            <span className="h-1.5 w-1.5 rounded-full bg-arc-300" />
            rust is the brain. typescript is the glass.
          </div>

          <h1 className="mt-6 max-w-[13ch] text-balance text-4xl font-semibold leading-[1.02] tracking-tighter text-ink-50 md:text-6xl lg:text-[4.7rem]">
            Industrial drift control you can prove.
          </h1>

          <p className="mt-5 max-w-[44ch] text-pretty text-base leading-relaxed text-ink-300 md:text-lg">
            Setpoint turns PLC registers into declarative resources, explains every remediation
            decision, and ships a proof run that fails CI when safety policy is violated.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/console"
              className="group inline-flex items-center gap-2 rounded-pill bg-arc-500 px-5 py-3 text-sm font-medium text-ink-50 transition hover:-translate-y-px active:scale-[0.98] duration-200 glow-arc"
            >
              Open console
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                weight="bold"
              />
            </a>
            <a
              href="#proof"
              className="inline-flex items-center gap-2 rounded-pill border border-ink-600 bg-ink-800/50 px-5 py-3 text-sm text-ink-200 transition hover:border-ink-500 hover:text-ink-50 active:scale-[0.98] duration-200"
            >
              See the proof
            </a>
          </div>

          <ul className="mt-10 flex max-w-2xl flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-700/50 pt-6 font-mono text-[12px] text-ink-300">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-arc-300" weight="bold" />
              per-register policy
            </li>
            <li className="text-ink-500">·</li>
            <li>rust operator + axum api + next.js console</li>
            <li className="text-ink-500">·</li>
            <li>proof.json gate in CI</li>
          </ul>
        </motion.div>

        <motion.div
          {...(reduce
            ? { initial: false, animate: {} }
            : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } })}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 lg:pt-2"
        >
          <div className="console-frame relative overflow-hidden p-4">
            <div className="overflow-hidden rounded-[18px] border border-ink-700/70 bg-ink-950/60">
              <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2 font-mono text-[11px] text-ink-400">
                <span>conveyor-speed | 4001</span>
                <span className="text-ok-500">in sync</span>
              </div>
              <div className="px-3 py-3">
                <HeroTrace />
              </div>
              <div className="flex items-center justify-between border-t border-ink-700/60 px-4 py-2 font-mono text-[10.5px] text-ink-400">
                <span>00:00:00</span>
                <span>drift_events = 1 | corrections_applied = 1</span>
                <span>00:01:24</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-ink-700/60 bg-ink-900/80 p-4">
                <div className="font-mono text-[10px] text-ink-400">proof gate</div>
                <div className="mt-2 font-mono text-2xl text-arc-300">PASS</div>
                <p className="mt-2 text-xs leading-relaxed text-ink-400">
                  Alert-policy drift was detected. No forbidden write.
                </p>
              </div>
              <div className="rounded-[18px] border border-ink-700/60 bg-ink-900/80 p-4">
                <div className="font-mono text-[10px] text-ink-400">artifacts/latest/</div>
                <ul className="mt-2 space-y-1 font-mono text-xs text-ink-200">
                  <li>drift-before.json</li>
                  <li>drift-after.json</li>
                  <li>proof.json</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
