"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowsClockwise, BracketsCurly, Broadcast } from "@phosphor-icons/react/dist/ssr";

const steps = [
  {
    icon: BracketsCurly,
    title: "Declare the machine surface.",
    body:
      "Each IndustrialPLC resource names the device, port, registers, and remediation strategy. Auto writes back. Alert holds state and emits evidence. Halt fails fast.",
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
    icon: Broadcast,
    title: "Observe live state, not assumptions.",
    body:
      "The API and console expose the same reality the operator sees: actual register values, drift counts, event history, and aggregate resource phase.",
    code: `$ kubectl apply -f line-1-printer-plc.yaml
industrialplc.setpoint.io/line-1-printer-plc created

$ kubectl get industrialplc -w
NAME                    PHASE          REGISTER                  IN_SYNC   STRATEGY
line-1-printer-plc      Connected      conveyor-speed            true      Auto
line-1-printer-plc      DriftDetected  print-head-position       false     Alert

$ setpointctl get status -n factory
...`,
  },
  {
    icon: ArrowsClockwise,
    title: "Ship a verdict, not a demo.",
    body:
      "The flagship proof spins the cluster, injects deterministic drift, captures artifacts, and fails the run when policy is broken. That proof is the project’s confidence layer.",
    code: `$ cat artifacts/latest/proof.json
{
  "plc": "line-1-printer-plc",
  "detection": {
    "registers_in_drift": 1,
    "alert_violations": 0
  },
  "verdict": "PASS"
}`,
  },
];

function Step({ step, index }: { step: (typeof steps)[number]; index: number }) {
  const reduce = useReducedMotion();
  const Icon = step.icon;
  return (
    <div className="grain-card grid grid-cols-1 gap-8 p-6 md:grid-cols-[0.9fr_1.1fr] md:p-8">
      <motion.div
        {...(reduce
          ? { initial: false }
          : { initial: { y: 8 }, whileInView: { y: 0 } })}
        viewport={{ once: true, amount: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col justify-between"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-arc-400/20 bg-arc-500/10 text-arc-300">
          <Icon className="h-5 w-5" weight="bold" />
        </div>
        <h3 className="mt-5 text-balance text-2xl font-semibold leading-tight tracking-tight text-ink-50 md:text-3xl">
          {step.title}
        </h3>
        <p className="mt-3 max-w-[52ch] text-pretty text-base leading-relaxed text-ink-300">{step.body}</p>
      </motion.div>

      <motion.div
        {...(reduce
          ? { initial: false }
          : { initial: { y: 8 }, whileInView: { y: 0 } })}
        viewport={{ once: true, amount: 0 }}
        transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="overflow-hidden rounded-[14px] border border-ink-700/60 bg-ink-900/50">
          <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-2 font-mono text-[11px] text-ink-400">
            <span>{index === 0 ? "industrialplc.yaml" : "runtime output"}</span>
            <span className="text-ink-500">{index === 0 ? "yaml" : "$"}</span>
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
    <section id="flow" className="relative isolate border-t border-ink-700/40 py-20 md:py-28">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-14 max-w-3xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-50 md:text-5xl">
            One control loop. Three ways to react.
          </h2>
          <p className="mt-3 max-w-[60ch] text-pretty text-base leading-relaxed text-ink-300">
            Setpoint stays valuable because the reaction path is explicit. You can tell the operator to write, watch, or stop. Then you can verify that it obeyed.
          </p>
        </div>
        <div className="space-y-8">
          {steps.map((s, i) => (
            <Step key={s.title} step={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
