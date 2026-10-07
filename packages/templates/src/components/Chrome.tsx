import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Palette, Theme } from "../generated";
import { fitFontSize, upper } from "../lib/text";
import { CANVAS, SAFE } from "../lib/safe";

export const Background: React.FC<{ palette: Palette }> = ({ palette }) => (
  <AbsoluteFill
    style={{
      background: palette.bg2 ? `linear-gradient(170deg, ${palette.bg} 0%, ${palette.bg2} 100%)` : palette.bg,
    }}
  />
);

/** Жёлтая плашка-заголовок. */
export const TitleChip: React.FC<{ text: string; palette: Palette; font: string; y: number; pulse?: number }> = ({ text, palette, font, y, pulse = 1 }) => {
  const width = CANVAS.w - SAFE.right - SAFE.left - 40;
  const size = fitFontSize(upper(text), width - 80, 76, font, 40);
  return (
    <div style={{ position: "absolute", top: y, left: SAFE.left + 20, width, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          background: palette.title_bg,
          color: palette.title_text,
          fontFamily: font,
          fontWeight: 800,
          fontSize: size,
          padding: "18px 40px",
          borderRadius: 18,
          transform: `scale(${pulse}) rotate(-1.2deg)`,
          boxShadow: "0 8px 0 rgba(0,0,0,0.2)",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        {upper(text)}
      </div>
    </div>
  );
};

/** Текст-хук над заголовком (2-6 слов). Небольшой «вдох» пока голос произносит хук. */
export const HookText: React.FC<{ text: string; palette: Palette; font: string; y: number; hookActiveSince: number | null }> = ({ text, palette, font, y, hookActiveSince }) => {
  const { fps } = useVideoConfig();
  if (!text) return null;
  const width = CANVAS.w - SAFE.right - SAFE.left;
  const size = fitFontSize(text, width - 40, 58, font, 34);
  const s = hookActiveSince === null ? 0 : spring({ frame: Math.round(hookActiveSince * fps), fps, config: { damping: 9, stiffness: 160 } });
  const scale = 1 + 0.06 * Math.sin(s * Math.PI);
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: SAFE.left,
        width,
        textAlign: "center",
        fontFamily: font,
        fontWeight: 800,
        fontSize: size,
        color: "#fff",
        WebkitTextStroke: `${Math.round(size / 9)}px ${palette.title_text}`,
        paintOrder: "stroke fill",
        transform: `scale(${scale})`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

export const ProgressBar: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", top: 44, left: 40, right: 40, height: 12, borderRadius: 6, background: "rgba(0,0,0,0.18)" }}>
      <div style={{ width: `${p * 100}%`, height: "100%", borderRadius: 6, background: color }} />
    </div>
  );
};

/** Красная закладка-лента с плюсом: «сохрани». */
export const Bookmark: React.FC<{ position: NonNullable<Theme["bookmark"]>["position"] }> = ({ position = "top_right" }) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 12) * 2;
  const pos: React.CSSProperties =
    position === "top_left" ? { top: 0, left: 70 } : position === "mid_right" ? { top: 760, right: 170 } : { top: 0, right: 170 };
  return (
    <div style={{ position: "absolute", ...pos, transform: `rotate(${sway}deg)`, transformOrigin: "top center" }}>
      <svg width="110" height="170" viewBox="0 0 110 170">
        <path d="M8 0 H102 V160 L55 128 L8 160 Z" fill="#E3262E" stroke="#fff" strokeWidth="6" />
        <path d="M55 40 V96 M27 68 H83" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const Watermark: React.FC<{ text: string; color: string; font: string }> = ({ text, color, font }) =>
  text ? (
    <div
      style={{
        position: "absolute",
        bottom: SAFE.bottom + 10,
        left: SAFE.left + 10,
        fontFamily: font,
        fontWeight: 800,
        fontSize: 34,
        color,
        opacity: 0.55,
      }}
    >
      {text}
    </div>
  ) : null;

/** Пузырь с призывом в комменты; гаснет перед концом, чтобы последний кадр совпадал с первым. */
export const CtaBubble: React.FC<{ text: string; palette: Palette; font: string; since: number | null; endsIn: number; y: number }> = ({ text, palette, font, since, endsIn, y }) => {
  const { fps } = useVideoConfig();
  if (since === null || !text) return null;
  const inS = spring({ frame: Math.round(since * fps), fps, config: { damping: 12 } });
  const out = interpolate(endsIn, [0, 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const width = CANVAS.w - SAFE.right - SAFE.left - 60;
  const size = fitFontSize(text, width - 60, 52, font, 30);
  return (
    <div style={{ position: "absolute", top: y, left: SAFE.left + 30, width, display: "flex", justifyContent: "center", opacity: out }}>
      <div
        style={{
          background: palette.accent,
          color: "#fff",
          fontFamily: font,
          fontWeight: 800,
          fontSize: size,
          padding: "16px 34px",
          borderRadius: 999,
          transform: `scale(${inS})`,
          whiteSpace: "nowrap",
          boxShadow: "0 6px 0 rgba(0,0,0,0.2)",
        }}
      >
        {text}
      </div>
    </div>
  );
};
