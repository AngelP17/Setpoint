import type { PlcPhase, Strategy } from "./types";

export const formatNumber = (n: number | undefined): string => {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
};

export const isHaltPhase = (phase: string): boolean => phase === "Failed";
export const isAlertPhase = (phase: string): boolean => phase === "DriftDetected";

export const strategyTone = (strategy: Strategy): "ok" | "warn" | "fail" => {
  if (strategy === "Halt") return "fail";
  if (strategy === "Alert") return "warn";
  return "ok";
};

export const phaseTone = (phase: string): "ok" | "warn" | "fail" | "muted" => {
  if (phase === "Failed") return "fail";
  if (phase === "DriftDetected") return "warn";
  if (phase === "Connected") return "ok";
  return "muted";
};

export const phaseLabel = (phase: string): string => {
  switch (phase as PlcPhase) {
    case "DriftDetected":
      return "DRIFT";
    case "Failed":
      return "HALTED";
    case "Connected":
      return "IN SYNC";
    case "Connecting":
      return "CONNECTING";
    case "Correcting":
      return "CORRECTING";
    default:
      return phase.toUpperCase();
  }
};
