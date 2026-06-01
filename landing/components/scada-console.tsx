"use client";

import { useReducer, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";

interface Register {
  name: string;
  address: number;
  desired: number;
  actual: number;
  strategy: "Auto" | "Alert" | "Halt";
  status: "InSync" | "Drift" | "Correcting" | "Failed";
}

interface LogEntry {
  id: string;
  time: string;
  level: "INFO" | "WARN" | "OK" | "FAIL";
  message: string;
}

interface SCADAState {
  registers: Register[];
  logs: LogEntry[];
  plcStatus: "Connected" | "Failed" | "Reconciling";
  isDrifting: boolean;
}

type SCADAAction =
  | { type: "INJECT_DRIFT" }
  | { type: "START_RECONCILE" }
  | { type: "REMEDIATE_AUTO"; name: string }
  | { type: "REMEDIATE_HALT"; name: string; value: number }
  | { type: "REMEDIATE_ALERT"; name: string; value: number }
  | { type: "RESET" }
  | { type: "ADD_LOG"; level: LogEntry["level"]; message: string };

const INITIAL_REGISTERS: Register[] = [
  {
    name: "conveyor-speed",
    address: 4001,
    desired: 2500,
    actual: 2500,
    strategy: "Auto",
    status: "InSync",
  },
  {
    name: "valve-pressure",
    address: 4002,
    desired: 120,
    actual: 120,
    strategy: "Alert",
    status: "InSync",
  },
  {
    name: "reactor-temp",
    address: 4003,
    desired: 65,
    actual: 65,
    strategy: "Halt",
    status: "InSync",
  },
];

const getTimestamp = () => {
  if (typeof window === "undefined") return "00:00:00";
  return new Date().toTimeString().split(" ")[0] ?? "00:00:00";
};

let _idCounter = 0;
const nextId = () => {
  if (typeof window === "undefined") return `ssr-${++_idCounter}`;
  return `c${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
};

function scadaReducer(state: SCADAState, action: SCADAAction): SCADAState {
  switch (action.type) {
    case "ADD_LOG": {
      const entry: LogEntry = {
        id: nextId(),
        time: getTimestamp(),
        level: action.level,
        message: action.message,
      };
      return {
        ...state,
        logs: [...state.logs.slice(-25), entry], // keep last 26 entries
      };
    }
    case "INJECT_DRIFT": {
      if (state.isDrifting || state.plcStatus === "Failed") return state;
      
      const newRegisters = state.registers.map((reg) => {
        if (reg.name === "conveyor-speed") {
          return { ...reg, actual: 999, status: "Drift" as const };
        }
        if (reg.name === "valve-pressure") {
          return { ...reg, actual: 195, status: "Drift" as const };
        }
        if (reg.name === "reactor-temp") {
          return { ...reg, actual: 92, status: "Drift" as const };
        }
        return reg;
      });

      const driftLogs: LogEntry[] = [
        {
          id: nextId(),
          time: getTimestamp(),
          level: "WARN",
          message: "DriftDetected: conveyor-speed actual=999 desired=2500 [Auto]",
        },
        {
          id: nextId(),
          time: getTimestamp(),
          level: "WARN",
          message: "DriftDetected: valve-pressure actual=195 desired=120 [Alert]",
        },
        {
          id: nextId(),
          time: getTimestamp(),
          level: "WARN",
          message: "DriftDetected: reactor-temp actual=92 desired=65 [Halt]",
        },
      ];

      return {
        ...state,
        registers: newRegisters,
        isDrifting: true,
        logs: [...state.logs.slice(-20), ...driftLogs],
      };
    }
    case "START_RECONCILE": {
      return {
        ...state,
        plcStatus: "Reconciling",
      };
    }
    case "REMEDIATE_AUTO": {
      const newRegisters = state.registers.map((reg) => {
        if (reg.name === action.name) {
          return { ...reg, actual: reg.desired, status: "InSync" as const };
        }
        return reg;
      });
      const newLog: LogEntry = {
        id: nextId(),
        time: getTimestamp(),
        level: "OK",
        message: `DriftCorrected: conveyor-speed auto-corrected 999 -> 2500`,
      };
      return {
        ...state,
        registers: newRegisters,
        logs: [...state.logs.slice(-25), newLog],
      };
    }
    case "REMEDIATE_ALERT": {
      const newLog: LogEntry = {
        id: nextId(),
        time: getTimestamp(),
        level: "INFO",
        message: `policy=Alert: valve-pressure drift (195) observed, no write applied`,
      };
      return {
        ...state,
        logs: [...state.logs.slice(-25), newLog],
      };
    }
    case "REMEDIATE_HALT": {
      const newRegisters = state.registers.map((reg) => {
        if (reg.name === action.name) {
          return { ...reg, status: "Failed" as const };
        }
        return reg;
      });
      const newLog: LogEntry = {
        id: nextId(),
        time: getTimestamp(),
        level: "FAIL",
        message: `CRITICAL: policy=Halt triggered on reactor-temp. Marking IndustrialPLC Failed.`,
      };
      return {
        ...state,
        registers: newRegisters,
        plcStatus: "Failed",
        isDrifting: false,
        logs: [...state.logs.slice(-25), newLog],
      };
    }
    case "RESET": {
      return {
        registers: INITIAL_REGISTERS,
        logs: [
          {
            id: "init",
            time: getTimestamp(),
            level: "INFO",
            message: "Setpoint SCADA controller loaded, listening on port 502",
          },
        ],
        plcStatus: "Connected",
        isDrifting: false,
      };
    }
    default:
      return state;
  }
}

export function SCADAConsole() {
  const reduce = useReducedMotion();
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(scadaReducer, {
    registers: INITIAL_REGISTERS,
    logs: [
      {
        id: "init",
        time: "00:00:00",
        level: "INFO",
        message: "Setpoint SCADA controller loaded, listening on port 502",
      },
    ],
    plcStatus: "Connected",
    isDrifting: false,
  });

  const [simActive, setSimActive] = useState(false);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.logs]);

  const triggerDriftSequence = async () => {
    if (state.plcStatus === "Failed" || simActive) return;
    setSimActive(true);

    dispatch({ type: "INJECT_DRIFT" });

    // Step 1: Reconcile begins
    await new Promise((r) => setTimeout(r, 1200));
    dispatch({ type: "START_RECONCILE" });
    dispatch({
      type: "ADD_LOG",
      level: "INFO",
      message: "Starting reconciliation loop (3 registers)...",
    });

    // Step 2: Auto Remediation
    await new Promise((r) => setTimeout(r, 1200));
    dispatch({ type: "REMEDIATE_AUTO", name: "conveyor-speed" });

    // Step 3: Alert Remediation
    await new Promise((r) => setTimeout(r, 1200));
    dispatch({ type: "REMEDIATE_ALERT", name: "valve-pressure", value: 195 });

    // Step 4: Halt Remediation
    await new Promise((r) => setTimeout(r, 1200));
    dispatch({ type: "REMEDIATE_HALT", name: "reactor-temp", value: 92 });

    setSimActive(false);
  };

  const resetSequence = () => {
    dispatch({ type: "RESET" });
    setSimActive(false);
  };

  // Dial calculations
  const conveyorReg = state.registers.find((r) => r.name === "conveyor-speed")!;
  const pressureReg = state.registers.find((r) => r.name === "valve-pressure")!;
  const tempReg = state.registers.find((r) => r.name === "reactor-temp")!;

  const speedPercentage = (conveyorReg.actual / 3000) * 100;
  const pressurePercentage = (pressureReg.actual / 200) * 100;
  const tempPercentage = (tempReg.actual / 100) * 100;

  return (
    <section id="console" className="relative isolate border-t border-ink-700/40 py-20 md:py-28 bg-ink-950">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-14 max-w-3xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-50 md:text-5xl">
            Watch the same fault trigger three different responses.
          </h2>
          <p className="mt-3 max-w-[60ch] text-pretty text-base leading-relaxed text-ink-300">
            Auto corrects. Alert reports. Halt fails fast. This sandbox keeps the page grounded in the actual safety model instead of abstract product copy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left panel: SCADA Panel */}
          <div className="grain-card p-5 md:p-6 lg:col-span-7 flex flex-col justify-between min-h-[480px]">
            <div>
              <div className="flex items-center justify-between border-b border-ink-700/60 pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">Modbus TCP Unit ID: 1</span>
                  <h3 className="font-mono text-sm text-ink-200">line-1-printer-plc</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-ink-400">Status:</span>
                    <span
                      className={`font-semibold ${
                        state.plcStatus === "Failed"
                          ? "text-fail-500"
                          : state.plcStatus === "Reconciling"
                          ? "text-warn-500"
                          : "text-ok-500"
                      }`}
                    >
                      {state.plcStatus.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gauges Grid */}
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {/* Gauge 1: Conveyor Speed */}
                <div className="flex flex-col items-center p-4 rounded-lg bg-ink-900/40 border border-ink-800/80 relative overflow-hidden group">
                  <div className="pointer-events-none absolute -right-8 -bottom-8 z-0 h-24 w-24 rounded-full bg-arc-500/5 blur-xl" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400">Speed (Auto)</span>
                  <div className="relative h-28 w-28 mt-3 flex items-center justify-center">
                    {/* SVG Gauge */}
                    <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
                      <circle cx="56" cy="56" r="42" stroke="var(--color-ink-700)" strokeWidth="4" fill="transparent" />
                      <motion.circle
                        cx="56"
                        cy="56"
                        r="42"
                        stroke={conveyorReg.status === "Drift" ? "var(--color-warn-500)" : "var(--color-arc-500)"}
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={263}
                        initial={{ strokeDashoffset: 263 }}
                        animate={{ strokeDashoffset: 263 - (263 * speedPercentage) / 100 }}
                        transition={{ type: "spring", stiffness: 60, damping: 12 }}
                      />
                    </svg>
                    <div className="text-center z-10">
                      <span className="font-mono text-xl font-bold text-ink-50">{conveyorReg.actual}</span>
                      <span className="block font-mono text-[8px] text-ink-400">RPM</span>
                    </div>
                  </div>
                  <span className="mt-3 font-mono text-[10px] text-ink-300">Desired: {conveyorReg.desired}</span>
                </div>

                {/* Gauge 2: Valve Pressure */}
                <div className="flex flex-col items-center p-4 rounded-lg bg-ink-900/40 border border-ink-800/80 relative overflow-hidden">
                  <div className="pointer-events-none absolute -right-8 -bottom-8 z-0 h-24 w-24 rounded-full bg-warn-500/5 blur-xl" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400">Pressure (Alert)</span>
                  <div className="relative h-28 w-28 mt-3 flex items-center justify-center">
                    <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
                      <circle cx="56" cy="56" r="42" stroke="var(--color-ink-700)" strokeWidth="4" fill="transparent" />
                      <motion.circle
                        cx="56"
                        cy="56"
                        r="42"
                        stroke={pressureReg.status === "Drift" ? "var(--color-warn-500)" : "var(--color-arc-500)"}
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={263}
                        initial={{ strokeDashoffset: 263 }}
                        animate={{ strokeDashoffset: 263 - (263 * pressurePercentage) / 100 }}
                        transition={{ type: "spring", stiffness: 60, damping: 12 }}
                      />
                    </svg>
                    <div className="text-center z-10">
                      <span className="font-mono text-xl font-bold text-ink-50">{pressureReg.actual}</span>
                      <span className="block font-mono text-[8px] text-ink-400">PSI</span>
                    </div>
                  </div>
                  <span className="mt-3 font-mono text-[10px] text-ink-300">Desired: {pressureReg.desired}</span>
                </div>

                {/* Gauge 3: Temp Gauge */}
                <div className="flex flex-col items-center p-4 rounded-lg bg-ink-900/40 border border-ink-800/80 relative overflow-hidden">
                  <div className="pointer-events-none absolute -right-8 -bottom-8 z-0 h-24 w-24 rounded-full bg-fail-500/5 blur-xl" />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400">Temp (Halt)</span>
                  <div className="relative h-28 w-28 mt-3 flex items-center justify-center">
                    <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
                      <circle cx="56" cy="56" r="42" stroke="var(--color-ink-700)" strokeWidth="4" fill="transparent" />
                      <motion.circle
                        cx="56"
                        cy="56"
                        r="42"
                        stroke={tempReg.status === "Failed" ? "var(--color-fail-500)" : tempReg.status === "Drift" ? "var(--color-warn-500)" : "var(--color-arc-500)"}
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={263}
                        initial={{ strokeDashoffset: 263 }}
                        animate={{ strokeDashoffset: 263 - (263 * tempPercentage) / 100 }}
                        transition={{ type: "spring", stiffness: 60, damping: 12 }}
                      />
                    </svg>
                    <div className="text-center z-10">
                      <span className="font-mono text-xl font-bold text-ink-50">{tempReg.actual}</span>
                      <span className="block font-mono text-[8px] text-ink-400">°C</span>
                    </div>
                  </div>
                  <span className="mt-3 font-mono text-[10px] text-ink-300">Desired: {tempReg.desired}</span>
                </div>
              </div>
            </div>

            {/* Simulated Action Controls */}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-ink-700/60 pt-5">
              <button
                onClick={triggerDriftSequence}
                disabled={state.plcStatus === "Failed" || simActive}
                className="group inline-flex items-center gap-2 rounded-pill bg-arc-500 px-5 py-2.5 text-xs font-semibold text-ink-950 transition hover:-translate-y-px hover:shadow-[0_0_15px_rgba(0,212,255,0.4)] active:scale-[0.98] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none duration-200 ease-out glow-arc"
              >
                Inject Drift / Drift registers
              </button>
              <button
                onClick={resetSequence}
                className="inline-flex items-center gap-2 rounded-pill border border-ink-600 bg-ink-800/50 px-5 py-2.5 text-xs font-semibold text-ink-200 transition hover:border-ink-500 hover:text-ink-50 active:scale-[0.98] duration-200 ease-out"
              >
                Reset Panel
              </button>
            </div>
          </div>

          {/* Right panel: Simulated live terminal */}
          <div className="grain-card relative overflow-hidden p-0 lg:col-span-5 flex flex-col justify-between bg-ink-900/30 min-h-[480px]">
            <div className="flex items-center justify-between border-b border-ink-700/60 px-4 py-3 bg-ink-950/60">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                <span className="h-2 w-2 rounded-full bg-[#28c840]" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-400">setpoint-operator --watch</span>
              <span className="h-2.5 w-2.5 rounded-full animate-pulse bg-arc-500" />
            </div>

            {/* Terminal Screen */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-[1.65] max-h-[360px] space-y-2 select-text scrollbar-thin">
              <AnimatePresence initial={false}>
                {state.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start gap-2.5"
                  >
                    <span className="text-ink-500 shrink-0">{log.time}</span>
                    <span
                      className={`font-semibold shrink-0 ${
                        log.level === "WARN"
                          ? "text-warn-500"
                          : log.level === "FAIL"
                          ? "text-fail-500"
                          : log.level === "OK"
                          ? "text-ok-500"
                          : "text-arc-400"
                      }`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-ink-200 text-pretty">{log.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={terminalEndRef} />
            </div>

            <div className="border-t border-ink-700/40 bg-ink-950/40 px-4 py-2.5 font-mono text-[10px] text-ink-500">
              Active registers: {state.registers.length} | Operator: Running
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
