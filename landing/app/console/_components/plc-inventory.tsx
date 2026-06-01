import { useState } from "react";
import type { PlcView, Strategy } from "../_lib/types";
import { triggerSync } from "../_lib/api";
import { formatNumber, phaseLabel, phaseTone, strategyTone } from "../_lib/format";
import { Card, EmptyState, SectionHeader } from "./cards";
import { StatusBadge, StatusDot } from "./status";

const criticalityTone = (c: string): "ok" | "warn" | "fail" | "muted" => {
  if (c === "SafetyCritical") return "fail";
  if (c === "High") return "warn";
  if (c === "Medium") return "warn";
  return "muted";
};

export function PlcInventoryView({
  plcs,
  onLogSync,
  onSyncError,
}: {
  plcs: PlcView[];
  onLogSync: (message: string) => void;
  onSyncError: (message: string) => void;
}) {
  const [pendingSync, setPendingSync] = useState<string | null>(null);

  const handleSync = async (plc: PlcView) => {
    const key = `${plc.namespace}/${plc.name}`;
    setPendingSync(key);
    const res = await triggerSync(plc.namespace, plc.name);
    setPendingSync(null);
    if (res.state === "live" && res.data) {
      onLogSync(`[Manual Trigger] ${res.data.message} (${plc.name})`);
    } else {
      const reason = res.error ?? "Sync request failed";
      onSyncError(`Sync failed for ${plc.name}: ${reason}`);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Inventory"
        title="IndustrialPLC roster"
        description="Git desired vs. live actual register state for each managed resource. Use Trigger Reconcile to ask the operator to re-evaluate the resource."
      />

      {plcs.length === 0 ? (
        <EmptyState
          title="No PLCs"
          body="Apply a sample IndustrialPLC to populate the inventory. The console is empty because the API returned zero resources."
        />
      ) : (
        <div className="space-y-6">
          {plcs.map((plc) => {
            const tone = phaseTone(plc.phase);
            const key = `${plc.namespace}/${plc.name}`;
            return (
              <Card
                key={key}
                className="space-y-4"
                title={undefined}
              >
                <div className="flex flex-col gap-3 border-b border-zinc-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-zinc-100">{plc.name}</h3>
                      <StatusBadge tone={tone === "muted" ? "muted" : tone}>
                        <StatusDot tone={tone === "muted" ? "muted" : tone} />
                        {phaseLabel(plc.phase)}
                      </StatusBadge>
                    </div>
                    <div className="font-mono text-xs text-zinc-400">
                      {plc.namespace}/{plc.name} · {plc.address}:{plc.port}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSync(plc)}
                    disabled={pendingSync === key}
                    className="self-start rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700/80 disabled:opacity-50 sm:self-center"
                  >
                    {pendingSync === key ? "Requesting…" : "Trigger reconcile"}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/40">
                  <table className="min-w-full divide-y divide-zinc-800/80 text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-6 py-3.5" scope="col">
                          Register
                        </th>
                        <th className="px-6 py-3.5" scope="col">
                          Address
                        </th>
                        <th className="px-6 py-3.5 text-center" scope="col">
                          Git desired
                        </th>
                        <th className="px-6 py-3.5 text-center" scope="col">
                          Live actual
                        </th>
                        <th className="px-6 py-3.5" scope="col">
                          Strategy
                        </th>
                        <th className="px-6 py-3.5" scope="col">
                          Criticality
                        </th>
                        <th className="px-6 py-3.5 text-right" scope="col">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono">
                      {plc.registers.map((reg) => (
                        <tr key={reg.name} className="hover:bg-zinc-900/20">
                          <td className="px-6 py-4 font-sans font-medium text-zinc-100">
                            {reg.name}
                          </td>
                          <td className="px-6 py-4 text-zinc-400">{reg.address}</td>
                          <td className="px-6 py-4 text-center font-bold text-emerald-400">
                            {formatNumber(reg.desiredValue)}
                          </td>
                          <td
                            className={`px-6 py-4 text-center font-bold ${
                              reg.inSync
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {formatNumber(reg.currentValue)}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge tone={strategyTone(reg.strategy as Strategy)}>
                              {reg.strategy}
                            </StatusBadge>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge tone={criticalityTone(reg.criticality)}>
                              {reg.criticality}
                            </StatusBadge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1.5 ${
                                reg.inSync ? "text-emerald-400" : "text-amber-400"
                              }`}
                            >
                              <StatusDot
                                tone={reg.inSync ? "ok" : "warn"}
                                pulse={!reg.inSync}
                              />
                              {reg.inSync ? "In sync" : "Drift"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
