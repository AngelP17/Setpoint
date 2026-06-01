import { ArrowUpRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";

export function GitHubCTA() {
  return (
    <section className="relative isolate overflow-hidden border-t border-ink-700/40 py-24 md:py-32">
      <div className="grid-bg-tight absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-arc-500) 18%, transparent), transparent 70%)" }}
        aria-hidden="true"
      />
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="grid grid-cols-1 items-end gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <h2 className="text-balance text-3xl font-semibold leading-[1.05] tracking-tighter text-ink-50 md:text-5xl">
              Ship the claim with the code.
            </h2>
            <p className="mt-4 max-w-[52ch] text-pretty text-base leading-relaxed text-ink-300">
              Clone the repo, run <code className="font-mono text-ink-100">make flagship-proof</code>, and inspect the exact artifacts the CI uses. That makes the frontend credible because the backend contract is testable.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs text-ink-300">
              <span className="inline-flex items-center gap-2 rounded-pill border border-ink-700/60 bg-ink-900/50 px-3 py-1.5"><CheckCircle className="h-3.5 w-3.5 text-arc-300" weight="fill" /> cargo test</span>
              <span className="inline-flex items-center gap-2 rounded-pill border border-ink-700/60 bg-ink-900/50 px-3 py-1.5"><CheckCircle className="h-3.5 w-3.5 text-arc-300" weight="fill" /> helm lint</span>
              <span className="inline-flex items-center gap-2 rounded-pill border border-ink-700/60 bg-ink-900/50 px-3 py-1.5"><CheckCircle className="h-3.5 w-3.5 text-arc-300" weight="fill" /> proof verdict</span>
            </div>
          </div>
          <div className="md:col-span-5">
            <div className="flex flex-col items-start gap-3 md:items-end">
              <a
                href="https://github.com/apinzon/setpoint-operator"
                className="group inline-flex items-center gap-3 rounded-pill bg-arc-500 px-6 py-3 text-sm font-medium text-ink-50 transition hover:-translate-y-px active:scale-[0.98] duration-200 glow-arc"
              >
                View repository
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" weight="bold" />
              </a>
              <span className="font-mono text-[11px] text-ink-400">
                apinzon/setpoint-operator | MIT
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
