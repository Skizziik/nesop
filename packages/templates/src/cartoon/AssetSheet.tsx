/**
 * Лист ассетов (docs/cartoon-visual-variety.md, «Как добавляется ассет»): каждый ассет каталога рядом с героем для масштаба —
 * локации с героем, предметы в руке или на земле, костюмы на всех героях, эффекты, действия, эмоции;
 * walk / walk_left — цикл шага в 8 фазах (вправо / влево) для всех героев, faces — крупные мордочки во всех эмоциях и ракурсах,
 * visemes — формы рта липсинка (X A B C D E F G H) и они же с эмоциями, в 3/4 и в профиле.
 * Режим only — один ассет на маленьком холсте (превью для страницы «Каталог» в дашборде).
 */
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { actionPose, ACTION_IDS, type ActionKind } from "./actions";
import { CAST } from "./cast";
import { EMOTION_CATALOG, FX_CATALOG, LOCATION_CATALOG, OUTFIT_CATALOG, PROP_CATALOG, CHARACTERS } from "./catalog";
import { locationDef, locationProps } from "./locations";
import { DEFAULT_WORLD, type WorldState } from "./palette";
import { Prop, PROP_STATES } from "./props";
import { Character, REST, type CEmotion, type CharState, type Fx, type Wear } from "./rig";
import { GROUND } from "./scenes";
import { VISEMES, type Viseme } from "./lipsync";

export const ASSET_SHEET_ID = "AssetSheet";
export const SHEET_KINDS = ["locations", "props", "outfits", "fx", "actions", "characters", "walk", "walk_left", "faces", "visemes", "states"] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

export interface AssetSheetProps {
  kind: SheetKind;
  only?: string; // один ассет (превью); для outfits/characters — id костюма/героя
  seed?: number;
  world?: Partial<WorldState>;
}

const BG = "#F4F1FA";
const INK = "#2A1B33";
const TALL = ["umbrella", "balloon", "kite"];

function state(over: Partial<CharState> = {}): CharState {
  return { pose: REST, emotion: "happy", mouth: 0, blink: false, look: [0, 0], facing: 1, autoBlink: false, ...over };
}

