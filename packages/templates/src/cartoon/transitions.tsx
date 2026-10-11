/**
 * Переходы между сценами мультика: cut, fade, iris (круг на герое), wipe (цветная волнистая полоса), star, bubble.
 * Сцены идут встык по start/duration. Входящая сцена «проявляется» поверх уходящей, которая доигрывает ещё ~0.6 с
 * (её время просто продолжается за конец: герои стоят в последних позах и дышат). Iris — в две фазы: круг сжимается
 * на герое в хвосте уходящей сцены, затем раскрывается на входящей.
 * Только CSS clip-path (circle/polygon/path) и сплошные контуры поверх — без SVG-фильтров, детерминированно.
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { CANDY, INK, Sparkle, Star, starPath } from "./overlays";

export const TRANSITION_IDS = ["cut", "fade", "iris", "wipe", "star", "bubble"] as const;
export type TransitionKind = (typeof TRANSITION_IDS)[number];

/** Длительность «проявления» входящей сцены, сек. */
export const TRANSITION_IN: Record<TransitionKind, number> = { cut: 0, fade: 0.5, iris: 0.45, wipe: 0.65, star: 0.7, bubble: 0.7 };
/** Iris: сколько секунд в конце уходящей сцены круг сжимается (с короткой задержкой на герое). */
export const IRIS_CLOSE = 0.55;

const W = 1920;
const H = 1080;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIn = (k: number) => k * k * k;
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const backOut = (k: number) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

interface SceneLike {
  kind?: string;
  location: string;
  transitionIn?: TransitionKind;
  duration: number;
}

/**
 * Переход на входе в сцену i. Явный `transitionIn` главнее; иначе — детерминированно по типу и номеру сцены:
 * интро → cut (первая) / fade; заставка истории → star; песня → bubble; прощание → iris;
 * та же локация, что у предыдущей → fade; новая локация → по очереди wipe / iris.
 */
export function transitionFor(scenes: readonly SceneLike[], i: number): TransitionKind {
  const sc = scenes[i];
  if (!sc) return "cut";
  if (sc.transitionIn && (TRANSITION_IDS as readonly string[]).includes(sc.transitionIn)) return sc.transitionIn;
  if (i === 0) return sc.kind === "intro" ? "cut" : "fade";
  const prev = scenes[i - 1]!;
  if (sc.kind === "intro") return "fade";
  if (sc.kind === "outro") return "iris";
  if (sc.kind === "title") return "star";
  if (sc.kind === "song") return "bubble";
  if (prev.location === sc.location && prev.kind !== "song") return "fade";
  return i % 2 === 0 ? "wipe" : "iris";
}

/** Сколько длится вход в сцену (не дольше половины сцены). */
export function inDuration(kind: TransitionKind, sceneDur: number): number {
  return Math.min(TRANSITION_IN[kind], sceneDur * 0.5);
}

/** Радиус, покрывающий весь кадр из точки (x, y). */
const coverR = (x: number, y: number) => Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 40;

function circlePath(cx: number, cy: number, r: number): string {
  const rr = Math.max(0.1, r);
  return `M${(cx - rr).toFixed(1)} ${cy.toFixed(1)} a${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(2 * rr).toFixed(1)} 0 a${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 0 ${(-2 * rr).toFixed(1)} 0 Z`;
}

/* ------------------------------------------------------------------ iris */

/** Радиус iris на сжатии: быстро до «окошка» вокруг героя, короткая пауза с пульсом, потом в точку. */
export function irisCloseR(p: number, fx: number, fy: number): number {
  const R = coverR(fx, fy);
  const hole = 190;
  if (p < 0.55) return hole + (R - hole) * (1 - easeInOut(p / 0.55));
  if (p < 0.82) return hole + Math.sin(((p - 0.55) / 0.27) * Math.PI) * 14;
  return hole * (1 - easeIn((p - 0.82) / 0.18));
}
export function irisOpenR(p: number, fx: number, fy: number): number {
  return coverR(fx, fy) * easeOut(clamp01(p));
}

/** Ободок iris (жёлтая линия по краю круга) — рисуется поверх. */
function IrisRim({ x, y, r }: { x: number; y: number; r: number }) {
  if (r < 2) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <circle cx={x} cy={y} r={r + 7} fill="none" stroke="#FFD23F" strokeWidth={14} />
      <circle cx={x} cy={y} r={r + 16} fill="none" stroke="#FFFFFF" strokeWidth={5} opacity={0.9} />
    </svg>
  );
}

