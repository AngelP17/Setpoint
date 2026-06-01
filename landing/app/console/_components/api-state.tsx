import type { ReactNode } from "react";
import type { ApiState } from "../_lib/types";
import { StatusBadge, StatusDot } from "./status";

const toneForState: Record<
  ApiState,
  { dot: "ok" | "warn" | "fail" | "muted"; label: string; badge: "ok" | "warn" | "fail" | "muted" | "arc" }
> = {
  live: { dot: "ok", label: "Connected to api", badge: "ok" },
  demo: { dot: "warn", label: "Demo data fallback", badge: "warn" },
  loading: { dot: "muted", label: "Loading…", badge: "muted" },
  empty: { dot: "warn", label: "No resources", badge: "warn" },
  error: { dot: "fail", label: "API error", badge: "fail" },
};

export function ApiStateBadge({ state }: { state: ApiState }) {
  const tone = toneForState[state];
  return (
    <StatusBadge tone={tone.badge}>
      <StatusDot tone={tone.dot} />
      {tone.label}
    </StatusBadge>
  );
}

export function ApiStateBanner({
  state,
  error,
  children,
}: {
  state: ApiState;
  error?: string | null;
  children?: ReactNode;
}) {
  if (state === "live" || state === "loading") return null;
  if (state === "demo") {
    return (
      <div
        role="status"
        className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-2.5 text-[11px] text-amber-200/90"
      >
        <span className="font-mono font-semibold uppercase tracking-wider">Demo data</span>
        <span className="ml-2">
          The Axum API is not reachable on localhost:8081. Showing bundled mock state.
        </span>
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div
        role="status"
        className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-[11px] text-zinc-400"
      >
        <span className="font-mono font-semibold uppercase tracking-wider text-zinc-300">
          No resources
        </span>
        <span className="ml-2">No IndustrialPLC resources were found in the cluster.</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-2.5 text-[11px] text-red-200/90"
      >
        <span className="font-mono font-semibold uppercase tracking-wider">
          API error
        </span>
        <span className="ml-2">{error ?? "Unknown error talking to the API."}</span>
      </div>
    );
  }
  return null;
}
