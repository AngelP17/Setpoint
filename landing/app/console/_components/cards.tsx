import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{title}</h2>
      {description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{description}</p>
      ) : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "ok" | "warn" | "fail";
  highlight?: boolean;
}) {
  const valueTone: Record<typeof tone, string> = {
    default: "text-zinc-50",
    ok: "text-emerald-400",
    warn: "text-amber-400",
    fail: "text-red-400",
  };
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-emerald-900/60 bg-emerald-950/20"
          : "border-zinc-800/80 bg-zinc-900/40"
      }`}
    >
      <div
        className={`font-mono text-[9px] uppercase tracking-wider ${
          highlight ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-bold ${valueTone[tone]}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[10px] text-zinc-500">{hint}</div>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 ${className}`}
    >
      <div>
        {title ? (
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h2>
        ) : null}
        {description ? (
          <p className="mt-1 text-xs text-zinc-400">{description}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-6 py-12 text-center">
      <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        {title}
      </div>
      <p className="max-w-[40ch] text-sm text-zinc-400">{body}</p>
      {action}
    </div>
  );
}
