/**
 * Вертикальный шортс 1080×1920 из готового эпизода: окно [from, to] перерисовывается из тех же сцен (не кроп видео) —
 * сцена масштабируется по высоте кадра, камера едет за говорящим/действием (shortFocus.ts), герои крупные.
 * Сверху — баннер-хук, значок сериала, под ним субтитры/караоке (низ кадра занят крупными героями и интерфейсом YouTube).
 * Звук — те же стемы эпизода со сдвигом на −from. Детский контент: никаких призывов подписаться.
 */
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { resolveAsset } from "../lib/assets";
import { CAST } from "./cast";
import { actorAt, camAt, isCard, Scene, type CartoonDoc, type Line, type Overlay, type SceneDoc } from "./Episode";
import { candy, INK, Overlays, PLUM, popAt, SeriesBadge, speakerColor } from "./overlays";
import { shade } from "./rig";
import { ShowBumper, ShowIntro, ShowOutro } from "./ShowIntro";
import { audioWindow, focusTarget, panFor, sceneIndexAt, SHORT_H, SHORT_SCALE, SHORT_W, smoothFocus, speakerAt, SRC_H, SRC_W, wrapWords } from "./shortFocus";

export const CARTOON_SHORT_ID = "CartoonShort";

export interface CartoonShortProps {
  doc: CartoonDoc;
  from: number;
  to: number;
  /** Хук в баннере сверху: «Sing along!», «Can you count them?»… */
  title?: string;
  /** Подставляется рендерером (верхний уровень props), иначе — doc.asset_base. */
  asset_base?: string;
}

export const shortFrames = (p: Partial<CartoonShortProps>): number => Math.max(1, Math.round(((p.to ?? 15) - (p.from ?? 0)) * (p.doc?.fps ?? 30)));

/** Нижняя граница текста: выше неё — подписи, ниже — интерфейс YouTube (название, канал, кнопки). */
/** Караоке и субтитры — под баннером, над головами: герои в шортсе крупные, низ кадра занят телами и интерфейсом YouTube. */
const TEXT_TOP = 385;
/** Справа колонка кнопок YouTube (лайк, комментарии) — текст туда не заходит. */
const RIGHT_SAFE = 150;
const XFADE = 0.25;

/** Цель камеры шортса в момент lt сцены: говорящий / группа, в пикселях кадра сцены. */
function rawFocus(sc: SceneDoc, lt: number): number {
  const cam = camAt(sc.camera, lt);
  const people = sc.actors.filter((a) => CAST[a.id]).map((a) => ({ id: a.id, px: SRC_W / 2 + (actorAt(a.keys, lt).x - cam.x) * cam.zoom }));
  return focusTarget(people, speakerAt(sc.lines, lt));
}

/* ------------------------------------------------------------------ подписи */

