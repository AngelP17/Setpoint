import type { LogEntry, PlcView } from "../_lib/types";
import { formatNumber, isAlertPhase, isHaltPhase, phaseLabel, phaseTone } from "../_lib/format";
import { Card, MetricCard, SectionHeader } from "./cards";
import { StatusBadge, StatusDot } from "./status";

export interface DashboardMetrics {
  managedPlcs: number;
  monitoredRegisters: number;
  activeDrift: number;
  autoCorrections: number;
}

export function DashboardView({
  plcs,
  metrics,
  logs,
}: {
  plcs: PlcView[];
  metrics: DashboardMetrics;
  logs: LogEntry[];
}) {
  const hasHalt = plcs.some((p) => isHaltPhase(p.phase));
  const hasAlert = plcs.some(
    (p) => isAlertPhase(p.phase) && p.registers.some((r) => r.strategy === "Alert" && !r.inSync),
  );
  const overallTone: "fail" | "warn" | "ok" = hasHalt
    ? "fail"
    : hasAlert
      ? "warn"
      : "ok";
  const overallLabel = hasHalt
    ? "Halt triggered"
    : hasAlert
      ? "Drift detected"
      : "Control plane healthy";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Control plane"
        title="Executive dashboard"
        description="Top-line summary of managed PLCs and register drift. Driven by /api/plcs when the Axum gateway is up."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Managed PLCs"
          value={formatNumber(metrics.managedPlcs)}
          hint="active reconciliation"
        />
        <MetricCard
          label="Monitored registers"
          value={formatNumber(metrics.monitoredRegisters)}
          hint="industrial sensors"
        />
        <MetricCard
          label="Active drift"
          value={formatNumber(metrics.activeDrift)}
          tone={metrics.activeDrift > 0 ? "warn" : "ok"}
          hint="unreconciled items"
        />
        <MetricCard
          label="Auto corrections"
          value={formatNumber(metrics.autoCorrections)}
          tone="ok"
          hint="silently resolved"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card
          title="Plant topology"
          description="Managed IndustrialPLC resources and their aggregate phase"
          className="lg:col-span-7"
        >
          {plcs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
              No IndustrialPLC resources in view. Apply a sample to populate the console.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {plcs.map((plc) => {
                const tone = phaseTone(plc.phase);
                return (
                  <div
                    key={`${plc.namespace}/${plc.name}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <StatusDot
                        tone={tone === "muted" ? "muted" : tone}
                        pulse={tone === "warn" || tone === "fail"}
                      />
                      <div>
                        <div className="text-sm font-medium text-zinc-100">{plc.name}</div>
                        <div className="font-mono text-[11px] text-zinc-500">
                          {plc.address}:{plc.port}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <StatusBadge tone={tone === "muted" ? "muted" : tone}>
                        {phaseLabel(plc.phase)}
                      </StatusBadge>
                      <div className="mt-1 text-[10px] text-zinc-500">
                        {plc.registers.length} registers
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900 pt-4 text-xs text-zinc-500">
            <span>Modbus TCP · port 502</span>
            <span>
              Cluster state:{" "}
              <span
                className={
                  overallTone === "ok"
                    ? "text-emerald-400"
                    : overallTone === "warn"
                      ? "text-amber-400"
                      : "text-red-400"
                }
              >
                {overallLabel}
              </span>
            </span>
          </div>
        </Card>

        <Card
          title="Reconciliation log"
          description="Bounded event stream from the operator / API"
          className="lg:col-span-5"
        >
          <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 font-mono text-[11px] text-zinc-300">
            {logs.length === 0 ? (
              <p className="text-zinc-500">No log entries yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {logs.map((log, idx) => (
                  <li key={`${log.id}-${idx}`} className="flex gap-2">
                    <span className="shrink-0 text-zinc-600">[{idx + 1}]</span>
                    <span className="shrink-0 text-zinc-500">{log.time}</span>
                    <span
                      className={
                        log.level === "WARN"
                          ? "text-amber-300"
                          : log.level === "FAIL"
                            ? "text-red-300"
                            : log.level === "OK"
                              ? "text-emerald-300"
                              : "text-arc-300"
                      }
                    >
                      {log.level}
                    </span>
                    <span className="text-zinc-200">{log.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Bundled demo stream until SSE upstream is reachable</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              streaming
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
