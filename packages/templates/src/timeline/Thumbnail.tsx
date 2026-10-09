import { AbsoluteFill } from "remotion";
import { Mascot, type Emotion } from "../components/Mascots";

/** Обложка YouTube 1280×720: крупный текст (2-4 слова) с подсветкой ключевого слова, маскот с эмоцией, бейдж уровня, триколор. */
export interface ThumbnailProps {
  text: string; // «ESSERE O AVERE?»
  highlight?: string; // слово, которое красим акцентом
  sub?: string; // плашка снизу: «Learn Italian · A2»
  badge?: string; // круг в углу: «A2»
  mascot?: string;
  emotion?: Emotion;
  variant?: number; // 0..2 — разные цвета и раскладка (для A/B-теста обложек YouTube)
}

export const THUMBNAIL_ID = "Thumbnail";
export const THUMB_W = 1280;
export const THUMB_H = 720;

const THEMES = [
  { bg: ["#2A0F5C", "#7B2CBF"], ray: "rgba(255,255,255,0.07)", glow: "rgba(255,214,10,0.55)", accent: "#FFD60A", ink: "#14082B" },
  { bg: ["#9B0F19", "#FF4B2B"], ray: "rgba(255,255,255,0.08)", glow: "rgba(255,255,255,0.55)", accent: "#FFE66D", ink: "#3A0306" },
  { bg: ["#05472A", "#1DB954"], ray: "rgba(255,255,255,0.08)", glow: "rgba(255,230,109,0.6)", accent: "#FFFFFF", ink: "#022215" },
] as const;

export function Thumbnail({ text, highlight, sub, badge, mascot = "espresso", emotion = "surprised", variant = 0 }: ThumbnailProps) {
  const th = THEMES[((variant % 3) + 3) % 3]!;
  const mirror = variant === 1; // маскот слева, текст справа — визуально другая обложка
  const words = text.toLocaleUpperCase("it-IT").split(/\s+/).filter(Boolean);
  // строки по 1-2 слова: крупно и читаемо даже в маленьком превью
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 10) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
  // Montserrat 900 в верхнем регистре ≈ 0.7 em на символ; высота — до 3 строк в 540 px
  const size = Math.max(70, Math.min(210, Math.floor(780 / (longest * 0.7)), Math.floor(540 / Math.max(lines.length, 1) / 1.04)));
  const hi = (highlight ?? "").toLocaleUpperCase("it-IT").replace(/[^\p{L}\p{N}']/gu, "");
  const textSide: React.CSSProperties = mirror ? { right: 56, alignItems: "flex-end", textAlign: "right" } : { left: 56, alignItems: "flex-start" };
  return (
    <AbsoluteFill style={{ fontFamily: "Montserrat", overflow: "hidden", background: `linear-gradient(135deg, ${th.bg[0]} 0%, ${th.bg[1]} 100%)` }}>
      {/* лучи от маскота */}
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from 0deg at ${mirror ? "22%" : "78%"} 55%, ${th.ray} 0deg 9deg, transparent 9deg 22deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          left: mirror ? -120 : 640,
          top: 30,
          background: `radial-gradient(circle, ${th.glow} 0%, transparent 65%)`,
        }}
      />
      {/* триколор */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 18, background: "linear-gradient(90deg, #009246 0 33.3%, #F1F2F1 33.3% 66.6%, #CE2B37 66.6% 100%)" }} />

      {/* маскот */}
      <div style={{ position: "absolute", bottom: 10, [mirror ? "left" : "right"]: 10, filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.45))" }}>
        <Mascot character={mascot} height={600} flip={mirror} s={{ mouth: emotion === "happy" ? 1 : 2, blink: false, emotion, t: 0 }} />
      </div>

      {/* текст */}
      <div style={{ position: "absolute", top: 70, bottom: 120, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, width: 800, ...textSide }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontSize: size, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2, transform: `rotate(${i % 2 ? 1.2 : -1.5}deg)` }}>
            {l.split(" ").map((w, j) => {
              const isHi = hi && w.replace(/[^\p{L}\p{N}']/gu, "") === hi;
              return (
                <span
                  key={j}
                  style={{
                    color: isHi ? th.ink : "#FFFFFF",
                    background: isHi ? th.accent : undefined,
                    padding: isHi ? "0 18px" : undefined,
                    borderRadius: isHi ? 18 : undefined,
                    WebkitTextStroke: isHi ? undefined : `10px ${th.ink}`,
                    paintOrder: "stroke fill",
                    textShadow: isHi ? undefined : `0 8px 0 ${th.ink}`,
                    marginRight: j < l.split(" ").length - 1 ? 22 : 0,
                    display: "inline-block",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {sub ? (
        <div
          style={{
            position: "absolute",
            bottom: 44,
            [mirror ? "right" : "left"]: 56,
            background: "#FFFFFF",
            color: th.ink,
            fontWeight: 900,
            fontSize: 40,
            padding: "10px 26px",
            borderRadius: 999,
            boxShadow: "0 8px 0 rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ display: "inline-flex", width: 54, height: 36, borderRadius: 6, overflow: "hidden", marginRight: 16, verticalAlign: "middle", border: "3px solid rgba(0,0,0,0.15)" }}>
            <span style={{ flex: 1, background: "#009246" }} />
            <span style={{ flex: 1, background: "#F1F2F1" }} />
            <span style={{ flex: 1, background: "#CE2B37" }} />
          </span>
          {sub}
        </div>
      ) : null}
      {badge ? (
        <div
          style={{
            position: "absolute",
            top: 28,
            [mirror ? "left" : "right"]: 28,
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: th.accent,
            color: th.ink,
            fontWeight: 900,
            fontSize: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `8px solid ${th.ink}`,
            transform: "rotate(-10deg)",
          }}
        >
          {badge}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
