import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import type { RenderProps } from "../generated";
import { resolveAsset } from "../lib/assets";
import { activeEvent } from "../lib/timeline";
import { bounce } from "./Kit";
import { Mascot, type Emotion } from "./Mascots";

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
    // эмоция по сюжету ролика: таймер — «думает», ответ — удивление, призыв — радость
    const emotion: Emotion = activeEvent(props.timeline, t, "countdown") ? "thinking" : activeEvent(props.timeline, t, "reveal") ? "surprised"
      : activeEvent(props.timeline, t, "cta") ? "happy" : "neutral";
    return (
      <div style={base}>
        <Mascot character={av.character ?? "pizza"} s={{ mouth: m, blink, emotion, t }} height={height} flip={av.position === "bottom_left"} />
      </div>
    );
  }
  return null; // lipsync — рендерится заранее в видео (этап 6, GPU), тогда mode=loop с готовым файлом
};
