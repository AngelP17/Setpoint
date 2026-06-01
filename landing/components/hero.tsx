"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

export function Hero() {
  const reduce = useReducedMotion();
  const enter = reduce
    ? { initial: false, animate: {} }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <section className="relative isolate overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="grid-bg absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-96 w-[60rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-arc-500) 24%, transparent), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-6 lg:grid-cols-12 lg:gap-10">
        <motion.div
          {...enter}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7"
        >
          <div className="inline-flex items-center gap-2 rounded-pill border border-ink-600 bg-ink-800/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-arc-500 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-arc-500" />
            </span>
            Reconciling, in production, since 0.2.0
          </div>

          <h1 className="mt-6 max-w-[16ch] text-balance text-4xl font-semibold leading-[1.05] tracking-tighter text-ink-50 md:text-5xl lg:text-[3.75rem]">
            GitOps for the factory floor.
          </h1>

          <p className="mt-5 max-w-[42ch] text-pretty text-base leading-relaxed text-ink-300 md:text-lg">
            Setpoint is a Kubernetes operator that watches Modbus registers and reconciles them like Argo CD reconciles manifests. One YAML, one source of truth, one audit log.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="https://github.com/apinzon/setpoint-operator"
              className="group inline-flex items-center gap-2 rounded-pill bg-arc-500 px-5 py-2.5 text-sm font-medium text-ink-950 transition-transform hover:-translate-y-px glow-arc"
            >
              View on GitHub
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#proof"
              className="inline-flex items-center gap-2 rounded-pill border border-ink-600 bg-ink-800/50 px-5 py-2.5 text-sm text-ink-200 transition-colors hover:border-ink-500 hover:text-ink-50"
            >
              See the proof
            </a>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-ink-700/50 pt-6 text-left">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Binaries</dt>
              <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-ink-100">4</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Registers / PLC</dt>
              <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-ink-100">N</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Verdict gate</dt>
              <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-arc-400">jq</dd>
            </div>
          </dl>
        </motion.div>

        <motion.div
          {...(reduce ? { initial: false, animate: {} } : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } })}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 lg:pt-2"
        >
          <div className="relative">
            <div className="absolute -inset-px rounded-[14px] bg-gradient-to-b from-arc-500/30 via-transparent to-transparent" aria-hidden="true" />
            <div className="grain-card relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="font-mono text-[11px] text-ink-400">proof.json</span>
                <span className="font-mono text-[11px] text-ok-500">PASS</span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.6] text-ink-200">
                <code>
{`{
  "apiVersion": "setpoint.io/proof/v1",
  "verdict": "PASS",
  "before":  { "in_sync": true,  "drift": 0 },
  "after":   { "in_sync": false, "drift": 1 },
  "detection": {
    "registers_in_drift": 1,
    "auto_corrected":     0,
    "alert_violations":   0
  },
  "verdict_reasons": []
}`}
                </code>
              </pre>
            </div>
            <p className="mt-3 px-1 font-mono text-[11px] text-ink-400">
              <span className="text-arc-400">▲</span> Aggregated by <code className="text-ink-300">scripts/aggregate-proof.sh</code> from the live proof run
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mx-auto mt-20 grid max-w-[1400px] grid-cols-1 items-center gap-6 px-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="relative aspect-[5/3] overflow-hidden rounded-[14px] border border-ink-700/60">
            <Image
              src="https://images.unsplash.com/photo-1565939033469-bd1d34c0b09d?w=1200&q=80&auto=format&fit=crop"
              alt="Conveyor belt inside an industrial plant"
              fill
              priority
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between font-mono text-[10.5px] text-ink-200/90">
              <span>line-2 / pick-and-place</span>
              <span className="text-arc-400">SCADA · Modbus TCP · 502</span>
            </div>
          </div>
        </div>
        <div className="md:col-span-7">
          <p className="text-pretty text-lg leading-relaxed text-ink-200 md:text-xl">
            A real conveyor belt on a real factory floor. Setpoint is what keeps its <span className="font-mono text-arc-400">conveyor-speed</span> register pinned to <span className="font-mono text-arc-400">2500</span> even when a contractor’s laptop drags the SCADA off course at 02:14.
          </p>
        </div>
      </div>
    </section>
  );
}