function ShortKaraoke({ o, lt, fps }: { o: Overlay; lt: number; fps: number }) {
  const words = o.text.split(/\s+/).filter(Boolean);
  const per = o.dur / Math.max(1, words.length + 0.4); // тот же темп, что у караоке эпизода (overlays.tsx → LyricLine)
  const cur = Math.min(words.length - 1, Math.floor(lt / per));
  const p = Math.max(0, Math.min(1, (lt - cur * per) / per));
  const k = popAt(lt, 0, fps, 13, 170);
  const out = interpolate(lt, [o.dur - 0.25, o.dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rows = wrapWords(words, 17);
  const fs = rows.length <= 2 ? 76 : 66;
  const hop = Math.sin(p * Math.PI);
  return (
    <div style={{ position: "absolute", left: 40, right: RIGHT_SAFE, top: TEXT_TOP, display: "flex", justifyContent: "center", opacity: out }}>
      <div
        style={{
          transform: `translateY(${(1 - k) * 90}px) scale(${0.85 + 0.15 * k})`,
          background: "rgba(58,36,102,0.9)",
          border: "7px solid #FFFFFF",
          borderRadius: 56,
          padding: "64px 30px 20px",
          boxShadow: "0 12px 0 rgba(42,27,51,0.4)",
          textAlign: "center",
        }}
      >
        {rows.map((row, r) => (
          <div key={r} style={{ whiteSpace: "nowrap", marginTop: r ? 40 : 0 }}>
            {row.map((j) => {
              const sung = lt >= j * per;
              const active = j === cur && sung;
              const bk = active ? popAt(lt, j * per, fps, 8, 260) : 0;
              return (
                <span key={j} style={{ position: "relative", display: "inline-block", padding: "0 16px" }}>
                  {active ? (
                    <svg viewBox="-24 -24 48 48" width={50} height={50} style={{ position: "absolute", left: "50%", top: -46 - hop * 40, transform: "translateX(-50%)", overflow: "visible" }}>
                      <circle r={20} fill="#FF5A7A" stroke="#FFFFFF" strokeWidth={5} />
                      <circle cx={-6} cy={-7} r={6} fill="#FFFFFF" opacity={0.6} />
                    </svg>
                  ) : null}
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: "Fredoka",
                      fontWeight: 700,
                      fontSize: fs,
                      lineHeight: 1.12,
                      color: active ? "#FFE45C" : sung ? "#FFD0DC" : "#FFFFFF",
                      WebkitTextStroke: active ? `9px ${PLUM}` : "0px transparent",
                      paintOrder: "stroke fill",
                      transform: `scale(${1 + bk * 0.08}) translateY(${-bk * 6}px)`,
                      transformOrigin: "50% 70%",
                    }}
                  >
                    {words[j]}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortCaption({ lines, lt, fps }: { lines: Line[]; lt: number; fps: number }) {
  const l = lines.find((x) => lt >= x.start && lt <= x.start + x.dur);
  if (!l) return null;
  const k = popAt(lt, l.start, fps, 14, 200);
  const c = speakerColor(l.char);
  const name = CAST[l.char]?.name ?? "";
  const fs = l.text.length > 70 ? 46 : 54;
  return (
    <div style={{ position: "absolute", left: 40, right: RIGHT_SAFE, top: TEXT_TOP, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          transform: `translateY(${(1 - k) * 36}px)`,
          opacity: Math.min(1, k * 2),
          background: "rgba(255,255,255,0.96)",
          border: `7px solid ${c}`,
          borderRadius: 44,
          padding: "22px 34px 24px",
          boxShadow: `0 9px 0 ${shade(c, 0.35)}`,
        }}
      >
        {name ? (
          <div style={{ position: "absolute", top: -30, left: 30, background: c, color: "#FFFFFF", fontFamily: "Fredoka", fontWeight: 700, fontSize: 32, lineHeight: 1, padding: "8px 20px 10px", borderRadius: 999, border: "4px solid #FFFFFF" }}>
            {name}
          </div>
        ) : null}
        <div style={{ fontFamily: "Nunito", fontWeight: 800, fontSize: fs, lineHeight: 1.18, color: INK, textAlign: "center" }}>{l.text}</div>
      </div>
    </div>
  );
}

/** Надписи сцены в вертикальной раскладке: карточка слова и «?» — под баннером, караоке/субтитры — внизу над зоной YouTube. */
function ShortOverlays({ sc, lt, fps, captions }: { sc: SceneDoc; lt: number; fps: number; captions: boolean }) {
  const ovs = sc.overlays ?? [];
  const lyric = ovs.find((o) => o.kind === "lyric" && lt >= o.t && lt <= o.t + o.dur);
  const top = ovs.filter((o) => o.kind === "word" || o.kind === "question");
  const box = 0.8; // карточки эпизода свёрстаны под ширину 1920 — уменьшаем, чтобы длинное слово влезло в 1080
  return (
    <>
      {top.length ? (
        <div style={{ position: "absolute", left: 0, top: 600, width: SHORT_W / box, height: 700, transform: `scale(${box})`, transformOrigin: "0 0" }}>
          <Overlays overlays={top} lt={lt} fps={fps} />
        </div>
      ) : null}
      {lyric ? <ShortKaraoke o={lyric} lt={lt - lyric.t} fps={fps} /> : captions && sc.kind !== "song" ? <ShortCaption lines={sc.lines} lt={lt} fps={fps} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ рамка шортса */

/** Баннер-хук: крупные «конфетные» слова в белой подушке; читается уже с кадра 0 (обложка шортса), слова чуть «допрыгивают» и покачиваются. */
function HookBanner({ text, t, fps }: { text: string; t: number; fps: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  const fs = text.length <= 14 ? 104 : text.length <= 22 ? 88 : 74;
  const k = popAt(t, -0.45, fps, 11, 160); // анимация уже «в пути» на кадре 0
  return (
    <div style={{ position: "absolute", top: 150, left: 50, right: 50, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          transform: `scale(${0.75 + 0.25 * k}) rotate(${-1.5 + Math.sin(t * 2.2) * 1.2}deg)`,
          background: "#FFFFFF",
          border: `8px solid ${PLUM}`,
          borderRadius: 64,
          padding: "18px 44px 24px",
          boxShadow: `0 14px 0 ${PLUM}`,
          textAlign: "center",
          lineHeight: 1.04,
          maxWidth: 940,
        }}
      >
        {words.map((w, i) => {
          const d = 0.08 + i * 0.07;
          const wk = popAt(t, d - 0.5, fps, 9, 170);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 12px",
                fontFamily: "Fredoka",
                fontWeight: 700,
                fontSize: fs,
                color: candy(i * 3 + 1),
                WebkitTextStroke: `4px ${PLUM}`,
                paintOrder: "stroke fill",
                transform: `scale(${0.55 + 0.45 * wk}) translateY(${t > d + 0.3 ? Math.sin(t * 3.2 + i * 0.8) * 5 : 0}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Картинка сцены в вертикальном кадре: масштаб по высоте, сдвиг к точке фокуса. */
function ShortScene({ sc, lt, fps, captions }: { sc: SceneDoc; lt: number; fps: number; captions: boolean }) {
  const card = isCard(sc);
  const fx = card ? SRC_W / 2 : smoothFocus((tt) => rawFocus(sc, tt), lt, 0, sc.duration);
  const ti = (sc.overlays ?? []).find((o) => o.kind === "title");
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width: SRC_W, height: SRC_H, overflow: "hidden", transform: `translate(${panFor(fx)}px, 0px) scale(${SHORT_SCALE})`, transformOrigin: "0 0" }}>
        {card ? (
          sc.kind === "intro" ? <ShowIntro t={lt} fps={fps} /> : sc.kind === "outro" ? <ShowOutro t={lt} fps={fps} title={ti?.text} sub={ti?.sub} /> : <ShowBumper t={lt} fps={fps} text={ti?.text} />
        ) : (
          <Scene sc={sc} t={lt} fps={fps} />
        )}
      </div>
      {card ? null : <ShortOverlays sc={sc} lt={lt} fps={fps} captions={captions} />}
    </AbsoluteFill>
  );
}

export function CartoonShort({ doc, from, to, title, asset_base }: CartoonShortProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const st = frame / fps;
  const t = from + st;
  const scenes = doc.scenes;
  const idx = sceneIndexAt(scenes, t);
  const sc = scenes[idx]!;
  const lt = t - sc.start;
  const caps = doc.show_captions !== false;
  const first = sceneIndexAt(scenes, from);
  // смена сцены внутри шортса — мягкая склейка: новая сцена проявляется поверх доигрывающей старой
  const xk = idx > first && lt < XFADE ? lt / XFADE : 1;
  const base = asset_base ?? doc.asset_base;
  const fade = (gf: number) => Math.min(1, gf / (0.12 * fps), (durationInFrames - gf) / (0.35 * fps));
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      {xk < 1 ? <ShortScene sc={scenes[idx - 1]!} lt={scenes[idx - 1]!.duration + lt} fps={fps} captions={caps} /> : null}
      <AbsoluteFill style={{ opacity: xk }}>
        <ShortScene sc={sc} lt={lt} fps={fps} captions={caps} />
      </AbsoluteFill>
      {/* мягкие градиенты: читаемость баннера сверху и подписей YouTube снизу */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 460, background: "linear-gradient(rgba(42,27,51,0.42), rgba(42,27,51,0))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 560, background: "linear-gradient(rgba(42,27,51,0), rgba(42,27,51,0.55))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 40, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 380, height: 52 }}>
          <SeriesBadge t={t} />
        </div>
      </div>
      <HookBanner text={title || doc.title} t={st} fps={fps} />
      {(doc.audio ?? []).map((a, i) => {
        const src = resolveAsset(a.src, base);
        const w = src ? audioWindow(a, from, to, fps) : null;
        if (!src || !w) return null;
        return (
          <Sequence key={i} from={w.from} durationInFrames={w.durationInFrames} layout="none">
            <Audio src={src} trimBefore={w.trimBefore || undefined} loop={a.loop} volume={(f) => (a.volume ?? 1) * Math.max(0, fade(f + w.from))} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export const SHORT_SIZE = { width: SHORT_W, height: SHORT_H };
