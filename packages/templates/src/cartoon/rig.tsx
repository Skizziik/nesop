/**
 * Персонажи мультиков: векторная «перекладка» (как Peppa / Hey Duggee). Всё — собственная SVG-отрисовка.
 * Локальные координаты: (0,0) — точка между ступнями, рост ребёнка ~300, взрослого ~380. Вверх — отрицательный y.
 *
 * Вид героя — смесь анфаса и профиля: turn 0 — анфас (лёгкий поворот 3/4 к facing), 1 — профиль по направлению facing.
 * При ходьбе герой разворачивается в профиль: черты лица уходят к носу, дальний глаз/ухо/рука/нога — за телом и темнее.
 * Скелет (плечи, кисти, голова) считается одной функцией skeleton() и для отрисовки, и для handPositions — предмет в руке
 * всегда там, где нарисована кисть.
 */
import type { ReactNode } from "react";
import { Prop } from "./props";

export type Species = "bunny" | "cat" | "bear" | "dog";
export type CEmotion = "neutral" | "happy" | "laugh" | "sad" | "surprised" | "angry" | "scared" | "thinking" | "sleepy";

export interface CharacterSpec {
  id: string;
  name: string;
  species: Species;
  fur: string; // основной цвет
  belly: string; // мордочка / живот / внутренность ушей
  outfit: { kind: "overalls" | "dress" | "tshirt" | "apron" | "none"; color: string; accent?: string };
  adult?: boolean;
  eye?: string;
  extra?: "collar" | "bow" | "glasses";
}

/** Куда тянется кисть (решается обратной кинематикой): к глазам (прятки), рту (еда), подбородку, груди (хлопок), животу, земле. */
export type ReachAnchor = "eyes" | "mouth" | "chin" | "chest" | "tummy" | "ground";
export interface Reach {
  at: ReachAnchor;
  dx?: number; // сдвиг наружу от центра тела, в радиусах головы
  dy?: number; // сдвиг вниз, в радиусах головы
}

/** Поза на кадр: углы рук в градусах (0 — вниз вдоль тела, 90 — в сторону, 180 — вверх), фаза ходьбы, подпрыгивание. */
export interface Pose {
  armL: [number, number]; // [плечо, локоть]
  armR: [number, number];
  walk: number; // фаза шага (радианы); NaN — стоит
  lift: number; // подъём над землёй (прыжок), в единицах роста
  bob: number; // дыхание / пружинка тела (+ вниз)
  tilt: number; // наклон головы, градусы
  lean: number; // наклон корпуса, градусы; + — в сторону facing
  /** 0 — анфас … 1 — профиль по facing. По умолчанию 1 при ходьбе (walk не NaN), иначе 0. */
  turn?: number;
  /** Множитель к facing (кружение: смотрит в другую сторону). */
  face?: 1 | -1;
  /** Добавочный поворот головы -1..1 относительно facing (мотает головой, выглядывает). */
  yaw?: number;
  /** Кивок: + голова вниз, − вверх. */
  pitch?: number;
  /** Сжатие/растяжение вокруг ступней с сохранением объёма: + вытянут, − сплющен. */
  squash?: number;
  /** Инерция ушей и хвоста -1..1 (+ уши разлетаются, − прижаты). */
  follow?: number;
  /** Длина шага (1 — обычный, 0.5 — на цыпочках, 1.4 — бег). */
  stride?: number;
  /** 0..1 — вид со спины (кружение). */
  back?: number;
  /** Минимальная открытость рта от действия (зевок, смех, жевание). */
  mouth?: number;
  /** Глаза закрыты действием (зевок). */
  shut?: boolean;
  /** 0..1 — щёки надуты (жуёт). */
  puff?: number;
  /** Кисти тянутся к точкам тела/земли; k — вес (0..1) поверх углов armL/armR. */
  reach?: { L?: Reach; R?: Reach; k?: number };
  /** Жест рассчитан на facing=1: в анфасе при facing=-1 руки (и reach) меняются местами — жест к партнёру. */
  mirror?: boolean;
}

export const WEAR_IDS = ["raincoat", "pajamas", "party_hat", "scarf", "sun_hat", "winter_hat"] as const;
export type Wear = (typeof WEAR_IDS)[number];
export const FX_IDS = ["hearts", "sparkles", "zzz", "notes", "sweat", "exclaim", "question", "puff"] as const;
export type Fx = (typeof FX_IDS)[number];

export interface CharState {
  hold?: { id: string; color?: string }; // предмет в правой руке
  wear?: Wear[];
  fx?: Fx;
  pose: Pose;
  emotion: CEmotion;
  mouth: number; // 0..1 — открытость рта по голосу
  blink: boolean;
  look: [number, number]; // взгляд -1..1
  facing: 1 | -1; // куда повернута мордочка (лёгкий поворот 3/4, в профиле — направление)
  /** Переопределяет pose.turn (0 — анфас … 1 — профиль). */
  turn?: number;
  /** false — не моргать самому (по умолчанию герой моргает с неровным интервалом 2-6 с). */
  autoBlink?: boolean;
}

export const REST: Pose = { armL: [12, 8], armR: [12, 8], walk: Number.NaN, lift: 0, bob: 0, tilt: 0, lean: 0 };

/** Темнее на k (0..1) — контур деталей цветом самой детали, а не чёрным: мягкий современный вид. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - k))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const INK = "#2A1B33";
const MOUTH = "#8A1F35";
const TONGUE = "#FF7A8A";
const BLUSH = "#FF8FB0";
const SHADOW = "#4A2F6B";
const deg = (a: number) => (a * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => {
  const x = clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
};
/** Небольшая доля анфаса «смотрит» в сторону facing — герой не стоит плоско, как вырезанный. */
const STAND_YAW = 0.15;

