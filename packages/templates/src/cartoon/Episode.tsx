/**
 * Движок мультика: сцена = локация + камера по ключевым кадрам + персонажи с дорожками (позиция, действие, эмоция) + реплики.
 * Рот — по огибающей голоса персонажа (envelope, кадры), без неё — по слогам текста (для черновика без озвучки).
 */
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { resolveAsset } from "../lib/assets";
import { actionPose, type ActionKind } from "./actions";
import { CAST } from "./cast";
import { Character, handPositions, type CEmotion, type Fx, type Pose, type Wear } from "./rig";
import { heldBy, itemAt, type HandOf, type SceneItem } from "./items";
import { Prop } from "./props";
import { locationDef, locationProps } from "./locations";
import type { WorldState } from "./palette";
import { WorldFx } from "./world";
import { LOCATION_CATALOG } from "./catalog";
import { GROUND, type Camera } from "./scenes";
import { Caption, INK, Overlays, SeriesBadge } from "./overlays";
import { ShowBumper, ShowIntro, ShowOutro } from "./ShowIntro";
import { IRIS_CLOSE, inDuration, IrisClose, TransitionIn, transitionFor, type TransitionKind } from "./transitions";

export interface ActorKey {
  t: number; // сек от начала сцены
  x?: number; // позиция по миру (центр кадра 960)
  action?: ActionKind;
  emotion?: CEmotion;
  facing?: 1 | -1;
  hold?: { id: string; color?: string } | null; // null — убрать предмет из рук
  fx?: Fx | null;
}
export interface Line {
  char: string;
  start: number;
  dur: number;
  text: string;
  envelope?: number[]; // громкость по кадрам (30 fps) с начала реплики
}
export interface CamKey {
  t: number;
  x: number;
  y?: number;
  zoom: number;
}
/** Надписи поверх сцены: слово урока, заставка истории, вопрос зрителю, строка песни. */
export interface Overlay {
  t: number;
  dur: number;
  kind: "word" | "title" | "question" | "lyric";
  text: string;
  sub?: string;
}
export interface SceneDoc {
  location: string;
  /**
   * intro / outro — заставка сериала и прощальная карточка; bumper — перебивка «Story time!» / «Song time!» / «Word time!»
   * (текст — из overlay kind "title", иначе «Story time!»). Рисуются вместо локации, см. ShowIntro.tsx.
   */
  kind?: "story" | "song" | "title" | "intro" | "outro" | "bumper";
  /** Переход на входе в сцену; без него — выбирается по типу и номеру сцены (transitions.tsx → transitionFor). */
  transitionIn?: TransitionKind;
  weather?: "rain" | "snow" | "leaves" | null;
  decor?: "birthday" | null;
  props?: { id: string; x: number; color?: string; scale?: number }[];
  overlays?: Overlay[];
  time?: "day" | "evening" | "night";
  /** Сид сцены (хэш проекта + номер сцены): мелочи локации выбираются по нему; 0 — каноническая раскладка. */
  seed?: number;
  /** Предметы с историей: на земле / в руке, передать, бросить, съесть (этап 2). */
  items?: SceneItem[];
  /** Состояние мира (этап 1 расширяет); без него — день, ясно, лето. */
  world?: Partial<WorldState>;
  start: number;
  duration: number;
  camera: CamKey[];
  actors: { id: string; depth?: number; scale?: number; wear?: Wear[]; keys: ActorKey[] }[];
  lines: Line[];
}
export interface AudioTrack {
  src: string;
  start: number;
  volume?: number;
  loop?: boolean;
  dur?: number;
}
export interface CartoonDoc {
  title: string;
  fps: number;
  duration: number;
  scenes: SceneDoc[];
  audio?: AudioTrack[];
  asset_base?: string;
  show_captions?: boolean;
  /** Значок «Benny & Friends» в углу на сюжетных сценах (по умолчанию включён). */
  series_badge?: boolean;
}

const easeIO = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

function camAt(keys: CamKey[], t: number): Camera {
  if (!keys.length) return { x: 960, y: 670, zoom: 1 };
  let a = keys[0]!;
  let b = keys[keys.length - 1]!;
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i]!.t && t <= keys[i + 1]!.t) [a, b] = [keys[i]!, keys[i + 1]!];
  if (t <= keys[0]!.t) b = a;
  const k = b.t > a.t ? easeIO(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))) : 0;
  return { x: a.x + (b.x - a.x) * k, y: (a.y ?? 670) + ((b.y ?? 670) - (a.y ?? 670)) * k, zoom: a.zoom + (b.zoom - a.zoom) * k };
}

