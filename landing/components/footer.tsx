export function Footer() {
  return (
    <footer className="border-t border-ink-700/40 py-10">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-6 text-sm text-ink-400 md:flex-row md:items-center">
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="font-semibold text-ink-200">setpoint</span>
          <span>gitops for the factory floor</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs">
          <a href="https://github.com/apinzon/setpoint-operator" className="transition-colors hover:text-ink-100">github</a>
          <a href="https://github.com/apinzon/setpoint-operator/blob/main/docs/adr" className="transition-colors hover:text-ink-100">adr</a>
          <a href="https://github.com/apinzon/setpoint-operator/blob/main/docs/proof.md" className="transition-colors hover:text-ink-100">proof.md</a>
          <a href="https://github.com/apinzon/setpoint-operator/blob/main/LICENSE" className="transition-colors hover:text-ink-100">mit</a>
        </div>
      </div>
    </footer>
  );
}