/** Детерминированный хэш (0..1) — для моргания и мелочей без Math.random. */
function hash01(s: string, i: number): number {
  let h = 2166136261 ^ i;
  for (let c = 0; c < s.length; c++) h = Math.imul(h ^ s.charCodeAt(c), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Моргание с неровным интервалом (≈2-6 с), детерминированно по id и времени. 0 — открыты, 1 — закрыты.
 * Моргание длится ~0.16 с: веко опускается, глаз закрыт, веко поднимается.
 */
export function blinkAt(id: string, t: number): number {
  // по одному морганию в каждом 4-секундном окне, в случайный (по хэшу) момент 0.5..2.5 с — интервалы 2-6 с
  const cell = 4;
  const i = Math.floor(t / cell);
  const start = 0.5 + hash01(id, i) * 2;
  const lt = (t - i * cell - start) / 0.16;
  if (lt < 0 || lt > 1) return 0;
  return 1 - Math.abs(lt * 2 - 1);
}

/** Размеры скелета: одни и те же числа для отрисовки и для расчёта точек (руки, голова). */
export function rigMetrics(spec: CharacterSpec) {
  const adult = !!spec.adult;
  return {
    adult,
    legH: adult ? 58 : 34,
    bodyH: adult ? 150 : 112,
    bw: adult ? 62 : 58, // полуширина тела у пояса
    r: adult ? 78 : 86, // радиус головы (у малышей голова крупнее)
    armLen: adult ? 54 : 44,
  };
}

/* ───────────────────────────── вид и лицо ───────────────────────────── */

function viewOf(pose: Pose, facing: 1 | -1, turn?: number) {
  const f = (facing * (pose.face ?? 1)) as 1 | -1;
  const walking = !Number.isNaN(pose.walk);
  const k = clamp(turn ?? pose.turn ?? (walking ? 1 : 0), 0, 1);
  const u = clamp(f * (STAND_YAW + (1 - STAND_YAW) * k + (pose.yaw ?? 0)), -1, 1);
  return { f, k, u };
}

interface EyeSlot {
  x: number;
  sx: number; // сжатие по горизонтали (дальний глаз в 3/4)
  op: number;
  side: 1 | -1; // с какой стороны лица этот глаз в анфасе
  near: boolean;
}

/** Где на голове черты лица при повороте u (-1..1). Координаты от центра головы. */
function faceLayout(spec: CharacterSpec, r: number, u: number, pitch: number) {
  const adult = !!spec.adult;
  const a = Math.abs(u);
  const s: 1 | -1 = u < 0 ? -1 : 1;
  const er = r * (adult ? 0.21 : 0.245);
  const eyeDx = r * (adult ? 0.32 : 0.34);
  const py = pitch * r * 0.12;
  const near: EyeSlot = { x: s * (eyeDx + a * r * 0.14), sx: 1 + 0.04 * a, op: 1, side: s, near: true };
  const far: EyeSlot = { x: s * (-eyeDx + a * r * 0.6), sx: 1 - 0.7 * a, op: clamp((0.86 - a) / 0.16, 0, 1), side: -s as 1 | -1, near: false };
  const sp = spec.species;
  const snoutX = sp === "cat" ? 0.62 : sp === "bunny" ? 0.72 : 0.7;
  const noseX = sp === "cat" ? 0.9 : sp === "bunny" ? 1.02 : 0.99;
  const mouthX = sp === "cat" ? 0.66 : sp === "bunny" ? 0.76 : 0.72;
  return {
    a,
    s,
    er,
    eyeY: r * 0.02 + py,
    py,
    near,
    far,
    muzzle: {
      x: s * a * snoutX * r,
      y: r * 0.44 + py - a * r * 0.04,
      rx: r * lerp(sp === "cat" ? 0.38 : 0.42, sp === "cat" ? 0.32 : 0.37, a),
      ry: r * lerp(0.27, 0.25, a),
    },
    nose: { x: s * a * noseX * r, y: r * (sp === "bunny" ? 0.3 : 0.32) + py - a * r * 0.05 },
    mouth: { x: s * a * mouthX * r, y: r * (sp === "bunny" ? 0.5 : 0.54) + py - a * r * 0.03, w: 1 - 0.35 * a },
    cheekNear: s * lerp(0.62, 0.3, a) * r,
    cheekFar: s * lerp(-0.62, 0.05, a) * r,
    cheekFarOp: clamp(1 - a / 0.7, 0, 1),
    cheekY: r * 0.38 + py,
  };
}

/* ───────────────────────────── скелет ───────────────────────────── */

interface ArmG {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  hx: number;
  hy: number;
}

/** Обратная кинематика двух звеньев: локоть наружу (по dir). Возвращает локоть и кисть. */
function solveIK(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, dir: number): [number, number, number, number] {
  const dx = tx - sx;
  const dy = ty - sy;
  const d0 = Math.hypot(dx, dy) || 1;
  const d = clamp(d0, Math.abs(l1 - l2) + 1, (l1 + l2) * 0.995);
  const th = Math.atan2(dx, dy);
  const al = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const c1 = th + al;
  const c2 = th - al;
  const g1 = dir * Math.sin(c1) >= dir * Math.sin(c2) ? c1 : c2;
  const ex = sx + l1 * Math.sin(g1);
  const ey = sy + l1 * Math.cos(g1);
  return [ex, ey, sx + Math.sin(th) * d, sy + Math.cos(th) * d];
}

/**
 * Весь скелет кадра: вид, корпус, голова, плечи и кисти в локальных координатах тела (до наклона/прыжка/сжатия),
 * плюс place() — перевод в координаты персонажа (как transform у <Character>).
 */
function skeleton(spec: CharacterSpec, pose0: Pose, t: number, facing: 1 | -1 = 1, turn?: number) {
  const m = rigMetrics(spec);
  const { f, k, u } = viewOf(pose0, facing, turn);
  const pose: Pose =
    pose0.mirror && f === -1 && k < 0.5
      ? { ...pose0, armL: pose0.armR, armR: pose0.armL, reach: pose0.reach ? { L: pose0.reach.R, R: pose0.reach.L, k: pose0.reach.k } : undefined }
      : pose0;
  const breath = Math.sin(t * 2.4) * 2.2;
  const bob = breath + pose.bob;
  const bodyTop = -m.legH - m.bodyH + bob;
  const bodyBottom = -m.legH + 6;
  const pitch = pose.pitch ?? 0;
  const headY = bodyTop - m.r * 0.72 + Math.max(0, pitch) * 8;
  const rk = pose.reach ? (pose.reach.k ?? 1) : 0;
  const toEyes = pose.reach && (pose.reach.L?.at === "eyes" || pose.reach.R?.at === "eyes") ? rk : 0;
  const shoulderY = bodyTop + 30 - toEyes * 7;
  const q = pose.squash ?? 0;
  const sy = 1 + q;
  const sx = 1 / sy;
  const lean = pose.lean * f;
  const lift = pose.lift;
  const cl = Math.cos(deg(lean));
  const sl = Math.sin(deg(lean));
  const place = (x: number, y: number): [number, number] => {
    const X = x * sx;
    const dy = y * sy + m.legH;
    return [X * cl - dy * sl, X * sl + dy * cl - m.legH - lift];
  };
  const unplace = (x: number, y: number): [number, number] => {
    const Y = y + lift + m.legH;
    const X = x * cl + Y * sl;
    const dy = -x * sl + Y * cl;
    return [X / sx, (dy - m.legH) / sy];
  };
  const fl = faceLayout(spec, m.r, u, pitch);
  const l1 = m.armLen;
  const l2 = m.armLen * 0.92;
  const anchor = (rc: Reach, side: 1 | -1): [number, number] => {
    const r = m.r;
    let p: [number, number];
    switch (rc.at) {
      case "eyes": {
        const xs = [fl.near.x, fl.far.x].sort((x1, x2) => x1 - x2);
        p = [side === 1 ? xs[1]! : xs[0]!, headY + fl.eyeY + fl.er * 0.25];
        break;
      }
      case "mouth":
        p = [fl.mouth.x + side * r * 0.1, headY + fl.mouth.y + 6];
        break;
      case "chin":
        p = [fl.mouth.x + side * r * 0.2, headY + r * 0.66];
        break;
      case "chest":
        p = [side * r * 0.12, shoulderY + 26];
        break;
      case "tummy":
        p = [side * r * 0.3, bodyBottom - m.bodyH * 0.4];
        break;
      case "ground":
        p = unplace(lerp(side * m.bw * 1.05, f * m.bw * 1.1, k), -16);
        break;
    }
    return [p[0] + side * (rc.dx ?? 0) * r, p[1] + (rc.dy ?? 0) * r];
  };
  const arm = (side: 1 | -1): ArmG => {
    const [a1, a2] = side === 1 ? pose.armR : pose.armL;
    const shx = lerp(side * m.bw * 0.68, f * m.bw * (side === 1 ? 0.04 : -0.12), k);
    // в профиле «в сторону» становится «вперёд»: горизонтальная проекция руки плавно меняет знак (ракурс)
    const mm = lerp(side, f, k);
    const ex = shx + Math.sin(deg(a1)) * mm * l1;
    const ey = shoulderY + Math.cos(deg(a1)) * l1;
    let g: ArmG = { sx: shx, sy: shoulderY, ex, ey, hx: ex + Math.sin(deg(a1 + a2)) * mm * l2, hy: ey + Math.cos(deg(a1 + a2)) * l2 };
    const rc = side === 1 ? pose.reach?.R : pose.reach?.L;
    if (rc && rk > 0) {
      const [tx, ty] = anchor(rc, side);
      const [iex, iey, ihx, ihy] = solveIK(shx, shoulderY, tx, ty, l1, l2, Math.sign(mm) || side);
      g = { ...g, ex: lerp(g.ex, iex, rk), ey: lerp(g.ey, iey, rk), hx: lerp(g.hx, ihx, rk), hy: lerp(g.hy, ihy, rk) };
    }
    return g;
  };
  return { pose, m, f, k, u, fl, bob, bodyTop, bodyBottom, headY, shoulderY, pitch, lean, sx, sy, lift, place, L: arm(-1), R: arm(1) };
}

/**
 * Точки скелета в локальных координатах персонажа (ступни в 0,0, до масштаба сцены) с учётом прыжка, наклона и сжатия:
 * кисти L/R, центр головы, макушка. Нужны, чтобы привязать предмет к руке, эффект к голове, передать предмет из рук в руки.
 * facing/turn — те же, что в CharState (в профиле правая рука — ближняя и тянется по facing).
 */
export function handPositions(spec: CharacterSpec, pose: Pose, t: number, facing: 1 | -1 = 1, turn?: number) {
  const sk = skeleton(spec, pose, t, facing, turn);
  return {
    L: sk.place(sk.L.hx, sk.L.hy),
    R: sk.place(sk.R.hx, sk.R.hy),
    head: sk.place(0, sk.headY),
    top: sk.place(0, sk.headY - sk.m.r * 1.1),
  };
}

/* ───────────────────────────── руки и ноги ───────────────────────────── */

/** Рука: рукав двумя сегментами + ладошка-варежка с большим пальцем (общий контур в два прохода). */
function ArmView({ g, color, hand, side, f, k }: { g: ArmG; color: string; hand: string; side: 1 | -1; f: 1 | -1; k: number }) {
  const w = 22;
  const line = shade(color, 0.35);
  const hl = shade(hand, 0.35);
  const d = `M${g.sx} ${g.sy} L${g.ex} ${g.ey} L${g.hx} ${g.hy}`;
  const g2 = Math.atan2(g.hx - g.ex, g.hy - g.ey); // 0 — кисть вниз
  // большой палец: у опущенной руки — к телу (в профиле — вперёд), у горизонтальной — вверх
  const lx = Math.cos(g2);
  const ly = -Math.sin(g2);
  const D: [number, number] = Math.abs(Math.sin(g2)) > 0.7 ? [0, -1] : k > 0.5 ? [f, 0] : [-side, 0];
  const ts = D[0] * lx + D[1] * ly >= 0 ? 1 : -1;
  const shapes = (fill: string, stroke?: string) => (
    <g fill={fill} stroke={stroke} strokeWidth={stroke ? 6 : undefined}>
      <ellipse cx={ts * 10} cy={-1} rx={6} ry={8} transform={`rotate(${-ts * 28} ${ts * 10} -1)`} />
      <ellipse cx={0} cy={3} rx={12.5} ry={14} />
    </g>
  );
  return (
    <g>
      <path d={d} stroke={line} strokeWidth={w + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g transform={`translate(${g.hx} ${g.hy}) rotate(${(-g2 * 180) / Math.PI})`}>
        {shapes(hl, hl)}
        {shapes(hand)}
        <ellipse cx={-4} cy={-2} rx={4} ry={5} fill="#FFFFFF" opacity={0.18} />
      </g>
    </g>
  );
}

/** Шаг: опорная нога едет назад равномерно (стопа «стоит» на земле), маховая — вперёд по дуге. x -1..1, y 0..1. */
function stepCycle(phase: number) {
  const uu = (((phase / (2 * Math.PI)) % 1) + 1) % 1;
  if (uu < 0.5) return { x: 1 - 4 * uu, y: 0, v: -1 };
  const v = (uu - 0.5) * 2;
  return { x: -1 + 2 * smooth(v), y: Math.sin(Math.PI * v), v };
}

function Leg({ hipX, phase, f, k, stride, color, foot, h, footRx }: { hipX: number; phase: number; f: 1 | -1; k: number; stride: number; color: string; foot: string; h: number; footRx: number }) {
  const walking = !Number.isNaN(phase);
  let dx = 0;
  let up = 0;
  let rot = 0;
  if (walking) {
    const c = stepCycle(phase);
    const A = (8 + h * 0.35) * stride;
    const H = (6 + h * 0.2) * Math.sqrt(stride);
    dx = c.x * A * f * lerp(0.3, 1, k);
    up = c.y * H;
    if (c.v >= 0) rot = f * k * 22 * (0.5 - c.v) * Math.sin(Math.PI * c.v);
  }
  const ax = hipX + dx;
  const ay = -up - 9;
  const d = `M${hipX} ${-h - 8} L${ax} ${ay}`;
  const fx = ax + f * k * 7;
  return (
    <g>
      <path d={d} stroke={shade(color, 0.35)} strokeWidth={33} strokeLinecap="round" fill="none" />
      <path d={d} stroke={color} strokeWidth={26} strokeLinecap="round" fill="none" />
      <ellipse cx={fx} cy={-up - 5} rx={footRx + k * 3} ry={12} fill={foot} stroke={shade(foot, 0.35)} strokeWidth="3.5" transform={rot ? `rotate(${rot} ${ax} ${-up - 5})` : undefined} />
    </g>
  );
}

/* ───────────────────────────── одежда и эффекты ───────────────────────────── */

/** Одежда поверх тела/головы: дождевик, пижама, шапки, шарф. */
function WearBody({ wear, bw, top, bottom }: { wear: Wear[]; bw: number; top: number; bottom: number }) {
  return (
    <>
      {wear.includes("pajamas") ? (
        <g>
          <path d={`M${-bw * 0.85} ${top + 14} Q0 ${top + 2} ${bw * 0.85} ${top + 14} L${bw * 0.95} ${bottom - 4} Q0 ${bottom + 12} ${-bw * 0.95} ${bottom - 4} Z`} fill="#9FD3FF" stroke="#5C9BD1" strokeWidth="3.5" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${-bw * 0.9} ${top + 30 + i * 22} H${bw * 0.9}`} stroke="#FFFFFF" strokeWidth="7" opacity={0.85} />
          ))}
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={0} cy={top + 34 + i * 26} r={5} fill="#FFD54A" />
          ))}
        </g>
      ) : null}
      {wear.includes("raincoat") ? (
        <g>
          <path d={`M${-bw * 0.8} ${top + 8} Q0 ${top - 6} ${bw * 0.8} ${top + 8} L${bw * 1.12} ${bottom + 4} Q0 ${bottom + 20} ${-bw * 1.12} ${bottom + 4} Z`} fill="#FFD23F" stroke="#C9A01A" strokeWidth="4" />
          <path d={`M0 ${top + 6} V${bottom + 14}`} stroke="#C9A01A" strokeWidth="3" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={10} cy={top + 30 + i * 26} r={5} fill="#3D8BFF" />
          ))}
        </g>
      ) : null}
      {wear.includes("scarf") ? (
        <g>
          <path d={`M${-bw * 0.66} ${top + 10} Q0 ${top + 32} ${bw * 0.66} ${top + 10}`} stroke="#E53950" strokeWidth="18" fill="none" strokeLinecap="round" />
          <path d={`M${bw * 0.3} ${top + 20} l10 56`} stroke="#E53950" strokeWidth="16" strokeLinecap="round" />
          <path d={`M${bw * 0.3} ${top + 40} l8 10 M${bw * 0.34} ${top + 60} l8 10`} stroke="#FFFFFF" strokeWidth="4" />
        </g>
      ) : null}
    </>
  );
}

function WearHead({ wear, r }: { wear: Wear[]; r: number }) {
  return (
    <>
      {wear.includes("raincoat") ? <path d={`M${-r * 1.02} ${-r * 0.1} Q${-r * 1.0} ${-r * 1.15} 0 ${-r * 1.12} Q${r * 1.0} ${-r * 1.15} ${r * 1.02} ${-r * 0.1} Q${r * 0.7} ${-r * 0.55} 0 ${-r * 0.62} Q${-r * 0.7} ${-r * 0.55} ${-r * 1.02} ${-r * 0.1} Z`} fill="#FFD23F" stroke="#C9A01A" strokeWidth="4" /> : null}
      {wear.includes("party_hat") ? (
        <g transform={`translate(${r * 0.2} ${-r * 0.82}) rotate(12)`}>
          <path d={`M${-r * 0.32} 0 L0 ${-r * 0.9} L${r * 0.32} 0 Z`} fill="#8E5CFF" stroke="#5E38B8" strokeWidth="4" strokeLinejoin="round" />
          <path d={`M${-r * 0.2} ${-r * 0.3} L${r * 0.18} ${-r * 0.4} M${-r * 0.12} ${-r * 0.6} L${r * 0.1} ${-r * 0.66}`} stroke="#FFD23F" strokeWidth="6" />
          <circle cy={-r * 0.92} r={r * 0.1} fill="#FF6FA8" />
        </g>
      ) : null}
      {wear.includes("sun_hat") ? (
        <g transform={`translate(0 ${-r * 0.72})`}>
          <ellipse cx={0} cy={0} rx={r * 1.15} ry={r * 0.22} fill="#FFE08A" stroke="#C9A65A" strokeWidth="4" />
          <path d={`M${-r * 0.55} 0 Q0 ${-r * 0.7} ${r * 0.55} 0 Z`} fill="#FFE08A" stroke="#C9A65A" strokeWidth="4" />
          <path d={`M${-r * 0.55} -4 Q0 ${-r * 0.2} ${r * 0.55} -4`} stroke="#FF6FA8" strokeWidth="9" fill="none" />
        </g>
      ) : null}
      {wear.includes("winter_hat") ? (
        <g transform={`translate(0 ${-r * 0.6})`}>
          <path d={`M${-r * 0.82} ${r * 0.05} Q0 ${-r * 1.0} ${r * 0.82} ${r * 0.05} Z`} fill="#3D8BFF" stroke="#2A64C2" strokeWidth="4" />
          <rect x={-r * 0.86} y={-r * 0.06} width={r * 1.72} height={r * 0.22} rx={r * 0.1} fill="#FFFFFF" stroke="#C9DDEA" strokeWidth="3" />
          <circle cy={-r * 0.82} r={r * 0.17} fill="#FFFFFF" stroke="#C9DDEA" strokeWidth="3" />
        </g>
      ) : null}
    </>
  );
}

/** Эффекты над головой: сердечки, искры, «zzz», ноты, капли, «!» «?», облачко. */
function FxLayer({ fx, x, y, t }: { fx: Fx; x: number; y: number; t: number }) {
  const ph = (k: number) => ((t * 0.8 + k) % 1 + 1) % 1;
  const items = [0, 0.33, 0.66];
  if (fx === "hearts" || fx === "notes" || fx === "zzz" || fx === "sparkles")
    return (
      <g>
        {items.map((k, i) => {
          const p = ph(k);
          // сбоку от головы и вверх — не налезает на уши зайца/кошки и на поднятые руки
          const gx = x + 100 + (i - 1) * 30 + Math.sin(p * 6 + i) * 10;
          const gy = y + 70 - p * 140;
          const op = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
          const body =
            fx === "hearts" ? (
              <path d="M0 8 C-18 -6 -12 -22 0 -12 C12 -22 18 -6 0 8 Z" fill="#FF4D7A" stroke="#C2224F" strokeWidth="2.5" />
            ) : fx === "notes" ? (
              <path d="M-6 6 a7 6 0 1 1 6 -4 V-22 l14 -4 v6 l-10 3 V4" fill="#3A2A66" stroke="#3A2A66" strokeWidth="2" />
            ) : fx === "zzz" ? (
              <text fontFamily="Fredoka" fontWeight={700} fontSize={30 + i * 8} fill="#7FA8FF" stroke="#3A4A99" strokeWidth="2">
                z
              </text>
            ) : (
              <path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="#FFE45C" stroke="#E0B400" strokeWidth="2" />
            );
          return (
            <g key={i} transform={`translate(${gx} ${gy}) scale(${0.8 + p * 0.5})`} opacity={op}>
              {body}
            </g>
          );
        })}
      </g>
    );
  if (fx === "sweat") return <path transform={`translate(${x + 60} ${y + 40 + (t * 40) % 20})`} d="M0 -16 Q-12 4 0 10 Q12 4 0 -16 Z" fill="#9ADBFF" stroke="#3B8BD0" strokeWidth="2.5" />;
  if (fx === "exclaim" || fx === "question")
    return (
      <text x={x + 70} y={y + 10} fontFamily="Fredoka" fontWeight={700} fontSize={90} fill={fx === "exclaim" ? "#FF4D5A" : "#3D8BFF"} stroke="#FFFFFF" strokeWidth="6" paintOrder="stroke" transform={`rotate(12 ${x + 70} ${y})`}>
        {fx === "exclaim" ? "!" : "?"}
      </text>
    );
  // puff — облачко пыли у ног (бег, приземление)
  return (
    <g opacity={0.8}>
      {[-50, 0, 50].map((dx, i) => (
        <circle key={i} cx={x + dx} cy={-10} r={18 + ((t * 30 + i * 7) % 12)} fill="#FFFFFF" />
      ))}
    </g>
  );
}

function Outfit({ spec, bw, top, bottom, fwd }: { spec: CharacterSpec; bw: number; top: number; bottom: number; fwd: number }) {
  const o = spec.outfit;
  const line = shade(o.color, 0.35);
  if (o.kind === "overalls")
    return (
      <g>
        <path d={`M${-bw * 0.62} ${top + 52} Q0 ${top + 40} ${bw * 0.62} ${top + 52} L${bw * 0.86} ${bottom - 10} Q0 ${bottom + 12} ${-bw * 0.86} ${bottom - 10} Z`} fill={o.color} stroke={line} strokeWidth="3.5" />
        <path d={`M${-bw * 0.42} ${top + 52} L${-bw * 0.3} ${top + 6}`} stroke={o.color} strokeWidth="11" strokeLinecap="round" />
        <path d={`M${bw * 0.42} ${top + 52} L${bw * 0.3} ${top + 6}`} stroke={o.color} strokeWidth="11" strokeLinecap="round" />
        <circle cx={-bw * 0.4} cy={top + 46} r={5} fill={o.accent ?? "#FFD54A"} />
        <circle cx={bw * 0.4} cy={top + 46} r={5} fill={o.accent ?? "#FFD54A"} />
        <rect x={-16 + fwd * 10} y={top + 62} width={32} height={22} rx={6} fill={shade(o.color, 0.12)} />
      </g>
    );
  if (o.kind === "dress")
    return (
      <g>
        <path d={`M${-bw * 0.7} ${top + 18} Q0 ${top + 6} ${bw * 0.7} ${top + 18} L${bw * 1.08} ${bottom + 2} Q0 ${bottom + 22} ${-bw * 1.08} ${bottom + 2} Z`} fill={o.color} stroke={line} strokeWidth="3.5" />
        <path d={`M${-bw * 1.02} ${bottom - 6} Q0 ${bottom + 14} ${bw * 1.02} ${bottom - 6}`} stroke={o.accent ?? "#FFFFFF"} strokeWidth="6" fill="none" strokeDasharray="2 12" strokeLinecap="round" />
      </g>
    );
  if (o.kind === "tshirt")
    return (
      <g>
        <path d={`M${-bw * 0.8} ${top + 14} Q0 ${top + 2} ${bw * 0.8} ${top + 14} L${bw * 0.92} ${top + 92} Q0 ${top + 104} ${-bw * 0.92} ${top + 92} Z`} fill={o.color} stroke={line} strokeWidth="3.5" />
        <circle cx={fwd * 16} cy={top + 52} r={14} fill={o.accent ?? "#FFFFFF"} opacity={0.9} />
      </g>
    );
  if (o.kind === "apron")
    return (
      <g>
        <path d={`M${-bw * 0.5} ${top + 30} h${bw} L${bw * 0.7} ${bottom - 6} Q0 ${bottom + 8} ${-bw * 0.7} ${bottom - 6} Z`} fill={o.color} stroke={line} strokeWidth="3.5" />
        <path d={`M${-bw * 0.5} ${top + 30} L${-bw * 0.28} ${top + 4} M${bw * 0.5} ${top + 30} L${bw * 0.28} ${top + 4}`} stroke={o.color} strokeWidth="7" strokeLinecap="round" />
        <rect x={-18 + fwd * 10} y={top + 70} width={36} height={24} rx={6} fill={o.accent ?? "#FFFFFF"} opacity={0.85} />
      </g>
    );
  return null;
}

/* ───────────────────────────── голова ───────────────────────────── */

type Lids = { tin: number; tout: number; bot?: number; sag?: number };
/** Веки по эмоции: высота линии века у внутреннего/внешнего уголка (1 — нет века, 0 — середина глаза), нижнее «улыбчивое» веко. */
const LIDS: Record<CEmotion, Lids> = {
  neutral: { tin: 1, tout: 1 },
  happy: { tin: 1, tout: 1 },
  laugh: { tin: 1, tout: 1 },
  sad: { tin: 0.8, tout: 0.2 },
  surprised: { tin: 1, tout: 1 },
  angry: { tin: 0.05, tout: 0.6 },
  scared: { tin: 1, tout: 1 },
  thinking: { tin: 0.55, tout: 0.6 },
  sleepy: { tin: -0.05, tout: -0.15, sag: 0.18 },
};
/** Брови: подъём внутреннего/внешнего конца (в радиусах глаза, + вверх) и общий подъём. */
const BROWS: Record<CEmotion, [number, number, number]> = {
  neutral: [0.08, 0, 0.22],
  happy: [0.16, 0.04, 0.34], // высоко и чуть домиком — дружелюбно (низкие прямые брови читались «строго»)
  laugh: [0.14, 0.04, 0.36],
  sad: [0.5, -0.12, 0.05],
  surprised: [0.1, 0.05, 0.5],
  angry: [-0.42, 0.18, -0.05],
  scared: [0.45, -0.05, 0.35],
  thinking: [-0.12, 0.1, 0],
  sleepy: [-0.05, -0.1, -0.08],
};

/** Глаз: белок, радужка, зрачок, два блика, веки по эмоции. inner — направление к носу. */
function Eye({ x, y, er, sx, op, inner, emo, closed, look, iris, lid }: { lid: string; x: number; y: number; er: number; sx: number; op: number; inner: 1 | -1; emo: CEmotion; closed: number; look: [number, number]; iris?: string }) {
  if (op <= 0.01) return null;
  const tf = `translate(${x} ${y}) scale(${sx} 1)`;
  const wide = emo === "surprised" || emo === "scared";
  const rx = er * 0.86 * (wide ? 1.05 : 1);
  const ry = er * (wide ? 1.12 : 1);
  // закрытые глаза: «^^» при смехе, «‿» при моргании/сне
  if (closed >= 0.7 || emo === "laugh") {
    const happy = emo === "laugh" && closed < 0.7;
    const d = happy ? `M${-rx} ${ry * 0.15} Q0 ${-ry * 0.95} ${rx} ${ry * 0.15}` : `M${-rx} ${-ry * 0.05} Q0 ${ry * 0.7} ${rx} ${-ry * 0.05}`;
    return (
      <g transform={tf} opacity={op}>
        <path d={d} stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />
        {!happy ? <path d={`M${-inner * rx} ${-ry * 0.05} l${-inner * 6} -6`} stroke={INK} strokeWidth="4" strokeLinecap="round" /> : null}
      </g>
    );
  }
  const lid0 = LIDS[emo];
  // полуморгание: верхнее веко опускается к середине
  const half = clamp(closed / 0.7, 0, 1);
  const tin = lerp(lid0.tin, -0.2, half);
  const tout = lerp(lid0.tout, -0.2, half);
  const pr = er * (emo === "scared" ? 0.44 : emo === "surprised" ? 0.54 : 0.64);
  const maxOff = Math.max(0, rx - pr * 0.92);
  const px = clamp(look[0], -1, 1) * maxOff;
  const py = clamp(look[1], -1, 1) * er * 0.18 + (emo === "sad" ? er * 0.14 : 0);
  const irisC = iris ?? "#4B3757";
  // точки на эллипсе на высоте h (sin угла): левая/правая
  const pt = (h: number, right: boolean): [number, number] => {
    const c = Math.sqrt(Math.max(0, 1 - h * h));
    return [(right ? 1 : -1) * rx * c, -ry * h];
  };
  const hL = inner === 1 ? tout : tin; // левый уголок: внешний, если нос справа
  const hR = inner === 1 ? tin : tout;
  const topLid =
    hL < 0.98 || hR < 0.98
      ? (() => {
          const [lx, ly] = pt(clamp(hL, -0.99, 0.99), false);
          const [qx, qy] = pt(clamp(hR, -0.99, 0.99), true);
          const span = Math.PI - Math.asin(clamp(hL, -0.99, 0.99)) - Math.asin(clamp(hR, -0.99, 0.99));
          const sag = (lid0.sag ?? 0) * ry + half * ry * 0.15;
          const mx = (lx + qx) / 2;
          const my = (ly + qy) / 2 + sag * 2;
          return { fill: `M${lx} ${ly} A${rx} ${ry} 0 ${span > Math.PI ? 1 : 0} 1 ${qx} ${qy} Q${mx} ${my} ${lx} ${ly} Z`, line: `M${lx} ${ly} Q${mx} ${my} ${qx} ${qy}` };
        })()
      : null;
  const botLid =
    lid0.bot && half < 0.5
      ? (() => {
          const b = lid0.bot;
          const [lx, ly] = pt(-b, false);
          const [qx, qy] = pt(-b, true);
          const my = ly - ry * 0.3;
          return { fill: `M${qx} ${qy} A${rx} ${ry} 0 0 1 ${lx} ${ly} Q0 ${my} ${qx} ${qy} Z`, line: `M${lx * 0.8} ${ly - ry * 0.06} Q0 ${my} ${qx * 0.8} ${qy - ry * 0.06}` };
        })()
      : null;
  return (
    <g transform={tf} opacity={op}>
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="#FFFFFF" stroke={INK} strokeWidth="3" />
      <circle cx={px} cy={py} r={pr} fill={irisC} />
      {iris ? <circle cx={px} cy={py} r={pr * 0.55} fill={INK} /> : <circle cx={px} cy={py} r={pr * 0.62} fill={INK} opacity={0.6} />}
      <circle cx={px - pr * 0.34} cy={py - pr * 0.38} r={pr * 0.36} fill="#FFFFFF" />
      <circle cx={px + pr * 0.36} cy={py + pr * 0.32} r={pr * 0.15} fill="#FFFFFF" />
      {topLid ? (
        <g>
          <path d={topLid.fill} fill={lid} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d={topLid.line} stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </g>
      ) : null}
      {botLid ? (
        <g>
          <path d={botLid.fill} fill={lid} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d={botLid.line} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
}

/** Рот по эмоции и открытости (голос/действие). Центр — (x, y), ширина w (в радиусах головы, с учётом ракурса). */
function Mouth({ spec, e, open, x, y, r, wk }: { spec: CharacterSpec; e: CEmotion; open: number; x: number; y: number; r: number; wk: number }) {
  const w = r * 0.17 * wk;
  const bunny = spec.species === "bunny";
  const teeth = (top: number, ww: number) => (bunny ? <rect x={x - ww * 0.32} y={top} width={ww * 0.64} height={r * 0.07} rx={3} fill="#FFFFFF" stroke={shade("#FFFFFF", 0.3)} strokeWidth="1.5" /> : null);
  if (open > 0.12) {
    if (e === "surprised" || e === "scared") {
      const rx = w * (0.45 + open * 0.25);
      const ry = r * (0.07 + open * 0.12);
      return (
        <g>
          <ellipse cx={x} cy={y + ry * 0.4} rx={rx} ry={ry} fill={MOUTH} stroke={INK} strokeWidth="3.5" />
          <ellipse cx={x} cy={y + ry * 0.95} rx={rx * 0.6} ry={ry * 0.35} fill={TONGUE} />
        </g>
      );
    }
    const big = e === "happy" || e === "laugh";
    const ww = w * (0.85 + open * 0.3) * (big ? 1.25 : 1);
    const h = r * (0.06 + open * 0.2) * (e === "laugh" ? 1.15 : 1);
    const corner = e === "sad" ? h * 0.25 : -h * (big ? 0.25 : 0.1); // уголки вниз у грусти
    const top = y - h * 0.15;
    const d = `M${x - ww} ${top + corner} Q${x} ${top - h * (big ? 0.2 : 0.05) + (e === "sad" ? -h * 0.2 : 0)} ${x + ww} ${top + corner} Q${x + ww * 0.85} ${y + h} ${x} ${y + h} Q${x - ww * 0.85} ${y + h} ${x - ww} ${top + corner} Z`;
    return (
      <g>
        <path d={d} fill={MOUTH} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <ellipse cx={x} cy={y + h * 0.7} rx={ww * 0.55} ry={h * 0.3} fill={TONGUE} />
        {teeth(top - h * 0.12, ww)}
      </g>
    );
  }
  const stroke = { stroke: INK, strokeWidth: 4.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (e) {
    case "happy":
    case "laugh": {
      const ww = w * (e === "laugh" ? 1.35 : 1.15);
      const h = r * (e === "laugh" ? 0.24 : 0.15);
      return (
        <g>
          <path d={`M${x - ww} ${y - 3} Q${x} ${y + 1} ${x + ww} ${y - 3} Q${x + ww * 0.8} ${y + h} ${x} ${y + h} Q${x - ww * 0.8} ${y + h} ${x - ww} ${y - 3} Z`} fill={MOUTH} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <ellipse cx={x} cy={y + h * 0.68} rx={ww * 0.5} ry={h * 0.3} fill={TONGUE} />
          {teeth(y - 3, ww)}
        </g>
      );
    }
    case "sad":
      return <path d={`M${x - w * 0.9} ${y + 7} Q${x - w * 0.55} ${y - 3} ${x - w * 0.22} ${y - 1} Q${x} ${y + 1} ${x + w * 0.22} ${y - 1} Q${x + w * 0.55} ${y - 3} ${x + w * 0.9} ${y + 7}`} {...stroke} />;
    case "surprised":
      return <ellipse cx={x} cy={y + 4} rx={w * 0.42} ry={r * 0.085} fill={MOUTH} stroke={INK} strokeWidth="3.5" />;
    case "scared":
      return <path d={`M${x - w} ${y + 3} Q${x - w * 0.5} ${y - 4} ${x} ${y + 3} T${x + w} ${y + 3}`} {...stroke} />;
    case "angry":
      return <path d={`M${x - w * 0.75} ${y + 6} Q${x} ${y - 4} ${x + w * 0.75} ${y + 6}`} {...stroke} />;
    case "thinking":
      return <path d={`M${x - w * 0.5} ${y + 3} Q${x + w * 0.2} ${y + 6} ${x + w * 0.75} ${y - 3}`} {...stroke} />;
    case "sleepy":
      return <ellipse cx={x} cy={y + 3} rx={w * 0.3} ry={r * 0.045} fill={MOUTH} stroke={INK} strokeWidth="3" />;
    default:
      // зайчик и котёнок — «ω», мишка и щенок — улыбка
      if (spec.species === "bunny" || spec.species === "cat")
        return <path d={`M${x - w * 0.8} ${y - 1} Q${x - w * 0.4} ${y + w * 0.62} ${x} ${y - 1} Q${x + w * 0.4} ${y + w * 0.62} ${x + w * 0.8} ${y - 1}`} {...stroke} />;
      return <path d={`M${x - w * 0.85} ${y} Q${x} ${y + r * 0.13} ${x + w * 0.85} ${y}`} {...stroke} />;
  }
}

/** Мордочка: щёки, глаза, брови, нос, рот, усы. Центр — середина головы. */
function Face({ spec, st, r, fl, open, closed, puff }: { spec: CharacterSpec; st: CharState; r: number; fl: ReturnType<typeof faceLayout>; open: number; closed: number; puff: number }) {
  const e = st.emotion;
  const { er, eyeY, s, a } = fl;
  const look: [number, number] = [clamp(st.look[0] + s * a * 0.6 + (e === "thinking" ? s * 0.5 : 0), -1, 1), clamp(st.look[1] + (e === "thinking" ? -0.9 : 0), -1, 1)];
  const eyes = [fl.far, fl.near];
  // в анфасе «к носу» — к центру; в профиле у ближнего глаза нос впереди
  const innerOf = (slot: EyeSlot): 1 | -1 => (slot.near ? (a > 0.5 ? s : (-slot.side as 1 | -1)) : s);
  const [bin, bout, braise] = BROWS[e];
  const brow = (slot: EyeSlot) => {
    if (slot.op <= 0.01) return null;
    const inner = innerOf(slot);
    const raise = braise + (e === "thinking" && slot.near ? 0.35 : 0);
    const by = eyeY - er * (1.3 + raise);
    const ix = slot.x + inner * er * 0.75 * slot.sx;
    const ox = slot.x - inner * er * 0.75 * slot.sx;
    const iy = by - bin * er;
    const oy = by - bout * er;
    return <path key={`b${slot.side}`} d={`M${ox} ${oy} Q${slot.x} ${Math.min(iy, oy) - er * 0.3} ${ix} ${iy}`} stroke={shade(spec.fur, 0.42)} strokeWidth="4.8" fill="none" strokeLinecap="round" opacity={slot.op} />;
  };
  const mz = fl.muzzle;
  const n = fl.nose;
  const nose =
    spec.species === "bunny" || spec.species === "cat" ? (
      <path
        d={`M${n.x - r * 0.085} ${n.y - r * 0.035} Q${n.x} ${n.y - r * 0.075} ${n.x + r * 0.085} ${n.y - r * 0.035} Q${n.x + r * 0.07} ${n.y + r * 0.03} ${n.x} ${n.y + r * 0.055} Q${n.x - r * 0.07} ${n.y + r * 0.03} ${n.x - r * 0.085} ${n.y - r * 0.035} Z`}
        fill={spec.species === "bunny" ? "#FF8FA8" : "#FF7A9C"}
        stroke={shade("#FF8FA8", 0.4)}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    ) : (
      <g>
        <ellipse cx={n.x} cy={n.y} rx={r * 0.13} ry={r * 0.09} fill="#4A2E36" stroke={shade("#4A2E36", 0.3)} strokeWidth="2" />
        <ellipse cx={n.x - r * 0.04} cy={n.y - r * 0.035} rx={r * 0.04} ry={r * 0.022} fill="#FFFFFF" opacity={0.55} />
      </g>
    );
  // «филтрум» от носа ко рту — у зайчика и котёнка
  const philtrum = (spec.species === "bunny" || spec.species === "cat") && open < 0.12 && (e === "neutral" || e === "thinking") ? <path d={`M${n.x} ${n.y + r * 0.05} L${fl.mouth.x} ${fl.mouth.y - 1}`} stroke={INK} strokeWidth="4" strokeLinecap="round" /> : null;
  const whiskers =
    spec.species === "cat" ? (
      <g stroke={shade(spec.fur, 0.5)} strokeWidth="2.5" strokeLinecap="round">
        {[-1, 1].map((sd) => {
          const wx = mz.x + sd * mz.rx * 0.78;
          const back = sd === -s && a > 0.5;
          return back ? null : (
            <g key={sd}>
              <path d={`M${wx} ${mz.y - r * 0.08} l${sd * r * 0.3} ${-r * 0.06}`} />
              <path d={`M${wx} ${mz.y} l${sd * r * 0.3} ${r * 0.04}`} />
            </g>
          );
        })}
      </g>
    ) : null;
  const cheek = (cx: number, op: number, key: string) =>
    op > 0.01 ? (
      <g key={key} opacity={op}>
        <ellipse cx={cx} cy={fl.cheekY} rx={r * (0.17 + puff * 0.06)} ry={r * (0.11 + puff * 0.04)} fill={BLUSH} opacity={0.22} />
        <ellipse cx={cx} cy={fl.cheekY} rx={r * (0.11 + puff * 0.04)} ry={r * (0.07 + puff * 0.03)} fill={BLUSH} opacity={0.45} />
      </g>
    ) : null;
  const tearSlot = fl.near;
  const tear = e === "sad" ? <path d={`M${tearSlot.x - innerOf(tearSlot) * er * 0.6} ${eyeY + er * 1.05} q-7 13 0 17 q7 -4 0 -17`} fill="#7EC8FF" stroke="#3B8BD0" strokeWidth="2" /> : null;
  // щёки при жевании надуваются — пухлая дуга поверх контура морды
  return (
    <g>
      {cheek(fl.cheekFar, fl.cheekFarOp, "cf")}
      {cheek(fl.cheekNear, 1, "cn")}
      {eyes.map((slot) => (
        <Eye key={slot.side} x={slot.x} y={eyeY} er={er} sx={slot.sx} op={slot.op} inner={innerOf(slot)} emo={e} closed={closed} look={look} iris={spec.eye} lid={spec.fur} />
      ))}
      {eyes.map(brow)}
      {nose}
      {philtrum}
      {whiskers}
      <Mouth spec={spec} e={e} open={open} x={fl.mouth.x} y={fl.mouth.y} r={r} wk={fl.mouth.w} />
      {tear}
      {spec.extra === "glasses" ? (
        <g fill="none" stroke={INK} strokeWidth="4">
          {eyes.map((slot) => (slot.op > 0.3 ? <ellipse key={slot.side} cx={slot.x} cy={eyeY} rx={er * 1.25 * slot.sx} ry={er * 1.25} /> : null))}
        </g>
      ) : null}
    </g>
  );
}

/** Позиция уха при повороте головы: ближнее уходит к макушке-затылку, дальнее — назад и темнеет. */
function earX(side: 1 | -1, s: 1 | -1, a: number, front: number, nearP: number, farP: number) {
  return side === s ? lerp(side * front, -s * nearP, a) : lerp(side * front, -s * farP, a);
}

/** Уши за головой (заяц, кошка, медведь; у собаки — дальнее в профиле). */
function EarsBack({ spec, r, t, e, s, a, follow }: { spec: CharacterSpec; r: number; t: number; e: CEmotion; s: 1 | -1; a: number; follow: number }) {
  const line = shade(spec.fur, 0.35);
  const droop = e === "sad" || e === "scared" ? 1 : e === "sleepy" ? 0.5 : 0;
  const order: (1 | -1)[] = [-s as 1 | -1, s];
  const dark = (side: 1 | -1) => (side === s ? 0 : 0.07 * a);
  if (spec.species === "bunny") {
    const sway = Math.sin(t * 2.2) * 3;
    return (
      <>
        {order.map((side) => {
          const x = earX(side, s, a, 0.32, 0.04, 0.3) * r;
          const dir = lerp(side, -s, a); // куда «откидывается» ухо: наружу в анфасе, назад в профиле
          const base = side === s ? lerp(12, 12, a) : lerp(12, 26, a);
          const rot = dir * (base + droop * 40 + follow * 16) + sway * side + (side === s ? 0 : Math.sin(t * 2.2 - 0.6) * 2);
          const fur = shade(spec.fur, dark(side));
          return (
            <g key={side} transform={`rotate(${rot} ${x} ${-r * 0.75})`}>
              <ellipse cx={x} cy={-r * 1.45} rx={r * 0.24} ry={r * 0.72} fill={fur} stroke={line} strokeWidth="4" />
              <ellipse cx={x} cy={-r * 1.4} rx={r * 0.12} ry={r * 0.54} fill={shade(spec.belly, dark(side))} />
              <ellipse cx={x - r * 0.08} cy={-r * 1.75} rx={r * 0.05} ry={r * 0.18} fill="#FFFFFF" opacity={0.18} />
            </g>
          );
        })}
      </>
    );
  }
  if (spec.species === "cat") {
    // подёргивание ухом раз в несколько секунд
    const tw = (() => {
      const ph = (t % 3.7) / 3.7;
      return ph < 0.06 ? Math.sin((ph / 0.06) * Math.PI) * 10 : 0;
    })();
    return (
      <>
        {order.map((side) => {
          const ax = earX(side, s, a, 0.55, 0.08, 0.4) * r;
          const ay = -r * 0.75 - (side === s ? a * r * 0.1 : a * r * 0.03);
          // ближнее ухо разворачивается не через «ноль» (тонкую щепку), а перескакивает в середине поворота
          const mx = side === s ? (a < 0.5 ? side * (1 - a * 0.6) : -s * (0.7 + (a - 0.5) * 0.6)) : lerp(side, -s, a);
          const rot = mx * (droop * 25 - follow * 8) + (side === s ? tw : 0);
          const fur = shade(spec.fur, dark(side));
          return (
            <g key={side} transform={`translate(${ax} ${ay}) rotate(${rot}) scale(${Math.abs(mx) < 0.08 ? 0.08 * Math.sign(mx || 1) : mx} 1)`}>
              <path d={`M${-r * 0.3} ${-r * 0.07} Q${-r * 0.06} ${-r * 0.4} ${r * 0.15} ${-r * 0.53} Q${r * 0.2} ${-r * 0.55} ${r * 0.21} ${-r * 0.48} Q${r * 0.28} ${-r * 0.1} ${r * 0.31} ${r * 0.25} Z`} fill={fur} stroke={line} strokeWidth="4" strokeLinejoin="round" />
              <path d={`M${-r * 0.15} ${-r * 0.06} Q${r * 0.0} ${-r * 0.25} ${r * 0.14} ${-r * 0.35} Q${r * 0.2} ${-r * 0.1} ${r * 0.22} ${r * 0.12} Z`} fill={shade(spec.belly, dark(side))} />
            </g>
          );
        })}
      </>
    );
  }
  if (spec.species === "bear") {
    const bounce = follow * 3;
    return (
      <>
        {order.map((side) => {
          const x = earX(side, s, a, 0.68, 0.22, 0.52) * r;
          const y = side === s ? lerp(-0.72, -0.84, a) * r : lerp(-0.72, -0.76, a) * r;
          const fur = shade(spec.fur, dark(side));
          return (
            <g key={side}>
              <circle cx={x} cy={y - bounce} r={r * 0.28} fill={fur} stroke={line} strokeWidth="4" />
              <circle cx={x} cy={y - bounce} r={r * 0.15} fill={shade(spec.belly, dark(side))} />
            </g>
          );
        })}
      </>
    );
  }
  // собака: дальнее ухо в профиле — за головой
  if (a > 0.45) return <DogEar side={-s as 1 | -1} ax={-s * 0.4 * r} ay={-r * 0.72} r={r} t={t} follow={follow} color={shade("#4A3426", 0.15)} />;
  return null;
}

function DogEar({ side, ax, ay, r, t, follow, color }: { side: 1 | -1; ax: number; ay: number; r: number; t: number; follow: number; color: string }) {
  const flap = Math.sin(t * 3) * 4 + follow * 14;
  return (
    <path
      d={`M${ax} ${ay} q${side * r * 0.42} ${r * 0.1} ${side * r * 0.36} ${r * 0.78} q${-side * r * 0.12} ${r * 0.16} ${-side * r * 0.3} ${-r * 0.08} z`}
      fill={color}
      stroke={shade(color, 0.35)}
      strokeWidth="4"
      strokeLinejoin="round"
      transform={`rotate(${side * flap} ${ax} ${ay})`}
    />
  );
}

/** Висячие уши собаки поверх головы. */
function DogEarsFront({ r, t, s, a, follow }: { r: number; t: number; s: 1 | -1; a: number; follow: number }) {
  const back = -s as 1 | -1;
  return (
    <>
      {/* ухо со стороны затылка — в профиле висит на макушке */}
      <DogEar side={back} ax={lerp(back * 0.62, back * 0.02, a) * r} ay={lerp(-0.62, -0.84, a) * r} r={r} t={t} follow={follow} color="#4A3426" />
      {a <= 0.45 ? <DogEar side={s} ax={lerp(s * 0.62, s * 0.5, a) * r} ay={-r * 0.62} r={r} t={t + 0.4} follow={follow} color="#4A3426" /> : null}
    </>
  );
}

/** Хвост — рисуется справа (x>0); в профиле зеркалится за спину. */
function Tail({ spec, t, follow }: { spec: CharacterSpec; t: number; follow: number }) {
  const line = shade(spec.fur, 0.35);
  const dog = spec.species === "dog";
  const wag = Math.sin(t * (dog ? 9 : 2.5)) * (dog ? 18 : 8) + follow * 12;
  if (spec.species === "bunny") return <circle cx={52} cy={-62 - follow * 3} r={20} fill="#FFFFFF" stroke={shade("#FFFFFF", 0.25)} strokeWidth="3.5" />;
  if (spec.species === "cat")
    return (
      <g transform={`rotate(${wag} 48 -60)`}>
        <path d="M48 -60 q60 -10 50 -80 q-4 -22 14 -26" stroke={line} strokeWidth="20" fill="none" strokeLinecap="round" />
        <path d="M48 -60 q60 -10 50 -80 q-4 -22 14 -26" stroke={spec.fur} strokeWidth="13" fill="none" strokeLinecap="round" />
      </g>
    );
  if (dog)
    return (
      <g transform={`rotate(${wag} 46 -70)`}>
        <path d="M46 -70 q34 -18 30 -54" stroke={line} strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d="M46 -70 q34 -18 30 -54" stroke={spec.fur} strokeWidth="10" fill="none" strokeLinecap="round" />
      </g>
    );
  return <circle cx={50} cy={-66 - follow * 2} r={14} fill={spec.fur} stroke={line} strokeWidth="3.5" />;
}

/* ───────────────────────────── персонаж ───────────────────────────── */

/** Персонаж в локальных координатах (ступни в 0,0). Оборачивай в <g transform="translate(x y) scale(s)">. */
export function Character({ spec, st, t }: { spec: CharacterSpec; st: CharState; t: number }) {
  const p = st.pose;
  const sk = skeleton(spec, p, t, st.facing, st.turn);
  const { m, f, k, fl, bodyTop, bodyBottom, headY } = sk;
  const { adult, legH, bodyH, bw, r } = m;
  const line = shade(spec.fur, 0.35);
  const sleeve = spec.outfit.kind === "tshirt" || spec.outfit.kind === "dress" ? spec.outfit.color : spec.fur;
  const follow = p.follow ?? 0;
  const back = clamp(p.back ?? 0, 0, 1);
  const s = fl.s;
  const a = fl.a;
  const open = Math.max(0, Math.min(1, Math.max(st.mouth, p.mouth ?? 0)));
  const auto = st.autoBlink === false ? 0 : blinkAt(spec.id, t);
  const closed = st.blink || p.shut ? 1 : auto;
  const stride = p.stride ?? 1;
  const hipX = bw * 0.42;
  const farShade = (c: string) => shade(c, 0.1 * k);
  // слои: в профиле дальняя (левая) рука за телом, ближняя (правая) — перед; поднятые руки и прятки — поверх головы
  const raised = (g: ArmG) => g.hy < sk.shoulderY - 40;
  // короткие ручки: поднятая кисть часто оказывается на фоне головы — тогда рука рисуется поверх, чтобы ладошку было видно
  const overHead = (g: ArmG) => g.hy < sk.shoulderY - 30 && Math.hypot(g.hx, (g.hy - headY) * 1.05) < r * 1.02;
  const coverK = p.reach?.L?.at === "eyes" || p.reach?.R?.at === "eyes" ? (p.reach?.k ?? 1) : 0;
  const armNode = (side: 1 | -1, dark: boolean) => {
    const g = side === 1 ? sk.R : sk.L;
    return <ArmView key={side} g={g} color={dark ? farShade(sleeve) : sleeve} hand={dark ? farShade(spec.fur) : spec.fur} side={side} f={f} k={k} />;
  };
  const profile = k > 0.5;
  const armsBehind = profile ? [armNode(-1, true)] : [];
  const armsFront: ReactNode[] = [];
  const armsTop: ReactNode[] = [];
  const front = profile ? [1 as const] : [-1 as const, 1 as const];
  const bothUp = raised(sk.L) && raised(sk.R);
  for (const side of front) {
    const g = side === 1 ? sk.R : sk.L;
    const top = coverK > 0.3 || overHead(g) || (profile ? raised(g) : bothUp);
    (top ? armsTop : armsFront).push(armNode(side, false));
  }
  // голова: наклон, кивок, лёгкое растяжение при открытом рте
  const hsx = 1 - open * 0.02 + (p.puff ?? 0) * 0.035;
  const hsy = 1 + open * 0.035;
  const headRx = r * (spec.species === "cat" ? 1.04 : 1);
  const headRy = r * (spec.species === "bunny" ? 0.96 : 0.9);
  const mz = fl.muzzle;
  const hasMuzzle = spec.species !== "bunny";
  const snout = hasMuzzle ? null : { x: s * a * 0.8 * r, y: r * 0.32 + fl.py, rx: r * 0.27, ry: r * 0.23 };
  const silhouette = (fill: string, stroke?: string, sw?: number) => (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <ellipse cx={0} cy={0} rx={headRx} ry={headRy} />
      {snout && a > 0.2 ? <ellipse cx={snout.x} cy={snout.y} rx={snout.rx} ry={snout.ry} /> : null}
      {hasMuzzle && back < 0.5 ? <ellipse cx={mz.x} cy={mz.y} rx={mz.rx} ry={mz.ry} fill={stroke ? undefined : spec.belly} /> : null}
    </g>
  );
  const breathe = 1 + Math.sin(t * 2.4) * 0.01;
  const tail = (
    <g transform={`translate(${-48 * back} 0) scale(${lerp(1, -f, k)} 1)`}>
      <Tail spec={spec} t={t} follow={follow} />
    </g>
  );
  const shadowK = Math.max(0.5, 1 - sk.lift / 300);
  return (
    <g>
      {/* тень — тёплая сиреневая, не серая */}
      <ellipse cx={0} cy={2} rx={bw * 1.1 * shadowK} ry={10 * shadowK} fill={SHADOW} opacity={0.2} />
      <g transform={`translate(0 ${-sk.lift}) rotate(${sk.lean} 0 ${-legH}) scale(${sk.sx} ${sk.sy})`}>
        {back < 0.5 ? tail : null}
        {armsBehind}
        <Leg hipX={lerp(-hipX, -f * 5, k)} phase={p.walk} f={f} k={k} stride={stride} color={farShade(spec.fur)} foot={farShade(shade(spec.fur, 0.12))} h={legH} footRx={spec.species === "bunny" ? 24 : 22} />
        <Leg hipX={lerp(hipX, f * 3, k)} phase={Number.isNaN(p.walk) ? p.walk : p.walk + Math.PI} f={f} k={k} stride={stride} color={spec.fur} foot={shade(spec.fur, 0.12)} h={legH} footRx={spec.species === "bunny" ? 24 : 22} />
        {/* тело (в профиле чуть уже, живот вперёд) */}
        <g transform={`translate(0 ${bodyBottom}) scale(${1 - 0.14 * k} ${breathe}) translate(0 ${-bodyBottom})`}>
          <path
            d={`M${-bw * 0.62} ${bodyTop + 12} Q0 ${bodyTop - 8} ${bw * 0.62} ${bodyTop + 12} Q${bw * 1.08} ${bodyBottom - bodyH * 0.35} ${bw * 0.9} ${bodyBottom - 6} Q0 ${bodyBottom + 14} ${-bw * 0.9} ${bodyBottom - 6} Q${-bw * 1.08} ${bodyBottom - bodyH * 0.35} ${-bw * 0.62} ${bodyTop + 12} Z`}
            fill={spec.fur}
            stroke={line}
            strokeWidth="4"
          />
          <ellipse cx={f * k * bw * 0.2} cy={bodyBottom - bodyH * 0.38} rx={bw * 0.55 * (1 - 0.2 * k)} ry={bodyH * 0.32} fill={spec.belly} opacity={0.9 * (1 - back)} />
          <Outfit spec={spec} bw={bw} top={bodyTop} bottom={bodyBottom} fwd={f * k} />
          {st.wear?.length ? <WearBody wear={st.wear} bw={bw} top={bodyTop} bottom={bodyBottom} /> : null}
          {spec.extra === "collar" ? (
            <g>
              <path d={`M${-bw * 0.6} ${bodyTop + 14} Q0 ${bodyTop + 30} ${bw * 0.6} ${bodyTop + 14}`} stroke="#E53950" strokeWidth="10" fill="none" strokeLinecap="round" />
              {back < 0.5 ? <circle cx={f * k * bw * 0.4} cy={bodyTop + 30 - k * 4} r={9} fill="#FFD54A" stroke="#B88A12" strokeWidth="2.5" /> : null}
            </g>
          ) : null}
        </g>
        {back >= 0.5 ? tail : null}
        {armsFront}
        {/* голова */}
        <g transform={`rotate(${p.tilt} 0 ${headY + r * 0.6})`}>
          <g transform={`translate(0 ${headY}) translate(0 ${r * 0.6}) scale(${hsx} ${hsy}) translate(0 ${-r * 0.6})`}>
            <EarsBack spec={spec} r={r} t={t} e={st.emotion} s={s} a={a} follow={follow} />
            {/* контур головы вместе с мордочкой — одним силуэтом (в два прохода), чтобы нос «выступал» в профиле */}
            {silhouette(line, line, 9)}
            {silhouette(spec.fur)}
            {hasMuzzle && back < 0.5 ? <ellipse cx={mz.x} cy={mz.y} rx={mz.rx} ry={mz.ry} fill="none" stroke={shade(spec.belly, 0.22)} strokeWidth="2.5" opacity={1 - a * 0.6} /> : null}
            <ellipse cx={-r * 0.3} cy={-r * 0.45} rx={r * 0.3} ry={r * 0.16} fill="#FFFFFF" opacity={0.18} transform={`rotate(-20 ${-r * 0.3} ${-r * 0.45})`} />
            {spec.species === "dog" && back < 0.5
              ? (() => {
                  // пятно вокруг правого глаза — едет вместе с ним
                  const slot = fl.near.side === 1 ? fl.near : fl.far;
                  return slot.op > 0.01 ? <ellipse cx={slot.x + r * 0.05 * slot.sx} cy={fl.eyeY - r * 0.12} rx={r * 0.3 * slot.sx} ry={r * 0.26} fill="#4A3426" opacity={0.85 * slot.op} /> : null;
                })()
              : null}
            {spec.species === "dog" ? <DogEarsFront r={r} t={t} s={s} a={a} follow={follow} /> : null}
            {back < 0.98 ? (
              <g opacity={1 - back}>
                <Face spec={spec} st={st} r={r} fl={fl} open={open} closed={closed} puff={p.puff ?? 0} />
              </g>
            ) : null}
            {st.wear?.length ? <WearHead wear={st.wear} r={r} /> : null}
            {spec.extra === "bow" ? (
              <g transform={`translate(${earX(1, s, a, 0.55, 0.08, 0.4) * r} ${-r * 0.8 - (s === 1 ? a * r * 0.1 : 0)})`}>
                <path d="M0 0 L-26 -16 Q-30 0 -26 16 Z M0 0 L26 -16 Q30 0 26 16 Z" fill="#FF5FA2" stroke={shade("#FF5FA2", 0.35)} strokeWidth="3" strokeLinejoin="round" />
                <circle r={8} fill="#FF8CC0" stroke={shade("#FF5FA2", 0.35)} strokeWidth="3" />
              </g>
            ) : null}
          </g>
        </g>
        {armsTop}
        {st.hold ? (
          <g transform={`translate(${sk.R.hx} ${sk.R.hy}) scale(${adult ? 0.95 : 0.85})`}>
            <Prop id={st.hold.id} color={st.hold.color} t={t} />
          </g>
        ) : null}
        {st.fx ? <FxLayer fx={st.fx} x={0} y={headY - r * 1.1} t={t} /> : null}
      </g>
    </g>
  );
}
