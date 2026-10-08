import { AbsoluteFill, Img, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio, Video } from "@remotion/media";
import type { Clip, Palette, TimelineDoc } from "../generated";
import { resolveAsset } from "../lib/assets";
import { blinking, mouthState } from "../components/Avatar";
import { Mascot, type Emotion } from "../components/Mascots";
import { Sticker } from "../components/Sticker";
import { ShortVideo } from "../Video";
import { Slide } from "./Slide";
import type { AudioProps, MascotProps, MediaProps, ShapeProps, ShortClipProps, SlideProps, StickerProps, SubtitleProps, TextProps } from "./types";
import { DEFAULT_PALETTE } from "./types";

const ANIM = 0.35; // сек на появление/исчезновение

function animStyle(kind: string | undefined, p: number, W: number, H: number): { opacity: number; transform: string } {
  // p: 0 → скрыт, 1 → на месте
  switch (kind) {
    case "fade":
      return { opacity: p, transform: "" };
    case "pop":
      return { opacity: Math.min(1, p * 2), transform: `scale(${0.6 + 0.4 * p})` };
    case "zoom":
      return { opacity: p, transform: `scale(${1.25 - 0.25 * p})` };
    case "slide_up":
      return { opacity: p, transform: `translateY(${(1 - p) * H * 0.06}px)` };
    case "slide_left":
      return { opacity: p, transform: `translateX(${(1 - p) * W * 0.06}px)` };
    default:
      return { opacity: 1, transform: "" };
  }
}

/** Один клип: геометрия (доли холста) + анимация входа/выхода. Рендерится внутри Sequence, поэтому frame — от начала клипа. */
function ClipBox({ clip, doc }: { clip: Clip; doc: TimelineDoc }) {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const pin = interpolate(t, [0, ANIM], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - (1 - x) ** 3 });
  const pout = interpolate(t, [clip.duration - ANIM, clip.duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const a = animStyle(clip.anim_in, pin, W, H);
  const b = animStyle(clip.anim_out, pout, W, H);
  const x = (clip.x ?? 0) * W;
  const y = (clip.y ?? 0) * H;
  const w = (clip.w ?? 1) * W;
  const h = (clip.h ?? 1) * H;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: (clip.opacity ?? 1) * a.opacity * b.opacity,
        transform: `rotate(${clip.rotation ?? 0}deg) ${a.transform} ${b.transform}`,
        transformOrigin: "center center",
      }}
    >
      <ClipContent clip={clip} doc={doc} w={w} h={h} t={t} />
    </div>
  );
}

function ClipContent({ clip, doc, w, h, t }: { clip: Clip; doc: TimelineDoc; w: number; h: number; t: number }) {
  const { fps } = useVideoConfig();
  const pal = { ...DEFAULT_PALETTE, ...((doc.palette ?? {}) as Partial<Palette>) } as Palette;
  const font = doc.font ?? "Montserrat";
  const k = useVideoConfig().height / 1080;
  const p = clip.props ?? {};
  switch (clip.type) {
    case "slide":
      return <Slide p={p as unknown as SlideProps} pal={pal} font={font} w={w} h={h} />;
    case "short": {
      const rp = (p as unknown as ShortClipProps).render_props;
      // шортс 1080×1920 вписываем в бокс клипа
      const s = Math.min(w / rp.canvas.w, h / rp.canvas.h);
      return (
        <div style={{ width: rp.canvas.w, height: rp.canvas.h, transform: `scale(${s})`, transformOrigin: "top left", position: "relative" }}>
          <ShortVideo {...rp} asset_base={doc.asset_base ?? rp.asset_base} />
        </div>
      );
    }
    case "text": {
      const tp = p as unknown as TextProps;
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: tp.align === "left" ? "flex-start" : tp.align === "right" ? "flex-end" : "center",
            textAlign: tp.align ?? "center",
            fontFamily: tp.font ?? font,
            fontWeight: tp.weight ?? 800,
            fontSize: (tp.size ?? 64) * k,
            color: tp.color ?? "#FFFFFF",
            background: tp.bg ?? "transparent",
            borderRadius: (tp.radius ?? 24) * k,
            padding: tp.bg ? `${10 * k}px ${24 * k}px` : 0,
            WebkitTextStroke: tp.stroke ? `${Math.max(2, ((tp.size ?? 64) * k) / 9)}px ${tp.stroke}` : undefined,
            paintOrder: "stroke fill",
            lineHeight: 1.15,
            whiteSpace: "pre-wrap",
          }}
        >
          {tp.text}
        </div>
      );
    }
    case "subtitle":
      return <Subtitle p={p as unknown as SubtitleProps} doc={doc} t={t} />;
    case "mascot": {
      const mp = p as unknown as MascotProps;
      const g = Math.round((clip.start + t) * fps); // глобальный кадр — для огибающей голоса
      const mouth = mp.talk === false ? 0 : mouthState(doc.envelope ?? [], g);
      const emotion: Emotion = !mp.emotion || mp.emotion === "auto" ? (mouth ? "neutral" : "happy") : mp.emotion;
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <Mascot character={mp.character} height={h} flip={mp.flip} s={{ mouth, blink: blinking(g, fps), emotion, t: clip.start + t }} />
        </div>
      );
    }
    case "sticker":
      return <Sticker s={{ name: (p as unknown as StickerProps).name, x: 0, y: 0, size: Math.min(w, h), rotate: 0 }} />;
    case "image": {
      const mp = p as unknown as MediaProps;
      const src = resolveAsset(mp.src, doc.asset_base);
      return src ? <Img src={src} style={{ width: "100%", height: "100%", objectFit: mp.fit ?? "contain" }} /> : null;
    }
    case "video": {
      const mp = p as unknown as MediaProps;
      const src = resolveAsset(mp.src, doc.asset_base);
      return src ? (
        <Video src={src} trimBefore={Math.round((clip.trim ?? 0) * fps)} volume={mp.muted ? 0 : (mp.volume ?? 1)} loop={mp.loop} style={{ width: "100%", height: "100%", objectFit: mp.fit ?? "cover" }} />
      ) : null;
    }
    case "shape": {
      const sp = p as unknown as ShapeProps;
      return <div style={{ width: "100%", height: "100%", background: sp.fill ?? "rgba(0,0,0,0.5)", borderRadius: (sp.radius ?? 24) * k, border: sp.stroke ? `${4 * k}px solid ${sp.stroke}` : undefined }} />;
    }
    default:
      return null;
  }
}

