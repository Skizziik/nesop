/**
 * Персонажи мультиков: векторная «перекладка» (как Peppa / Hey Duggee). Всё — собственная SVG-отрисовка.
 * Локальные координаты: (0,0) — точка между ступнями, рост ребёнка ~300, взрослого ~380. Вверх — отрицательный y.
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

/** Поза на кадр: углы рук в градусах (0 — вниз вдоль тела, 90 — в сторону, 180 — вверх), фаза ходьбы, подпрыгивание. */
export interface Pose {
  armL: [number, number]; // [плечо, локоть]
  armR: [number, number];
  walk: number; // фаза шага (радианы); NaN — стоит
  lift: number; // подъём над землёй (прыжок), в единицах роста
  bob: number; // дыхание / пружинка тела
  tilt: number; // наклон головы, градусы
  lean: number; // наклон корпуса
}

export type Wear = "raincoat" | "pajamas" | "party_hat" | "scarf" | "sun_hat" | "winter_hat";
export type Fx = "hearts" | "sparkles" | "zzz" | "notes" | "sweat" | "exclaim" | "question" | "puff";

export interface CharState {
  hold?: { id: string; color?: string }; // предмет в правой руке
  wear?: Wear[];
  fx?: Fx;
  pose: Pose;
  emotion: CEmotion;
  mouth: number; // 0..1 — открытость рта по голосу
  blink: boolean;
  look: [number, number]; // взгляд -1..1
  facing: 1 | -1; // куда повернута мордочка (лёгкий поворот 3/4)
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
const deg = (a: number) => (a * Math.PI) / 180;

/** Рука из двух сегментов: от плеча, угол 0 — вниз. side: -1 левая (на экране слева), 1 правая. */
function Arm({ x, y, a1, a2, side, len, w, color, hand }: { x: number; y: number; a1: number; a2: number; side: -1 | 1; len: number; w: number; color: string; hand: string }) {
  // для левой руки угол «в сторону» уходит влево
  const t1 = deg(a1) * side;
  const ex = x + Math.sin(t1) * len;
  const ey = y + Math.cos(t1) * len;
  const t2 = t1 + deg(a2) * side;
  const hx = ex + Math.sin(t2) * len * 0.92;
  const hy = ey + Math.cos(t2) * len * 0.92;
  const line = shade(color, 0.35);
  return (
    <g>
      <path d={`M${x} ${y} L${ex} ${ey} L${hx} ${hy}`} stroke={line} strokeWidth={w + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${x} ${y} L${ex} ${ey} L${hx} ${hy}`} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={hx} cy={hy} r={w * 0.62} fill={hand} stroke={shade(hand, 0.35)} strokeWidth="3" />
    </g>
  );
}

function handPos(x: number, y: number, a1: number, a2: number, side: -1 | 1, len: number): [number, number] {
  const t1 = deg(a1) * side;
  const ex = x + Math.sin(t1) * len;
  const ey = y + Math.cos(t1) * len;
  const t2 = t1 + deg(a2) * side;
  return [ex + Math.sin(t2) * len * 0.92, ey + Math.cos(t2) * len * 0.92];
}

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
          const gx = x + (i - 1) * 46 + Math.sin(p * 6 + i) * 10;
          const gy = y - p * 120;
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

function Leg({ x, phase, color, foot, h }: { x: number; phase: number; color: string; foot: string; h: number }) {
  const walking = !Number.isNaN(phase);
  const up = walking ? Math.max(0, Math.sin(phase)) * 14 : 0;
  const swing = walking ? Math.cos(phase) * 9 : 0;
  return (
    <g transform={`translate(${x + swing} ${-up})`}>
      <rect x={-13} y={-h} width={26} height={h} rx={12} fill={color} stroke={shade(color, 0.35)} strokeWidth="3.5" />
      <ellipse cx={0} cy={-4} rx={22} ry={12} fill={foot} stroke={shade(foot, 0.35)} strokeWidth="3.5" />
    </g>
  );
}

/** Мордочка: глаза, брови, нос, рот. Центр — середина головы. */
function Face({ spec, st, r }: { spec: CharacterSpec; st: CharState; r: number }) {
  const { emotion: e, blink, mouth } = st;
  // поворот 3/4: при ходьбе мордочка сильнее смотрит по ходу движения (как в «Пеппе» — герои идут боком)
  const walking = !Number.isNaN(st.pose.walk);
  const fx = st.facing * r * (walking ? 0.24 : 0.08);
  const lx = st.look[0] * 4 + fx * 0.6;
  const ly = st.look[1] * 3;
  const eyeY = -r * 0.05;
  const eyeDx = r * 0.33;
  const eyeR = r * (spec.adult ? 0.15 : 0.18);
  const closedHappy = e === "laugh" || (e === "happy" && mouth < 0.15);
  const sleepy = e === "sleepy";
  const eye = (cx: number, side: -1 | 1) => {
    if (blink || sleepy) return <path key={side} d={`M${cx - eyeR} ${eyeY} q${eyeR} ${eyeR * 0.6} ${eyeR * 2} 0`} stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />;
    if (closedHappy) return <path key={side} d={`M${cx - eyeR} ${eyeY + 3} q${eyeR} ${-eyeR * 1.1} ${eyeR * 2} 0`} stroke={INK} strokeWidth="5.5" fill="none" strokeLinecap="round" />;
    const ry = e === "surprised" || e === "scared" ? eyeR * 1.25 : eyeR;
    const pr = e === "scared" ? eyeR * 0.42 : eyeR * 0.6;
    return (
      <g key={side}>
        <ellipse cx={cx} cy={eyeY} rx={eyeR * 0.92} ry={ry} fill="#FFFFFF" stroke={INK} strokeWidth="3" />
        <circle cx={cx + lx} cy={eyeY + ly + (e === "sad" ? 3 : 0)} r={pr} fill={spec.eye ?? INK} />
        <circle cx={cx + lx + pr * 0.35} cy={eyeY + ly - pr * 0.4} r={pr * 0.36} fill="#FFFFFF" />
      </g>
    );
  };
  // брови: угол и высота по эмоции
  const browY = eyeY - eyeR * (e === "surprised" || e === "scared" ? 1.85 : 1.5);
  const browTilt = e === "angry" ? 9 : e === "sad" || e === "scared" ? -8 : e === "thinking" ? 5 : 0;
  const brow = (cx: number, side: -1 | 1) => (
    <path
      key={`b${side}`}
      d={`M${cx - eyeR} ${browY + side * browTilt * 0.5 * (side === 1 ? 1 : -1)} q${eyeR} ${-eyeR * 0.5} ${eyeR * 2} ${-side * browTilt * 0.5 * (side === 1 ? -1 : 1)}`}
      stroke={shade(spec.fur, 0.55)}
      strokeWidth="5"
      fill="none"
      strokeLinecap="round"
      transform={e === "thinking" && side === 1 ? `translate(0 -5)` : undefined}
    />
  );
  // мордочка (светлая) у кошки/медведя/собаки
  const muzzle = spec.species !== "bunny" ? <ellipse cx={fx} cy={r * 0.36} rx={r * 0.42} ry={r * 0.3} fill={spec.belly} stroke={shade(spec.belly, 0.25)} strokeWidth="2.5" /> : null;
  const noseY = r * 0.24;
  const nose =
    spec.species === "bunny" ? (
      <ellipse cx={fx} cy={noseY} rx={r * 0.075} ry={r * 0.055} fill="#FF8FA8" stroke={shade("#FF8FA8", 0.4)} strokeWidth="2.5" />
    ) : spec.species === "cat" ? (
      <path d={`M${fx - r * 0.07} ${noseY - 2} h${r * 0.14} l${-r * 0.07} ${r * 0.08} z`} fill="#FF7A9C" stroke={shade("#FF7A9C", 0.4)} strokeWidth="2.5" strokeLinejoin="round" />
    ) : (
      <ellipse cx={fx} cy={noseY} rx={r * 0.12} ry={r * 0.085} fill={INK} />
    );
  // рот: открытость по голосу + форма по эмоции
  const my = r * 0.47;
  const open = Math.max(0, Math.min(1, mouth));
  let m: ReactNode;
  if (open > 0.12) {
    const w = r * (0.16 + open * 0.08) * (e === "laugh" || e === "happy" ? 1.25 : 1);
    const h = r * (0.06 + open * 0.2);
    m = (
      <g>
        <path d={`M${fx - w} ${my - h * 0.2} Q${fx} ${my - h * 0.55} ${fx + w} ${my - h * 0.2} Q${fx + w * 0.8} ${my + h} ${fx} ${my + h} Q${fx - w * 0.8} ${my + h} ${fx - w} ${my - h * 0.2} Z`} fill="#8A1F35" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <ellipse cx={fx} cy={my + h * 0.62} rx={w * 0.5} ry={h * 0.3} fill="#FF7A8A" />
      </g>
    );
  } else if (e === "sad" || e === "scared") {
    m = <path d={`M${fx - r * 0.16} ${my + 8} q${r * 0.16} ${-r * 0.13} ${r * 0.32} 0`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />;
  } else if (e === "surprised") {
    m = <ellipse cx={fx} cy={my + 4} rx={r * 0.08} ry={r * 0.1} fill="#8A1F35" stroke={INK} strokeWidth="3.5" />;
  } else if (e === "angry") {
    m = <path d={`M${fx - r * 0.14} ${my + 6} h${r * 0.28}`} stroke={INK} strokeWidth="5" strokeLinecap="round" />;
  } else if (e === "thinking") {
    m = <path d={`M${fx - r * 0.12} ${my + 4} q${r * 0.14} ${-r * 0.06} ${r * 0.24} ${r * 0.03}`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />;
  } else {
    const big = e === "happy" || e === "laugh";
    m = big ? (
      <path d={`M${fx - r * 0.22} ${my - 4} q${r * 0.22} ${r * 0.3} ${r * 0.44} 0 z`} fill="#8A1F35" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    ) : (
      <path d={`M${fx - r * 0.16} ${my} q${r * 0.16} ${r * 0.14} ${r * 0.32} 0`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
    );
  }
  const whiskers =
    spec.species === "cat" ? (
      <g stroke={shade(spec.fur, 0.5)} strokeWidth="2.5" strokeLinecap="round">
        <path d={`M${fx - r * 0.3} ${r * 0.3} l${-r * 0.32} ${-r * 0.06}`} />
        <path d={`M${fx - r * 0.3} ${r * 0.38} l${-r * 0.32} ${r * 0.04}`} />
        <path d={`M${fx + r * 0.3} ${r * 0.3} l${r * 0.32} ${-r * 0.06}`} />
        <path d={`M${fx + r * 0.3} ${r * 0.38} l${r * 0.32} ${r * 0.04}`} />
      </g>
    ) : null;
  const tear = e === "sad" ? <path d={`M${-eyeDx + fx} ${eyeY + eyeR * 1.3} q-6 12 0 16 q6 -4 0 -16`} fill="#7EC8FF" stroke="#3B8BD0" strokeWidth="2" /> : null;
  return (
    <g>
      {muzzle}
      <ellipse cx={-r * 0.6 + fx} cy={r * 0.3} rx={r * 0.13} ry={r * 0.08} fill="#FF9DB5" opacity={0.65} />
      <ellipse cx={r * 0.6 + fx} cy={r * 0.3} rx={r * 0.13} ry={r * 0.08} fill="#FF9DB5" opacity={0.65} />
      {eye(-eyeDx + fx, -1)}
      {eye(eyeDx + fx, 1)}
      {brow(-eyeDx + fx, -1)}
      {brow(eyeDx + fx, 1)}
      {nose}
      {whiskers}
      {m}
      {tear}
      {spec.extra === "glasses" ? (
        <g fill="none" stroke={INK} strokeWidth="4">
          <circle cx={-eyeDx + fx} cy={eyeY} r={eyeR * 1.35} />
          <circle cx={eyeDx + fx} cy={eyeY} r={eyeR * 1.35} />
          <path d={`M${-eyeDx + fx + eyeR * 1.35} ${eyeY} h${eyeDx * 2 - eyeR * 2.7}`} />
        </g>
      ) : null}
    </g>
  );
}

function Ears({ spec, r, t, e }: { spec: CharacterSpec; r: number; t: number; e: CEmotion }) {
  const line = shade(spec.fur, 0.35);
  const droop = e === "sad" || e === "scared" ? 1 : 0;
  if (spec.species === "bunny") {
    const sway = Math.sin(t * 2.2) * 3;
    const ear = (side: -1 | 1) => (
      <g key={side} transform={`rotate(${side * (12 + droop * 40) + sway * side} ${side * r * 0.32} ${-r * 0.75})`}>
        <ellipse cx={side * r * 0.32} cy={-r * 1.45} rx={r * 0.24} ry={r * 0.72} fill={spec.fur} stroke={line} strokeWidth="4" />
        <ellipse cx={side * r * 0.32} cy={-r * 1.42} rx={r * 0.12} ry={r * 0.55} fill={spec.belly} />
      </g>
    );
    return (
      <>
        {ear(-1)}
        {ear(1)}
      </>
    );
  }
  if (spec.species === "cat") {
    const ear = (side: -1 | 1) => (
      <g key={side} transform={`rotate(${side * (droop * 25)} ${side * r * 0.55} ${-r * 0.6})`}>
        <path d={`M${side * r * 0.25} ${-r * 0.82} L${side * r * 0.72} ${-r * 1.28} L${side * r * 0.86} ${-r * 0.5} Z`} fill={spec.fur} stroke={line} strokeWidth="4" strokeLinejoin="round" />
        <path d={`M${side * r * 0.38} ${-r * 0.8} L${side * r * 0.7} ${-r * 1.1} L${side * r * 0.78} ${-r * 0.6} Z`} fill={spec.belly} />
      </g>
    );
    return (
      <>
        {ear(-1)}
        {ear(1)}
      </>
    );
  }
  if (spec.species === "bear") {
    const ear = (side: -1 | 1) => (
      <g key={side}>
        <circle cx={side * r * 0.68} cy={-r * 0.72} r={r * 0.28} fill={spec.fur} stroke={line} strokeWidth="4" />
        <circle cx={side * r * 0.68} cy={-r * 0.72} r={r * 0.15} fill={spec.belly} />
      </g>
    );
    return (
      <>
        {ear(-1)}
        {ear(1)}
      </>
    );
  }
  return null; // у собаки висячие уши рисуются поверх головы
}

function DogEars({ spec, r, t }: { spec: CharacterSpec; r: number; t: number }) {
  const line = shade(spec.belly === spec.fur ? spec.fur : "#3A2A22", 0.1);
  const flap = Math.sin(t * 3) * 4;
  const ear = (side: -1 | 1) => (
    <path
      key={side}
      d={`M${side * r * 0.62} ${-r * 0.62} q${side * r * 0.42} ${r * 0.1} ${side * r * 0.36} ${r * 0.78} q${-side * r * 0.12} ${r * 0.16} ${-side * r * 0.3} ${-r * 0.08} z`}
      fill="#4A3426"
      stroke={line}
      strokeWidth="4"
      strokeLinejoin="round"
      transform={`rotate(${side * flap} ${side * r * 0.62} ${-r * 0.62})`}
    />
  );
  return (
    <>
      {ear(-1)}
      {ear(1)}
    </>
  );
}

function Tail({ spec, t }: { spec: CharacterSpec; t: number }) {
  const line = shade(spec.fur, 0.35);
  const wag = Math.sin(t * (spec.species === "dog" ? 9 : 2.5)) * (spec.species === "dog" ? 18 : 8);
  if (spec.species === "bunny") return <circle cx={52} cy={-62} r={20} fill={spec.belly === spec.fur ? "#FFFFFF" : "#FFFFFF"} stroke={shade("#FFFFFF", 0.25)} strokeWidth="3.5" />;
  if (spec.species === "cat")
    return <path d="M48 -60 q60 -10 50 -80 q-4 -22 14 -26" stroke={line} strokeWidth="20" fill="none" strokeLinecap="round" transform={`rotate(${wag} 48 -60)`} />;
  if (spec.species === "dog")
    return <path d="M46 -70 q34 -18 30 -54" stroke={line} strokeWidth="16" fill="none" strokeLinecap="round" transform={`rotate(${wag} 46 -70)`} />;
  return <circle cx={50} cy={-66} r={14} fill={spec.fur} stroke={line} strokeWidth="3.5" />;
}

/** Хвост кошки/собаки рисуем двумя штрихами (контур + цвет) — отдельный компонент поверх контура. */
function TailFill({ spec, t }: { spec: CharacterSpec; t: number }) {
  const wag = Math.sin(t * (spec.species === "dog" ? 9 : 2.5)) * (spec.species === "dog" ? 18 : 8);
  if (spec.species === "cat") return <path d="M48 -60 q60 -10 50 -80 q-4 -22 14 -26" stroke={spec.fur} strokeWidth="13" fill="none" strokeLinecap="round" transform={`rotate(${wag} 48 -60)`} />;
  if (spec.species === "dog") return <path d="M46 -70 q34 -18 30 -54" stroke={spec.fur} strokeWidth="10" fill="none" strokeLinecap="round" transform={`rotate(${wag} 46 -70)`} />;
  return null;
}

function Outfit({ spec, bw, top, bottom }: { spec: CharacterSpec; bw: number; top: number; bottom: number }) {
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
        <rect x={-16} y={top + 62} width={32} height={22} rx={6} fill={shade(o.color, 0.12)} />
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
        <circle cx={0} cy={top + 52} r={14} fill={o.accent ?? "#FFFFFF"} opacity={0.9} />
      </g>
    );
  if (o.kind === "apron")
    return (
      <g>
        <path d={`M${-bw * 0.5} ${top + 30} h${bw} L${bw * 0.7} ${bottom - 6} Q0 ${bottom + 8} ${-bw * 0.7} ${bottom - 6} Z`} fill={o.color} stroke={line} strokeWidth="3.5" />
        <path d={`M${-bw * 0.5} ${top + 30} L${-bw * 0.28} ${top + 4} M${bw * 0.5} ${top + 30} L${bw * 0.28} ${top + 4}`} stroke={o.color} strokeWidth="7" strokeLinecap="round" />
        <rect x={-18} y={top + 70} width={36} height={24} rx={6} fill={o.accent ?? "#FFFFFF"} opacity={0.85} />
      </g>
    );
  return null;
}

/** Персонаж в локальных координатах (ступни в 0,0). Оборачивай в <g transform="translate(x y) scale(s)">. */
export function Character({ spec, st, t }: { spec: CharacterSpec; st: CharState; t: number }) {
  const p = st.pose;
  const adult = !!spec.adult;
  const legH = adult ? 58 : 34;
  const bodyH = adult ? 150 : 112;
  const bw = adult ? 62 : 58; // полуширина тела у пояса
  const r = adult ? 78 : 86; // радиус головы (у малышей голова крупнее)
  const bob = Math.sin(t * 2.4) * 2.2 + p.bob;
  const lift = p.lift;
  const bodyTop = -legH - bodyH + bob;
  const bodyBottom = -legH + 6;
  const headY = bodyTop - r * 0.72;
  const line = shade(spec.fur, 0.35);
  const sleeve = spec.outfit.kind === "tshirt" || spec.outfit.kind === "dress" ? spec.outfit.color : spec.fur;
  const shoulderY = bodyTop + 30;
  const arms = (
    <>
      <Arm x={-bw * 0.68} y={shoulderY} a1={p.armL[0]} a2={p.armL[1]} side={-1} len={adult ? 54 : 44} w={22} color={sleeve} hand={spec.fur} />
      <Arm x={bw * 0.68} y={shoulderY} a1={p.armR[0]} a2={p.armR[1]} side={1} len={adult ? 54 : 44} w={22} color={sleeve} hand={spec.fur} />
    </>
  );
  const hipX = bw * 0.42;
  return (
    <g transform={`translate(0 ${-lift}) rotate(${p.lean} 0 ${-legH})`}>
      {/* тень */}
      <ellipse cx={0} cy={lift + 2} rx={bw * 1.1 * Math.max(0.5, 1 - lift / 300)} ry={10} fill="rgba(0,0,0,0.18)" />
      <g>
        <Tail spec={spec} t={t} />
        <TailFill spec={spec} t={t} />
      </g>
      <Leg x={-hipX} phase={p.walk} color={spec.fur} foot={shade(spec.fur, 0.12)} h={legH} />
      <Leg x={hipX} phase={Number.isNaN(p.walk) ? p.walk : p.walk + Math.PI} color={spec.fur} foot={shade(spec.fur, 0.12)} h={legH} />
      {/* тело */}
      <path
        d={`M${-bw * 0.62} ${bodyTop + 12} Q0 ${bodyTop - 8} ${bw * 0.62} ${bodyTop + 12} Q${bw * 1.08} ${bodyBottom - bodyH * 0.35} ${bw * 0.9} ${bodyBottom - 6} Q0 ${bodyBottom + 14} ${-bw * 0.9} ${bodyBottom - 6} Q${-bw * 1.08} ${bodyBottom - bodyH * 0.35} ${-bw * 0.62} ${bodyTop + 12} Z`}
        fill={spec.fur}
        stroke={line}
        strokeWidth="4"
      />
      <ellipse cx={0} cy={bodyBottom - bodyH * 0.38} rx={bw * 0.55} ry={bodyH * 0.32} fill={spec.belly} opacity={0.9} />
      <Outfit spec={spec} bw={bw} top={bodyTop} bottom={bodyBottom} />
      {st.wear?.length ? <WearBody wear={st.wear} bw={bw} top={bodyTop} bottom={bodyBottom} /> : null}
      {spec.extra === "collar" ? (
        <g>
          <path d={`M${-bw * 0.6} ${bodyTop + 14} Q0 ${bodyTop + 30} ${bw * 0.6} ${bodyTop + 14}`} stroke="#E53950" strokeWidth="10" fill="none" strokeLinecap="round" />
          <circle cx={0} cy={bodyTop + 30} r={9} fill="#FFD54A" stroke="#B88A12" strokeWidth="2.5" />
        </g>
      ) : null}
      {p.armL[0] < 120 || p.armR[0] < 120 ? arms : null}
      {/* голова */}
      <g transform={`rotate(${p.tilt} 0 ${headY + r * 0.6})`}>
        <g transform={`translate(0 ${headY})`}>
          <Ears spec={spec} r={r} t={t} e={st.emotion} />
          <ellipse cx={0} cy={0} rx={r * (spec.species === "cat" ? 1.04 : 1)} ry={r * (spec.species === "bunny" ? 0.96 : 0.9)} fill={spec.fur} stroke={line} strokeWidth="4.5" />
          <ellipse cx={-r * 0.3} cy={-r * 0.45} rx={r * 0.3} ry={r * 0.16} fill="#FFFFFF" opacity={0.18} transform={`rotate(-20 ${-r * 0.3} ${-r * 0.45})`} />
          {spec.species === "dog" ? <ellipse cx={r * 0.38} cy={-r * 0.18} rx={r * 0.26} ry={r * 0.22} fill="#4A3426" opacity={0.85} /> : null}
          {spec.species === "dog" ? <DogEars spec={spec} r={r} t={t} /> : null}
          <Face spec={spec} st={st} r={r} />
          {st.wear?.length ? <WearHead wear={st.wear} r={r} /> : null}
          {spec.extra === "bow" ? (
            <g transform={`translate(${r * 0.55} ${-r * 0.78})`}>
              <path d="M0 0 L-26 -16 L-26 16 Z M0 0 L26 -16 L26 16 Z" fill="#FF5FA2" stroke={shade("#FF5FA2", 0.35)} strokeWidth="3" strokeLinejoin="round" />
              <circle r={8} fill="#FF8CC0" stroke={shade("#FF5FA2", 0.35)} strokeWidth="3" />
            </g>
          ) : null}
        </g>
      </g>
      {/* поднятые руки — поверх головы, чтобы ладошки было видно */}
      {p.armL[0] >= 120 && p.armR[0] >= 120 ? arms : null}
      {st.hold
        ? (() => {
            const [hx, hy] = handPos(bw * 0.68, shoulderY, p.armR[0], p.armR[1], 1, adult ? 54 : 44);
            return (
              <g transform={`translate(${hx} ${hy}) scale(${adult ? 0.95 : 0.85})`}>
                <Prop id={st.hold.id} color={st.hold.color} t={t} />
              </g>
            );
          })()
        : null}
      {st.fx ? <FxLayer fx={st.fx} x={0} y={headY - r * 1.1} t={t} /> : null}
    </g>
  );
}
