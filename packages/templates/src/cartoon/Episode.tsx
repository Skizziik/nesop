/**
 * Движок мультика: сцена = локация + камера по ключевым кадрам + персонажи с дорожками (позиция, действие, эмоция) + реплики.
 * Рот — по огибающей голоса персонажа (envelope, кадры), без неё — по слогам текста (для черновика без озвучки).
 */
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { resolveAsset } from "../lib/assets";
import { actionPose, type ActionKind } from "./actions";
import { CAST } from "./cast";
import { Character, type CEmotion } from "./rig";
import { LOCATIONS } from "./locations";
import { GROUND, type Camera } from "./scenes";

export interface ActorKey {
  t: number; // сек от начала сцены
  x?: number; // позиция по миру (центр кадра 960)
  action?: ActionKind;
  emotion?: CEmotion;
  facing?: 1 | -1;
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
  kind?: "story" | "song" | "title";
  overlays?: Overlay[];
  time?: "day" | "evening";
  start: number;
  duration: number;
  camera: CamKey[];
  actors: { id: string; depth?: number; scale?: number; keys: ActorKey[] }[];
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
function actorAt(keys: ActorKey[], t: number) {
  let x = 960;
  let facing: 1 | -1 = 1;
  let action: ActionKind = "idle";
  let emotion: CEmotion = "neutral";
  let since = 0;
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
  }
  return { x, facing, action, emotion, tl: t - since };
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

function Scene({ sc, t, fps }: { sc: SceneDoc; t: number; fps: number }) {
  const cam = camAt(sc.camera, t);
  const actors = sc.actors.map((a) => ({ a, s: actorAt(a.keys, t) }));
  const W = 1920;
  const H = 1080;
  const z = cam.zoom;
  const tf = `translate(${W / 2} ${H * 0.62}) scale(${z}) translate(${-cam.x} ${-cam.y})`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {(LOCATIONS[sc.location] ?? LOCATIONS.garden!).Back({ cam, t: t + sc.start })}
      <g transform={tf}>
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
              pose: actionPose(s.action, s.tl, t + a.id.length),
              emotion: s.emotion,
              mouth: mouthAt(sc.lines, a.id, t, fps),
              blink,
              look: [lookX, 0] as [number, number],
              facing: (other ? (lookX >= 0 ? 1 : -1) : s.facing) as 1 | -1,
            };
            const sc2 = (a.scale ?? 1) * 1.25 * (spec.adult ? 1.12 : 1);
            return (
              <g key={a.id} transform={`translate(${s.x} ${GROUND + (a.depth ?? 0) * 40}) scale(${sc2})`}>
                <Character spec={spec} st={st} t={t + a.id.length} />
              </g>
            );
          })}
      </g>
      {(LOCATIONS[sc.location] ?? LOCATIONS.garden!).Front?.({ cam, t: t + sc.start })}
    </svg>
  );
}

function pop(frame: number, fps: number) {
  return spring({ frame, fps, config: { damping: 11, stiffness: 170 } });
}

/** Надписи: карточка слова (крупно, с подпрыгиванием), заставка истории, «?» для зрителя, караоке песни. */
function Overlays({ sc, t, fps }: { sc: SceneDoc; t: number; fps: number }) {
  return (
    <>
      {(sc.overlays ?? [])
        .filter((o) => t >= o.t && t <= o.t + o.dur)
        .map((o, i) => {
          const lt = t - o.t;
          const k = pop(Math.round(lt * fps), fps);
          const outK = interpolate(lt, [o.dur - 0.3, o.dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (o.kind === "word")
            return (
              <div key={i} style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: outK }}>
                <div style={{ transform: `scale(${k}) rotate(${-3 + Math.sin(lt * 3) * 2}deg)`, background: "#FFFFFF", border: "10px solid #FFB23F", borderRadius: 40, padding: "18px 56px", boxShadow: "0 14px 0 rgba(0,0,0,0.18)", fontFamily: "Fredoka", fontWeight: 700, fontSize: 120, color: "#3A2A66", letterSpacing: 2 }}>
                  {o.text}
                </div>
              </div>
            );
          if (o.kind === "title")
            return (
              <AbsoluteFill key={i} style={{ justifyContent: "center", alignItems: "center", opacity: outK }}>
                <div style={{ transform: `scale(${k})`, textAlign: "center", fontFamily: "Fredoka", fontWeight: 700, color: "#FFFFFF", WebkitTextStroke: "14px #3A2A66", paintOrder: "stroke fill", fontSize: 140, lineHeight: 1.05, textShadow: "0 12px 0 #3A2A66" }}>
                  {o.text}
                  {o.sub ? <div style={{ fontSize: 60, WebkitTextStroke: "10px #3A2A66", marginTop: 16, color: "#FFE45C" }}>{o.sub}</div> : null}
                </div>
              </AbsoluteFill>
            );
          if (o.kind === "question")
            return (
              <div key={i} style={{ position: "absolute", top: 90, right: 120, transform: `scale(${k * (1 + Math.sin(lt * 6) * 0.06)})`, width: 230, height: 230, borderRadius: "50%", background: "#FFE45C", border: "12px solid #3A2A66", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fredoka", fontWeight: 700, fontSize: 170, color: "#3A2A66" }}>
                ?
              </div>
            );
          // строка песни: слова подсвечиваются по очереди (караоке)
          const words = o.text.split(" ");
          const per = o.dur / Math.max(1, words.length);
          return (
            <div key={i} style={{ position: "absolute", bottom: 70, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: outK }}>
              <div style={{ background: "rgba(58,42,102,0.82)", borderRadius: 36, padding: "16px 40px", fontFamily: "Fredoka", fontWeight: 700, fontSize: 76, color: "#FFFFFF" }}>
                {words.map((w, j) => (
                  <span key={j} style={{ color: lt >= j * per ? "#FFE45C" : "#FFFFFF", display: "inline-block", transform: `translateY(${lt >= j * per && lt < (j + 1) * per ? -8 : 0}px)`, marginRight: 20 }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
}

/** Субтитр снизу: кто говорит и что (дети 2-5 не читают, но родителям и для ESL удобно; ключевые слова — крупно). */
function Caption({ sc, t }: { sc: SceneDoc; t: number }) {
  if (sc.kind === "song") return null;
  const l = sc.lines.find((x) => t >= x.start && t <= x.start + x.dur);
  if (!l) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 46, display: "flex", justifyContent: "center" }}>
      <div style={{ fontFamily: "Fredoka", fontWeight: 700, fontSize: 46, color: "#fff", background: "rgba(30,20,50,0.55)", padding: "8px 26px", borderRadius: 22 }}>{l.text}</div>
    </div>
  );
}

export function CartoonEpisode(doc: CartoonDoc) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const sc = doc.scenes.find((s) => t >= s.start && t < s.start + s.duration) ?? doc.scenes[doc.scenes.length - 1]!;
  const lt = t - sc.start;
  const fade = interpolate(lt, [0, 0.35, sc.duration - 0.35, sc.duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fade }}>
        <Scene sc={sc} t={lt} fps={fps} />
        <Overlays sc={sc} t={lt} fps={fps} />
        {doc.show_captions !== false ? <Caption sc={sc} t={lt} /> : null}
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
