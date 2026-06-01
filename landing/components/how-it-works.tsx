"use client";

import { motion, useReducedMotion } from "motion/react";

const steps = [
  {
    n: "01",
    title: "Declare the registers in YAML.",
    body:
      "Each IndustrialPLC resource lists its Modbus address, port, and the registers you want reconciled. Per-register remediation: Auto writes back. Alert observes only. Halt halts the line.",
    code: `apiVersion: setpoint.io/v1
kind: IndustrialPLC
metadata:
  name: line-1-printer-plc
spec:
  deviceAddress: 10.42.7.21
  port: 502
  registers:
    - name: conveyor-speed
      address: 4001
      desiredValue: 2500
      remediation:
        strategy: Auto
        pollIntervalSecs: 5
    - name: print-head-position
      address: 4002
      desiredValue: 1200
      remediation:
        strategy: Alert
        pollIntervalSecs: 5`,
  },
  {
    n: "02",
    title: "Apply it. The operator does the rest.",
    body:
      "kubectl apply -f. Setpoint watches each register on its own poll interval, compares actual to desired, applies the remediation policy, and emits Kubernetes events on every drift and correction. Prometheus metrics per register, per strategy.",
    code: `$ kubectl apply -f line-1-printer-plc.yaml
industrialplc.setpoint.io/line-1-printer-plc created

$ kubectl get industrialplc -w
NAME                    PHASE          REGISTER                  IN_SYNC   STRATEGY
line-1-printer-plc      Connected      conveyor-speed            true      Auto
line-1-printer-plc      Connected      print-head-position       true      Alert

$ setpointctl get status -n factory
...`,
  },
];

function Step({ step, index }: { step: (typeof steps)[number]; index: number }) {
  const reduce = useReducedMotion();
  const isReversed = index % 2 === 1;
  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-12">
      <motion.div
        {...(reduce
          ? { initial: false }
          : { initial: { opacity: 0, x: isReversed ? 24 : -24 }, whileInView: { opacity: 1, x: 0 } })}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`md:col-span-5 ${isReversed ? "md:order-2" : ""}`}
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-arc-400">Step {step.n}</div>
        <h3 className="mt-3 text-balance text-2xl font-semibold leading-tight tracking-tight text-ink-50 md:text-3xl">
          {step.title}
        </h3>
        <p className="mt-3 max-w-[52ch] text-pretty text-base leading-relaxed text-ink-300">{step.body}</p>
      </motion.div>

      <motion.div
        {...(reduce
          ? { initial: false }
          : { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 } })}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className={`md:col-span-7 ${isReversed ? "md:order-1" : ""}`}
      >
        <div className="overflow-hidden rounded-[14px] border border-ink-700/60 bg-ink-900/50">
          <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2 font-mono text-[11px] text-ink-400">
            <span>{isReversed ? "terminal" : "industrialplc.yaml"}</span>
            <span className="text-ink-500">{isReversed ? "$" : "yaml"}</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.6] text-ink-200">
            <code>{step.code}</code>
          </pre>
        </div>
      </motion.div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="relative isolate border-t border-ink-700/40 py-20 md:py-28">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-14 max-w-3xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-50 md:text-4xl">
            Declarative PLCs, the way you wished Argo CD worked on a Siemens S7.
          </h2>
          <p className="mt-3 max-w-[60ch] text-pretty text-base leading-relaxed text-ink-300">
            The same mental model that reconciles Deployments reconciles Modbus holding registers. Drift becomes a typed, audited event instead of a Slack thread.
          </p>
        </div>
        <div className="space-y-24">
          {steps.map((s, i) => (
            <Step key={s.n} step={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
