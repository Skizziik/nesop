/**
 * Локации мультика: слоистые векторные фоны. Мир 1920×1080, земля на y=GROUND.
 * Камера {x, y, zoom}: дальние слои сдвигаются меньше (параллакс) — даёт глубину при панораме.
 */
import type { ReactNode } from "react";
import { shade } from "./rig";

export const GROUND = 905;
export interface Camera {
  x: number; // центр кадра по миру
  y: number;
  zoom: number;
}

const W = 1920;
const H = 1080;

/** Слой с параллаксом: depth 0 — бесконечно далеко (не двигается), 1 — плоскость персонажей. */
export function Layer({ cam, depth, children }: { cam: Camera; depth: number; children: ReactNode }) {
  const z = 1 + (cam.zoom - 1) * depth;
  const dx = (W / 2 - cam.x) * depth;
  const dy = (H * 0.62 - cam.y) * depth;
  return <g transform={`translate(${W / 2} ${H * 0.62}) scale(${z}) translate(${-W / 2 + dx} ${-H * 0.62 + dy})`}>{children}</g>;
}

function Cloud({ x, y, s, t, speed }: { x: number; y: number; s: number; t: number; speed: number }) {
  const cx = ((x + t * speed) % (W + 600)) - 300;
  return (
    <g transform={`translate(${cx} ${y}) scale(${s})`} opacity={0.95}>
      <ellipse cx={0} cy={0} rx={90} ry={42} fill="#FFFFFF" />
      <ellipse cx={-60} cy={10} rx={60} ry={32} fill="#FFFFFF" />
      <ellipse cx={62} cy={8} rx={66} ry={34} fill="#FFFFFF" />
      <ellipse cx={10} cy={-26} rx={58} ry={38} fill="#FFFFFF" />
      <ellipse cx={0} cy={22} rx={150} ry={16} fill="#E6F2FF" />
    </g>
  );
}

function Tree({ x, y, s, hue = "#4CB944", t }: { x: number; y: number; s: number; hue?: string; t: number }) {
  const sway = Math.sin(t * 1.3 + x) * 1.5;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 0 L-10 -120 Q0 -130 10 -120 L14 0 Z" fill="#8B5A2B" stroke={shade("#8B5A2B", 0.3)} strokeWidth="4" />
      <g transform={`rotate(${sway} 0 -120)`}>
        <circle cx={0} cy={-190} r={86} fill={hue} stroke={shade(hue, 0.3)} strokeWidth="5" />
        <circle cx={-62} cy={-140} r={58} fill={hue} stroke={shade(hue, 0.3)} strokeWidth="5" />
        <circle cx={64} cy={-142} r={60} fill={hue} stroke={shade(hue, 0.3)} strokeWidth="5" />
        <circle cx={-30} cy={-220} r={30} fill={shade(hue, -0.25)} opacity={0.7} />
        <circle cx={30} cy={-170} r={9} fill="#FF4D5A" />
        <circle cx={-40} cy={-150} r={9} fill="#FF4D5A" />
        <circle cx={54} cy={-120} r={9} fill="#FF4D5A" />
      </g>
    </g>
  );
}

function Flower({ x, y, c, t }: { x: number; y: number; c: string; t: number }) {
  const sw = Math.sin(t * 2 + x * 0.1) * 4;
  return (
    <g transform={`translate(${x} ${y}) rotate(${sw})`}>
      <path d="M0 0 L0 -34" stroke="#3E9B3A" strokeWidth="5" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-46} rx={8} ry={13} fill={c} transform={`rotate(${a} 0 -34)`} />
      ))}
      <circle cx={0} cy={-34} r={7} fill="#FFD54A" />
    </g>
  );
}

