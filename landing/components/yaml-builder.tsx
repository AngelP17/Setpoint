"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function YAMLBuilder() {
  const [name, setName] = useState("conveyor-speed");
  const [address, setAddress] = useState(4001);
  const [desired, setDesired] = useState(2500);
  const [strategy, setStrategy] = useState<"Auto" | "Alert" | "Halt">("Auto");
  const [pollInterval, setPollInterval] = useState(5);
  const [cooldown, setCooldown] = useState(10);
  const [copied, setCopied] = useState(false);

  const yamlContent = `apiVersion: setpoint.io/v1
kind: IndustrialPLC
metadata:
  name: line-1-printer-plc
spec:
  deviceAddress: plc-1.factory.lan
  port: 502
  registers:
    - name: ${name}
      address: ${address}
      desiredValue: ${desired}
      remediation:
        strategy: ${strategy}
        pollIntervalSecs: ${pollInterval}
        cooldownSecs: ${cooldown}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  return (
    <section className="relative isolate border-t border-ink-700/40 py-20 md:py-28 bg-ink-950">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-14 max-w-3xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-50 md:text-5xl">
            Shape the resource before it hits the cluster.
          </h2>
          <p className="mt-3 max-w-[60ch] text-pretty text-base leading-relaxed text-ink-300">
            Tune the register name, desired value, and remediation strategy. The output stays honest to the CRD shape already used by the operator and proof flow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Form Side */}
          <div className="grain-card p-5 md:p-6 lg:col-span-5 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-2">
                  Register Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-2.5 font-mono text-sm text-ink-100 placeholder-ink-500 focus:border-arc-500 focus:ring-1 focus:ring-arc-500 focus:outline-none transition"
                  placeholder="e.g. conveyor-speed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-2">
                    Address
                  </label>
                  <input
                    type="number"
                    value={address}
                    onChange={(e) => setAddress(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-2.5 font-mono text-sm text-ink-100 focus:border-arc-500 focus:ring-1 focus:ring-arc-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-2">
                    Desired Value
                  </label>
                  <input
                    type="number"
                    value={desired}
                    onChange={(e) => setDesired(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-2.5 font-mono text-sm text-ink-100 focus:border-arc-500 focus:ring-1 focus:ring-arc-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-2">
                  Remediation Strategy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Auto", "Alert", "Halt"] as const).map((strat) => (
                    <button
                      key={strat}
                      type="button"
                      onClick={() => setStrategy(strat)}
                      className={`rounded-lg border px-3 py-2 font-mono text-xs font-medium transition cursor-pointer text-center ${
                        strategy === strat
                          ? "border-arc-500 bg-arc-500/10 text-arc-400"
                          : "border-ink-700 bg-ink-900/40 text-ink-300 hover:border-ink-600 hover:text-ink-100"
                      }`}
                    >
                      {strat}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-400 leading-normal">
                  {strategy === "Auto" && "Silently writes the desired value back on drift."}
                  {strategy === "Alert" && "Observes register and emits events, monitoring only."}
                  {strategy === "Halt" && "Marks the resource failed and halts operational loop."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-2">
                    Poll Interval (s)
                  </label>
                  <input
                    type="number"
                    value={pollInterval}
                    onChange={(e) => setPollInterval(parseInt(e.target.value) || 5)}
                    className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-2.5 font-mono text-sm text-ink-100 focus:border-arc-500 focus:ring-1 focus:ring-arc-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-2">
                    Cooldown (s)
                  </label>
                  <input
                    type="number"
                    value={cooldown}
                    onChange={(e) => setCooldown(parseInt(e.target.value) || 10)}
                    className="w-full rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-2.5 font-mono text-sm text-ink-100 focus:border-arc-500 focus:ring-1 focus:ring-arc-500 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-ink-700/60 flex justify-between items-center">
              <span className="font-mono text-[10px] text-ink-500">Validation: spec.registers[0] OK</span>
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-2 rounded-pill bg-arc-500 px-5 py-2.5 text-xs font-semibold text-ink-950 transition hover:-translate-y-px hover:shadow-[0_0_15px_rgba(0,212,255,0.4)] active:scale-[0.98] active:translate-y-0 duration-200 ease-out glow-arc"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                        <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                      </svg>
                      Copied!
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1.5"
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                        <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25v-7.5z" />
                        <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25v-7.5zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-7.5z" />
                      </svg>
                      Copy YAML
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          {/* YAML Output Codeblock */}
          <div className="grain-card p-0 lg:col-span-7 flex flex-col justify-between overflow-hidden bg-ink-900/30">
            <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-3 bg-ink-950/60">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-ink-600" />
                <span className="h-2 w-2 rounded-full bg-ink-600" />
                <span className="h-2 w-2 rounded-full bg-ink-600" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">industrialplc.yaml</span>
              <span className="font-mono text-[9px] uppercase text-arc-400">crd spec</span>
            </div>

            <div className="flex-1 p-5 overflow-x-auto font-mono text-[12.5px] leading-[1.65] text-ink-200">
              <pre>
                <code>{yamlContent}</code>
              </pre>
            </div>

            <div className="border-t border-ink-700/40 px-5 py-3 bg-ink-950/40 font-mono text-[10.5px] text-ink-400">
              Target port: <code className="text-arc-400">502 (Modbus TCP)</code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
