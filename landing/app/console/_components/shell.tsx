import { useEffect, useState } from "react";
import { fetchHealth } from "../_lib/api";
import type { ApiState } from "../_lib/types";
import { StatusDot } from "./status";

export type ConsoleTab = "dashboard" | "plcs" | "simulator" | "proof";

const TABS: { id: ConsoleTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "plcs", label: "PLCs" },
  { id: "simulator", label: "Simulator" },
  { id: "proof", label: "Proof" },
];

export function ConsoleHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: ConsoleTab;
  onTabChange: (t: ConsoleTab) => void;
}) {
  const [health, setHealth] = useState<"ok" | "down" | "probing">("probing");

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const res = await fetchHealth();
      if (cancelled) return;
      setHealth(res.state === "live" ? "ok" : "down");
    };
    void probe();
    const id = setInterval(probe, 8_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const clusterLabel =
    health === "ok" ? "API online" : health === "down" ? "API offline" : "Probing";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6">
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-50">
              Setpoint{" "}
              <span className="rounded-md border border-emerald-800 bg-emerald-950/60 px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Console
              </span>
            </span>
          </a>

          <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
            <StatusDot
              tone={health === "ok" ? "ok" : health === "down" ? "fail" : "muted"}
              pulse={health === "ok"}
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              {clusterLabel}
            </span>
          </div>
        </div>

        <nav
          aria-label="Console sections"
          className="flex items-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-1.5 py-1"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`rounded-md border px-3 py-1 text-xs font-medium tracking-wide transition-colors ${
                  active
                    ? "border-zinc-700/60 bg-zinc-800 text-zinc-50"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