/** Состояние актёра: позиция — линейно между ключами с x; действие/эмоция/взгляд — последний ключ до t. */
function actorAt(keys0: ActorKey[], t: number) {
  const keys = [...keys0].sort((a, b) => a.t - b.t); // устойчивая сортировка: при равном t побеждает ключ, записанный позже
  let x = 960;
  let facing: 1 | -1 = 1;
  let action: ActionKind = "idle";
  let emotion: CEmotion = "neutral";
  let since = 0;
  let hold: { id: string; color?: string } | undefined;
  let fx: Fx | undefined;
  let fxAt = -99;
  const xs = keys.filter((k) => k.x !== undefined);
  if (xs.length) {
    x = xs[0]!.x!;
    for (let i = 0; i < xs.length; i++) {
      const a = xs[i]!;
      const b = xs[i + 1];
      if (t >= a.t && (!b || t < b.t)) {
        x = b ? a.x! + (b.x! - a.x!) * Math.min(1, (t - a.t) / Math.max(0.01, b.t - a.t)) : a.x!;
        if (b && b.x !== a.x) facing = b.x! > a.x! ? 1 : -1;
      }
    }
  }
  for (const k of keys) {
    if (k.t > t) break;
    if (k.action) {
      action = k.action;
      since = k.t;
    }
    if (k.emotion) emotion = k.emotion;
    if (k.facing) facing = k.facing;
    if (k.hold !== undefined) hold = k.hold ?? undefined;
    if (k.fx !== undefined) {
      fx = k.fx ?? undefined;
      fxAt = k.t;
    }
  }
  if (t - fxAt > 2.6) fx = undefined; // эффект живёт ~2.5 с
  return { x, facing, action, emotion, tl: t - since, hold, fx };
}

/** Открытость рта: по огибающей голоса или по слогам (≈ 4.5 слога/с). */
function mouthAt(lines: Line[], char: string, t: number, fps: number): number {
  for (const l of lines) {
    if (l.char !== char || t < l.start || t > l.start + l.dur) continue;
    const lt = t - l.start;
    if (l.envelope?.length) return Math.min(1, (l.envelope[Math.floor(lt * fps)] ?? 0) * 2.2);
    const syl = Math.abs(Math.sin(lt * Math.PI * 4.5));
    return lt > l.dur - 0.15 ? 0 : 0.25 + syl * 0.75;
  }
  return 0;
}

function speakingTo(lines: Line[], char: string, t: number): string | null {
  const l = lines.find((x) => t >= x.start && t <= x.start + x.dur && x.char !== char);
  return l ? l.char : null;
}

