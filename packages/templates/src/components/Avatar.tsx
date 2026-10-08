import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import type { RenderProps } from "../generated";
import { resolveAsset } from "../lib/assets";
import { activeEvent } from "../lib/timeline";
import { bounce } from "./Kit";

/** Рот по RMS-огибающей голоса: 0 закрыт, 1 полуоткрыт, 2 открыт. */
export function mouthState(envelope: number[], frame: number): 0 | 1 | 2 {
  const v = envelope[frame] ?? 0;
  const prev = envelope[frame - 1] ?? 0;
  const e = Math.max(v, prev * 0.7); // сглаживание, чтобы рот не дёргался через кадр
  return e < 0.12 ? 0 : e < 0.45 ? 1 : 2;
}

/** Моргание: детерминированно раз в ~3.3 с на 4 кадра. */
export const blinking = (frame: number, fps: number): boolean => frame % Math.round(fps * 3.3) < 4;

const H = 330; // нижняя полоса кадра (зона подписи YouTube) — ведущая не перекрывает контент ни одного формата

export const Avatar: React.FC<{ props: RenderProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const av = props.avatar;
  if (!av || av.mode === "none") return null;
  const height = Math.min(av.height ?? H, H);
  const side = av.position === "bottom_left" ? { left: 30 } : { right: 160 };
  const t = frame / fps;
  const hi = activeEvent(props.timeline, t, "highlight") ?? activeEvent(props.timeline, t, "word");
  const hop = hi ? bounce(t - hi.t_start, fps) : 1;
  const base: React.CSSProperties = { position: "absolute", bottom: 14, height, ...side, transformOrigin: "bottom center", transform: `scale(${hop})` };

  if (av.mode === "loop" && av.src) {
    const src = resolveAsset(av.src, props.asset_base);
    return src ? <Video src={src} loop muted style={{ ...base, width: "auto" }} /> : null;
  }
  if (av.mode === "mascot") {
    const m = mouthState(props.audio.envelope ?? [], frame);
    const blink = blinking(frame, fps);
    if (av.src && av.src.includes("{mouth}")) {
      // свои PNG-спрайты: путь с {mouth} → 0/1/2
      const src = resolveAsset(av.src.replace("{mouth}", String(m)), props.asset_base);
      return src ? <Img src={src} style={{ ...base, width: "auto" }} /> : null;
    }
    return (
      <div style={base}>
        <PizzaMascot mouth={m} blink={blink} size={height} />
      </div>
    );
  }
  return null; // lipsync — рендерится заранее в видео (этап 6, GPU), тогда mode=loop с готовым файлом
};

/** Маскот канала: кусочек пиццы с итальянским флажком. Собственная отрисовка (без внешних лицензий). */
export const PizzaMascot: React.FC<{ mouth: 0 | 1 | 2; blink: boolean; size: number }> = ({ mouth, blink, size }) => (
  <svg width={size * 0.85} height={size} viewBox="0 0 170 200" style={{ filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.2))" }}>
    {/* корж и сыр */}
    <path d="M85 196 L10 40 Q85 6 160 40 Z" fill="#FFC857" stroke="#7A3E00" strokeWidth="5" strokeLinejoin="round" />
    <path d="M10 40 Q85 6 160 40 L152 58 Q85 26 18 58 Z" fill="#D9822B" stroke="#7A3E00" strokeWidth="5" strokeLinejoin="round" />
    {/* салями */}
    <circle cx="52" cy="78" r="11" fill="#E3412E" />
    <circle cx="122" cy="84" r="10" fill="#E3412E" />
    <circle cx="96" cy="150" r="8" fill="#E3412E" />
    {/* глаза */}
    {blink ? (
      <>
        <path d="M62 102 q10 6 20 0" stroke="#2B1206" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M92 102 q10 6 20 0" stroke="#2B1206" strokeWidth="5" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <ellipse cx="72" cy="100" rx="9" ry="11" fill="#fff" />
        <ellipse cx="102" cy="100" rx="9" ry="11" fill="#fff" />
        <circle cx="74" cy="102" r="5" fill="#2B1206" />
        <circle cx="104" cy="102" r="5" fill="#2B1206" />
      </>
    )}
    {/* рот: 0 закрыт, 1 полуоткрыт, 2 открыт */}
    {mouth === 0 ? (
      <path d="M72 126 q15 10 30 0" stroke="#2B1206" strokeWidth="5" fill="none" strokeLinecap="round" />
    ) : (
      <ellipse cx="87" cy="128" rx={mouth === 1 ? 11 : 14} ry={mouth === 1 ? 6 : 12} fill="#7A1020" stroke="#2B1206" strokeWidth="4" />
    )}
    {/* щёчки и флажок */}
    <circle cx="58" cy="118" r="6" fill="#FF8FB1" opacity="0.7" />
    <circle cx="116" cy="118" r="6" fill="#FF8FB1" opacity="0.7" />
    <g transform="translate(128 0)">
      <rect x="0" y="0" width="4" height="40" fill="#7A3E00" />
      <rect x="4" y="2" width="10" height="16" fill="#009246" />
      <rect x="14" y="2" width="10" height="16" fill="#F1F2F1" />
      <rect x="24" y="2" width="10" height="16" fill="#CE2B37" />
    </g>
  </svg>
);
