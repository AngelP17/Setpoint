const items = [
  {
    label: "Operator",
    value: "Rust 1.78",
    detail: "kube-rs 0.87 · tokio · Modbus TCP",
  },
  {
    label: "Helm chart",
    value: "0.2.0",
    detail: "ServiceMonitor, Grafana ConfigMap",
  },
  {
    label: "Mock PLC",
    value: "Multi-register",
    detail: "HashMap holding registers, chaos mode",
  },
  {
    label: "Drift sim",
    value: "Standalone",
    detail: "Bounded writes, deterministic proof",
  },
  {
    label: "CI",
    value: "5 + 1",
    detail: "fmt, clippy, test, build, helm-lint, e2e proof",
  },
  {
    label: "Proof",
    value: "jq gate",
    detail: "PASS or FAIL, machine-checked",
  },
];

export function Spec() {
  return (
    <section id="spec" className="relative isolate border-t border-ink-700/40 py-20 md:py-28">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-50 md:text-4xl">
            What you get on <code className="font-mono text-arc-400">git clone</code>.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-ink-700/60 bg-ink-700/40 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.label} className="bg-ink-900/40 p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">{it.label}</div>
              <div className="mt-2 font-mono text-lg text-ink-50">{it.value}</div>
              <div className="mt-1 text-sm text-ink-300">{it.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