/** Герой в клетке: ступни в (0,0), viewBox подобран под рост ребёнка с ушами и предмет рядом. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="-320 -640 640 700" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <ellipse cx={0} cy={8} rx={250} ry={22} fill="#E3DDEE" />
      {children}
    </svg>
  );
}

function Hero({ id = "benny", st, t, x = 0 }: { id?: string; st: CharState; t: number; x?: number }) {
  const spec = CAST[id]!;
  const s = 1.25 * (spec.adult ? 0.95 : 1);
  return (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <Character spec={spec} st={st} t={t} />
    </g>
  );
}

function Cell({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#FFFFFF", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 0 #E3DDEE" }}>
      <div style={{ flex: 1, width: "100%", minHeight: 0 }}>{children}</div>
      <div style={{ font: "700 20px/1.1 Nunito, Arial, sans-serif", color: INK, padding: "4px 6px 0", textAlign: "center" }}>{label}</div>
      <div style={{ font: "500 14px/1.2 monospace", color: "#7A6E8A", paddingBottom: 6 }}>{sub ?? ""}</div>
    </div>
  );
}

function LocationCell({ id, t, seed, world }: { id: string; t: number; seed: number; world: WorldState }) {
  const loc = locationDef(id);
  const cam = { x: 960, y: 1080 * 0.62, zoom: 1 };
  const lp = locationProps(id, cam, t, { world, seed, uid: `sheet-${id}-${seed}` });
  return (
    <svg viewBox="0 0 1920 1080" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <loc.Back {...lp} />
      <g transform={`translate(960 ${GROUND}) scale(1.25)`}>
        <Character spec={CAST.benny!} st={state({ pose: actionPose("wave", 1, t) })} t={t} />
      </g>
      {loc.Front ? <loc.Front {...lp} /> : null}
    </svg>
  );
}

function PropCell({ id, t }: { id: string; t: number }) {
  const entry = PROP_CATALOG.find((p) => p.id === id);
  if (entry?.ground)
    return (
      <Stage>
        <Hero st={state({ pose: actionPose("point", 1, t) })} t={t} x={-120} />
        <g transform="translate(120 6) scale(1.3)">
          <Prop id={id} t={t} />
        </g>
      </Stage>
    );
  const tall = TALL.includes(id);
  return (
    <Stage>
      <Hero st={state({ hold: { id }, pose: tall ? { ...REST, armR: [150, 12] } : REST })} t={t} />
    </Stage>
  );
}

function OutfitCell({ id, t, char }: { id: string; t: number; char?: string }) {
  const chars = char ? [char] : ["benny", "mia", "ollie", "dot"];
  const step = 600 / chars.length;
  return (
    <svg viewBox={`${-300 * Math.max(1, chars.length / 1.6)} -640 ${600 * Math.max(1, chars.length / 1.6)} 700`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {chars.map((c, i) => (
        <Hero key={c} id={c} st={state({ wear: id === "none" ? [] : [id as Wear] })} t={t + i} x={chars.length === 1 ? 0 : (i - (chars.length - 1) / 2) * step * Math.max(1, chars.length / 1.6)} />
      ))}
    </svg>
  );
}

const ACTION_T: Partial<Record<ActionKind, number>> = { jump: 0.4, wave: 0.6, cheer: 0.5, shrug: 0.3, bow: 0.6, clap: 0.43, dance: 0.3, nod: 0.22, shake_head: 0.17, yawn: 0.9, stretch: 1, spin: 0.3, hop: 0.35, high_five: 0.45, cover_eyes: 0.5, throw: 0.3, catch: 0.22, eat: 0.5, pick_up: 0.3, put_down: 0.9, give: 0.8, wiggle: 0.17 };

/** Содержимое одной клетки по виду листа. */
function item(kind: SheetKind, id: string, t: number, seed: number, world: WorldState): { label: string; sub: string; node: ReactNode } {
  switch (kind) {
    case "locations": {
      const e = LOCATION_CATALOG.find((l) => l.id === id);
      return { label: e?.label ?? id, sub: id, node: <LocationCell id={id} t={t} seed={seed} world={world} /> };
    }
    case "props": {
      const e = PROP_CATALOG.find((p) => p.id === id);
      return { label: e?.label ?? id, sub: id, node: <PropCell id={id} t={t} /> };
    }
    case "outfits": {
      const e = OUTFIT_CATALOG.find((o) => o.id === id);
      return { label: e?.label ?? "Без костюма", sub: id, node: <OutfitCell id={id} t={t} /> };
    }
    case "fx": {
      const e = FX_CATALOG.find((f) => f.id === id);
      return { label: e?.label ?? id, sub: id, node: <Stage><Hero st={state({ fx: id as Fx })} t={t} /></Stage> };
    }
    case "actions": {
      const k = id as ActionKind;
      return { label: k, sub: id, node: <Stage><Hero st={state({ pose: actionPose(k, ACTION_T[k] ?? 0.8, t) })} t={t} /></Stage> };
    }
    case "states": {
      const [pid, st] = id.split(":") as [string, string | undefined];
      return {
        label: st ?? "обычный",
        sub: pid,
        node: (
          <svg viewBox="-130 -230 260 280" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <Prop id={pid} state={st} t={t} scale={1.3} />
          </svg>
        ),
      };
    }
    case "characters": {
      const e = CHARACTERS.find((c) => c.id === id);
      return { label: e?.name ?? id, sub: e?.label ?? id, node: <Stage><Hero id={id} st={state({ pose: actionPose("wave", 0.8, t) })} t={t} /></Stage> };
    }
    case "walk":
    case "walk_left":
    case "visemes":
      return { label: id, sub: "", node: <VisemesRow id={id} t={t} /> };
    case "faces":
      return { label: id, sub: "", node: kind === "faces" ? <FacesRow id={id} t={t} /> : <WalkRow id={id} t={t} facing={kind === "walk_left" ? -1 : 1} /> };
  }
}

/** Цикл шага: 8 фаз шага, бег, разворот 3/4. Ступни в (0,0) — видно, не скользит ли стопа и не «отрываются» ли конечности. */
function WalkRow({ id, t, facing }: { id: string; t: number; facing: 1 | -1 }) {
  const cells: { label: string; st: CharState }[] = [];
  for (let i = 0; i < 8; i++) cells.push({ label: `${i}/8`, st: state({ facing, pose: actionPose("walk", 1 + (i * Math.PI * 2) / 8 / 8, t), hold: i === 2 ? { id: "ball" } : undefined }) });
  cells.push({ label: "run", st: state({ facing, pose: actionPose("run", 1.1, t) }) });
  cells.push({ label: "tiptoe", st: state({ facing, pose: actionPose("tiptoe", 1.3, t), emotion: "neutral" }) });
  cells.push({ label: "turn 0.5", st: state({ facing, pose: actionPose("walk", 0.1, t), turn: 0.5 }) });
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, height: "100%" }}>
      {cells.map((c, i) => (
        <svg key={i} viewBox="-230 -600 460 640" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <line x1={-230} x2={230} y1={2} y2={2} stroke="#E3DDEE" strokeWidth={6} />
          <Hero id={id} st={c.st} t={t} />
          <text x={-220} y={-560} fontFamily="monospace" fontSize={34} fill="#7A6E8A">
            {c.label}
          </text>
        </svg>
      ))}
    </div>
  );
}

