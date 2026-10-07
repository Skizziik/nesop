import type { CSSProperties, ReactNode } from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette, TimelineEvent } from "../generated";
import { activeEvent } from "../lib/timeline";
import { SAFE_RECT } from "../lib/safe";

export const CONTENT_TOP = 440;
export const CONTENT_BOTTOM = 1560;
export const CONTENT_W = SAFE_RECT.x1 - SAFE_RECT.x0 - 20;
export const CONTENT_X = SAFE_RECT.x0 + 10;

/** Текущее время и активные события — общий хук всех форматов. */
export function useT(timeline: TimelineEvent[]) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const hi = activeEvent(timeline, t, "highlight");
  return {
    frame,
    fps,
    t,
    total: durationInFrames / fps,
    hiTarget: hi?.target ?? null,
    hiSince: hi ? t - hi.t_start : null,
    active: (action: TimelineEvent["action"]) => activeEvent(timeline, t, action),
    started: (action: TimelineEvent["action"]) => timeline.some((e) => e.action === action && t >= e.t_start),
  };
}

/** «Пружинка» при начале подсветки: 1 → 1.08 → 1. */
export function bounce(since: number | null, fps: number): number {
  if (since === null) return 1;
  const s = spring({ frame: Math.round(since * fps), fps, config: { damping: 8, stiffness: 220, mass: 0.6 } });
  return 1 + 0.08 * Math.sin(s * Math.PI);
}

export const pulse = (t: number, amp = 0.06, hz = 1.1) => 1 + amp * Math.sin(t * Math.PI * 2 * hz);

export function Card({ children, style, palette, highlighted, scale = 1 }: { children: ReactNode; style?: CSSProperties; palette: Palette; highlighted?: boolean; scale?: number }) {
  return (
    <div
      style={{
        background: highlighted ? palette.highlight_bg : palette.right_bg,
        color: highlighted ? palette.highlight_text : palette.right_text,
        borderRadius: 36,
        padding: "34px 40px",
        boxShadow: "0 10px 0 rgba(0,0,0,0.18)",
        transform: `scale(${scale})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function LetterBadge({ letter, palette, active, size = 92 }: { letter: string; palette: Palette; active?: boolean; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: active ? palette.highlight_left_text : palette.left_bg,
        color: active ? "#141414" : palette.left_text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.52,
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
}

/** Кольцо-таймер: сколько секунд осталось внутри события countdown. */
export function CountdownRing({ ev, t, palette, size = 220 }: { ev: TimelineEvent | null; t: number; palette: Palette; size?: number }) {
  if (!ev) return null;
  const dur = ev.t_end - ev.t_start;
  const p = Math.min(Math.max((t - ev.t_start) / dur, 0), 1);
  const left = Math.max(Math.ceil(dur - (t - ev.t_start)), 1);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const tick = 1 + 0.08 * Math.max(0, 1 - ((t - ev.t_start) % 1) * 4);
  return (
    <div style={{ width: size, height: size, position: "relative", transform: `scale(${tick})` }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill={palette.right_bg} stroke="rgba(0,0,0,0.15)" strokeWidth={18} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={palette.accent}
          strokeWidth={18}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * p}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, fontWeight: 800, color: palette.right_text }}>
        {left}
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#E3262E", "#FFD23F", "#2DE53A", "#1F4FA0", "#FF8FB1", "#ffffff"];

/** Детерминированные конфетти (random(seed) из Remotion) — одинаковые в превью и рендере. */
export function Confetti({ since, seed, originY = 900 }: { since: number | null; seed: number; originY?: number }) {
  if (since === null || since > 2.2) return null;
  const n = 70;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => {
        const a = random(`${seed}-a-${i}`) * Math.PI * 2;
        const v = 600 + random(`${seed}-v-${i}`) * 900;
        const tt = since;
        const x = 540 + Math.cos(a) * v * tt;
        const y = originY + Math.sin(a) * v * tt + 900 * tt * tt;
        const rot = random(`${seed}-r-${i}`) * 720 * tt;
        const op = interpolate(tt, [0, 1.6, 2.2], [1, 1, 0], { extrapolateRight: "clamp" });
        const w = 14 + random(`${seed}-w-${i}`) * 14;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: w * 0.45,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              transform: `rotate(${rot}deg)`,
              opacity: op,
              borderRadius: 3,
            }}
          />
        );
      })}
    </div>
  );
}

export const LEVEL_COLORS: Record<string, string> = { A1: "#2DBE60", A2: "#7BC74D", B1: "#F2C230", B2: "#F28C28", C1: "#E3412E", C2: "#9B1B30" };
