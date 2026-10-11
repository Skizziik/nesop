/**
 * Персонажи мультиков: векторная «перекладка» (как Peppa / Hey Duggee). Всё — собственная SVG-отрисовка.
 * Локальные координаты: (0,0) — точка между ступнями, рост ребёнка ~300, взрослого ~380. Вверх — отрицательный y.
 *
 * Вид героя — смесь анфаса и профиля: turn 0 — анфас (лёгкий поворот 3/4 к facing), 1 — профиль по направлению facing.
 * При ходьбе герой разворачивается в профиль: черты лица уходят к носу, дальний глаз/ухо/рука/нога — за телом и темнее.
 * Скелет (плечи, кисти, голова) считается одной функцией skeleton() и для отрисовки, и для handPositions — предмет в руке
 * всегда там, где нарисована кисть.
 */
import { useId, type ReactNode } from "react";
import { Prop } from "./props";
import { VISEME_OPEN, type Viseme } from "./lipsync";

export type Species = "bunny" | "cat" | "bear" | "dog" | "fox" | "mouse" | "elephant" | "lion";
export type CEmotion = "neutral" | "happy" | "laugh" | "sad" | "surprised" | "angry" | "scared" | "thinking" | "sleepy";

export interface CharacterSpec {
  id: string;
  name: string;
  species: Species;
  fur: string; // основной цвет
  belly: string; // мордочка / живот / внутренность ушей
  /** motif — рисунок на груди футболки (по умолчанию кружок цвета accent). */
  outfit: { kind: "overalls" | "dress" | "tshirt" | "apron" | "hoodie" | "sweater" | "none"; color: string; accent?: string; motif?: "star" };
  adult?: boolean;
  eye?: string;
  extra?: "collar" | "bow" | "glasses";
  /** Второй цвет меха: грива льва; кончики ушей, лапки и носочки лисы. */
  fur2?: string;
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
  /** Форма рта по липсинку (lipsync.ts): задана — рот рисуется по виземе (уголки — по эмоции), mouth — только громкость. */
  viseme?: Viseme;
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
  // мышка — самая маленькая в компании, слонёнок — крепкий и круглый (всё остальное — общий скелет ребёнка/взрослого)
  if (!adult && spec.species === "mouse") return { adult, legH: 28, bodyH: 98, bw: 52, r: 80, armLen: 40 };
  if (!adult && spec.species === "elephant") return { adult, legH: 36, bodyH: 116, bw: 64, r: 90, armLen: 44 };
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

/**
 * Геометрия мордочки по виду (в радиусах головы): где кончик мордочки/нос/рот в профиле (snoutX/noseX/mouthX — доля r при a=1),
 * полуширина мордочки в анфасе→профиле (mz), её высота (mzy), высота носа и рта. Заяц и кошка — исторические числа в faceLayout.
 * Слонёнок: нос — основание хобота, мордочки нет.
 */
const FACE_GEO: Partial<Record<Species, { snoutX: number; noseX: number; mouthX: number; mz: [number, number]; mzy: [number, number]; noseY: number; mouthY: number; eyeY?: number }>> = {
  bear: { snoutX: 0.7, noseX: 0.99, mouthX: 0.72, mz: [0.42, 0.37], mzy: [0.27, 0.25], noseY: 0.32, mouthY: 0.54 },
  dog: { snoutX: 0.7, noseX: 0.99, mouthX: 0.72, mz: [0.42, 0.37], mzy: [0.27, 0.25], noseY: 0.32, mouthY: 0.54 },
  fox: { snoutX: 0.8, noseX: 1.12, mouthX: 0.8, mz: [0.44, 0.4], mzy: [0.26, 0.21], noseY: 0.3, mouthY: 0.52 },
  mouse: { snoutX: 0.74, noseX: 1.06, mouthX: 0.76, mz: [0.36, 0.34], mzy: [0.24, 0.21], noseY: 0.31, mouthY: 0.52 },
  elephant: { snoutX: 0.7, noseX: 0.8, mouthX: 0.58, mz: [0.4, 0.36], mzy: [0.26, 0.24], noseY: 0.08, mouthY: 0.68, eyeY: -0.04 },
  lion: { snoutX: 0.68, noseX: 0.96, mouthX: 0.72, mz: [0.42, 0.36], mzy: [0.28, 0.25], noseY: 0.3, mouthY: 0.54 },
};

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
  const g = FACE_GEO[sp] ?? FACE_GEO.bear!;
  const snoutX = sp === "cat" ? 0.62 : sp === "bunny" ? 0.72 : g.snoutX;
  const noseX = sp === "cat" ? 0.9 : sp === "bunny" ? 1.02 : g.noseX;
  const mouthX = sp === "cat" ? 0.66 : sp === "bunny" ? 0.76 : g.mouthX;
  return {
    a,
    s,
    er,
    eyeY: r * (g.eyeY ?? 0.02) + py,
    py,
    near,
    far,
    muzzle: {
      x: s * a * snoutX * r,
      y: r * 0.44 + py - a * r * 0.04,
      rx: r * lerp(sp === "cat" ? 0.38 : g.mz[0], sp === "cat" ? 0.32 : g.mz[1], a),
      ry: r * lerp(g.mzy[0], g.mzy[1], a),
    },
    nose: { x: s * a * noseX * r, y: r * (sp === "bunny" ? 0.3 : g.noseY) + py - a * r * 0.05 },
    mouth: { x: s * a * mouthX * r, y: r * (sp === "bunny" ? 0.5 : g.mouthY) + py - a * r * 0.03, w: 1 - 0.35 * a },
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

function Leg({ hipX, phase, f, k, stride, color, foot, h, footRx, nails }: { hipX: number; phase: number; f: 1 | -1; k: number; stride: number; color: string; foot: string; h: number; footRx: number; nails?: boolean }) {
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
      {nails ? (
        // ноготки слонёнка: три светлых полукруга спереди стопы (в профиле — у носка)
        <g fill="#FFF8EE" stroke={shade(foot, 0.3)} strokeWidth="1.8" transform={rot ? `rotate(${rot} ${ax} ${-up - 5})` : undefined}>
          {[-1, 0, 1].map((i) => (k > 0.5 && i === -f ? null : <ellipse key={i} cx={fx + lerp(i * 9, f * (footRx - 6) + i * 4, k)} cy={-up + 1} rx={lerp(4.5, 3.4, k)} ry={3.6} />))}
        </g>
      ) : null}
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

/** Пятиконечная звезда (центр, внешний и внутренний радиус). */
function starPath(cx: number, cy: number, R: number, ri: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? ri : R;
    pts.push(`${(cx + Math.cos(ang) * rr).toFixed(2)} ${(cy + Math.sin(ang) * rr).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
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
        {o.motif === "star" ? (
          <path d={starPath(fwd * 16, top + 52, 17, 7.5)} fill={o.accent ?? "#FFFFFF"} stroke={shade(o.accent ?? "#FFFFFF", 0.3)} strokeWidth="2.5" strokeLinejoin="round" />
        ) : (
          <circle cx={fwd * 16} cy={top + 52} r={14} fill={o.accent ?? "#FFFFFF"} opacity={0.9} />
        )}
      </g>
    );
  if (o.kind === "hoodie") {
    // худи: длиннее футболки, капюшон складкой у шеи, шнурки и карман-кенгуру
    const ac = o.accent ?? "#FFFFFF";
    return (
      <g>
        <path d={`M${-bw * 0.82} ${top + 14} Q0 ${top + 2} ${bw * 0.82} ${top + 14} L${bw * 0.96} ${top + 100} Q0 ${top + 113} ${-bw * 0.96} ${top + 100} Z`} fill={o.color} stroke={line} strokeWidth="3.5" />
        <path d={`M${-bw * 0.96} ${top + 96} Q0 ${top + 109} ${bw * 0.96} ${top + 96}`} stroke={shade(o.color, 0.14)} strokeWidth="7" fill="none" />
        <path d={`M${-bw * 0.66} ${top + 12} Q0 ${top + 42} ${bw * 0.66} ${top + 12}`} stroke={line} strokeWidth="19" fill="none" strokeLinecap="round" />
        <path d={`M${-bw * 0.66} ${top + 12} Q0 ${top + 42} ${bw * 0.66} ${top + 12}`} stroke={shade(o.color, 0.1)} strokeWidth="13" fill="none" strokeLinecap="round" />
        {[-1, 1].map((sd) => (
          <g key={sd}>
            <path d={`M${fwd * 8 + sd * 9} ${top + 30} l${sd * 1.5} 22`} stroke={ac} strokeWidth="4" strokeLinecap="round" />
            <circle cx={fwd * 8 + sd * 10.5} cy={top + 54} r={3.6} fill={ac} />
          </g>
        ))}
        <path d={`M${-23 + fwd * 12} ${top + 66} L${23 + fwd * 12} ${top + 66} L${30 + fwd * 12} ${top + 92} L${-30 + fwd * 12} ${top + 92} Z`} fill={shade(o.color, 0.1)} stroke={line} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    );
  }
  if (o.kind === "sweater") {
    // свитер: до пояса, круглый ворот и резинка по низу, полоска узора на груди
    const ac = o.accent ?? "#FFFFFF";
    const hem = bottom - 10;
    return (
      <g>
        <path d={`M${-bw * 0.8} ${top + 14} Q0 ${top + 2} ${bw * 0.8} ${top + 14} Q${bw * 1.04} ${(top + hem) / 2} ${bw * 0.95} ${hem} Q0 ${hem + 16} ${-bw * 0.95} ${hem} Q${-bw * 1.04} ${(top + hem) / 2} ${-bw * 0.8} ${top + 14} Z`} fill={o.color} stroke={line} strokeWidth="3.5" />
        <path d={`M${-bw * 0.93} ${hem - 9} Q0 ${hem + 7} ${bw * 0.93} ${hem - 9}`} stroke={shade(o.color, 0.16)} strokeWidth="9" fill="none" />
        <path d={`M${-bw * 0.9} ${top + 58} Q0 ${top + 70} ${bw * 0.9} ${top + 58}`} stroke={ac} strokeWidth="7" fill="none" strokeDasharray="10 7" />
        <path d={`M${-bw * 0.5} ${top + 13} Q0 ${top + 34} ${bw * 0.5} ${top + 13}`} stroke={shade(o.color, 0.16)} strokeWidth="8" fill="none" strokeLinecap="round" />
      </g>
    );
  }
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
  const lid0 = LIDS[emo] ?? LIDS.neutral; // эмоция не из каталога (от LLM) не роняет рендер
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

/** У кого спокойный рот — «ω» и черта от носа ко рту (у остальных — улыбка). */
const OMEGA = new Set<Species>(["bunny", "cat", "fox", "mouse", "lion"]);

/** Рот по эмоции и открытости (голос/действие). Центр — (x, y), ширина w (в радиусах головы, с учётом ракурса). */
function Mouth({ spec, e, open, x, y, r, wk }: { spec: CharacterSpec; e: CEmotion; open: number; x: number; y: number; r: number; wk: number }) {
  const w = r * 0.17 * wk;
  const bunny = spec.species === "bunny" || spec.species === "mouse";
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
      // зайчик, котёнок, лисёнок, мышка, львёнок — «ω», мишка, щенок, слонёнок — улыбка
      if (OMEGA.has(spec.species))
        return <path d={`M${x - w * 0.8} ${y - 1} Q${x - w * 0.4} ${y + w * 0.62} ${x} ${y - 1} Q${x + w * 0.4} ${y + w * 0.62} ${x + w * 0.8} ${y - 1}`} {...stroke} />;
      return <path d={`M${x - w * 0.85} ${y} Q${x} ${y + r * 0.13} ${x + w * 0.85} ${y}`} {...stroke} />;
  }
}

/* ───────────────────────────── липсинк: рот по виземе ───────────────────────────── */

/** Эмоция поверх виземы: ширина, подъём уголков (+ вверх, в r·0.045), высота открытия, добавочная округлость. */
const VIS_EMO: Record<CEmotion, { wk: number; lift: number; hk: number; ro: number }> = {
  neutral: { wk: 1, lift: 0.15, hk: 1, ro: 0 },
  happy: { wk: 1.14, lift: 0.75, hk: 1, ro: 0 },
  laugh: { wk: 1.26, lift: 1, hk: 1.15, ro: 0 },
  sad: { wk: 0.92, lift: -0.7, hk: 0.9, ro: 0.1 },
  surprised: { wk: 0.8, lift: 0, hk: 1.15, ro: 0.45 },
  scared: { wk: 0.9, lift: -0.4, hk: 1.05, ro: 0.25 },
  angry: { wk: 0.96, lift: -0.45, hk: 0.92, ro: 0 },
  thinking: { wk: 0.92, lift: 0, hk: 0.9, ro: 0 },
  sleepy: { wk: 0.86, lift: 0, hk: 0.75, ro: 0.2 },
};

/**
 * Форма каждой виземы (в радиусах головы): полуширина W (от r·0.17), верх ht и низ hb открытия от линии рта,
 * округлость уголков ro (0 — острые, 1 — овал), зубы и язык.
 */
const VIS_SHAPE: Record<Exclude<Viseme, "X" | "A">, { W: number; ht: number; hb: number; ro: number; teeth?: number; tongue?: "low" | "up"; amp?: boolean }> = {
  B: { W: 0.92, ht: 0.012, hb: 0.065, ro: 0.15, teeth: 0.032 },
  C: { W: 1.0, ht: 0.03, hb: 0.15, ro: 0.25, tongue: "low", amp: true },
  D: { W: 1.08, ht: 0.045, hb: 0.25, ro: 0.4, tongue: "low", amp: true },
  E: { W: 0.66, ht: 0.06, hb: 0.15, ro: 0.92, tongue: "low", amp: true },
  F: { W: 0.42, ht: 0.05, hb: 0.08, ro: 1 },
  G: { W: 0.84, ht: 0.01, hb: 0.058, ro: 0.1, teeth: 0.05 },
  H: { W: 0.94, ht: 0.03, hb: 0.135, ro: 0.3, tongue: "up", amp: true },
};

const KAPPA = 0.5523;
/** Контур рта: уголки (x−wl, y+cl) и (x+wr, y+cr), верх y−ht и низ y+hb по центру, ro — округлость уголков. */
function lipPath(x: number, y: number, wl: number, wr: number, ht: number, hb: number, cl: number, cr: number, ro: number, top = true, bottom = true) {
  const Lx = x - wl;
  const Ly = y + cl;
  const Rx = x + wr;
  const Ry = y + cr;
  const Ty = y - ht;
  const By = y + hb;
  const k = KAPPA;
  const up = `C${Lx} ${Ly - k * (Ly - Ty) * ro} ${x - k * wl} ${Ty} ${x} ${Ty} C${x + k * wr} ${Ty} ${Rx} ${Ry - k * (Ry - Ty) * ro} ${Rx} ${Ry}`;
  const down = `C${Rx} ${Ry + k * (By - Ry) * ro} ${x + k * wr} ${By} ${x} ${By} C${x - k * wl} ${By} ${Lx} ${Ly + k * (By - Ly) * ro} ${Lx} ${Ly}`;
  if (top && bottom) return `M${Lx} ${Ly} ${up} ${down} Z`;
  return top ? `M${Lx} ${Ly} ${up}` : `M${Rx} ${Ry} ${down}`;
}

/**
 * Рот по виземе липсинка: форма — от звука, уголки и ширина — от эмоции (улыбается и говорит).
 * В профиле видна половина рта: передний уголок прижат к кончику мордочки, задний уходит к щеке.
 * Чернила (INK) — только контур, внутри — тёмно-малиновый рот, розовый язык, у зайчика — два передних зуба.
 */
function VisemeMouth({ spec, e, vis, amp, x, y, r, s, a }: { spec: CharacterSpec; e: CEmotion; vis: Viseme; amp: number; x: number; y: number; r: number; s: 1 | -1; a: number }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const em = VIS_EMO[e] ?? VIS_EMO.neutral;
  const bunny = spec.species === "bunny" || spec.species === "mouse";
  const w0 = r * 0.17;
  // половины ширины: передняя (к носу) сжимается в профиле, задняя чуть длиннее
  const halves = (W: number): [number, number] => {
    const front = W * (1 - 0.55 * a);
    const back = W * (1 + 0.12 * a);
    return s === 1 ? [back, front] : [front, back];
  };
  const lift = em.lift * r * 0.045;
  // уголок спереди в профиле не поднимается (он на кончике мордочки)
  const corners = (c: number): [number, number] => (s === 1 ? [c, c * (1 - a)] : [c * (1 - a), c]);
  const line = { stroke: INK, strokeWidth: 4.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (vis === "A") {
    // губы сомкнуты (M/B/P): короткая сжатая линия с изгибом по эмоции + пухлая нижняя губка
    const [wl, wr] = halves(w0 * 0.78 * em.wk);
    const [cl, cr] = corners(-lift * 0.9);
    const smile = r * (0.012 + Math.max(0, em.lift) * 0.04) - Math.max(0, -em.lift) * r * 0.05;
    const omega = OMEGA.has(spec.species) && (e === "neutral" || e === "thinking");
    const d = omega
      ? `M${x - wl} ${y - 1 + cl} Q${x - wl * 0.5} ${y + wl * 0.36} ${x} ${y} Q${x + wr * 0.5} ${y + wr * 0.36} ${x + wr} ${y - 1 + cr}`
      : `M${x - wl} ${y + cl} Q${x} ${y + smile * 2} ${x + wr} ${y + cr}`;
    const lipW = (wl + wr) * 0.22;
    const lipY = y + (omega ? wl * 0.2 : smile) + r * 0.05;
    return (
      <g>
        <path d={d} {...line} />
        <path d={`M${x - lipW} ${lipY} Q${x} ${lipY + r * 0.035} ${x + lipW} ${lipY}`} stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.55} />
      </g>
    );
  }
  if (vis === "X") return null;
  const sh = VIS_SHAPE[vis];
  const ak = sh.amp ? 0.78 + 0.4 * amp : 1;
  const W = w0 * sh.W * em.wk * (sh.amp ? 0.96 + 0.08 * amp : 1);
  const [wl, wr] = halves(W);
  const ht = r * sh.ht;
  const hb = r * sh.hb * em.hk * ak;
  const ro = clamp(sh.ro + em.ro, 0, 1);
  // уголки: чуть выше линии рта, поднятые улыбкой (у округлых визем — меньше)
  const cLift = -lift * (1 - sh.ro * 0.7) - ht * 0.2;
  const [cl, cr] = corners(cLift);
  const d = lipPath(x, y, wl, wr, ht, hb, cl, cr, ro);
  const cx = x + (wr - wl) * 0.3;
  const Ty = y - ht;
  const By = y + hb;
  const inner: ReactNode[] = [];
  if (sh.tongue === "low") inner.push(<ellipse key="t" cx={cx} cy={By - (hb + ht) * 0.12} rx={Math.min(wl, wr) * 0.62 + W * 0.1} ry={(hb + ht) * 0.38} fill={TONGUE} />);
  if (sh.tongue === "up")
    inner.push(
      <g key="t">
        <ellipse cx={cx} cy={By + (hb + ht) * 0.05} rx={W * 0.62} ry={(hb + ht) * 0.4} fill={TONGUE} />
        <ellipse cx={cx} cy={Ty + (hb + ht) * 0.42} rx={W * 0.3} ry={(hb + ht) * 0.4} fill={TONGUE} />
        <path d={`M${cx} ${Ty + (hb + ht) * 0.3} V${By}`} stroke={shade(TONGUE, 0.18)} strokeWidth={2} />
      </g>,
    );
  if (sh.teeth && !bunny) {
    // ряд верхних зубов вдоль верхней губы (на F/V — до нижней губы)
    const th = r * sh.teeth;
    inner.push(<path key="z" d={`${lipPath(x, y, wl, wr, ht, hb, cl, cr, ro, true, false)} L${x + wr} ${y + cr + th * 0.4} Q${x} ${Ty + th * 1.6} ${x - wl} ${y + cl + th * 0.4} Z`} fill="#FFFFFF" />);
  }
  // зайчик: два передних зуба из-под верхней губы (на F/V — лежат на нижней губе)
  const buck =
    bunny && vis !== "F" && vis !== "E"
      ? (() => {
          const tw = Math.min(W * 0.3, r * 0.06) * (1 - 0.3 * a);
          const tH = vis === "G" ? hb + ht + r * 0.03 : Math.min(r * 0.075, (hb + ht) * 0.75 + r * 0.02);
          const tx = x + (s === 1 ? 1 : -1) * a * W * 0.15;
          const ty = Ty + 1.2;
          const tooth = (ox: number) => <rect key={ox} x={tx + ox} y={ty} width={tw} height={tH} rx={Math.min(3.5, tw * 0.35)} fill="#FFFFFF" stroke={shade("#FFFFFF", 0.28)} strokeWidth="1.6" />;
          return <g>{a > 0.7 ? tooth(-tw * 0.5) : [tooth(-tw - 0.6), tooth(0.6)]}</g>;
        })()
      : null;
  return (
    <g>
      <defs>
        <clipPath id={`m${uid}`}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={MOUTH} />
      <g clipPath={`url(#m${uid})`}>{inner}</g>
      <path d={d} fill="none" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      {vis === "F" ? (
        // трубочка: маленькие складочки губ по бокам
        <g stroke={INK} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} fill="none">
          <path d={`M${x - wl - r * 0.045} ${y - r * 0.01} q${-r * 0.02} ${r * 0.04} 0 ${r * 0.075}`} opacity={s === -1 ? 1 - a : 1} />
          <path d={`M${x + wr + r * 0.045} ${y - r * 0.01} q${r * 0.02} ${r * 0.04} 0 ${r * 0.075}`} opacity={s === 1 ? 1 - a : 1} />
        </g>
      ) : null}
      {buck}
    </g>
  );
}

/** Нос мишки/щенка и гостей: тёмная пуговка (медведь, собака, лиса), розовая бусинка (мышка), треугольник (лев); у слона — хобот. */
function GuestNose({ spec, n, r }: { spec: CharacterSpec; n: { x: number; y: number }; r: number }) {
  const sp = spec.species;
  if (sp === "elephant") return null;
  if (sp === "mouse")
    return (
      <g>
        <ellipse cx={n.x} cy={n.y} rx={r * 0.085} ry={r * 0.07} fill="#FF8FAE" stroke={shade("#FF8FAE", 0.35)} strokeWidth="2.5" />
        <ellipse cx={n.x - r * 0.028} cy={n.y - r * 0.026} rx={r * 0.028} ry={r * 0.018} fill="#FFFFFF" opacity={0.6} />
      </g>
    );
  if (sp === "lion") {
    const c = "#B8645A";
    return (
      <g>
        <path d={`M${n.x - r * 0.1} ${n.y - r * 0.045} Q${n.x} ${n.y - r * 0.085} ${n.x + r * 0.1} ${n.y - r * 0.045} Q${n.x + r * 0.08} ${n.y + r * 0.035} ${n.x} ${n.y + r * 0.065} Q${n.x - r * 0.08} ${n.y + r * 0.035} ${n.x - r * 0.1} ${n.y - r * 0.045} Z`} fill={c} stroke={shade(c, 0.35)} strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx={n.x - r * 0.03} cy={n.y - r * 0.035} rx={r * 0.03} ry={r * 0.016} fill="#FFFFFF" opacity={0.5} />
      </g>
    );
  }
  if (sp === "fox") {
    const k = 0.82;
    return (
      <g>
        <ellipse cx={n.x} cy={n.y} rx={r * 0.13 * k} ry={r * 0.09 * k} fill="#4A2E36" stroke={shade("#4A2E36", 0.3)} strokeWidth="2" />
        <ellipse cx={n.x - r * 0.04 * k} cy={n.y - r * 0.035 * k} rx={r * 0.04 * k} ry={r * 0.022 * k} fill="#FFFFFF" opacity={0.55} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={n.x} cy={n.y} rx={r * 0.13} ry={r * 0.09} fill="#4A2E36" stroke={shade("#4A2E36", 0.3)} strokeWidth="2" />
      <ellipse cx={n.x - r * 0.04} cy={n.y - r * 0.035} rx={r * 0.04} ry={r * 0.022} fill="#FFFFFF" opacity={0.55} />
    </g>
  );
}

type Pt = [number, number];
/** Точка и касательная кубической Безье при u. */
function bez(p: Pt[], u: number): { x: number; y: number; dx: number; dy: number } {
  const [a, b, c, d] = p as [Pt, Pt, Pt, Pt];
  const v = 1 - u;
  const x = v * v * v * a[0] + 3 * v * v * u * b[0] + 3 * v * u * u * c[0] + u * u * u * d[0];
  const y = v * v * v * a[1] + 3 * v * v * u * b[1] + 3 * v * u * u * c[1] + u * u * u * d[1];
  const dx = 3 * v * v * (b[0] - a[0]) + 6 * v * u * (c[0] - b[0]) + 3 * u * u * (d[0] - c[0]);
  const dy = 3 * v * v * (b[1] - a[1]) + 6 * v * u * (c[1] - b[1]) + 3 * u * u * (d[1] - c[1]);
  return { x, y, dx, dy };
}

/** Хобот: точки кривой в радиусах головы, x — в сторону взгляда. Анфас / профиль × опущен / поднят (основание — в носе faceLayout). */
const TRUNK: Record<"front" | "prof" | "frontUp" | "profUp", Pt[]> = {
  front: [[0, 0.08], [-0.01, 0.3], [0.01, 0.46], [0.11, 0.54]],
  prof: [[0.8, 0.06], [1.14, 0.32], [1.34, 0.6], [1.5, 0.38]],
  frontUp: [[0, 0.08], [0.02, 0.4], [0.44, 0.52], [0.6, 0.24]],
  profUp: [[0.8, 0.06], [1.18, 0.1], [1.34, -0.2], [1.26, -0.5]],
};

/**
 * Хобот слонёнка вместо носа: короткий, сужается к кончику, мягко покачивается.
 * В анфасе свисает между глазами к улыбке (рот виден под ним), в профиле — вперёд от мордочки, кончик загнут вверх.
 * Радость поднимает хобот («тру-у!»): смех — вверх, удивление — наполовину; грусть и сон — опускают.
 * Рисуется заливкой по кривой с переменной шириной; контур не замыкается у основания — хобот «растёт» из мордочки.
 */
function Trunk({ spec, r, fl, e, t }: { spec: CharacterSpec; r: number; fl: ReturnType<typeof faceLayout>; e: CEmotion; t: number }) {
  const { s, a } = fl;
  const up = e === "laugh" ? 1 : e === "surprised" ? 0.55 : e === "happy" ? 0.12 : e === "sad" || e === "sleepy" ? -0.25 : 0;
  const sw = Math.sin(t * 1.7) * 0.03 + Math.sin(t * 0.9 + 1) * 0.012;
  const kU = clamp(up, 0, 1);
  const pts: Pt[] = TRUNK.front.map((f0, i) => {
    const pr = TRUNK.prof[i]!;
    const fu = TRUNK.frontUp[i]!;
    const pu = TRUNK.profUp[i]!;
    let x = lerp(lerp(f0[0], pr[0], a), lerp(fu[0], pu[0], a), kU);
    let y = lerp(lerp(f0[1], pr[1], a), lerp(fu[1], pu[1], a), kU);
    if (i >= 2) {
      const tipK = i === 3 ? 1 : 0.5;
      x += sw * tipK;
      y += -Math.min(0, up) * 0.14 * tipK;
    }
    return [s * x * r, y * r];
  });
  pts[0] = [fl.nose.x + s * a * r * 0.04, fl.nose.y + a * r * 0.18]; // в профиле хобот растёт ниже глаза, ближе ко рту
  const W0 = r * 0.36;
  const W1 = r * 0.24;
  const N = 20;
  const Ls: Pt[] = [];
  const Rs: Pt[] = [];
  const at = (u: number) => {
    const q = bez(pts, u);
    const len = Math.hypot(q.dx, q.dy) || 1;
    return { ...q, tx: q.dx / len, ty: q.dy / len, w: lerp(W0, W1, Math.sqrt(u)) / 2 };
  };
  for (let i = 0; i <= N; i++) {
    const q = at(i / N);
    Ls.push([q.x - q.ty * q.w, q.y + q.tx * q.w]);
    Rs.push([q.x + q.ty * q.w, q.y - q.tx * q.w]);
  }
  const end = at(1);
  const hk = end.w * 1.33;
  const lN = Ls[N]!;
  const rN = Rs[N]!;
  const cap = `C${lN[0] + end.tx * hk} ${lN[1] + end.ty * hk} ${rN[0] + end.tx * hk} ${rN[1] + end.ty * hk} ${rN[0]} ${rN[1]}`;
  const run = (arr: Pt[]) => arr.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L");
  const K = 4; // контур — от этой точки (у основания контура нет)
  const fill = `M${run(Ls)} ${cap} L${run([...Rs].reverse())} Z`;
  const outline = `M${run(Ls.slice(K))} ${cap} L${run(Rs.slice(K).reverse())}`;
  const line = shade(spec.fur, 0.35);
  const ridges = [0.48, 0.62, 0.76].map((u) => {
    const q = at(u);
    const nx = -q.ty * q.w * 0.62;
    const ny = q.tx * q.w * 0.62;
    return <path key={u} d={`M${q.x - nx} ${q.y - ny} Q${q.x + q.tx * 3} ${q.y + q.ty * 3} ${q.x + nx} ${q.y + ny}`} />;
  });
  // ноздри у кончика: две точки в анфасе, одна в профиле
  const nq = at(0.96);
  const nost = a > 0.6 ? [0] : [-1, 1];
  return (
    <g>
      <path d={fill} fill={spec.fur} />
      <path d={outline} fill="none" stroke={line} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g stroke={line} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity={0.5}>
        {ridges}
      </g>
      <g fill={shade(spec.fur, 0.42)} opacity={0.8}>
        {nost.map((k) => (
          <ellipse key={k} cx={nq.x - nq.ty * nq.w * 0.38 * k + nq.tx * 2} cy={nq.y + nq.tx * nq.w * 0.38 * k + nq.ty * 2} rx={W1 * 0.1} ry={W1 * 0.13} />
        ))}
      </g>
    </g>
  );
}

/** Очки (папа): круглые оправы цвета ореха, перемычка над носом; в профиле — одно стекло и дужка к уху. */
function Glasses({ fl, r }: { fl: ReturnType<typeof faceLayout>; r: number }) {
  const frame = "#6B4A3A";
  const { er, eyeY, s, a } = fl;
  const rx = (slot: EyeSlot) => er * 1.24 * slot.sx;
  const lens = (slot: EyeSlot) => (slot.op > 0.3 ? <ellipse key={slot.side} cx={slot.x} cy={eyeY} rx={rx(slot)} ry={er * 1.2} opacity={slot.near ? 1 : slot.op} /> : null);
  const inN = fl.near.x - s * rx(fl.near);
  const inF = fl.far.x + s * rx(fl.far);
  return (
    <g>
      <g fill="#FFFFFF" opacity={0.16}>
        {lens(fl.far)}
        {lens(fl.near)}
      </g>
      <g fill="none" stroke={frame} strokeWidth="4.5" strokeLinecap="round">
        {lens(fl.far)}
        {lens(fl.near)}
        {fl.far.op > 0.3 ? <path d={`M${inF} ${eyeY - er * 0.25} Q${(inF + inN) / 2} ${eyeY - er * 0.6} ${inN} ${eyeY - er * 0.25}`} opacity={fl.far.op} /> : null}
        {/* дужка к уху — только когда дальнее стекло скрылось (иначе она перечёркивает его в 3/4) */}
        {a > 0.5 && fl.far.op < 0.6 ? <path d={`M${inN} ${eyeY - er * 0.2} L${-s * r * 0.5} ${eyeY - er * 0.5}`} opacity={1 - fl.far.op / 0.6} /> : null}
      </g>
      <path d={`M${fl.near.x - er * 0.8 * fl.near.sx} ${eyeY - er * 0.55} q${er * 0.25} ${-er * 0.35} ${er * 0.6} ${-er * 0.4}`} stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" opacity={0.55} />
    </g>
  );
}

/** Мордочка: щёки, глаза, брови, нос, рот, усы. Центр — середина головы. */
function Face({ spec, st, r, fl, open, closed, puff, vis, amp = 0.5, t = 0 }: { spec: CharacterSpec; st: CharState; r: number; fl: ReturnType<typeof faceLayout>; open: number; closed: number; puff: number; vis?: Viseme; amp?: number; t?: number }) {
  const e = st.emotion;
  const { er, eyeY, s, a } = fl;
  const look: [number, number] = [clamp(st.look[0] + s * a * 0.6 + (e === "thinking" ? s * 0.5 : 0), -1, 1), clamp(st.look[1] + (e === "thinking" ? -0.9 : 0), -1, 1)];
  const eyes = [fl.far, fl.near];
  // в анфасе «к носу» — к центру; в профиле у ближнего глаза нос впереди
  const innerOf = (slot: EyeSlot): 1 | -1 => (slot.near ? (a > 0.5 ? s : (-slot.side as 1 | -1)) : s);
  const [bin, bout, braise] = BROWS[e] ?? BROWS.neutral;
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
      <GuestNose spec={spec} n={n} r={r} />
    );
  // «филтрум» от носа ко рту — у зайчика и котёнка (пока говорит — постоянно, без мигания между звуками; в профиле — нет)
  const philtrum = OMEGA.has(spec.species) && (st.viseme !== undefined && (st.pose.mouth ?? 0) < 0.35 ? a < 0.5 : open < 0.12) && (e === "neutral" || e === "thinking") ? <path d={`M${n.x} ${n.y + r * 0.05} L${fl.mouth.x} ${fl.mouth.y - 1}`} stroke={INK} strokeWidth="4" strokeLinecap="round" /> : null;
  const whiskers =
    spec.species === "cat" || spec.species === "mouse" ? (
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
    ) : spec.species === "lion" ? (
      // львёнок: точки у основания усов
      <g fill={shade(spec.belly, 0.38)}>
        {[-1, 1].map((sd) =>
          sd === -s && a > 0.5
            ? null
            : [0, 1, 2].map((i) => <circle key={`${sd}${i}`} cx={mz.x + sd * mz.rx * (0.42 + (i % 2) * 0.16) * (1 - 0.3 * a)} cy={mz.y - r * 0.06 + i * r * 0.055} r={r * 0.022} />),
        )}
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
      {spec.species === "elephant" ? <Trunk spec={spec} r={r} fl={fl} e={e} t={t} /> : null}
      {eyes.map((slot) => (
        <Eye key={slot.side} x={slot.x} y={eyeY} er={er} sx={slot.sx} op={slot.op} inner={innerOf(slot)} emo={e} closed={closed} look={look} iris={spec.eye} lid={spec.fur} />
      ))}
      {eyes.map(brow)}
      {nose}
      {philtrum}
      {whiskers}
      {vis ? <VisemeMouth spec={spec} e={e} vis={vis} amp={amp} x={fl.mouth.x} y={fl.mouth.y} r={r} s={s} a={a} /> : <Mouth spec={spec} e={e} open={open} x={fl.mouth.x} y={fl.mouth.y} r={r} wk={fl.mouth.w} />}
      {tear}
      {spec.extra === "glasses" ? <Glasses fl={fl} r={r} /> : null}
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
  if (spec.species === "fox") return <FoxEars spec={spec} r={r} t={t} droop={droop} s={s} a={a} follow={follow} />;
  if (spec.species === "mouse") {
    const wob = Math.sin(t * 2.6) * 2 + follow * 6;
    return (
      <>
        {order.map((side) => {
          const x = earX(side, s, a, 0.7, 0.14, 0.52) * r;
          const y = (side === s ? lerp(-0.66, -0.8, a) : lerp(-0.66, -0.74, a)) * r + droop * r * 0.08;
          const R = r * 0.5;
          const fur = shade(spec.fur, dark(side));
          const rot = side * (wob + droop * 18) * (side === s ? 1 : 0.7);
          return (
            <g key={side} transform={`rotate(${rot} ${x} ${y + R * 0.6})`}>
              <circle cx={x} cy={y} r={R} fill={fur} stroke={line} strokeWidth="4" />
              <circle cx={x + side * R * 0.06 * (1 - a)} cy={y + R * 0.06} r={R * 0.68} fill={shade(EAR_PINK, dark(side))} />
              <ellipse cx={x - R * 0.35} cy={y - R * 0.42} rx={R * 0.18} ry={R * 0.1} fill="#FFFFFF" opacity={0.22} transform={`rotate(-30 ${x - R * 0.35} ${y - R * 0.42})`} />
            </g>
          );
        })}
      </>
    );
  }
  if (spec.species === "elephant") return <ElephantEars spec={spec} r={r} t={t} droop={droop} s={s} a={a} follow={follow} layer="back" />;
  if (spec.species === "lion") {
    const bounce = follow * 3;
    return (
      <>
        <Mane spec={spec} r={r} t={t} s={s} a={a} follow={follow} />
        {order.map((side) => {
          const x = earX(side, s, a, 0.6, 0.2, 0.5) * r;
          const y = side === s ? lerp(-0.74, -0.84, a) * r : lerp(-0.74, -0.78, a) * r;
          const fur = shade(spec.fur, dark(side));
          return (
            <g key={side}>
              <circle cx={x} cy={y - bounce} r={r * 0.24} fill={fur} stroke={line} strokeWidth="4" />
              <circle cx={x} cy={y - bounce} r={r * 0.13} fill={shade(spec.belly, dark(side))} />
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

const EAR_PINK = "#FFB8CB";

/**
 * Уши лисёнка: высокие острые с тёмными кончиками (fur2) и светлой серединкой. Ближнее в профиле, как у кошки,
 * перескакивает на затылок в середине поворота (без «щепки» нулевой ширины).
 */
function FoxEars({ spec, r, t, droop, s, a, follow }: { spec: CharacterSpec; r: number; t: number; droop: number; s: 1 | -1; a: number; follow: number }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const line = shade(spec.fur, 0.35);
  const tipC = spec.fur2 ?? shade(spec.fur, 0.5);
  const order: (1 | -1)[] = [-s as 1 | -1, s];
  const tw = (() => {
    const ph = ((t + 1.3) % 4.3) / 4.3;
    return ph < 0.05 ? Math.sin((ph / 0.05) * Math.PI) * 9 : 0;
  })();
  // ухо в локальных координатах: основание на (0,0), остриё вверх и чуть наружу (+x)
  const outer = `M${-r * 0.27} ${r * 0.06} Q${-r * 0.2} ${-r * 0.42} ${r * 0.06} ${-r * 0.74} Q${r * 0.13} ${-r * 0.78} ${r * 0.15} ${-r * 0.68} Q${r * 0.26} ${-r * 0.34} ${r * 0.3} ${r * 0.2} Z`;
  const inner = `M${-r * 0.13} ${r * 0.04} Q${-r * 0.08} ${-r * 0.28} ${r * 0.06} ${-r * 0.48} Q${r * 0.15} ${-r * 0.24} ${r * 0.18} ${r * 0.12} Z`;
  return (
    <>
      {order.map((side) => {
        const ax = earX(side, s, a, 0.52, 0.06, 0.38) * r;
        const ay = -r * 0.7 - (side === s ? a * r * 0.1 : a * r * 0.03);
        const mx = side === s ? (a < 0.5 ? side * (1 - a * 0.6) : -s * (0.7 + (a - 0.5) * 0.6)) : lerp(side, -s, a);
        const rot = mx * (droop * 30 - follow * 8 + 6) + (side === s ? tw : 0);
        const dk = side === s ? 0 : 0.07 * a;
        const id = `fe${uid}${side === 1 ? "r" : "l"}`;
        return (
          <g key={side} transform={`translate(${ax} ${ay}) rotate(${rot}) scale(${Math.abs(mx) < 0.08 ? 0.08 * Math.sign(mx || 1) : mx} 1)`}>
            <defs>
              <clipPath id={id}>
                <path d={outer} />
              </clipPath>
            </defs>
            <path d={outer} fill={shade(spec.fur, dk)} />
            <path d={inner} fill={shade(spec.belly, dk)} />
            <g clipPath={`url(#${id})`}>
              <path d={`M${-r * 0.4} ${-r * 0.44} Q${r * 0.05} ${-r * 0.54} ${r * 0.4} ${-r * 0.4} L${r * 0.4} ${-r * 0.9} L${-r * 0.4} ${-r * 0.9} Z`} fill={shade(tipC, dk)} />
            </g>
            <path d={outer} fill="none" stroke={line} strokeWidth="4" strokeLinejoin="round" />
          </g>
        );
      })}
    </>
  );
}

/**
 * Большие мягкие уши слонёнка. В анфасе — оба за головой по бокам. При повороте ухо со стороны затылка
 * переезжает на бок головы и в профиле рисуется поверх неё (layer="front"), ближнее уходит за голову.
 * Уши плавно «обмахиваются» (сжатие по ширине) и опускаются, когда грустно.
 */
function ElephantEars({ spec, r, t, droop, s, a, follow, layer }: { spec: CharacterSpec; r: number; t: number; droop: number; s: 1 | -1; a: number; follow: number; layer: "back" | "front" }) {
  const line = shade(spec.fur, 0.35);
  const flap = Math.sin(t * 2.1) * 0.05 + follow * 0.1;
  const SWITCH = 0.5;
  const ear = (side: 1 | -1, onHead: boolean) => {
    const near = side === s;
    const ax = (near ? lerp(side * 0.8, side * 0.45, a) : lerp(side * 0.8, side * 0.08, a)) * r;
    const ay = lerp(-0.1, -0.12, a) * r;
    const w = (onHead ? lerp(0.95, 1.05, a) : 1) * (1 + flap * (near ? 1 : 0.8));
    const dk = onHead ? 0 : near ? 0 : 0.06 * a;
    const fur = shade(spec.fur, dk);
    const rot = side * (droop * 14 + Math.sin(t * 2.1 + 0.5) * 1.5);
    return (
      <g key={`${side}${onHead ? "h" : "b"}`} transform={`translate(${ax} ${ay}) rotate(${rot}) scale(${side * w} 1)`}>
        <path d={`M0 ${-r * 0.42} C${r * 0.36} ${-r * 0.7} ${r * 0.8} ${-r * 0.52} ${r * 0.74} ${-r * 0.02} C${r * 0.7} ${r * 0.44} ${r * 0.34} ${r * 0.66} ${r * 0.02} ${r * 0.4} Z`} fill={fur} stroke={line} strokeWidth="4" strokeLinejoin="round" />
        <path d={`M${r * 0.12} ${-r * 0.3} C${r * 0.38} ${-r * 0.5} ${r * 0.66} ${-r * 0.36} ${r * 0.6} ${-r * 0.02} C${r * 0.56} ${r * 0.3} ${r * 0.34} ${r * 0.46} ${r * 0.12} ${r * 0.26} Z`} fill={shade(EAR_PINK, dk)} opacity={0.9} />
        <ellipse cx={r * 0.42} cy={-r * 0.44} rx={r * 0.12} ry={r * 0.06} fill="#FFFFFF" opacity={0.2} transform={`rotate(-12 ${r * 0.42} ${-r * 0.44})`} />
      </g>
    );
  };
  const back = -s as 1 | -1;
  if (layer === "front") return a > SWITCH ? ear(back, true) : null;
  return (
    <>
      {a <= SWITCH ? ear(back, false) : null}
      {ear(s, false)}
    </>
  );
}

/** Грива львёнка: пушистый круг с фестонами за головой; в профиле сдвигается к затылку. */
function Mane({ spec, r, t, s, a, follow }: { spec: CharacterSpec; r: number; t: number; s: 1 | -1; a: number; follow: number }) {
  const c = spec.fur2 ?? shade(spec.fur, 0.25);
  const cx = -s * a * 0.2 * r;
  const cy = r * 0.06;
  const rx = r * lerp(1.34, 1.2, a) * (1 + follow * 0.03);
  const ry = r * 1.24 * (1 + follow * 0.03);
  const N = 14;
  const ph = Math.sin(t * 1.6) * 0.012;
  const pt = (i: number, k: number): Pt => {
    const th = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(th) * rx * k, cy + Math.sin(th) * ry * k];
  };
  let d = "";
  for (let i = 0; i < N; i++) {
    const [x0, y0] = pt(i, 0.9);
    const [qx, qy] = pt(i + 0.5, 1.08 + ph * (i % 2 ? 1 : -1));
    const [x1, y1] = pt(i + 1, 0.9);
    d += `${i === 0 ? `M${x0} ${y0}` : ""} Q${qx} ${qy} ${x1} ${y1}`;
  }
  return (
    <g>
      <path d={d + " Z"} fill={c} stroke={shade(c, 0.32)} strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.84} ry={ry * 0.84} fill={shade(c, 0.1)} opacity={0.5} />
      <ellipse cx={cx - rx * 0.45} cy={cy - ry * 0.55} rx={rx * 0.2} ry={ry * 0.09} fill="#FFFFFF" opacity={0.16} transform={`rotate(-35 ${cx - rx * 0.45} ${cy - ry * 0.55})`} />
    </g>
  );
}

/** Чёлка гривы на макушке львёнка — три пушистых завитка поверх головы, едут к носу при повороте. */
function ManeTuft({ spec, r, s, a }: { spec: CharacterSpec; r: number; s: 1 | -1; a: number }) {
  const c = spec.fur2 ?? shade(spec.fur, 0.25);
  const x0 = s * a * 0.12 * r;
  const curls: [number, number, number][] = [
    [-0.15, -0.8, -28],
    [0.15, -0.8, 28],
    [0, -0.86, 0],
  ];
  return (
    <g fill={c} stroke={shade(c, 0.32)} strokeWidth="3.5">
      {curls.map(([dx, dy, rot], i) => {
        const x = x0 + dx * r * (1 - 0.45 * a);
        const y = dy * r;
        return <ellipse key={i} cx={x} cy={y} rx={r * 0.12} ry={r * 0.2} transform={`rotate(${rot + s * a * 15} ${x} ${y + r * 0.12})`} />;
      })}
    </g>
  );
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
  if (spec.species === "fox") return <FoxTail spec={spec} t={t} follow={follow} />;
  if (spec.species === "mouse") {
    const c = "#F4A7B9";
    const d = "M44 -46 q44 14 58 -18 q10 -26 -10 -36 q-16 -6 -18 10";
    return (
      <g transform={`rotate(${Math.sin(t * 2.2) * 7 + follow * 10} 44 -46)`}>
        <path d={d} stroke={shade(c, 0.35)} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={d} stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (spec.species === "elephant") {
    const d = "M50 -66 q22 8 24 34";
    return (
      <g transform={`rotate(${Math.sin(t * 2.6) * 9 + follow * 10} 50 -66)`}>
        <path d={d} stroke={line} strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d={d} stroke={spec.fur} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M74 -36 q-9 8 -4 18 q6 -6 10 -2 q2 -9 -6 -16 Z" fill={shade(spec.fur, 0.3)} stroke={shade(spec.fur, 0.45)} strokeWidth="2" strokeLinejoin="round" />
      </g>
    );
  }
  if (spec.species === "lion") {
    const d = "M46 -58 q48 6 54 -40 q3 -22 18 -30";
    const tuft = spec.fur2 ?? shade(spec.fur, 0.25);
    return (
      <g transform={`rotate(${Math.sin(t * 2.3) * 8 + follow * 12} 46 -58)`}>
        <path d={d} stroke={line} strokeWidth="13" fill="none" strokeLinecap="round" />
        <path d={d} stroke={spec.fur} strokeWidth="7.5" fill="none" strokeLinecap="round" />
        <path d="M118 -128 q4 -20 18 -22 q-2 12 8 16 q-8 4 -6 16 q-10 -6 -20 -2 Z" transform="rotate(10 118 -128)" fill={tuft} stroke={shade(tuft, 0.32)} strokeWidth="3" strokeLinejoin="round" />
      </g>
    );
  }
  return <circle cx={50} cy={-66 - follow * 2} r={14} fill={spec.fur} stroke={line} strokeWidth="3.5" />;
}

/** Пушистый хвост лисёнка с белым кончиком (кончик — обрезкой по силуэту хвоста). */
function FoxTail({ spec, t, follow }: { spec: CharacterSpec; t: number; follow: number }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const line = shade(spec.fur, 0.35);
  const wag = Math.sin(t * 2.4) * 7 + follow * 12;
  const d = "M40 -52 C70 -44 112 -60 126 -104 C136 -136 122 -168 104 -176 C96 -150 92 -128 76 -108 C64 -92 52 -84 38 -80 Z";
  return (
    <g transform={`rotate(${wag} 40 -64)`}>
      <defs>
        <clipPath id={`ft${uid}`}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={spec.fur} />
      <g clipPath={`url(#ft${uid})`}>
        <path d="M80 -150 Q110 -128 150 -140 L150 -200 L80 -200 Z" fill={spec.belly} />
      </g>
      <path d={d} fill="none" stroke={line} strokeWidth="4" strokeLinejoin="round" />
      <path d="M112 -150 q6 -10 2 -20" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" opacity={0.35} />
    </g>
  );
}

/* ───────────────────────────── персонаж ───────────────────────────── */

/** Персонаж в локальных координатах (ступни в 0,0). Оборачивай в <g transform="translate(x y) scale(s)">. */
export function Character({ spec, st, t }: { spec: CharacterSpec; st: CharState; t: number }) {
  const p = st.pose;
  const sk = skeleton(spec, p, t, st.facing, st.turn);
  const { m, f, k, fl, bodyTop, bodyBottom, headY } = sk;
  const { adult, legH, bodyH, bw, r } = m;
  const line = shade(spec.fur, 0.35);
  const sp = spec.species;
  const ok = spec.outfit.kind;
  const sleeve = ok === "tshirt" || ok === "dress" || ok === "hoodie" || ok === "sweater" ? spec.outfit.color : spec.fur;
  // лисёнок: тёмные лапки и носочки (fur2)
  const paw = sp === "fox" && spec.fur2 ? spec.fur2 : spec.fur;
  const legC = sp === "fox" && spec.fur2 ? spec.fur2 : spec.fur;
  const footC = sp === "fox" && spec.fur2 ? shade(spec.fur2, 0.12) : shade(spec.fur, 0.12);
  const footRx = sp === "bunny" ? 24 : sp === "elephant" ? 25 : sp === "mouse" ? 20 : 22;
  const follow = p.follow ?? 0;
  const back = clamp(p.back ?? 0, 0, 1);
  const s = fl.s;
  const a = fl.a;
  // рот: визема липсинка (если герой говорит и действие не держит рот открытым — зевок, смех, еда), иначе — по громкости
  const actOpen = p.mouth ?? 0;
  const speaking = st.viseme !== undefined && actOpen < 0.35;
  const vis = speaking && st.viseme !== "X" ? st.viseme : undefined;
  const amp = clamp(st.mouth, 0, 1);
  const open = vis ? VISEME_OPEN[vis] * (0.75 + 0.25 * amp) : clamp(speaking ? actOpen : Math.max(st.mouth, actOpen), 0, 1);
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
    return <ArmView key={side} g={g} color={dark ? farShade(sleeve) : sleeve} hand={dark ? farShade(paw) : paw} side={side} f={f} k={k} />;
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
  const headRx = r * (sp === "cat" || sp === "fox" || sp === "elephant" ? 1.04 : 1);
  const headRy = r * (sp === "bunny" ? 0.96 : sp === "elephant" ? 0.94 : 0.9);
  const mz = fl.muzzle;
  const hasMuzzle = sp !== "bunny" && sp !== "elephant"; // у слонёнка вместо мордочки — хобот
  const snout = sp === "bunny" ? { x: s * a * 0.8 * r, y: r * 0.32 + fl.py, rx: r * 0.27, ry: r * 0.23 } : null;
  // лисёнок: пушистые щёчки-«бакенбарды» по бокам головы (в профиле — только со стороны затылка)
  const tufts =
    sp === "fox" && back < 0.5
      ? ([-1, 1] as const)
          .filter((side) => side === -s || a < 0.45)
          .map((side) => {
            const o = side === -s ? lerp(side, -s * 0.92, a) : side;
            return <path key={`tf${side}`} d={`M${o * 0.8 * r} ${r * 0.08} Q${o * 1.08 * r} ${r * 0.2} ${o * 1.2 * r} ${r * 0.44} Q${o * 0.98 * r} ${r * 0.42} ${o * 0.9 * r} ${r * 0.52} Q${o * 0.8 * r} ${r * 0.56} ${o * 0.62 * r} ${r * 0.6} Z`} strokeLinejoin="round" />;
          })
      : null;
  const silhouette = (fill: string, stroke?: string, sw?: number) => (
    <g fill={fill} stroke={stroke} strokeWidth={sw}>
      <ellipse cx={0} cy={0} rx={headRx} ry={headRy} />
      {tufts}
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
        <Leg hipX={lerp(-hipX, -f * 5, k)} phase={p.walk} f={f} k={k} stride={stride} color={farShade(legC)} foot={farShade(footC)} h={legH} footRx={footRx} nails={sp === "elephant"} />
        <Leg hipX={lerp(hipX, f * 3, k)} phase={Number.isNaN(p.walk) ? p.walk : p.walk + Math.PI} f={f} k={k} stride={stride} color={legC} foot={footC} h={legH} footRx={footRx} nails={sp === "elephant"} />
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
            {sp === "elephant" ? <ElephantEars spec={spec} r={r} t={t} droop={st.emotion === "sad" || st.emotion === "scared" ? 1 : st.emotion === "sleepy" ? 0.5 : 0} s={s} a={a} follow={follow} layer="front" /> : null}
            {sp === "lion" && back < 0.9 ? <ManeTuft spec={spec} r={r} s={s} a={a} /> : null}
            {back < 0.98 ? (
              <g opacity={1 - back}>
                <Face spec={spec} st={st} r={r} fl={fl} open={open} closed={closed} puff={p.puff ?? 0} vis={vis} amp={amp} t={t} />
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
