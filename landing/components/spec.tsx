const items = [
  {
    label: "operator",
    value: "Rust workspace",
    detail: "reconciler, metrics, CRD status, policy path",
  },
  {
    label: "api",
    value: "Axum gateway",
    detail: "serves telemetry and control-plane state to the console",
  },
  {
    label: "console",
    value: "Next.js 15",
    detail: "inventory, proof, simulation, live status surfaces",
  },
  {
    label: "proof",
    value: "Artifacts first",
    detail: "drift snapshots, metrics, events, logs, verdict",
  },
  {
    label: "deployment",
    value: "raw + helm",
    detail: "k8s manifests for local clusters and packaged install",
  },
  {
    label: "tooling",
    value: "CLI + simulator",
    detail: "setpointctl, mock-plc, drift-simulator, proof scripts",
  },
];

export function Spec() {
  return (
    <section id="spec" className="relative isolate border-t border-ink-700/40 py-20 md:py-28">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-12 max-w-3xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-50 md:text-5xl">
            The repo already has the right platform shape.
          </h2>
          <p className="mt-3 max-w-[60ch] text-pretty text-base leading-relaxed text-ink-300">
            This is not a frontend-first demo. The page is a thin lens over a Rust operator, an API surface, and a proof-oriented development loop.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-ink-700/60 bg-ink-700/40 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.label} className="bg-ink-900/40 p-6">
              <div className="font-mono text-[10px] text-ink-400">{it.label}</div>
              <div className="mt-2 font-mono text-lg text-ink-50">{it.value}</div>
              <div className="mt-1 text-sm text-ink-300">{it.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
