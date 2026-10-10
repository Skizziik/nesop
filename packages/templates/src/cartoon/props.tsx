/**
 * Предметы историй: рисуются вокруг (0,0) — центр «хвата» (для предметов в руке) или середина низа (на земле).
 * Размер ~ ладонь ребёнка = 60-90 единиц. color — для предметов, у которых важен цвет (уроки про цвета).
 */
import type { ReactNode } from "react";
import { shade } from "./rig";

const o = (c: string) => shade(c, 0.35);
type F = (c: string, t: number) => ReactNode;

const P: Record<string, { draw: F; color?: string; ground?: boolean; label: string }> = {
  ball: { label: "ball", color: "#FF4D5A", draw: (c, t) => (
    <g transform={`rotate(${t * 120})`}>
      <circle r={34} fill={c} stroke={o(c)} strokeWidth="4" />
      <path d="M-34 0 Q0 -18 34 0 M-34 0 Q0 18 34 0" stroke="#FFFFFF" strokeWidth="6" fill="none" />
    </g>
  ) },
  balloon: { label: "balloon", color: "#FF4D7A", draw: (c, t) => (
    <g transform={`translate(0 ${Math.sin(t * 2) * 4})`}>
      <path d="M0 0 q-8 -60 6 -120" stroke="#7A6A5A" strokeWidth="3" fill="none" />
      <ellipse cx={6} cy={-160} rx={38} ry={46} fill={c} stroke={o(c)} strokeWidth="4" />
      <ellipse cx={-6} cy={-176} rx={9} ry={14} fill="#FFFFFF" opacity={0.6} />
      <path d="M0 -114 l12 0 l-6 10 z" fill={c} />
    </g>
  ) },
  kite: { label: "kite", color: "#3D8BFF", draw: (c, t) => (
    <g>
      <path d={`M0 0 Q30 -80 ${60 + Math.sin(t * 2) * 10} -180`} stroke="#7A6A5A" strokeWidth="3" fill="none" />
      <g transform={`translate(${60 + Math.sin(t * 2) * 10} -230) rotate(${Math.sin(t * 2.5) * 10})`}>
        <path d="M0 -60 L44 0 L0 70 L-44 0 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
        <path d="M0 -60 V70 M-44 0 H44" stroke="#FFFFFF" strokeWidth="4" />
        <path d={`M0 70 q10 30 -10 50 q-20 20 0 40`} stroke="#FF4D5A" strokeWidth="4" fill="none" />
      </g>
    </g>
  ) },
  umbrella: { label: "umbrella", color: "#FF5E5B", draw: (c) => (
    <g>
      <path d="M0 0 V-150" stroke="#5A4A3A" strokeWidth="6" />
      <path d="M0 0 q0 14 -12 14" stroke="#5A4A3A" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M-110 -140 Q0 -260 110 -140 Q82 -158 55 -140 Q28 -158 0 -140 Q-28 -158 -55 -140 Q-82 -158 -110 -140 Z" fill={c} stroke={o(c)} strokeWidth="5" strokeLinejoin="round" />
    </g>
  ) },
  toothbrush: { label: "toothbrush", color: "#3DC4FF", draw: (c) => (
    <g transform="rotate(-30)">
      <rect x={-8} y={-90} width={16} height={100} rx={8} fill={c} stroke={o(c)} strokeWidth="3" />
      <rect x={-10} y={-120} width={20} height={34} rx={4} fill="#FFFFFF" stroke="#CCCCCC" strokeWidth="3" />
      <path d="M-6 -118 v-10 M0 -118 v-12 M6 -118 v-10" stroke="#7FD7FF" strokeWidth="4" />
    </g>
  ) },
  book: { label: "book", color: "#8E5CFF", draw: (c) => (
    <g>
      <path d="M-50 -40 L0 -30 L50 -40 L50 20 L0 30 L-50 20 Z" fill="#FFFFFF" stroke="#BBB" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-56 -44 L-56 24 L0 34 L56 24 L56 -44 L0 -34 Z" fill="none" stroke={c} strokeWidth="8" strokeLinejoin="round" />
      <path d="M0 -30 V30" stroke="#CCC" strokeWidth="3" />
      <path d="M-40 -18 h28 M-40 -6 h28 M12 -18 h28 M12 -6 h28" stroke="#DDD" strokeWidth="4" />
    </g>
  ) },
  teddy: { label: "teddy bear", color: "#C68A4E", draw: (c) => (
    <g>
      <circle cx={-26} cy={-62} r={14} fill={c} stroke={o(c)} strokeWidth="3" />
      <circle cx={26} cy={-62} r={14} fill={c} stroke={o(c)} strokeWidth="3" />
      <ellipse cx={0} cy={0} rx={34} ry={38} fill={c} stroke={o(c)} strokeWidth="3" />
      <circle cx={0} cy={-46} r={30} fill={c} stroke={o(c)} strokeWidth="3" />
      <ellipse cx={0} cy={-38} rx={13} ry={9} fill={shade(c, -0.3)} />
      <circle cx={-10} cy={-52} r={4} fill="#2A1B33" />
      <circle cx={10} cy={-52} r={4} fill="#2A1B33" />
      <circle cx={0} cy={-41} r={4} fill="#2A1B33" />
      <path d="M-18 -18 q18 10 36 0" stroke="#FF5FA2" strokeWidth="6" fill="none" />
    </g>
  ) },
  apple: { label: "apple", color: "#FF3B4A", draw: (c) => (
    <g>
      <path d="M0 -50 C-46 -64 -52 0 -24 24 C-10 34 10 34 24 24 C52 0 46 -64 0 -50 Z" fill={c} stroke={o(c)} strokeWidth="4" />
      <path d="M0 -50 q2 -18 10 -24" stroke="#6B4A2A" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M8 -66 q20 -10 28 4 q-18 8 -28 -4" fill="#4CB944" />
      <ellipse cx={-18} cy={-28} rx={7} ry={11} fill="#FFFFFF" opacity={0.5} />
    </g>
  ) },
  banana: { label: "banana", color: "#FFD93D", draw: (c) => <path d="M-50 -10 Q0 50 50 -30 Q10 20 -40 -24 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" /> },
  carrot: { label: "carrot", color: "#FF8A2A", draw: (c) => (
    <g transform="rotate(20)">
      <path d="M-14 -40 L14 -40 L0 40 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M0 -40 l-12 -24 M0 -40 l0 -28 M0 -40 l12 -24" stroke="#4CB944" strokeWidth="6" strokeLinecap="round" />
    </g>
  ) },
  cake: { label: "birthday cake", color: "#FF8CC0", ground: true, draw: (c, t) => (
    <g>
      <rect x={-80} y={-70} width={160} height={70} rx={14} fill={c} stroke={o(c)} strokeWidth="5" />
      <path d="M-80 -50 q20 18 40 0 q20 18 40 0 q20 18 40 0 q20 18 40 0" stroke="#FFFFFF" strokeWidth="10" fill="none" strokeLinecap="round" />
      {[-40, 0, 40].map((x) => (
        <g key={x}>
          <rect x={x - 5} y={-110} width={10} height={40} rx={4} fill="#7FD7FF" />
          <path d={`M${x} -112 q-8 -14 0 -26 q8 12 0 26`} fill="#FFB23F" transform={`scale(1 ${1 + Math.sin(t * 12 + x) * 0.12})`} style={{ transformOrigin: `${x}px -112px` }} />
        </g>
      ))}
    </g>
  ) },
  cookie: { label: "cookie", color: "#D9A35E", draw: (c) => (
    <g>
      <circle r={30} fill={c} stroke={o(c)} strokeWidth="4" />
      {[[-10, -10], [12, -4], [-2, 12], [14, 14], [-16, 8]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill="#5A3A20" />
      ))}
    </g>
  ) },
  ice_cream: { label: "ice cream", color: "#FF9EC4", draw: (c) => (
    <g>
      <path d="M-26 -20 L26 -20 L0 50 Z" fill="#E8B46A" stroke="#B88540" strokeWidth="4" strokeLinejoin="round" />
      <circle cx={0} cy={-38} r={28} fill={c} stroke={o(c)} strokeWidth="4" />
      <circle cx={0} cy={-66} r={8} fill="#E53950" />
    </g>
  ) },
  cup: { label: "cup", color: "#5DA9FF", draw: (c) => (
    <g>
      <path d="M-26 -40 h52 l-6 50 h-40 z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M26 -28 q22 4 0 26" stroke={o(c)} strokeWidth="6" fill="none" />
    </g>
  ) },
  bucket: { label: "bucket", color: "#3D8BFF", ground: true, draw: (c) => (
    <g>
      <path d="M-44 -64 L44 -64 L34 0 L-34 0 Z" fill={c} stroke={o(c)} strokeWidth="5" strokeLinejoin="round" />
      <path d="M-44 -64 Q0 -120 44 -64" stroke="#333" strokeWidth="4" fill="none" />
    </g>
  ) },
  spade: { label: "spade", color: "#FF5E5B", draw: (c) => (
    <g transform="rotate(25)">
      <rect x={-5} y={-80} width={10} height={70} rx={4} fill="#F5C26B" stroke="#C99A4A" strokeWidth="3" />
      <path d="M-22 -10 h44 l-6 40 q-16 14 -32 0 z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
    </g>
  ) },
  flower: { label: "flower", color: "#FF6FA8", draw: (c) => (
    <g>
      <path d="M0 40 V-30" stroke="#3E9B3A" strokeWidth="6" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-48} rx={12} ry={18} fill={c} stroke={o(c)} strokeWidth="2" transform={`rotate(${a} 0 -30)`} />
      ))}
      <circle cx={0} cy={-30} r={11} fill="#FFD54A" />
    </g>
  ) },
  star: { label: "star", color: "#FFD23F", draw: (c, t) => (
    <path transform={`rotate(${Math.sin(t * 3) * 8}) scale(${1 + Math.sin(t * 5) * 0.05})`} d="M0 -46 L13 -14 L46 -12 L20 8 L29 42 L0 22 L-29 42 L-20 8 L-46 -12 L-13 -14 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
  ) },
  gift: { label: "present", color: "#8E5CFF", ground: true, draw: (c) => (
    <g>
      <rect x={-50} y={-90} width={100} height={90} rx={8} fill={c} stroke={o(c)} strokeWidth="5" />
      <rect x={-10} y={-90} width={20} height={90} fill="#FFD23F" />
      <path d="M0 -92 q-34 -40 -40 -8 q8 14 40 8 q34 -40 40 -8 q-8 14 -40 8" fill="#FFD23F" stroke="#C9A01A" strokeWidth="3" />
    </g>
  ) },
  crayon: { label: "crayon", color: "#FF5E5B", draw: (c) => (
    <g transform="rotate(-35)">
      <rect x={-9} y={-60} width={18} height={70} rx={4} fill={c} stroke={o(c)} strokeWidth="3" />
      <path d="M-9 -60 L0 -82 L9 -60 Z" fill={shade(c, 0.15)} stroke={o(c)} strokeWidth="3" strokeLinejoin="round" />
      <rect x={-9} y={-30} width={18} height={14} fill="#FFFFFF" opacity={0.7} />
    </g>
  ) },
  drawing: { label: "drawing", color: "#FFFFFF", draw: () => (
    <g>
      <rect x={-56} y={-70} width={112} height={84} rx={6} fill="#FFFFFF" stroke="#C9C9C9" strokeWidth="3" />
      <circle cx={30} cy={-46} r={12} fill="#FFD23F" />
      <path d="M-44 4 L-14 -34 L10 -6 L26 -22 L46 4 Z" fill="#7BC96F" />
      <path d="M-40 -50 q10 -12 20 0" stroke="#3D8BFF" strokeWidth="4" fill="none" />
    </g>
  ) },
  blocks: { label: "blocks", color: "#FF5E5B", ground: true, draw: () => (
    <g>
      <rect x={-60} y={-50} width={50} height={50} rx={6} fill="#FF5E5B" stroke={o("#FF5E5B")} strokeWidth="4" />
      <rect x={-5} y={-50} width={50} height={50} rx={6} fill="#3D8BFF" stroke={o("#3D8BFF")} strokeWidth="4" />
      <rect x={-34} y={-104} width={50} height={50} rx={6} fill="#FFD23F" stroke={o("#FFD23F")} strokeWidth="4" />
      <text x={-10} y={-70} fontFamily="Fredoka" fontWeight={700} fontSize={34} fill="#FFFFFF" textAnchor="middle">A</text>
    </g>
  ) },
  toy_car: { label: "toy car", color: "#E8453C", ground: true, draw: (c) => (
    <g>
      <path d="M-60 -20 h120 v-24 q-10 -6 -30 -8 l-16 -26 h-40 l-18 26 q-16 2 -16 32 z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <rect x={-30} y={-68} width={24} height={20} rx={4} fill="#BDE6FF" />
      <rect x={0} y={-68} width={24} height={20} rx={4} fill="#BDE6FF" />
      <circle cx={-34} cy={-14} r={16} fill="#333" />
      <circle cx={34} cy={-14} r={16} fill="#333" />
    </g>
  ) },
  drum: { label: "drum", color: "#FF5E5B", ground: true, draw: (c) => (
    <g>
      <rect x={-50} y={-70} width={100} height={70} rx={8} fill={c} stroke={o(c)} strokeWidth="5" />
      <ellipse cx={0} cy={-70} rx={50} ry={14} fill="#FFF3DD" stroke="#D8C6A5" strokeWidth="4" />
      <path d="M-50 -60 L-20 0 L10 -60 L40 0" stroke="#FFD23F" strokeWidth="5" fill="none" />
    </g>
  ) },
  sandwich: { label: "sandwich", color: "#F2C27A", draw: (c) => (
    <g>
      <path d="M-44 10 L0 -40 L44 10 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M-38 4 L38 4" stroke="#7BC96F" strokeWidth="8" />
      <path d="M-34 -2 L34 -2" stroke="#FF5E5B" strokeWidth="6" />
    </g>
  ) },
  bowl: { label: "bowl", color: "#5DA9FF", draw: (c) => (
    <g>
      <ellipse cx={0} cy={-26} rx={46} ry={12} fill="#FFF3DD" />
      <path d="M-48 -26 Q0 40 48 -26 Z" fill={c} stroke={o(c)} strokeWidth="4" />
    </g>
  ) },
  pillow: { label: "pillow", color: "#B9E3FF", ground: true, draw: (c) => <rect x={-70} y={-50} width={140} height={50} rx={22} fill={c} stroke={o(c)} strokeWidth="5" /> },
  bubbles: { label: "bubble wand", color: "#9ADBFF", draw: (c, t) => (
    <g>
      <rect x={-4} y={-60} width={8} height={70} rx={4} fill="#FF6FA8" />
      <circle cx={0} cy={-74} r={16} fill="none" stroke="#FF6FA8" strokeWidth="5" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={20 + i * 26 + Math.sin(t * 2 + i) * 6} cy={-90 - ((t * 40 + i * 30) % 120)} r={10 + i * 3} fill={c} fillOpacity={0.25} stroke={c} strokeWidth="3" />
      ))}
    </g>
  ) },
  leaf: { label: "leaf", color: "#FF8A2A", draw: (c) => <path d="M0 -40 C30 -30 34 10 0 40 C-34 10 -30 -30 0 -40 Z M0 -40 V44" fill={c} stroke={o(c)} strokeWidth="4" /> },
  shell: { label: "shell", color: "#FFB3C6", ground: true, draw: (c) => <path d="M-36 0 Q0 -70 36 0 Z M0 0 L-20 -40 M0 0 L0 -50 M0 0 L20 -40" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" /> },
  sandcastle: { label: "sandcastle", color: "#F5DB9A", ground: true, draw: (c) => (
    <g>
      <rect x={-80} y={-60} width={160} height={60} fill={c} stroke={o(c)} strokeWidth="5" />
      <rect x={-30} y={-120} width={60} height={60} fill={c} stroke={o(c)} strokeWidth="5" />
      <path d="M0 -120 V-160 l24 10 l-24 10" stroke="#5A4A3A" strokeWidth="3" fill="#FF5E5B" />
      <rect x={-10} y={-30} width={20} height={30} rx={10} fill={o(c)} />
    </g>
  ) },
  snowman: { label: "snowman", color: "#FFFFFF", ground: true, draw: () => (
    <g>
      <circle cx={0} cy={-60} r={60} fill="#FFFFFF" stroke="#C9DDEA" strokeWidth="5" />
      <circle cx={0} cy={-160} r={44} fill="#FFFFFF" stroke="#C9DDEA" strokeWidth="5" />
      <circle cx={-14} cy={-170} r={6} fill="#333" />
      <circle cx={14} cy={-170} r={6} fill="#333" />
      <path d="M0 -158 l30 8 l-30 4 z" fill="#FF8A2A" />
      <path d="M-44 -122 q44 20 88 0" stroke="#E53950" strokeWidth="14" fill="none" strokeLinecap="round" />
    </g>
  ) },
  puddle: { label: "puddle", color: "#7FC8FF", ground: true, draw: (c, t) => (
    <g>
      <ellipse cx={0} cy={0} rx={130} ry={24} fill={c} stroke={o(c)} strokeWidth="4" />
      <ellipse cx={-20} cy={-2} rx={40 + Math.sin(t * 3) * 6} ry={8} fill="none" stroke="#FFFFFF" strokeWidth="3" opacity={0.7} />
    </g>
  ) },
  magnifier: { label: "magnifying glass", color: "#5A4A3A", draw: (c) => (
    <g transform="rotate(-20)">
      <rect x={-6} y={-10} width={12} height={60} rx={6} fill={c} />
      <circle cx={0} cy={-40} r={30} fill="#CFEFFF" fillOpacity={0.6} stroke="#9AA6B2" strokeWidth="8" />
    </g>
  ) },
  plaster: { label: "plaster", color: "#F4C9A0", draw: (c) => (
    <g transform="rotate(-20)">
      <rect x={-46} y={-14} width={92} height={28} rx={14} fill={c} stroke={o(c)} strokeWidth="3" />
      <rect x={-14} y={-14} width={28} height={28} fill={shade(c, 0.12)} />
    </g>
  ) },
};

export const PROP_IDS = Object.keys(P);
export const PROP_LABELS: Record<string, string> = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.label]));
export const GROUND_PROPS = Object.entries(P).filter(([, v]) => v.ground).map(([k]) => k);

/** Предмет: id из библиотеки, цвет (для уроков про цвета), t — время для мелкой анимации. */
export function Prop({ id, color, t, scale = 1 }: { id: string; color?: string; t: number; scale?: number }) {
  const p = P[id];
  if (!p) return null;
  return <g transform={`scale(${scale})`}>{p.draw(color ?? p.color ?? "#FF4D5A", t)}</g>;
}
