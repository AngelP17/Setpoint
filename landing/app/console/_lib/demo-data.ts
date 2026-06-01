import type { PlcView } from "./types";

const DEMO_TIMESTAMP = "2026-06-01T18:00:00Z";

const demoRegisters = (
  specs: Array<{
    name: string;
    address: number;
    desiredValue: number;
    currentValue: number | undefined;
    inSync: boolean;
    strategy: "Auto" | "Alert" | "Halt";
    criticality: string;
  }>) =>
  specs.map((s) => ({
    name: s.name,
    address: s.address,
    desiredValue: s.desiredValue,
    currentValue: s.currentValue,
    inSync: s.inSync,
    strategy: s.strategy,
    criticality: s.criticality,
    driftEvents: s.inSync ? 0 : 1,
    correctionsApplied: s.strategy === "Auto" && s.inSync ? 1 : 0,
  }));

export const DEMO_PLCS: PlcView[] = [
  {
    name: "line-1-printer-plc",
    namespace: "default",
    address: "10.42.7.21",
    port: 502,
    phase: "DriftDetected",
    driftCount: 1,
    corrections: 1,
    registers: demoRegisters([
      {
        name: "conveyor-speed",
        address: 4001,
        desiredValue: 2500,
        currentValue: 2500,
        inSync: true,
        strategy: "Auto",
        criticality: "High",
      },
      {
        name: "print-head-position",
        address: 4002,
        desiredValue: 1200,
        currentValue: 1295,
        inSync: false,
        strategy: "Alert",
        criticality: "Medium",
      },
      {
        name: "emergency-halt",
        address: 4003,
        desiredValue: 0,
        currentValue: 0,
        inSync: true,
        strategy: "Halt",
        criticality: "SafetyCritical",
      },
    ]),
  },
  {
    name: "line-2-furnace-plc",
    namespace: "default",
    address: "10.42.8.99",
    port: 502,
    phase: "Connected",
    driftCount: 0,
    corrections: 0,
    registers: demoRegisters([
      {
        name: "core-temp",
        address: 5001,
        desiredValue: 850,
        currentValue: 850,
        inSync: true,
        strategy: "Auto",
        criticality: "SafetyCritical",
      },
      {
        name: "gas-intake",
        address: 5002,
        desiredValue: 450,
        currentValue: 450,
        inSync: true,
        strategy: "Auto",
        criticality: "High",
      },
    ]),
  },
];

export { DEMO_TIMESTAMP };