/** День рождения: флажки-гирлянда и шарики в мире сцены. */
function Birthday({ t }: { t: number }) {
  const colors = ["#FF4D5A", "#FFD23F", "#3D8BFF", "#7BC96F", "#B38BFF"];
  return (
    <g>
      <path d="M-200 220 Q960 380 2120 220" stroke="#8A6A4A" strokeWidth="4" fill="none" />
      {Array.from({ length: 24 }, (_, i) => {
        const x = -150 + i * 95;
        const y = 220 + Math.sin((i / 23) * Math.PI) * 150;
        return <path key={i} d={`M${x - 30} ${y} L${x + 30} ${y} L${x} ${y + 56} Z`} fill={colors[i % 5]} stroke="#FFFFFF" strokeWidth="3" />;
      })}
      {[180, 1740].map((bx, k) => (
        <g key={bx} transform={`translate(${bx} ${GROUND - 60})`}>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${(i - 1) * 46} ${Math.sin(t * 2 + i + k) * 6})`}>
              <path d={`M0 0 q-6 -120 ${(i - 1) * 10} -230`} stroke="#7A6A5A" strokeWidth="3" fill="none" />
              <ellipse cx={(i - 1) * 10} cy={-270} rx={36} ry={44} fill={colors[(i + k) % 5]} stroke="#FFFFFF" strokeWidth="3" />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

/** Мир сцены: новое поле world, либо старые weather/time (листопад = осень с ветром); детская без времени — ночь. */
export function sceneWorld(sc: SceneDoc): WorldState {
  const legacyWeather = sc.weather === "rain" || sc.weather === "snow" ? sc.weather : sc.weather === "leaves" ? "windy" : "clear";
  return {
    time: sc.world?.time ?? sc.time ?? (sc.location === "bedroom" ? "night" : "day"),
    weather: sc.world?.weather ?? legacyWeather,
    season: sc.world?.season ?? (sc.weather === "leaves" ? "autumn" : sc.weather === "snow" ? "winter" : "summer"),
    dressing: sc.world?.dressing ?? sc.decor ?? undefined,
  };
}
const isOutdoor = (loc: string) => LOCATION_CATALOG.find((l) => l.id === loc)?.outdoor ?? true;

const TALL = ["umbrella", "balloon", "kite"];
const NO_HAND: HandOf = () => ({ x: 0, y: 0, scale: 1 });

/** Поза актёра в момент t: действие + «высокий предмет в руке — рука поднята». */
function actorPose(a: SceneDoc["actors"][number], s: ReturnType<typeof actorAt>, t: number, held: string | undefined): Pose {
  const basePose = actionPose(s.action, s.tl, t + a.id.length);
  const tall = TALL.includes(held ?? s.hold?.id ?? "");
  return tall && (s.action === "idle" || s.action === "talk" || s.action === "walk") ? { ...basePose, armR: [150, 12] as [number, number] } : basePose;
}
const actorScale = (a: SceneDoc["actors"][number], adult: boolean) => (a.scale ?? 1) * 1.25 * (adult ? 1.12 : 1);

function Scene({ sc, t, fps }: { sc: SceneDoc; t: number; fps: number }) {
  const cam = camAt(sc.camera, t);
  const actors = sc.actors.map((a) => ({ a, s: actorAt(a.keys, t) }));
  const W = 1920;
  const H = 1080;
  const z = cam.zoom;
  const tf = `translate(${W / 2} ${H * 0.62}) scale(${z}) translate(${-cam.x} ${-cam.y})`;
  const loc = locationDef(sc.location);
  const world = sceneWorld(sc);
  const lp = locationProps(sc.location, cam, t + sc.start, { world, seed: sc.seed ?? 0, uid: `sc${Math.round(sc.start * 1000)}` });
  const held = heldBy(sc.items, t, NO_HAND);
  // кисть героя в мире в любой момент сцены — предметы едут вместе с рукой
  const hand: HandOf = (char, tt) => {
    const a = sc.actors.find((x) => x.id === char);
    const spec = a ? CAST[a.id] : undefined;
    if (!a || !spec) return null;
    const st = actorAt(a.keys, tt);
    const k = actorScale(a, !!spec.adult);
    const r = handPositions(spec, actorPose(a, st, tt, heldBy(sc.items, tt, NO_HAND)[char]), tt + a.id.length).R;
    return { x: st.x + r[0] * k, y: GROUND + (a.depth ?? 0) * 40 + r[1] * k, scale: k };
  };
  const items = (sc.items ?? []).map((it) => ({ it, p: itemAt(it, t, hand) })).filter((x) => x.p);
  const drawItem = ({ it, p }: (typeof items)[number]) => (
    <g key={it.uid} transform={`translate(${p!.x} ${p!.y}) rotate(${p!.rot}) scale(${p!.scale})`} opacity={p!.opacity}>
      <Prop id={it.prop} color={it.color} state={p!.state} t={t} />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <loc.Back {...lp} />
      <g transform={tf}>
        {sc.decor === "birthday" ? <Birthday t={t} /> : null}
        {(sc.props ?? []).map((pr, i) => (
          <g key={i} transform={`translate(${pr.x} ${GROUND + 6}) scale(${pr.scale ?? 1.3})`}>
            <Prop id={pr.id} color={pr.color} t={t} />
          </g>
        ))}
        {items.filter((x) => !x.p!.holder && !x.p!.flying).map(drawItem)}
        {actors
          .sort((p, q) => (p.a.depth ?? 0) - (q.a.depth ?? 0))
          .map(({ a, s }) => {
            const spec = CAST[a.id];
            if (!spec) return null;
            const listener = speakingTo(sc.lines, a.id, t);
            const other = listener ? actors.find((o) => o.a.id === listener) : undefined;
            const lookX = other ? Math.sign(other.s.x - s.x) : 0;
            const blink = (Math.floor((t + a.id.length * 0.7) * 10) % 37) === 0;
            const st = {
              pose: actorPose(a, s, t, held[a.id]),
              emotion: s.emotion,
              mouth: mouthAt(sc.lines, a.id, t, fps),
              blink,
              look: [lookX, 0] as [number, number],
              facing: (other ? (lookX >= 0 ? 1 : -1) : s.facing) as 1 | -1,
              hold: held[a.id] ? undefined : s.hold, // предмет сцены рисуется сам, поверх руки
              wear: a.wear,
              fx: s.fx,
            };
            const sc2 = actorScale(a, !!spec.adult);
            return (
              <g key={a.id} transform={`translate(${s.x} ${GROUND + (a.depth ?? 0) * 40}) scale(${sc2})`}>
                <Character spec={spec} st={st} t={t + a.id.length} />
              </g>
            );
          })}
        {items.filter((x) => x.p!.holder || x.p!.flying).map(drawItem)}
      </g>
      {loc.Front ? <loc.Front {...lp} /> : null}
      <WorldFx world={world} t={t + sc.start} outdoor={isOutdoor(sc.location)} />
    </svg>
  );
}

/** Сцены-карточки сериала (рисуются целиком, без локации). */
const isCard = (sc: SceneDoc) => sc.kind === "intro" || sc.kind === "outro" || sc.kind === "bumper";

/** Слой одной сцены: картинка (локация или заставка сериала) + надписи + субтитры. */
function SceneLayer({ sc, t, fps, captions }: { sc: SceneDoc; t: number; fps: number; captions: boolean }) {
  if (isCard(sc)) {
    const ti = (sc.overlays ?? []).find((o) => o.kind === "title");
    return (
      <AbsoluteFill>
        {sc.kind === "intro" ? <ShowIntro t={t} fps={fps} /> : sc.kind === "outro" ? <ShowOutro t={t} fps={fps} title={ti?.text} sub={ti?.sub} /> : <ShowBumper t={t} fps={fps} text={ti?.text} />}
        <Overlays overlays={sc.overlays} lt={t} fps={fps} skipTitle />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Scene sc={sc} t={t} fps={fps} />
      <Overlays overlays={sc.overlays} lt={t} fps={fps} />
      <Caption lines={sc.lines} lt={t} fps={fps} hidden={!captions || sc.kind === "song"} />
    </AbsoluteFill>
  );
}

/** Точка фокуса перехода (iris/звезда) в пикселях кадра: лицо последнего говорящего, иначе первого героя. */
function focusPoint(sc: SceneDoc, t: number): [number, number] {
  if (isCard(sc) || !sc.actors.length) return [960, 520];
  const spoke = [...sc.lines].reverse().find((l) => l.start <= t);
  const a = sc.actors.find((x) => x.id === spoke?.char && CAST[x.id]) ?? sc.actors.find((x) => CAST[x.id]);
  if (!a) return [960, 520];
  const cam = camAt(sc.camera, t);
  const s = actorAt(a.keys, t);
  const scale = (a.scale ?? 1) * 1.25 * (CAST[a.id]?.adult ? 1.12 : 1);
  const x = 960 + (s.x - cam.x) * cam.zoom;
  const y = 1080 * 0.62 + (GROUND + (a.depth ?? 0) * 40 - 210 * scale - cam.y) * cam.zoom;
  return [Math.max(260, Math.min(1660, x)), Math.max(220, Math.min(820, y))];
}

export function CartoonEpisode(doc: CartoonDoc) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scenes = doc.scenes;
  let idx = scenes.findIndex((s) => t >= s.start && t < s.start + s.duration);
  if (idx < 0) idx = t < (scenes[0]?.start ?? 0) ? 0 : scenes.length - 1;
  const sc = scenes[idx]!;
  const lt = t - sc.start;
  const caps = doc.show_captions !== false;
  const layer = (i: number, at: number) => <SceneLayer sc={scenes[i]!} t={at} fps={fps} captions={caps} />;
  // переход на входе: входящая сцена проявляется поверх уходящей (та доигрывает за своим концом)
  const kin = transitionFor(scenes, idx);
  const din = inDuration(kin, sc.duration);
  const kout = idx + 1 < scenes.length ? transitionFor(scenes, idx + 1) : null;
  const close = Math.min(IRIS_CLOSE, sc.duration * 0.35);
  let body;
  if (idx > 0 && kin !== "cut" && lt < din) {
    const prev = scenes[idx - 1]!;
    const [fx, fy] = focusPoint(sc, lt);
    body = <TransitionIn kind={kin} p={lt / din} index={idx} fx={fx} fy={fy} t={t} outgoing={kin === "iris" ? null : layer(idx - 1, prev.duration + lt)} incoming={layer(idx, lt)} />;
  } else if (kout === "iris" && lt > sc.duration - close) {
    const [fx, fy] = focusPoint(sc, lt);
    body = (
      <IrisClose p={(lt - (sc.duration - close)) / close} fx={fx} fy={fy} t={t}>
        {layer(idx, lt)}
      </IrisClose>
    );
  } else body = layer(idx, lt);
  // начало эпизода — из «чернил» (если первая сцена не заставка), конец — мягко в «чернила»
  const fadeIn = idx === 0 && kin === "fade" ? interpolate(lt, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const fadeOut = idx === scenes.length - 1 ? interpolate(lt, [sc.duration - 0.45, sc.duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        {body}
        {doc.series_badge !== false && !isCard(sc) ? (
          <AbsoluteFill style={{ opacity: idx > 0 && isCard(scenes[idx - 1]!) && din > 0 ? Math.min(1, lt / din) : 1 }}>
            <SeriesBadge t={t} />
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
      {(doc.audio ?? []).map((a, i) => {
        const src = resolveAsset(a.src, doc.asset_base);
        if (!src) return null;
        const from = Math.round(a.start * fps);
        const dur = a.dur ? Math.max(1, Math.round(a.dur * fps)) : undefined;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Audio src={src} volume={a.volume ?? 1} loop={a.loop} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** Демо: 15 секунд — проверка, что это «живой» мультик, а не говорящая картинка. */
export const DEMO_CARTOON: CartoonDoc = {
  title: "Demo",
  fps: 30,
  duration: 15,
  scenes: [
    {
      location: "garden",
      start: 0,
      duration: 15,
      camera: [
        { t: 0, x: 960, zoom: 1 },
        { t: 3.5, x: 960, zoom: 1 },
        { t: 5, x: 1020, zoom: 1.35 },
        { t: 9, x: 1050, zoom: 1.35 },
        { t: 10.5, x: 1100, zoom: 1.05 },
        { t: 15, x: 1120, zoom: 1.08 },
      ],
      actors: [
        { id: "benny", keys: [{ t: 0, x: -150, action: "walk", emotion: "happy" }, { t: 3.2, x: 760, action: "idle" }, { t: 3.4, action: "wave", emotion: "happy" }, { t: 5.6, action: "talk" }, { t: 9, action: "dance", emotion: "laugh" }, { t: 12, action: "cheer" }] },
        { id: "mia", keys: [{ t: 0, x: 1220, action: "idle", emotion: "neutral", facing: -1 }, { t: 4.2, emotion: "surprised" }, { t: 5.2, action: "jump", emotion: "happy" }, { t: 6.8, action: "talk" }, { t: 9, action: "clap", emotion: "laugh" }, { t: 12, action: "cheer" }] },
        { id: "ollie", depth: 0.5, keys: [{ t: 0, x: 2300 }, { t: 10, x: 2300, action: "run", emotion: "happy" }, { t: 11.8, x: 1500, action: "wave" }, { t: 13, action: "dance", emotion: "laugh" }] },
      ],
      lines: [
        { char: "benny", start: 3.4, dur: 1.4, text: "Hi, Mia!" },
        { char: "mia", start: 5.0, dur: 1.6, text: "Benny! Hello!" },
        { char: "benny", start: 6.8, dur: 2.0, text: "Let's play in the garden!" },
        { char: "mia", start: 9.1, dur: 1.4, text: "Yay! Hooray!" },
        { char: "ollie", start: 11.6, dur: 1.8, text: "Wait for me!" },
      ],
    },
  ],
};
