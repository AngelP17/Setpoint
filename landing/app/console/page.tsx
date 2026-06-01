"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPlcs } from "./_lib/api";
import { DEMO_PLCS } from "./_lib/demo-data";
import { toPlcViews } from "./_lib/mappers";
import type { ApiState, LogEntry } from "./_lib/types";
import { ApiStateBanner } from "./_components/api-state";
import { ConsoleHeader, type ConsoleTab } from "./_components/shell";
import { DashboardView, type DashboardMetrics } from "./_components/dashboard";
import { PlcInventoryView } from "./_components/plc-inventory";
import { SimulatorView } from "./_components/simulator";
import { ProofView } from "./_components/proof";
import { INITIAL_DEMO_LOGS } from "./_lib/types";

const REFRESH_INTERVAL_MS = 4_000;
const MAX_LOG_ENTRIES = 80;

const computeMetrics = (plcs: ReturnType<typeof toPlcViews>): DashboardMetrics => {
  const managedPlcs = plcs.length;
  const monitoredRegisters = plcs.reduce(
    (acc, p) => acc + p.registers.length,
    0,
  );
  const activeDrift = plcs.reduce(
    (acc, p) => acc + p.registers.filter((r) => !r.inSync).length,
    0,
  );
  const autoCorrections = plcs.reduce((acc, p) => acc + p.corrections, 0);

  return {
    managedPlcs,
    monitoredRegisters,
    activeDrift,
    autoCorrections,
  };
};

export default function ConsolePage() {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("dashboard");
  const [plcs, setPlcs] = useState(DEMO_PLCS);
  const [plcState, setPlcState] = useState<ApiState>("loading");
  const [plcError, setPlcError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_DEMO_LOGS);
  const [usingDemoData, setUsingDemoData] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetchPlcs();
    if (res.state === "live" && res.data) {
      const mapped = toPlcViews(res.data);
      if (mapped.length > 0) {
        setPlcs(mapped);
        setUsingDemoData(false);
      }
      setPlcState("live");
      setPlcError(null);
      return;
    }
    if (res.state === "error") {
      setPlcState("error");
      setPlcError(res.error);
      return;
    }
    if (res.state === "empty") {
      setPlcs([]);
      setPlcState("empty");
      setPlcError(null);
      setUsingDemoData(false);
      return;
    }
    setPlcState("demo");
    setPlcError(null);
    setUsingDemoData(true);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const appendLog = useCallback((message: string, level: LogEntry["level"] = "INFO") => {
    setLogs((prev) => {
      const time = new Date().toTimeString().slice(0, 8);
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time,
        level,
        message,
      };
      return [...prev, entry].slice(-MAX_LOG_ENTRIES);
    });
  }, []);

  const handleSyncLog = useCallback(
    (message: string) => {
      appendLog(message, "INFO");
    },
    [appendLog],
  );

  const handleSyncError = useCallback(
    (message: string) => {
      appendLog(message, "FAIL");
    },
    [appendLog],
  );

  const metrics = useMemo(() => computeMetrics(plcs), [plcs]);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 font-sans text-zinc-100 selection:bg-emerald-500/30">
      <ConsoleHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        {activeTab === "dashboard" && (
          <>
            <ApiStateBanner state={plcState} error={plcError} />
            <DashboardView plcs={plcs} metrics={metrics} logs={logs} />
          </>
        )}
        {activeTab === "plcs" && (
          <>
            <ApiStateBanner state={plcState} error={plcError} />
            <PlcInventoryView
              plcs={usingDemoData && plcState === "demo" ? DEMO_PLCS : plcs}
              onLogSync={handleSyncLog}
              onSyncError={handleSyncError}
            />
          </>
        )}
        {activeTab === "simulator" && <SimulatorView />}
        {activeTab === "proof" && <ProofView />}
      </main>
    </div>
  );
}
