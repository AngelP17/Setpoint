import type {
  IndustrialPLC,
  PlcView,
  RegisterStatus,
  RegisterView,
  Strategy,
} from "./types";

const asString = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const asNumber = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const asBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

const normaliseStrategy = (raw: unknown): Strategy => {
  if (raw === "Halt" || raw === "Alert") return raw;
  return "Auto";
};

const normaliseStatusRegister = (
  reg: Partial<RegisterStatus> | undefined,
): RegisterStatus | undefined => {
  if (!reg || typeof reg !== "object") return undefined;
  return {
    name: asString(reg.name, ""),
    address: asNumber(reg.address, 0),
    currentValue:
      typeof reg.currentValue === "number" ? reg.currentValue : undefined,
    inSync: asBool(reg.inSync, true),
    driftEvents: asNumber(reg.driftEvents, 0),
    correctionsApplied: asNumber(reg.correctionsApplied, 0),
    strategy: normaliseStrategy(reg.strategy),
    lastDriftAt: typeof reg.lastDriftAt === "string" ? reg.lastDriftAt : undefined,
    lastCorrectionAt:
      typeof reg.lastCorrectionAt === "string" ? reg.lastCorrectionAt : undefined,
  };
};

const toRegisterView = (
  spec: IndustrialPLC["spec"]["registers"][number],
  status: IndustrialPLC["status"],
): RegisterView => {
  const statusReg = status?.registers?.find(
    (r): r is RegisterStatus => r?.name === spec.name,
  );
  const safeStatus = normaliseStatusRegister(statusReg);
  return {
    name: spec.name,
    address: spec.address,
    desiredValue: spec.desiredValue,
    currentValue: safeStatus?.currentValue,
    inSync: safeStatus?.inSync ?? true,
    strategy: normaliseStrategy(spec.remediation?.strategy),
    criticality: asString(spec.criticality, "Medium"),
    driftEvents: safeStatus?.driftEvents ?? 0,
    correctionsApplied: safeStatus?.correctionsApplied ?? 0,
  };
};

export const toPlcView = (raw: unknown): PlcView | null => {
  if (!raw || typeof raw !== "object") return null;
  const plc = raw as Partial<IndustrialPLC>;
  const metadata = (plc.metadata ?? {}) as Partial<IndustrialPLC["metadata"]>;
  const spec: Partial<IndustrialPLC["spec"]> = plc.spec ?? {
    deviceAddress: "127.0.0.1",
    port: 502,
    registers: [],
  };
  if (!spec.registers || !Array.isArray(spec.registers)) {
    return null;
  }
  const status = plc.status;
  const registers = spec.registers
    .map((r) => toRegisterView(r, status))
    .filter((r) => r.name.length > 0);

  const driftCount = registers.reduce((acc, r) => acc + r.driftEvents, 0);
  const corrections = registers.reduce(
    (acc, r) => acc + r.correctionsApplied,
    0,
  );

  return {
    name: asString(metadata.name, "unnamed"),
    namespace: asString(metadata.namespace, "default"),
    address: asString(spec.deviceAddress, "127.0.0.1"),
    port: asNumber(spec.port, 502),
    phase: asString(status?.phase, "Pending"),
    driftCount,
    corrections,
    registers,
  };
};

export const toPlcViews = (raw: unknown): PlcView[] => {
  if (!Array.isArray(raw)) return [];
  const views: PlcView[] = [];
  for (const item of raw) {
    const view = toPlcView(item);
    if (view) views.push(view);
  }
  return views;
};
