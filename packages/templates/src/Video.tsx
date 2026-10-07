import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import type { RenderProps } from "./generated";
import { Background, Bookmark, CtaBubble, HookText, ProgressBar, TitleChip, Watermark } from "./components/Chrome";
import { Sticker } from "./components/Sticker";
import { YtOverlay } from "./components/YtOverlay";
import { resolveAsset } from "./lib/assets";
import { activeEvent } from "./lib/timeline";
import { readableOn } from "./lib/color";
import { FORMAT_COMPONENTS } from "./registry";

const HOOK_Y = 140;
const TITLE_Y = 260;
const CTA_Y = 1580;

/** Общая оболочка всех форматов: фон, хук, заголовок, прогресс, закладка, наклейки, аудио. */
export const ShortVideo: React.FC<RenderProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const { theme, timeline, audio } = props;
  const Body = FORMAT_COMPONENTS[props.format];
  const hookEv = activeEvent(timeline, t, "hook");
  const ctaEv = activeEvent(timeline, t, "cta");
  const voice = resolveAsset(audio.voice_url, props.asset_base);
  const music = resolveAsset(audio.music_url, props.asset_base);
  const endsIn = (durationInFrames - frame) / fps;

  return (
    <AbsoluteFill style={{ fontFamily: theme.font, overflow: "hidden" }}>
      <Background palette={theme.palette} />
      {(theme.stickers ?? []).map((s, i) => (
        <Sticker key={i} s={s} />
      ))}
      {theme.show_progress_bar !== false ? <ProgressBar color={theme.palette.title_bg} /> : null}
      {theme.bookmark?.enabled !== false ? <Bookmark position={theme.bookmark?.position ?? "top_right"} /> : null}
      <HookText text={props.hook_text} palette={theme.palette} font={theme.font} y={HOOK_Y} hookActiveSince={hookEv ? t - hookEv.t_start : null} />
      <TitleChip text={props.title} palette={theme.palette} font={theme.font} y={TITLE_Y} />
      {Body ? <Body props={props} /> : <Unsupported format={props.format} />}
      <CtaBubble text={props.cta_text ?? ""} palette={theme.palette} font={theme.font} since={ctaEv ? t - ctaEv.t_start : null} endsIn={endsIn} y={CTA_Y} />
      <Watermark text={theme.watermark ?? "@ItalianoPerTe"} color={readableOn(theme.palette.bg)} font={theme.font} />
      {props.prev_answer ? <PrevAnswer text={props.prev_answer} font={theme.font} /> : null}
      {voice ? <Audio src={voice} /> : null}
      {music ? <Audio src={music} volume={audio.music_volume ?? 0.08} loop /> : null}
      {(audio.sfx ?? []).map((s, i) => {
        const src = resolveAsset(`/media/sfx/${s.name}.wav`, props.asset_base);
        return src ? (
          <Sequence key={i} from={Math.round(s.t * fps)} layout="none">
            <Audio src={src} volume={s.volume ?? 0.5} />
          </Sequence>
        ) : null;
      })}
      {props.show_yt_overlay ? <YtOverlay /> : null}
    </AbsoluteFill>
  );
};

/** answer_tomorrow: ответ на загадку прошлого эпизода — возвращает зрителей к серии. */
const PrevAnswer: React.FC<{ text: string; font: string }> = ({ text, font }) => (
  <div style={{ position: "absolute", top: 72, left: 300, right: 300, display: "flex", justifyContent: "center" }}>
    <div style={{ background: "#141414", color: "#fff", fontFamily: font, fontWeight: 800, fontSize: 28, borderRadius: 999, padding: "8px 22px", whiteSpace: "nowrap", opacity: 0.92 }}>
      ✅ Risposta di ieri: <span style={{ color: "#FFE600" }}>{text.toLocaleUpperCase("it-IT")}</span>
    </div>
  </div>
);

const Unsupported: React.FC<{ format: string }> = ({ format }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 60, fontWeight: 800 }}>
    Формат «{format}» ещё не реализован
  </AbsoluteFill>
);