/** Субтитры: итальянский (караоке по словам) + перевод. Стиль — общий для документа. */
function Subtitle({ p, doc, t }: { p: SubtitleProps; doc: TimelineDoc; t: number }) {
  const { width: W, height: H } = useVideoConfig();
  const st = doc.subtitle_style ?? {};
  const k = H / 1080;
  const size = (st.size ?? 46) * k * (H > W ? 1.15 : 1);
  const words = p.text.split(/\s+/).filter(Boolean);
  const karaoke = st.highlight_words !== false && p.words && p.words.length === words.length;
  return (
    <div style={{ position: "absolute", left: W * 0.06, right: W * 0.06, top: (st.y ?? 0.88) * H, transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 * k }}>
      <div style={{ background: st.bg ?? "rgba(0,0,0,0.6)", color: st.color ?? "#fff", fontFamily: doc.font ?? "Montserrat", fontWeight: 800, fontSize: size, padding: `${8 * k}px ${22 * k}px`, borderRadius: 16 * k, textAlign: "center", lineHeight: 1.25 }}>
        {karaoke
          ? words.map((wd, i) => {
              const [ws, wdur] = p.words![i]!;
              const on = t >= ws && t < ws + wdur;
              const done = t >= ws + wdur;
              return (
                <span key={i} style={{ color: on ? "#FFE600" : done ? (st.color ?? "#fff") : "rgba(255,255,255,0.75)", display: "inline-block", transform: `scale(${on ? 1.08 : 1})`, margin: `0 ${6 * k}px` }}>
                  {wd}
                </span>
              );
            })
          : p.text}
      </div>
      {st.show_translation !== false && p.tr ? (
        <div style={{ background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.9)", fontFamily: doc.font ?? "Montserrat", fontWeight: 700, fontSize: size * 0.66, padding: `${4 * k}px ${16 * k}px`, borderRadius: 12 * k, textAlign: "center" }}>
          {p.tr}
        </div>
      ) : null}
    </div>
  );
}

function AudioClip({ clip, doc }: { clip: Clip; doc: TimelineDoc }) {
  const { fps } = useVideoConfig();
  const ap = clip.props as unknown as AudioProps;
  const src = resolveAsset(ap.src, doc.asset_base);
  if (!src) return null;
  const vol = ap.volume ?? 1;
  const fi = ap.fade_in ?? 0;
  const fo = ap.fade_out ?? 0;
  const total = clip.duration * fps;
  return (
    <Audio
      src={src}
      trimBefore={Math.round((clip.trim ?? 0) * fps)}
      loop={ap.loop}
      volume={(f) => {
        const a = fi > 0 ? Math.min(1, f / (fi * fps)) : 1;
        const b = fo > 0 ? Math.min(1, (total - f) / (fo * fps)) : 1;
        return vol * Math.max(0, Math.min(a, b));
      }}
    />
  );
}

/** Композиция проекта-таймлайна. Дорожки рисуются по порядку: первая — самая нижняя. */
export const TimelineVideo: React.FC<TimelineDoc> = (doc) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: doc.background ?? "#1B1035", overflow: "hidden" }}>
      {doc.tracks.map((tr) =>
        tr.hidden
          ? null
          : tr.clips.map((c) => {
              const from = Math.round(c.start * fps);
              const dur = Math.max(1, Math.round(c.duration * fps));
              if (c.type === "audio") {
                return tr.muted ? null : (
                  <Sequence key={c.id} from={from} durationInFrames={dur} layout="none">
                    <AudioClip clip={c} doc={doc} />
                  </Sequence>
                );
              }
              return (
                <Sequence key={c.id} from={from} durationInFrames={dur}>
                  <ClipBox clip={c} doc={doc} />
                </Sequence>
              );
            }),
      )}
    </AbsoluteFill>
  );
};
