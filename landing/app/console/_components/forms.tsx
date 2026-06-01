import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-arc-500/60 focus:outline-none focus:ring-1 focus:ring-arc-500/40 transition";

export function FieldLabel({
  htmlFor,
  children,
  tone = "default",
}: {
  htmlFor: string;
  children: React.ReactNode;
  tone?: "default" | "muted";
}) {
  const toneClass =
    tone === "muted" ? "text-zinc-500" : "text-zinc-400";
  return (
    <label
      htmlFor={htmlFor}
      className={`font-mono text-[11px] uppercase tracking-wider ${toneClass}`}
    >
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${fieldBase} ${className}`} {...rest} />;
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input type="number" className={`${fieldBase} ${className}`} {...rest} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select className={`${fieldBase} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`${fieldBase} ${className}`} {...rest} />;
}