/** Крупные мордочки: все эмоции, говорит, профиль, 3/4, моргание. */
function FacesRow({ id, t }: { id: string; t: number }) {
  const emos = EMOTION_CATALOG.map((e) => e.id as CEmotion);
  const cells: { label: string; st: CharState }[] = emos.map((e) => ({ label: e, st: state({ emotion: e }) }));
  cells.push({ label: "talk", st: state({ emotion: "happy", mouth: 0.6 }) });
  cells.push({ label: "3/4", st: state({ emotion: "neutral", turn: 0.55 }) });
  cells.push({ label: "profile", st: state({ emotion: "happy", turn: 1, mouth: 0.5 }) });
  cells.push({ label: "blink", st: state({ emotion: "neutral", blink: true }) });
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, height: "100%" }}>
      {cells.map((c, i) => (
        <svg key={i} viewBox="-190 -560 380 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <Hero id={id} st={c.st} t={t} />
          <text x={-180} y={-180} fontFamily="monospace" fontSize={30} fill="#7A6E8A">
            {c.label}
          </text>
        </svg>
      ))}
    </div>
  );
}

/** Липсинк: все виземы в анфасе, с эмоциями (уголки от эмоции), в 3/4 и профиль. */
function VisemesRow({ id, t }: { id: string; t: number }) {
  const v = (vis: Viseme, emotion: CEmotion = "neutral", turn?: number) => ({ label: `${vis}${emotion === "neutral" ? "" : ` ${emotion}`}${turn ? (turn >= 1 ? " prof" : " 3/4") : ""}`, st: state({ emotion, viseme: vis, mouth: 0.6, turn }) });
  const cells: { label: string; st: CharState }[] = [
    ...VISEMES.map((x) => v(x)),
    v("A", "happy"),
    v("D", "happy"),
    v("C", "laugh"),
    v("B", "sad"),
    v("E", "surprised"),
    v("H", "angry"),
    v("C", "neutral", 0.55),
    v("A", "happy", 1),
    v("D", "happy", 1),
    v("F", "neutral", 1),
    v("G", "neutral", 1),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, height: "100%" }}>
      {cells.map((c, i) => (
        <svg key={i} viewBox="-150 -470 300 230" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <Hero id={id} st={c.st} t={t} />
          <text x={-142} y={-446} fontFamily="monospace" fontSize={24} fill="#7A6E8A">
            {c.label}
          </text>
        </svg>
      ))}
    </div>
  );
}

function ids(kind: SheetKind): string[] {
  switch (kind) {
    case "locations":
      return LOCATION_CATALOG.map((l) => l.id);
    case "props":
      return PROP_CATALOG.map((p) => p.id);
    case "outfits":
      return ["none", ...OUTFIT_CATALOG.map((o) => o.id)];
    case "fx":
      return FX_CATALOG.map((f) => f.id);
    case "actions":
      return [...ACTION_IDS];
    case "characters":
    case "walk":
    case "walk_left":
    case "faces":
    case "visemes":
      return CHARACTERS.map((c) => c.id);
    case "states":
      return Object.entries(PROP_STATES).flatMap(([id, sts]) => [id, ...sts.map((st) => `${id}:${st}`)]);
  }
}

const COLS: Record<SheetKind, number> = { states: 8, locations: 4, props: 10, outfits: 4, fx: 4, actions: 9, characters: 5, walk: 1, walk_left: 1, faces: 1, visemes: 1 };

/** Эмоции всех героев — отдельной строкой листа characters. */
function EmotionsRow({ t }: { t: number }) {
  const emos = EMOTION_CATALOG.map((e) => e.id as CEmotion);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${emos.length}, 1fr)`, gap: 10, flex: 1, minHeight: 0 }}>
      {emos.map((e) => (
        <Cell key={e} label={e}>
          <svg viewBox="-260 -540 520 330" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <Hero st={state({ emotion: e, mouth: e === "laugh" || e === "surprised" ? 0.7 : 0 })} t={t} x={-110} />
            <Hero id="mia" st={state({ emotion: e, mouth: e === "laugh" || e === "surprised" ? 0.7 : 0 })} t={t + 1} x={120} />
          </svg>
        </Cell>
      ))}
    </div>
  );
}

export function AssetSheet({ kind, only, seed = 0, world }: AssetSheetProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + 1;
  const w: WorldState = { ...DEFAULT_WORLD, ...world };
  if (only) {
    const it = item(kind, only, t, seed, w);
    return <AbsoluteFill style={{ background: kind === "locations" ? INK : "#FFFFFF" }}>{it.node}</AbsoluteFill>;
  }
  const list = ids(kind);
  const cols = COLS[kind];
  const rows = Math.ceil(list.length / cols);
  return (
    <AbsoluteFill style={{ background: BG, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ font: "900 34px/1 Nunito, Arial, sans-serif", color: INK }}>
        Каталог · {kind} · {list.length}
        {seed ? <span style={{ fontWeight: 600, color: "#7A6E8A" }}> · seed {seed}</span> : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 12, flex: kind === "characters" ? 2 : 1, minHeight: 0 }}>
        {list.map((id) => {
          const it = item(kind, id, t, seed, w);
          return (
            <Cell key={id} label={it.label} sub={it.sub}>
              {it.node}
            </Cell>
          );
        })}
      </div>
      {kind === "characters" ? <EmotionsRow t={t} /> : null}
    </AbsoluteFill>
  );
}