/** Фон под iris: сливовый с мелкими звёздочками (не чёрный). */
export function IrisBackdrop({ t }: { t: number }) {
  return (
    <AbsoluteFill style={{ background: INK }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {Array.from({ length: 26 }, (_, i) => {
          const x = (i * 739) % W;
          const y = (i * 421 + 90) % H;
          const s = 0.6 + 0.4 * Math.sin(t * 6 + i);
          return (
            <g key={i} transform={`translate(${x} ${y}) scale(${s})`} opacity={0.55}>
              <Sparkle r={10 + (i % 3) * 4} color={CANDY[i % CANDY.length]!} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

/** Сжатие iris в хвосте уходящей сцены: сцена видна только в круге вокруг героя. */
export function IrisClose({ p, fx, fy, t, children }: { p: number; fx: number; fy: number; t: number; children: ReactNode }) {
  const r = irisCloseR(clamp01(p), fx, fy);
  return (
    <>
      <IrisBackdrop t={t} />
      <AbsoluteFill style={{ clipPath: `circle(${r.toFixed(1)}px at ${fx.toFixed(1)}px ${fy.toFixed(1)}px)` }}>{children}</AbsoluteFill>
      <IrisRim x={fx} y={fy} r={r} />
    </>
  );
}

/* ------------------------------------------------------------------ вход */

/** Цвет полосы wipe и направление — по номеру сцены. */
const BAND_COLORS = ["#FFD23F", "#FF6FA8", "#3D8BFF", "#4CB944", "#8E5CFF", "#FF8A2A"];

/** Волнистый край полосы: точки по вертикали, x смещается синусом. */
function wavyEdge(x: number, phase: number, amp = 26): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = -40; y <= H + 40; y += 60) pts.push([x + Math.sin(y / 90 + phase) * amp, y]);
  return pts;
}

interface InProps {
  kind: TransitionKind;
  /** 0..1 — прогресс проявления входящей сцены. */
  p: number;
  /** Номер сцены: цвет полосы, направление, раскладка пузырей. */
  index: number;
  /** Точка фокуса (герой) в пикселях кадра — центр iris / звезды. */
  fx: number;
  fy: number;
  t: number;
  outgoing: ReactNode;
  incoming: ReactNode;
}

/** Слой перехода: уходящая сцена снизу, входящая проявляется по маске; декоративные контуры поверх. */
export function TransitionIn({ kind, p: p0, index, fx, fy, t, outgoing, incoming }: InProps) {
  const p = clamp01(p0);
  if (kind === "cut" || p >= 1) return <AbsoluteFill>{incoming}</AbsoluteFill>;
  if (kind === "fade") {
    return (
      <>
        <AbsoluteFill>{outgoing}</AbsoluteFill>
        <AbsoluteFill style={{ opacity: easeInOut(p) }}>{incoming}</AbsoluteFill>
      </>
    );
  }
  if (kind === "iris") {
    const r = irisOpenR(p, fx, fy);
    return (
      <>
        <IrisBackdrop t={t} />
        <AbsoluteFill style={{ clipPath: `circle(${r.toFixed(1)}px at ${fx.toFixed(1)}px ${fy.toFixed(1)}px)` }}>{incoming}</AbsoluteFill>
        <IrisRim x={fx} y={fy} r={r} />
      </>
    );
  }
  let clip = "";
  let deco: ReactNode = null;
  if (kind === "wipe") {
    const dir = index % 2 === 0 ? 1 : -1;
    const band = 240;
    const color = BAND_COLORS[index % BAND_COLORS.length]!;
    const lead = -band - 60 + easeInOut(p) * (W + 2 * band + 120); // передний край полосы (для dir=1)
    const X = (x: number) => (dir > 0 ? x : W - x);
    const front = wavyEdge(lead, t * 4).map(([x, y]) => [X(x), y] as [number, number]);
    const back = wavyEdge(lead - band, t * 4 + 1.3).map(([x, y]) => [X(x), y] as [number, number]);
    const behind = dir > 0 ? -60 : W + 60;
    clip = `polygon(${[[behind, -60] as [number, number], ...back, [behind, H + 60] as [number, number]].map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
    const bandD = `M${front.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} L${[...back].reverse().map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
    const mid = X(lead - band / 2);
    deco = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <path d={bandD} fill={color} stroke="#FFFFFF" strokeWidth={12} strokeLinejoin="round" />
        {Array.from({ length: 7 }, (_, i) => {
          const y = 80 + i * 160;
          const x = mid + Math.sin(y / 90 + t * 4) * 20 + (i % 2 ? 40 : -40);
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${t * 120 * dir + i * 30})`}>
              {i % 2 ? <circle r={20} fill="#FFFFFF" opacity={0.85} /> : <Star r={30} color="#FFFFFF" stroke="#FFFFFF" />}
            </g>
          );
        })}
      </svg>
    );
  } else if (kind === "star") {
    const R = easeIn(p) * 4300 + easeOut(p) * 80;
    const rot = p * 160;
    const d = starPath(R, R * 0.5, -90 + rot);
    // clip-path: path() задаётся в пикселях от левого верхнего угла слоя → сдвигаем путь в точку фокуса
    const shifted = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a: string, b: string) => `${(Number(a) + fx).toFixed(1)} ${(Number(b) + fy).toFixed(1)}`);
    clip = `path('${shifted}')`;
    deco = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${fx} ${fy})`}>
          <path d={d} fill="none" stroke="#FFD23F" strokeWidth={22} strokeLinejoin="round" />
          <path d={starPath(R + 18, (R + 18) * 0.5, -90 + rot)} fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinejoin="round" />
          {Array.from({ length: 10 }, (_, i) => {
            const a = ((rot - 90 + i * 36) * Math.PI) / 180;
            const rr = (i % 2 === 0 ? R : R * 0.5) + 60;
            return (
              <g key={i} transform={`translate(${Math.cos(a) * rr} ${Math.sin(a) * rr}) scale(${0.6 + 0.4 * Math.sin(t * 9 + i)})`}>
                <Sparkle r={22} color={CANDY[i % CANDY.length]!} rot={t * 90} />
              </g>
            );
          })}
        </g>
      </svg>
    );
  } else {
    // bubble: пузыри растут с задержкой по сетке и вместе закрывают кадр
    const bubbles = bubbleLayout(index).map((b) => {
      const k = clamp01((p - b.delay) / (1 - 0.5));
      return { ...b, k, r: b.max * backOut(k) * (k > 0 ? 1 : 0) };
    });
    clip = `path('${bubbles.filter((b) => b.r > 0.5).map((b) => circlePath(b.x, b.y, b.r)).join(" ") || "M0 0 Z"}')`;
    deco = (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {bubbles.map((b, i) =>
          b.r > 2 && b.k < 0.98 ? (
            <g key={i} opacity={(1 - b.k) ** 0.6}>
              <circle cx={b.x} cy={b.y} r={b.r} fill="none" stroke="#FFFFFF" strokeWidth={10} opacity={0.95} />
              <circle cx={b.x} cy={b.y} r={b.r + 9} fill="none" stroke={CANDY[(i + index) % CANDY.length]!} strokeWidth={8} opacity={0.8} />
              <path d={`M${b.x - b.r * 0.62} ${b.y - b.r * 0.2} A${b.r * 0.66} ${b.r * 0.66} 0 0 1 ${b.x - b.r * 0.2} ${b.y - b.r * 0.62}`} fill="none" stroke="#FFFFFF" strokeWidth={Math.max(4, b.r * 0.06)} strokeLinecap="round" opacity={0.75} />
            </g>
          ) : null,
        )}
        {/* мелкие пузырьки летят вверх */}
        {Array.from({ length: 14 }, (_, i) => {
          const x = ((i * 293 + index * 117) % W) + Math.sin(t * 3 + i) * 20;
          const y = H + 40 - p * (500 + (i % 5) * 160);
          return <circle key={`s${i}`} cx={x} cy={y} r={10 + (i % 4) * 6} fill="#FFFFFF" fillOpacity={0.25} stroke="#FFFFFF" strokeWidth={4} />;
        })}
      </svg>
    );
  }
  const style: CSSProperties = { clipPath: clip };
  return (
    <>
      <AbsoluteFill>{outgoing}</AbsoluteFill>
      <AbsoluteFill style={style}>{incoming}</AbsoluteFill>
      {deco}
    </>
  );
}

/** Раскладка пузырей: сетка 4×3 со сдвигом по номеру сцены; при полном радиусе покрывает кадр. */
export function bubbleLayout(index: number): { x: number; y: number; max: number; delay: number }[] {
  const out: { x: number; y: number; max: number; delay: number }[] = [];
  const order = [5, 2, 9, 0, 7, 11, 3, 6, 10, 1, 8, 4];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) {
      const id = r * 4 + c;
      const jx = (((id * 37 + index * 53) % 100) / 100 - 0.5) * 120;
      const jy = (((id * 71 + index * 29) % 100) / 100 - 0.5) * 100;
      const pos = order.indexOf((id + index * 5) % 12);
      out.push({ x: 240 + c * 480 + jx, y: 180 + r * 360 + jy, max: 470, delay: (pos / 11) * 0.5 });
    }
  return out;
}
