"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { ArrowRight, Gauge, ShieldCheck, Waves } from "@phosphor-icons/react/dist/ssr";

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
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-60 bg-gradient-to-b from-arc-500/8 to-transparent" aria-hidden="true" />

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
            Setpoint turns PLC registers into declarative resources, explains every remediation decision, and ships a proof run that fails CI when safety policy is violated.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="/console" className="group inline-flex items-center gap-2 rounded-pill bg-arc-500 px-5 py-3 text-sm font-medium text-ink-50 transition hover:-translate-y-px active:scale-[0.98] duration-200 glow-arc">
              Open console
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
            </a>
            <a
              href="#proof"
              className="inline-flex items-center gap-2 rounded-pill border border-ink-600 bg-ink-800/50 px-5 py-3 text-sm text-ink-200 transition hover:border-ink-500 hover:text-ink-50 active:scale-[0.98] duration-200"
            >
              See the proof
            </a>
          </div>

          <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-4 border-t border-ink-700/50 pt-6 text-left sm:grid-cols-3">
            <div>
              <dt className="font-mono text-[11px] text-ink-400">Safety engine</dt>
              <dd className="mt-1 flex items-center gap-2 font-mono text-lg text-ink-100"><ShieldCheck className="h-4 w-4 text-arc-300" weight="bold" /> per-register policy</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] text-ink-400">Runtime</dt>
              <dd className="mt-1 flex items-center gap-2 font-mono text-lg text-ink-100"><Gauge className="h-4 w-4 text-arc-300" weight="bold" /> operator + api + cli</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] text-ink-400">Evidence</dt>
              <dd className="mt-1 flex items-center gap-2 font-mono text-lg text-ink-100"><Waves className="h-4 w-4 text-arc-300" weight="bold" /> proof.json gate</dd>
            </div>
          </dl>
        </motion.div>

        <motion.div
          {...(reduce ? { initial: false, animate: {} } : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } })}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 lg:pt-2"
        >
          <div className="console-frame relative overflow-hidden p-4">
            <div className="grid gap-4">
              <div className="overflow-hidden rounded-[18px] border border-ink-700/70">
                <div className="relative aspect-[4/3]">
                  <Image
                    src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&q=80&auto=format&fit=crop"
                    alt="Industrial automation line with operator stations and conveyor systems"
                    fill
                    priority
                    sizes="(min-width: 1024px) 34vw, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-arc-400/20 bg-ink-900/80 p-3 backdrop-blur">
                      <div className="font-mono text-[10px] text-ink-400">active line</div>
                      <div className="mt-1 font-mono text-sm text-ink-100">line-1-printer-plc</div>
                    </div>
                    <div className="rounded-2xl border border-arc-400/20 bg-ink-900/80 p-3 backdrop-blur">
                      <div className="font-mono text-[10px] text-ink-400">phase</div>
                      <div className="mt-1 font-mono text-sm text-arc-300">DriftDetected</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-ink-700/60 bg-ink-900/80 p-4">
                  <div className="font-mono text-[10px] text-ink-400">proof gate</div>
                  <div className="mt-2 font-mono text-2xl text-arc-300">PASS</div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-300">Alert-policy drift was detected. No forbidden write occurred.</p>
                </div>
                <div className="rounded-[18px] border border-ink-700/60 bg-ink-900/80 p-4">
                  <div className="font-mono text-[10px] text-ink-400">artifact stack</div>
                  <ul className="mt-2 space-y-1 font-mono text-xs text-ink-200">
                    <li>drift-before.json</li>
                    <li>drift-after.json</li>
                    <li>prometheus-metrics.txt</li>
                    <li>proof.json</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mx-auto mt-10 max-w-[1400px] px-6">
        <div className="grid gap-4 rounded-[24px] border border-ink-700/50 bg-ink-900/45 p-5 md:grid-cols-4 md:p-6">
          <div>
            <div className="font-mono text-[10px] text-ink-400">layer 1</div>
            <div className="mt-2 text-lg text-ink-50">Rust operator</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-ink-400">layer 2</div>
            <div className="mt-2 text-lg text-ink-50">Axum API</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-ink-400">layer 3</div>
            <div className="mt-2 text-lg text-ink-50">Web console</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-ink-400">layer 4</div>
            <div className="mt-2 text-lg text-ink-50">Proof system</div>
          </div>
        </div>
      </div>
    </section>
  );
}
