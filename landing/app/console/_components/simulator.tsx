import { useMemo, useState } from "react";
import { postSimulation } from "../_lib/api";
import { formatNumber, strategyTone } from "../_lib/format";
import type { ApiState, SimulationRequest, SimulationResponse, Strategy } from "../_lib/types";
import { ApiStateBanner } from "./api-state";
import { Card, SectionHeader } from "./cards";
import { FieldLabel, NumberInput, SelectInput, TextInput } from "./forms";
import { StatusBadge } from "./status";

const STRATEGIES: Strategy[] = ["Auto", "Alert", "Halt"];

interface FormState {
  registerName: string;
  desiredValue: number;
  currentValue: number;
  strategy: Strategy;
  maxCorrectionsPerHour: number;
  correctionsLastHour: number;
  cooldownSecs: number;
  elapsedSinceLastSecs: number;
}

const INITIAL_FORM: FormState = {
  registerName: "conveyor-speed",
  desiredValue: 2500,
  currentValue: 2999,
  strategy: "Auto",
  maxCorrectionsPerHour: 10,
  correctionsLastHour: 0,
  cooldownSecs: 30,
  elapsedSinceLastSecs: 45,
};

const offlineFallback = (form: FormState): SimulationResponse => {
  if (form.currentValue === form.desiredValue) {
    return {
      verdict: "In Sync",
      action: "None",
      reason: "Register is in sync.",
      risk: "Low",
    };
  }
  if (form.strategy === "Halt") {
    return {
      verdict: "System Halt",
      action: "Mark IndustrialPLC Failed, halt operational line",
      reason: `Halt strategy: drift detected (desired ${form.desiredValue}, actual ${form.currentValue}).`,
      risk: "Critical",
    };
  }
  if (form.strategy === "Alert") {
    return {
      verdict: "Drift Detected",
      action: "Emit Warning event, increment drift metrics, do not write",
      reason: "Alert strategy: passive monitoring prevents write action.",
      risk: "Medium",
    };
  }
  if (form.elapsedSinceLastSecs < form.cooldownSecs) {
    return {
      verdict: "Reconciliation Skipped",
      action: "Hold write back, keep drift status active",
      reason: `Skip: cooldown active (${form.elapsedSinceLastSecs}s elapsed < ${form.cooldownSecs}s limit).`,
      risk: "High",
    };
  }
  if (form.correctionsLastHour >= form.maxCorrectionsPerHour) {
    return {
      verdict: "Reconciliation Skipped",
      action: "Hold write back, skip correction trigger",
      reason: `Skip: hourly correction limit reached (${form.correctionsLastHour}/${form.maxCorrectionsPerHour}).`,
      risk: "High",
    };
  }
  return {
    verdict: "Auto-Reconciling",
    action: `Write desired value ${form.desiredValue} back to register`,
    reason: "Safe auto-correction triggered successfully.",
    risk: "Low (Safe Auto-correction)",
  };
};

const verdictTone = (verdict: string): "ok" | "warn" | "fail" | "muted" => {
  if (verdict.startsWith("In Sync")) return "ok";
  if (verdict.startsWith("Auto") || verdict.startsWith("Reconciliation Triggered")) {
    return "ok";
  }
  if (verdict.startsWith("System Halt")) return "fail";
  if (verdict.startsWith("Reconciliation Skipped")) return "warn";
  return "warn";
};

const riskTone = (risk: string): "ok" | "warn" | "fail" => {
  if (risk.toLowerCase().includes("critical")) return "fail";
  if (risk.toLowerCase().includes("high")) return "warn";
  return "ok";
};

