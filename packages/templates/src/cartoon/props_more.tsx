/**
 * Ещё предметы историй (этап 2: 60+). Те же правила, что в props.tsx: центр хвата в (0,0) для предметов в руке,
 * середина низа — для стоящих на земле; размер ~ ладонь ребёнка; контур цветом детали (shade), блик сверху слева.
 * draw(c, t, state) — state из каталога (например "bitten", "open", "popped").
 */
import type { ReactNode } from "react";
import { shade } from "./rig";

const o = (c: string) => shade(c, 0.35);
const hi = (x: number, y: number, rx: number, ry: number) => <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#FFFFFF" opacity={0.45} />;
export type DrawFn = (c: string, t: number, state?: string) => ReactNode;
export interface PropDef {
  draw: DrawFn;
  color?: string;
  ground?: boolean;
  label: string;
}

export const MORE_PROPS: Record<string, PropDef> = {
  orange: { label: "orange", color: "#FF9A2A", draw: (c) => (
    <g>
      <circle r={30} fill={c} stroke={o(c)} strokeWidth="4" />
      <path d="M0 -30 q6 -12 16 -12 q-4 10 -16 12" fill="#4CB944" />
      {[[-10, -6], [8, 8], [12, -10], [-6, 14]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} fill={shade(c, 0.2)} />)}
      {hi(-12, -14, 6, 9)}
    </g>
  ) },
  strawberry: { label: "strawberry", color: "#FF3B4A", draw: (c) => (
    <g>
      <path d="M0 34 C-30 10 -34 -24 0 -26 C34 -24 30 10 0 34 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M-18 -26 L-6 -20 L0 -32 L6 -20 L18 -26 L10 -14 L-10 -14 Z" fill="#4CB944" stroke="#2E8A3A" strokeWidth="3" strokeLinejoin="round" />
      {[[-10, -4], [8, -6], [0, 8], [-12, 12], [12, 10], [0, 22]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={2} ry={3} fill="#FFE27A" />)}
    </g>
  ) },
  watermelon: { label: "watermelon slice", color: "#FF4D6A", draw: (c) => (
    <g>
      <path d="M-50 -10 A50 50 0 0 0 50 -10 Z" fill="#4CB944" stroke="#2E8A3A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M-42 -10 A42 42 0 0 0 42 -10 Z" fill="#E9FFD6" />
      <path d="M-36 -10 A36 36 0 0 0 36 -10 Z" fill={c} />
      {[[-18, 2], [0, 10], [18, 2], [-8, 18], [10, 18]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={3} ry={5} fill="#2A1B33" />)}
    </g>
  ) },
  grapes: { label: "bunch of grapes", color: "#8E5CFF", draw: (c) => (
    <g>
      <path d="M0 -40 q4 -10 12 -12" stroke="#6B4A2A" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M8 -50 q16 -8 22 4 q-14 6 -22 -4" fill="#4CB944" />
      {[[-14, -30], [0, -32], [14, -30], [-20, -14], [-6, -14], [8, -14], [20, -14], [-12, 2], [2, 2], [14, 2], [-4, 18], [8, 18], [2, 32]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={10} fill={c} stroke={o(c)} strokeWidth="2.5" />
          <circle cx={(x ?? 0) - 3} cy={(y ?? 0) - 3} r={2.5} fill="#FFFFFF" opacity={0.5} />
        </g>
      ))}
    </g>
  ) },
  cupcake: { label: "cupcake", color: "#FF8CC0", draw: (c) => (
    <g>
      <path d="M-28 -4 L28 -4 L20 34 L-20 34 Z" fill="#7FD7FF" stroke="#3EA6D6" strokeWidth="4" strokeLinejoin="round" />
      <path d="M-14 -4 L-10 34 M0 -4 V34 M14 -4 L10 34" stroke="#3EA6D6" strokeWidth="2.5" />
      <path d="M-32 -4 Q-36 -28 -12 -30 Q-8 -52 10 -46 Q30 -44 26 -26 Q38 -16 32 -4 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <circle cx={2} cy={-52} r={8} fill="#E53950" />
      {[[-16, -16, "#FFD23F"], [10, -22, "#3D8BFF"], [18, -10, "#4CB944"], [-4, -10, "#FFFFFF"]].map(([x, y, col], i) => (
        <rect key={i} x={Number(x) - 4} y={Number(y) - 1.5} width={8} height={3} rx={1.5} fill={String(col)} transform={`rotate(${i * 40} ${x} ${y})`} />
      ))}
    </g>
  ) },
  pancakes: { label: "stack of pancakes", color: "#F2B45A", ground: true, draw: (c) => (
    <g>
      <ellipse cx={0} cy={-4} rx={70} ry={14} fill="#FFFFFF" stroke="#D6D6E0" strokeWidth="4" />
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx={0} cy={-16 - i * 14} rx={52} ry={12} fill={c} stroke={o(c)} strokeWidth="4" />
      ))}
      <path d="M-30 -66 Q0 -84 30 -66 Q24 -50 14 -54 Q8 -40 0 -52 Q-10 -44 -16 -56 Q-26 -50 -30 -66 Z" fill="#C8771E" opacity={0.9} />
      <rect x={-10} y={-80} width={20} height={12} rx={3} fill="#FFF2A8" stroke="#E6C85A" strokeWidth="2" />
    </g>
  ) },
  juice: { label: "juice box", color: "#FF9A2A", draw: (c) => (
    <g>
      <rect x={-20} y={-34} width={40} height={64} rx={6} fill={c} stroke={o(c)} strokeWidth="4" />
      <circle cx={0} cy={2} r={12} fill="#FFFFFF" />
      <circle cx={0} cy={2} r={8} fill="#FF9A2A" />
      <path d="M8 -34 L14 -60 L22 -62" stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round" />
      {hi(-10, -22, 4, 8)}
    </g>
  ) },
  milk: { label: "glass of milk", color: "#FFFFFF", draw: () => (
    <g>
      <path d="M-20 -40 L20 -40 L16 30 L-16 30 Z" fill="#E8F6FF" stroke="#9FC4DC" strokeWidth="4" strokeLinejoin="round" />
      <path d="M-18 -22 L18 -22 L16 30 L-16 30 Z" fill="#FFFFFF" />
      <path d="M-18 -22 q9 6 18 0 q9 -6 18 0" stroke="#E2EEF6" strokeWidth="3" fill="none" />
    </g>
  ) },
  egg: { label: "egg", color: "#FFF6E6", draw: (c, _t, st) =>
    st === "cracked" ? (
      <g>
        <path d="M-30 6 C-30 30 30 30 30 6 L22 -2 L14 8 L6 -4 L-2 8 L-10 -4 L-18 8 Z" fill={c} stroke="#D8C6A5" strokeWidth="4" strokeLinejoin="round" />
        <ellipse cx={0} cy={8} rx={14} ry={8} fill="#FFC93D" />
        <path d="M-22 -20 L-14 -30 L-6 -20 L2 -30 L10 -20 L18 -30 C10 -60 -14 -60 -22 -20 Z" fill={c} stroke="#D8C6A5" strokeWidth="4" strokeLinejoin="round" transform="translate(-6 -16) rotate(-20)" />
      </g>
    ) : (
      <g>
        <path d="M0 -40 C-30 -40 -34 30 0 30 C34 30 30 -40 0 -40 Z" fill={c} stroke="#D8C6A5" strokeWidth="4" />
        {hi(-10, -20, 6, 10)}
      </g>
    ) },
  rubber_duck: { label: "rubber duck", color: "#FFD23F", draw: (c) => (
    <g>
      <path d="M-34 10 Q-40 -10 -14 -8 Q-26 -40 4 -44 Q28 -44 26 -20 Q44 -20 40 2 Q34 26 0 26 Q-30 26 -34 10 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M24 -26 q18 -2 22 6 q-12 8 -22 2" fill="#FF8A2A" stroke="#D96A12" strokeWidth="3" strokeLinejoin="round" />
      <circle cx={10} cy={-30} r={5} fill="#2A1B33" />
      <circle cx={11} cy={-32} r={1.6} fill="#FFFFFF" />
      <path d="M-14 4 q10 10 24 0" stroke={o(c)} strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  ) },
  soap: { label: "soap with bubbles", color: "#9FE3FF", draw: (c, t) => (
    <g>
      <rect x={-30} y={-16} width={60} height={32} rx={14} fill={c} stroke={o(c)} strokeWidth="4" />
      {hi(-14, -6, 10, 4)}
      {[0, 1, 2].map((i) => {
        const ph = (t * 0.6 + i / 3) % 1;
        return <circle key={i} cx={-14 + i * 14 + Math.sin(t * 2 + i) * 6} cy={-24 - ph * 60} r={6 + i * 2} fill="#FFFFFF" fillOpacity={0.35} stroke="#9FD8FF" strokeWidth="2" opacity={1 - ph} />;
      })}
    </g>
  ) },
  towel: { label: "towel", color: "#FF8FA3", draw: (c) => (
    <g>
      <path d="M-28 -46 h56 v80 q-28 10 -56 0 z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M-28 18 h56 M-28 26 h56" stroke="#FFFFFF" strokeWidth="4" />
    </g>
  ) },
  robot: { label: "toy robot", color: "#9AA9C9", ground: true, draw: (c, t) => (
    <g>
      <rect x={-26} y={-60} width={52} height={50} rx={10} fill={c} stroke={o(c)} strokeWidth="4" />
      <rect x={-20} y={-112} width={40} height={40} rx={10} fill={c} stroke={o(c)} strokeWidth="4" />
      <path d="M0 -112 v-14" stroke={o(c)} strokeWidth="4" />
      <circle cx={0} cy={-130} r={6} fill={Math.sin(t * 6) > 0 ? "#FF4D5A" : "#FFD23F"} />
      <circle cx={-9} cy={-94} r={6} fill="#7FE0FF" stroke="#3B8BD0" strokeWidth="2" />
      <circle cx={9} cy={-94} r={6} fill="#7FE0FF" stroke="#3B8BD0" strokeWidth="2" />
      <rect x={-10} y={-84} width={20} height={5} rx={2.5} fill={o(c)} />
      <rect x={-12} y={-48} width={24} height={14} rx={4} fill="#FFD23F" />
      <rect x={-20} y={-10} width={14} height={10} rx={3} fill={o(c)} />
      <rect x={6} y={-10} width={14} height={10} rx={3} fill={o(c)} />
    </g>
  ) },
  dinosaur: { label: "toy dinosaur", color: "#4CB944", ground: true, draw: (c) => (
    <g>
      <path d="M-60 -20 Q-40 -60 0 -56 Q20 -90 44 -84 Q64 -80 60 -62 Q50 -52 30 -56 Q36 -30 24 -12 L24 0 L12 0 L10 -10 L-14 -10 L-16 0 L-28 0 L-28 -14 Q-50 -10 -70 -2 Q-66 -14 -60 -20 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      {[-30, -14, 2].map((x, i) => <path key={i} d={`M${x} ${-56 + i * -2} l8 -14 l8 14`} fill="#FFD23F" stroke="#D9A512" strokeWidth="2" strokeLinejoin="round" />)}
      <circle cx={46} cy={-72} r={4} fill="#2A1B33" />
      <path d="M44 -62 q8 4 14 0" stroke={o(c)} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ) },
  train: { label: "toy train", color: "#E8453C", ground: true, draw: (c, t) => (
    <g>
      <rect x={-60} y={-50} width={70} height={36} rx={8} fill={c} stroke={o(c)} strokeWidth="4" />
      <rect x={-10} y={-78} width={36} height={64} rx={8} fill="#3D8BFF" stroke={o("#3D8BFF")} strokeWidth="4" />
      <rect x={-4} y={-70} width={24} height={20} rx={4} fill="#BDE6FF" />
      <rect x={-50} y={-70} width={16} height={22} rx={4} fill="#2A1B33" opacity={0.8} />
      <circle cx={-42} cy={-80 - ((t * 30) % 20)} r={8} fill="#FFFFFF" opacity={0.7} />
      {[-44, -14, 14].map((x) => (
        <g key={x} transform={`translate(${x} -10) rotate(${t * 200})`}>
          <circle r={11} fill="#FFD23F" stroke="#D9A512" strokeWidth="3" />
          <path d="M-8 0 H8" stroke="#D9A512" strokeWidth="3" />
        </g>
      ))}
    </g>
  ) },
  boat: { label: "toy sailboat", color: "#3D8BFF", draw: (c, t) => (
    <g transform={`rotate(${Math.sin(t * 2) * 5})`}>
      <path d="M-44 0 L44 0 L32 22 L-32 22 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M0 0 V-70" stroke="#8B5A2B" strokeWidth="4" />
      <path d="M4 -66 L38 -10 L4 -10 Z" fill="#FFFFFF" stroke="#D6D6E0" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-4 -56 L-30 -10 L-4 -10 Z" fill="#FF4D5A" stroke={o("#FF4D5A")} strokeWidth="3" strokeLinejoin="round" />
    </g>
  ) },
  trumpet: { label: "toy trumpet", color: "#FFC93D", draw: (c) => (
    <g transform="rotate(-15)">
      <rect x={-50} y={-6} width={60} height={12} rx={6} fill={c} stroke={o(c)} strokeWidth="3" />
      <path d="M10 -6 L44 -24 L44 24 L10 6 Z" fill={c} stroke={o(c)} strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx={44} cy={0} rx={6} ry={24} fill={shade(c, 0.15)} stroke={o(c)} strokeWidth="3" />
      {[-30, -18, -6].map((x) => <rect key={x} x={x - 3} y={-16} width={6} height={10} rx={3} fill={o(c)} />)}
    </g>
  ) },
  xylophone: { label: "toy xylophone", color: "#FF4D5A", ground: true, draw: () => (
    <g>
      <path d="M-80 -20 L80 -30 M-80 -6 L80 -2" stroke="#8B5A2B" strokeWidth="6" strokeLinecap="round" />
      {["#FF4D5A", "#FF8A2A", "#FFD23F", "#4CB944", "#3D8BFF", "#8E5CFF"].map((col, i) => (
        <rect key={i} x={-70 + i * 24} y={-44 + i * 2} width={20} height={56 - i * 6} rx={5} fill={col} stroke={shade(col, 0.35)} strokeWidth="3" />
      ))}
    </g>
  ) },
  jump_rope: { label: "jump rope", color: "#FF6FA8", draw: (c, t) => (
    <g>
      <rect x={-6} y={-20} width={12} height={34} rx={6} fill="#FFD23F" stroke="#D9A512" strokeWidth="3" />
      <path d={`M0 14 Q${30 + Math.sin(t * 3) * 10} 60 70 30`} stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  ) },
  magic_wand: { label: "magic wand", color: "#FFD23F", draw: (c, t) => (
    <g transform="rotate(-25)">
      <rect x={-4} y={-60} width={8} height={70} rx={4} fill="#8E5CFF" stroke={o("#8E5CFF")} strokeWidth="2.5" />
      <g transform={`translate(0 -72) rotate(${t * 60}) scale(${1 + Math.sin(t * 6) * 0.08})`}>
        <path d="M0 -20 L6 -6 L20 -6 L9 3 L13 18 L0 9 L-13 18 L-9 3 L-20 -6 L-6 -6 Z" fill={c} stroke={o(c)} strokeWidth="3" strokeLinejoin="round" />
      </g>
      {[0, 1, 2].map((i) => <circle key={i} cx={Math.sin(t * 3 + i * 2) * 26} cy={-80 + Math.cos(t * 3 + i * 2) * 26} r={3} fill="#FFFFFF" opacity={0.8} />)}
    </g>
  ) },
  crown: { label: "paper crown", color: "#FFD23F", draw: (c) => (
    <g>
      <path d="M-40 10 L-40 -24 L-20 -6 L0 -34 L20 -6 L40 -24 L40 10 Z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <circle cx={-20} cy={0} r={5} fill="#FF4D5A" />
      <circle cx={0} cy={-2} r={6} fill="#3D8BFF" />
      <circle cx={20} cy={0} r={5} fill="#4CB944" />
    </g>
  ) },
  backpack: { label: "backpack", color: "#3D8BFF", ground: true, draw: (c) => (
    <g>
      <path d="M-20 -80 q20 -24 40 0" stroke={o(c)} strokeWidth="6" fill="none" />
      <rect x={-40} y={-80} width={80} height={80} rx={22} fill={c} stroke={o(c)} strokeWidth="4" />
      <rect x={-28} y={-40} width={56} height={32} rx={10} fill={shade(c, -0.25)} stroke={o(c)} strokeWidth="3" />
      <circle cx={0} cy={-58} r={7} fill="#FFD23F" />
    </g>
  ) },
  watering_can: { label: "watering can", color: "#4CB944", draw: (c, t, st) => (
    <g>
      <path d="M-30 -30 h44 v40 q-22 8 -44 0 z" fill={c} stroke={o(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M14 -16 L46 -40" stroke={c} strokeWidth="9" strokeLinecap="round" />
      <path d="M-30 -22 q-18 4 -12 22" stroke={o(c)} strokeWidth="5" fill="none" />
      <path d="M-24 -30 q16 -18 32 0" stroke={o(c)} strokeWidth="5" fill="none" />
      {st === "pouring"
        ? [0, 1, 2, 3].map((i) => <path key={i} d={`M${48 + i * 4} ${-36 + ((t * 120 + i * 14) % 50)} v8`} stroke="#7FC8FF" strokeWidth="3" strokeLinecap="round" />)
        : null}
    </g>
  ) },
  snowball: { label: "snowball", color: "#FFFFFF", draw: (c) => (
    <g>
      <circle r={22} fill={c} stroke="#C9DCEB" strokeWidth="4" />
      <circle cx={-6} cy={-6} r={6} fill="#EAF4FB" />
    </g>
  ) },
  acorn: { label: "acorn", color: "#B5651D", draw: (c) => (
    <g>
      <ellipse cx={0} cy={6} rx={16} ry={20} fill={c} stroke={o(c)} strokeWidth="3" />
      <path d="M-20 -6 Q0 -26 20 -6 Q0 0 -20 -6 Z" fill="#7A4E2A" stroke="#5A3A20" strokeWidth="3" />
      <path d="M0 -18 v-10" stroke="#5A3A20" strokeWidth="4" strokeLinecap="round" />
    </g>
  ) },
  sled: { label: "sled", color: "#E8453C", ground: true, draw: (c) => (
    <g>
      <rect x={-70} y={-34} width={130} height={18} rx={8} fill={c} stroke={o(c)} strokeWidth="4" />
      <path d="M-60 -16 v12 M40 -16 v12" stroke="#8B8B9A" strokeWidth="5" />
      <path d="M-74 -4 H60 Q80 -4 78 -24" stroke="#8B8B9A" strokeWidth="6" fill="none" strokeLinecap="round" />
    </g>
  ) },
  tricycle: { label: "tricycle", color: "#FF4D5A", ground: true, draw: (c, t) => (
    <g>
      {[[-50, -22, 22], [44, -30, 30]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${t * 90})`}>
          <circle r={r} fill="none" stroke="#2A1B33" strokeWidth="6" />
          <path d={`M${-(r ?? 0) + 4} 0 H${(r ?? 0) - 4} M0 ${-(r ?? 0) + 4} V${(r ?? 0) - 4}`} stroke="#9AA9C9" strokeWidth="3" />
        </g>
      ))}
      <path d="M-50 -22 L0 -40 L44 -30 M0 -40 L30 -84 M20 -84 h24" stroke={c} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={-16} y={-54} width={30} height={10} rx={5} fill="#2A1B33" />
    </g>
  ) },
  butterfly_net: { label: "butterfly net", color: "#9FE3FF", draw: (c) => (
    <g transform="rotate(-20)">
      <rect x={-4} y={-50} width={8} height={70} rx={4} fill="#C98F55" />
      <circle cx={0} cy={-76} r={26} fill={c} fillOpacity={0.4} stroke="#FFFFFF" strokeWidth="5" />
      <path d="M-22 -66 Q0 -20 22 -66" stroke="#FFFFFF" strokeWidth="3" fill="none" opacity={0.8} />
    </g>
  ) },
  paper_plane: { label: "paper plane", color: "#FFFFFF", draw: (c, t) => (
    <g transform={`translate(0 ${Math.sin(t * 3) * 4}) rotate(-10)`}>
      <path d="M-40 0 L44 -18 L-10 18 Z" fill={c} stroke="#B9C6D6" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-10 18 L-4 2 L44 -18" fill="#E2EAF3" stroke="#B9C6D6" strokeWidth="3" strokeLinejoin="round" />
    </g>
  ) },
};