function House({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-170} y={-260} width={340} height={260} rx={10} fill="#FFE3B3" stroke="#C99A5A" strokeWidth="6" />
      <path d="M-200 -250 L0 -410 L200 -250 Z" fill="#E8574C" stroke="#A8352C" strokeWidth="6" strokeLinejoin="round" />
      <rect x={110} y={-400} width={40} height={90} fill="#C9564C" stroke="#8C3A33" strokeWidth="5" />
      <rect x={-40} y={-140} width={80} height={140} rx={40} fill="#6B4BB0" stroke="#45307A" strokeWidth="6" />
      <circle cx={24} cy={-70} r={7} fill="#FFD54A" />
      {[-120, 120].map((wx) => (
        <g key={wx}>
          <rect x={wx - 42} y={-210} width={84} height={76} rx={10} fill="#BDE6FF" stroke="#C99A5A" strokeWidth="6" />
          <path d={`M${wx} -210 V-134 M${wx - 42} -172 H${wx + 42}`} stroke="#C99A5A" strokeWidth="5" />
        </g>
      ))}
    </g>
  );
}

/** Сад у дома: небо, солнце, облака, холмы, дом, деревья, забор, трава, цветы. */
export function GardenScene({ cam, t, time = "day" }: { cam: Camera; t: number; time?: "day" | "evening" }) {
  const sky = time === "evening" ? ["#FF9A6B", "#FFD9A0"] : ["#6EC6FF", "#CFEFFF"];
  return (
    <g>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
      </defs>
      <rect x={-200} y={-200} width={W + 400} height={H + 400} fill="url(#sky)" />
      <Layer cam={cam} depth={0.05}>
        <g transform={`translate(1580 170)`}>
          <circle r={95} fill="#FFE45C" opacity={0.35} transform={`scale(${1 + Math.sin(t * 1.5) * 0.04})`} />
          <circle r={70} fill="#FFD93D" stroke="#F5B700" strokeWidth="6" />
        </g>
        <Cloud x={200} y={160} s={1} t={t} speed={14} />
        <Cloud x={900} y={110} s={0.75} t={t} speed={10} />
        <Cloud x={1500} y={240} s={0.6} t={t} speed={18} />
      </Layer>
      <Layer cam={cam} depth={0.25}>
        <path d={`M-400 760 Q 200 560 700 720 T 1700 690 T 2600 740 V ${H + 300} H -400 Z`} fill="#8FD98A" />
        <Tree x={220} y={735} s={0.45} hue="#5CC157" t={t} />
        <Tree x={1500} y={705} s={0.4} hue="#5CC157" t={t} />
      </Layer>
      <Layer cam={cam} depth={0.55}>
        <path d={`M-400 820 Q 400 700 1000 800 T 2500 790 V ${H + 300} H -400 Z`} fill="#6CCB5F" />
        <House x={560} y={812} s={0.82} />
        <Tree x={1260} y={815} s={0.8} t={t} />
      </Layer>
      <Layer cam={cam} depth={0.8}>
        {/* забор — за героями, чуть ниже их роста */}
        {Array.from({ length: 34 }, (_, i) => -700 + i * 96).map((fx) => (
          <path key={fx} d={`M${fx} ${GROUND - 95} V${GROUND - 190} l20 -18 l20 18 V${GROUND - 95} Z`} fill="#FFFFFF" stroke="#D8CBB8" strokeWidth="4" strokeLinejoin="round" />
        ))}
        <rect x={-800} y={GROUND - 172} width={3600} height={12} fill="#FFFFFF" stroke="#D8CBB8" strokeWidth="3" />
        <rect x={-800} y={GROUND - 132} width={3600} height={12} fill="#FFFFFF" stroke="#D8CBB8" strokeWidth="3" />
        {[-420, 300, 1160, 1900, 2500].map((bx) => (
          <g key={bx} transform={`translate(${bx} ${GROUND - 92})`}>
            <circle cx={0} cy={0} r={52} fill="#4FB04A" stroke="#3E9139" strokeWidth="4" />
            <circle cx={50} cy={8} r={40} fill="#58BA52" stroke="#3E9139" strokeWidth="4" />
            <circle cx={-46} cy={10} r={38} fill="#4AA845" stroke="#3E9139" strokeWidth="4" />
            <circle cx={10} cy={-20} r={7} fill="#FF7AB0" />
            <circle cx={-30} cy={4} r={7} fill="#FFFFFF" />
            <circle cx={44} cy={-4} r={7} fill="#FF7AB0" />
          </g>
        ))}
        <rect x={-800} y={GROUND - 100} width={3600} height={200} fill="#5DBB52" />
      </Layer>
      <Layer cam={cam} depth={1}>
        {/* земля */}
        <rect x={-600} y={GROUND - 60} width={3400} height={H} fill="#5DBB52" />
        {/* тропинка */}
        <path d={`M-600 ${GROUND + 20} Q 400 ${GROUND - 10} 960 ${GROUND + 10} T 2800 ${GROUND + 5} V ${GROUND + 70} Q 1500 ${GROUND + 90} 960 ${GROUND + 72} T -600 ${GROUND + 80} Z`} fill="#E9D3A8" stroke="#D2B886" strokeWidth="4" />
        {Array.from({ length: 40 }, (_, i) => -560 + i * 90).map((gx, i) => (
          <path key={gx} d={`M${gx} ${GROUND + 40 + (i % 3) * 30} q6 -16 12 0 q6 -20 12 0`} stroke="#4CA442" strokeWidth="5" fill="none" strokeLinecap="round" />
        ))}
        {[["#FF6FA8", -200], ["#FFFFFF", 120], ["#FFB23F", 330], ["#C38BFF", 1500], ["#FF6FA8", 1720], ["#FFFFFF", 1960], ["#FFB23F", 2150]].map(([c, fx]) => (
          <Flower key={String(fx)} x={Number(fx)} y={GROUND - 26} c={String(c)} t={t} />
        ))}
      </Layer>
    </g>
  );
}