export function SimulatorView() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestBody = useMemo<SimulationRequest>(
    () => ({
      strategy: form.strategy,
      desiredValue: form.desiredValue,
      currentValue: form.currentValue,
      cooldownSecs: form.cooldownSecs,
      maxCorrectionsPerHour: form.maxCorrectionsPerHour,
      correctionsLastHour: form.correctionsLastHour,
      lastCorrectionElapsedSecs: form.elapsedSinceLastSecs,
    }),
    [form],
  );

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const runSimulation = async () => {
    setSubmitting(true);
    const res = await postSimulation(requestBody);
    setSubmitting(false);
    if (res.state === "live" && res.data) {
      setApiState("live");
      setApiError(null);
      setResult(res.data);
      return;
    }
    if (res.state === "error") {
      setApiState("error");
      setApiError(res.error);
      setResult(null);
      return;
    }
    setApiState("demo");
    setApiError(null);
    setResult(offlineFallback(form));
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sandbox"
        title="Policy simulator"
        description="Reuses the same PolicyEngine as the operator. Falls back to a local replica if the Axum gateway is offline."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <Card
          title="Simulation parameters"
          description="Order of evaluation: in-sync, strategy, cooldown, hourly rate limit."
          className="lg:col-span-5"
        >
          <div className="space-y-4 text-sm">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="sim-register">Register name</FieldLabel>
              <TextInput
                id="sim-register"
                value={form.registerName}
                onChange={(e) => updateField("registerName", e.target.value)}
                placeholder="e.g. conveyor-speed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="sim-desired">Git desired</FieldLabel>
                <NumberInput
                  id="sim-desired"
                  value={form.desiredValue}
                  onChange={(e) =>
                    updateField("desiredValue", Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="sim-actual">Live actual</FieldLabel>
                <NumberInput
                  id="sim-actual"
                  value={form.currentValue}
                  onChange={(e) =>
                    updateField("currentValue", Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="sim-strategy">Remediation policy</FieldLabel>
              <SelectInput
                id="sim-strategy"
                value={form.strategy}
                onChange={(e) => updateField("strategy", e.target.value as Strategy)}
              >
                {STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            </div>

            <div className="border-t border-zinc-800/80 pt-4">
              <div className="mb-3 font-mono text-xs uppercase tracking-wider text-zinc-400">
                Reconciliation rate limits
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="sim-max-hour" tone="muted">
                    Max corrections / hour
                  </FieldLabel>
                  <NumberInput
                    id="sim-max-hour"
                    value={form.maxCorrectionsPerHour}
                    onChange={(e) =>
                      updateField(
                        "maxCorrectionsPerHour",
                        Number(e.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="sim-applied" tone="muted">
                    Corrections applied
                  </FieldLabel>
                  <NumberInput
                    id="sim-applied"
                    value={form.correctionsLastHour}
                    onChange={(e) =>
                      updateField(
                        "correctionsLastHour",
                        Number(e.target.value) || 0,
                      )
                    }
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="sim-cooldown" tone="muted">
                    Cooldown (s)
                  </FieldLabel>
                  <NumberInput
                    id="sim-cooldown"
                    value={form.cooldownSecs}
                    onChange={(e) =>
                      updateField("cooldownSecs", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="sim-elapsed" tone="muted">
                    Elapsed since last (s)
                  </FieldLabel>
                  <NumberInput
                    id="sim-elapsed"
                    value={form.elapsedSinceLastSecs}
                    onChange={(e) =>
                      updateField("elapsedSinceLastSecs", Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void runSimulation()}
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {submitting ? "Evaluating…" : "Evaluate safety engine"}
            </button>
          </div>
        </Card>

        <Card
          title="Safety engine verdict"
          description={apiState === "demo" ? "Sourced from the bundled replica (api offline)." : "Sourced from /api/simulate-policy."}
          className="lg:col-span-7"
        >
          <ApiStateBanner state={apiState} error={apiError} />
          {result ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                    Remediation decision
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-lg font-bold">
                    <StatusBadge tone={verdictTone(result.verdict)}>
                      {result.verdict}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                    System risk level
                  </div>
                  <div className="mt-1.5">
                    <StatusBadge tone={riskTone(result.risk)}>{result.risk}</StatusBadge>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-950 p-5">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                    Remediation action
                  </div>
                  <div className="mt-1 font-mono text-sm font-medium text-zinc-200">
                    {result.action}
                  </div>
                </div>
                <div className="border-t border-zinc-800/80 pt-3">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                    Engine rationale
                  </div>
                  <div className="mt-1 font-mono text-xs leading-relaxed text-zinc-400">
                    {result.reason}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={strategyTone(form.strategy)}>
                  strategy · {form.strategy}
                </StatusBadge>
                <StatusBadge tone="muted">
                  drift · {formatNumber(form.desiredValue - form.currentValue)}
                </StatusBadge>
                <StatusBadge tone="muted">
                  cooldown · {form.elapsedSinceLastSecs}/{form.cooldownSecs}s
                </StatusBadge>
                <StatusBadge tone="muted">
                  hourly · {form.correctionsLastHour}/{form.maxCorrectionsPerHour}
                </StatusBadge>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-500">
              Awaiting engine evaluation.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
