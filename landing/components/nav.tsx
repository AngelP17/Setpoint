import Link from "next/link";
import { ArrowUpRight, Command, GitBranch, Radio } from "@phosphor-icons/react/dist/ssr";
import { ThemeToggle } from "./theme-toggle";

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink-700/50 bg-ink-950/76 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3 transition hover:opacity-90 active:scale-[0.98] duration-200">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-arc-400/25 bg-arc-500/10 text-arc-300">
            <Radio className="h-5 w-5" weight="duotone" />
          </span>
          <span>
            <span className="block font-mono text-sm font-medium text-ink-50">setpoint</span>
            <span className="block text-[11px] text-ink-400">industrial gitops control plane</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-ink-300 lg:flex">
          <a href="#proof" className="transition hover:text-ink-50">Proof</a>
          <a href="#console" className="transition hover:text-ink-50">Console</a>
          <a href="#flow" className="transition hover:text-ink-50">Control loop</a>
          <a href="#spec" className="transition hover:text-ink-50">Surfaces</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href="https://github.com/apinzon/setpoint-operator"
            className="group inline-flex items-center gap-2 rounded-pill border border-ink-600 bg-ink-800/60 px-4 py-2 font-mono text-xs text-ink-100 transition hover:border-arc-400/50 hover:bg-ink-800 active:scale-[0.98] duration-200"
          >
            <GitBranch className="h-3.5 w-3.5" weight="bold" />
            Repo
            <ArrowUpRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" weight="bold" />
          </a>
          <a
            href="/console"
            className="hidden items-center gap-2 rounded-pill bg-arc-500 px-4 py-2 font-mono text-xs font-medium text-ink-50 transition hover:-translate-y-px active:scale-[0.98] lg:inline-flex glow-arc"
          >
            <Command className="h-3.5 w-3.5" weight="bold" />
            Open console
          </a>
        </div>
      </div>
    </header>
  );
}
