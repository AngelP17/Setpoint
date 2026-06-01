import type { ReactNode } from "react";

type Tone = "ok" | "warn" | "fail" | "muted" | "arc";

const toneStyles: Record<Tone, string> = {
  ok: "bg-emerald-950/40 border-emerald-800 text-emerald-300",
  warn: "bg-amber-950/40 border-amber-800 text-amber-300",
  fail: "bg-red-950/40 border-red-800 text-red-300",
  muted: "bg-zinc-900/60 border-zinc-800 text-zinc-400",
  arc: "bg-arc-500/10 border-arc-500/40 text-arc-300",
};

export function StatusBadge({
  tone = "muted",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${toneStyles[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "muted",
  pulse = false,
}: {
  tone?: Tone;
  pulse?: boolean;
}) {
  const fill: Record<Tone, string> = {
    ok: "bg-emerald-400",
    warn: "bg-amber-400",
    fail: "bg-red-400",
    muted: "bg-zinc-500",
    arc: "bg-arc-400",
  };
  return (
    <span className="relative flex h-2 w-2">
      {pulse ? (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${fill[tone]}`}
        />
      ) : null}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${fill[tone]}`} />
    </span>
  );
}