function Butterfly({ x, y, t, c }: { x: number; y: number; t: number; c: string }) {
  const fx = x + Math.sin(t * 0.6 + x) * 140;
  const fy = y + Math.sin(t * 1.3 + x) * 40;
  const flap = Math.abs(Math.sin(t * 14 + x));
  return (
    <g transform={`translate(${fx} ${fy})`}>
      <ellipse cx={-9} cy={0} rx={10 * (0.3 + flap * 0.7)} ry={12} fill={c} stroke={shade(c, 0.35)} strokeWidth="2" />
      <ellipse cx={9} cy={0} rx={10 * (0.3 + flap * 0.7)} ry={12} fill={c} stroke={shade(c, 0.35)} strokeWidth="2" />
      <rect x={-2} y={-9} width={4} height={18} rx={2} fill="#3A2A44" />
    </g>
  );
}

/** Бабочки — на слое персонажей (оживляют кадр). */
export function GardenLife({ cam, t }: { cam: Camera; t: number }) {
  return (
    <Layer cam={cam} depth={1}>
      <Butterfly x={420} y={GROUND - 330} t={t} c="#FFB23F" />
      <Butterfly x={1500} y={GROUND - 420} t={t + 3} c="#B38BFF" />
    </Layer>
  );
}

/** Передний план (поверх персонажей): кусты по краям — глубина кадра. */
export function GardenForeground({ cam, t }: { cam: Camera; t: number }) {
  return (
    <Layer cam={cam} depth={1.35}>
      {[-260, 2160].map((bx) => (
        <g key={bx} transform={`translate(${bx} ${GROUND + 190}) rotate(${Math.sin(t * 1.2 + bx) * 1.2})`}>
          <circle cx={0} cy={0} r={150} fill="#3FA243" />
          <circle cx={120} cy={30} r={110} fill="#47AE4A" />
          <circle cx={-110} cy={40} r={120} fill="#3A9A3E" />
        </g>
      ))}
    </Layer>
  );
}
