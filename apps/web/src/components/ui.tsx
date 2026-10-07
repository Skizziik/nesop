"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Check, Copy } from "lucide-react";
import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

type Variant = "primary" | "ghost" | "danger" | "outline";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-verde hover:bg-verde-2 text-white",
  ghost: "hover:bg-panel-2 text-ink",
  danger: "bg-rosso/90 hover:bg-rosso text-white",
  outline: "border border-line hover:bg-panel-2 text-ink",
};

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-2xl border border-line bg-panel p-5", className)} />;
}

export function CardTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-semibold">{children}</h2>
      {extra}
    </div>
  );
}

const TONES = {
  green: "bg-verde/15 text-verde-2 border-verde/30",
  red: "bg-rosso/15 text-rosso border-rosso/30",
  yellow: "bg-giallo/15 text-giallo border-giallo/30",
  gray: "bg-panel-2 text-mute border-line",
  blue: "bg-sky-500/15 text-sky-300 border-sky-500/30",
} as const;

export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold", TONES[tone], className)}>{children}</span>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-panel-2">
      <div className="h-full rounded-full bg-verde-2 transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={`Скопировать: ${label}`}
      className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-mute hover:bg-panel-2 hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          toast.error("Браузер не дал доступ к буферу обмена");
        }
      }}
    >
      {done ? <Check size={12} /> : <Copy size={12} />} {label}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-mute">{children}</div>;
}
