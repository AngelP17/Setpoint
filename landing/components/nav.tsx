import Link from "next/link";

export function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-ink-700/40 bg-ink-950/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 font-mono text-sm tracking-tight">
          <svg viewBox="0 0 28 28" className="h-6 w-6" aria-hidden="true">
            <rect x="3" y="3" width="22" height="22" rx="6" fill="none" stroke="var(--color-arc-500)" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="3" fill="var(--color-arc-500)" />
            <line x1="14" y1="3" x2="14" y2="8" stroke="var(--color-arc-500)" strokeWidth="1.5" />
            <line x1="14" y1="20" x2="14" y2="25" stroke="var(--color-arc-500)" strokeWidth="1.5" />
            <line x1="3" y1="14" x2="8" y2="14" stroke="var(--color-arc-500)" strokeWidth="1.5" />
            <line x1="20" y1="14" x2="25" y2="14" stroke="var(--color-arc-500)" strokeWidth="1.5" />
          </svg>
          <span className="font-semibold text-ink-50">setpoint</span>
          <span className="text-ink-400">.io</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-ink-300 md:flex">
          <a href="#proof" className="transition-colors hover:text-ink-50">Proof</a>
          <a href="#how" className="transition-colors hover:text-ink-50">How it works</a>
          <a href="#spec" className="transition-colors hover:text-ink-50">Spec</a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/apinzon/setpoint-operator"
            className="group inline-flex items-center gap-2 rounded-pill border border-ink-600 bg-ink-800/50 px-3.5 py-1.5 font-mono text-xs text-ink-200 transition-colors hover:border-arc-500/50 hover:text-ink-50"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            apinzon/setpoint-operator
            <span className="text-ink-400 transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
