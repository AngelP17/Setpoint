import { Card, SectionHeader } from "./cards";
import { StatusBadge } from "./status";

interface ProofSummary {
  verdict: "PASS" | "FAIL" | "UNKNOWN";
  runDurationSec: number;
  kindClusterSetup: boolean;
  registersTested: number;
  alertViolations: number;
  autoCorrected: number;
  payload: string;
}

const DEFAULT_PROOF: ProofSummary = {
  verdict: "PASS",
  runDurationSec: 42,
  kindClusterSetup: true,
  registersTested: 3,
  alertViolations: 0,
  autoCorrected: 1,
  payload: `{
  "schema": "setpoint.io/proof/v1",
  "plc": "line-1-printer-plc",
  "captured_at": "2026-06-01T18:00:00Z",
  "verdict": "PASS",
  "detection": {
    "registers_in_drift": 1,
    "auto_corrected": 1,
    "alert_violations": 0
  },
  "invariants": {
    "alert_strategy_write_blocks_satisfied": true,
    "halt_strategy_system_lock_satisfied": true
  }
}`,
};

export function ProofView({
  proof = DEFAULT_PROOF,
}: {
  proof?: ProofSummary;
}) {
  const verdictTone: "ok" | "fail" | "muted" =
    proof.verdict === "PASS" ? "ok" : proof.verdict === "FAIL" ? "fail" : "muted";

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Verification"
        title="E2E proof center"
        description="Snapshot of the most recent flagship proof run. The hard invariant: an Alert-policy register is never auto-corrected."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-5" title={undefined}>
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Latest run verdict
          </h3>

          <div
            className={`mt-4 flex items-center justify-between rounded-xl border p-5 ${
              proof.verdict === "PASS"
                ? "border-emerald-900/60 bg-emerald-950/20"
                : proof.verdict === "FAIL"
                  ? "border-red-900/60 bg-red-950/20"
                  : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <div>
              <div
                className={`font-mono text-[10px] uppercase tracking-wider ${
                  proof.verdict === "PASS"
                    ? "text-emerald-400"
                    : proof.verdict === "FAIL"
                      ? "text-red-400"
                      : "text-zinc-400"
                }`}
              >
                {proof.verdict === "PASS" ? "Verifiably certified" : proof.verdict === "FAIL" ? "Invariant violated" : "Awaiting run"}
              </div>
              <div className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-50">
                {proof.verdict}
              </div>
            </div>
            <StatusBadge tone={verdictTone}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  proof.verdict === "PASS"
                    ? "bg-emerald-400"
                    : proof.verdict === "FAIL"
                      ? "bg-red-400"
                      : "bg-zinc-500"
                }`}
              />
              {proof.verdict === "PASS"
                ? "ready"
                : proof.verdict === "FAIL"
                  ? "blocked"
                  : "pending"}
            </StatusBadge>
          </div>

          <dl className="mt-6 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <dt className="text-zinc-500">Run duration</dt>
              <dd className="text-zinc-200">{proof.runDurationSec}s</dd>
            </div>
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <dt className="text-zinc-500">Kind cluster setup</dt>
              <dd className="text-zinc-200">{proof.kindClusterSetup ? "Yes" : "No"}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <dt className="text-zinc-500">Registers tested</dt>
              <dd className="text-zinc-200">{proof.registersTested} registers</dd>
            </div>
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <dt className="text-zinc-500">Alert-policy violations</dt>
              <dd
                className={
                  proof.alertViolations > 0 ? "text-red-400" : "text-emerald-400"
                }
              >
                {proof.alertViolations}
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <dt className="text-zinc-500">Auto corrections applied</dt>
              <dd className="text-zinc-200">{proof.autoCorrected}</dd>
            </div>
          </dl>

          <p className="mt-6 border-t border-zinc-900 pt-4 text-[11px] leading-relaxed text-zinc-500">
            The flagship proof enforces strict invariants: any write to an Alert-only register
            fails the verification suite. Run <code className="font-mono text-zinc-300">make flagship-proof</code> to refresh.
          </p>
        </Card>

        <Card
          title="proof.json (snapshot)"
          description="Aggregate machine-readable verdict under artifacts/latest/"
          className="lg:col-span-7"
        >
          <pre className="max-h-96 overflow-auto rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 font-mono text-[11px] leading-[1.65] text-zinc-300">
            <code>{proof.payload}</code>
          </pre>
          <p className="mt-3 text-xs text-zinc-500">
            The actual proof.json is generated by <code className="font-mono">scripts/flagship-proof.sh</code> and{" "}
            <code className="font-mono">scripts/aggregate-proof.sh</code>. Re-run{" "}
            <code className="font-mono">make flagship-proof</code> to refresh the artifact.
          </p>
        </Card>
      </div>
    </div>
  );
}
