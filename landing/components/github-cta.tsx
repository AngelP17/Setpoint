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
              <span className="block">One command.</span>
              <span className="block text-arc-400">Verdict in your terminal.</span>
            </h2>
            <p className="mt-4 max-w-[52ch] text-pretty text-base leading-relaxed text-ink-300">
              Clone, build, run <code className="font-mono text-ink-100">make flagship-proof</code>. If the verdict isn’t PASS, the proof run fails. The CI runs the same thing.
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="flex flex-col items-start gap-3 md:items-end">
              <a
                href="https://github.com/apinzon/setpoint-operator"
                className="group inline-flex items-center gap-3 rounded-pill bg-arc-500 px-6 py-3 text-sm font-medium text-ink-950 transition-transform hover:-translate-y-px glow-arc"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View on GitHub
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
              <span className="font-mono text-[11px] text-ink-400">
                apinzon/setpoint-operator · MIT
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
