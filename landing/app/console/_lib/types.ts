export type ApiState = "loading" | "live" | "demo" | "error" | "empty";

export type PlcPhase =
  | "Pending"
  | "Connecting"
  | "Connected"
  | "DriftDetected"
  | "Correcting"
  | "Failed";

export type Strategy = "Auto" | "Alert" | "Halt";
export type Criticality = "SafetyCritical" | "High" | "Medium" | "Low";

export interface IndustrialPLC {
  metadata: {
    name: string;
    namespace?: string;
    uid?: string;
    creationTimestamp?: string;
  };
  spec: {
    deviceAddress: string;
    port: number;
    protocol?: string;
    registers: RegisterSpec[];
    tags?: string[];
  };
  status?: {
    phase?: PlcPhase | string;
    lastUpdate?: string;
    lastError?: string;
    message?: string;
    registers?: RegisterStatus[];
  };
}

export interface RegisterSpec {
  name: string;
  address: number;
  desiredValue: number;
  remediation: {
    strategy: Strategy;
    pollIntervalSecs: number;
    maxCorrectionsPerHour: number;
    cooldownSecs: number;
  };
  criticality?: Criticality | string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  deadband?: number;
}

export interface RegisterStatus {
  name: string;
  address: number;
  currentValue?: number;
  inSync: boolean;
  driftEvents: number;
  correctionsApplied: number;
  strategy: Strategy;
  lastDriftAt?: string;
  lastCorrectionAt?: string;
  recentCorrections?: Array<{ timestamp: string; value: number }>;
}

export interface RegisterView {
  name: string;
  address: number;
  desiredValue: number;
  currentValue: number | undefined;
  inSync: boolean;
  strategy: Strategy;
  criticality: string;
  driftEvents: number;
  correctionsApplied: number;
}

export interface PlcView {
  name: string;
  namespace: string;
  address: string;
  port: number;
  phase: string;
  driftCount: number;
  corrections: number;
  registers: RegisterView[];
}

export interface SimulationRequest {
  strategy: Strategy;
  desiredValue: number;
  currentValue: number;
  cooldownSecs: number;
  maxCorrectionsPerHour: number;
  correctionsLastHour: number;
  lastCorrectionElapsedSecs: number;
}

export interface SimulationResponse {
  verdict: string;
  action: string;
  reason: string;
  risk: string;
}

export interface ApiError {
  error: string;
  detail: string;
}

export interface HealthResponse {
  status: "ok";
  service: "setpoint-api";
  version: string;
  timestamp: string;
  kubeClientLoaded: boolean;
  mode: "demo-ready" | "demo-fallback";
}

export interface AuditResponse {
  verifyingKey: string;
  blocks: Array<{
    index: number;
    timestamp: string;
    data: string;
    previousHash: string;
    hash: string;
    signature: string;
    publicKey: string;
  }>;
  isMock: boolean;
}

export interface EventRecord {
  timestamp: string;
  name: string;
  reason: string;
  message: string;
  type: string;
}

export type LogLevel = "INFO" | "WARN" | "OK" | "FAIL";

export interface LogEntry {
  id: string;
  time: string;
  level: LogLevel;
  message: string;
}

export const INITIAL_DEMO_LOGS: LogEntry[] = [
  {
    id: "demo-1",
    time: "02:14:08",
    level: "INFO",
    message: "Connected to PLC line-1-printer-plc",
  },
  {
    id: "demo-2",
    time: "02:14:13",
    level: "INFO",
    message: "Full register scan completed successfully",
  },
  {
    id: "demo-3",
    time: "02:14:18",
    level: "WARN",
    message:
      "DriftDetected print-head-position desired=1200 actual=1295 strategy=Alert",
  },
  {
    id: "demo-4",
    time: "02:14:23",
    level: "INFO",
    message:
      "policy=Alert: no auto-correction applied to print-head-position",
  },
  {
    id: "demo-5",
    time: "02:14:28",
    level: "INFO",
    message: "Chaining SHA-256 state transition block #42",
  },
  {
    id: "demo-6",
    time: "02:14:33",
    level: "OK",
    message: "Ed25519 signature generated: audit block verified",
  },
];
