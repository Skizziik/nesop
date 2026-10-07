import { useCurrentFrame } from "remotion";
import type { StickerPlacement } from "../generated";

/** Встроенные SVG-наклейки (собственная отрисовка, без внешних лицензий). PNG владельца — этап 4 (assets). */
const SHAPES: Record<string, React.ReactNode> = {
  heart: <path d="M50 88 L14 52 A20 20 0 0 1 50 22 A20 20 0 0 1 86 52 Z" fill="#FF4D6D" stroke="#fff" strokeWidth="6" />,
  star: (
    <path
      d="M50 6 L62 38 L96 38 L68 58 L79 92 L50 72 L21 92 L32 58 L4 38 L38 38 Z"
      fill="#FFD23F"
      stroke="#fff"
      strokeWidth="6"
      strokeLinejoin="round"
    />
  ),
  flower: (
    <g stroke="#fff" strokeWidth="5">
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={50 + 24 * Math.cos((a * Math.PI) / 180)} cy={50 + 24 * Math.sin((a * Math.PI) / 180)} r="18" fill="#FF8FB1" />
      ))}
      <circle cx="50" cy="50" r="14" fill="#FFD23F" />
    </g>
  ),
  pizza: (
    <g stroke="#fff" strokeWidth="5" strokeLinejoin="round">
      <path d="M50 92 L12 18 Q50 2 88 18 Z" fill="#FFC857" />
      <path d="M12 18 Q50 2 88 18 L84 28 Q50 14 16 28 Z" fill="#C97B2B" />
      <circle cx="44" cy="40" r="8" fill="#E3262E" />
      <circle cx="60" cy="58" r="7" fill="#E3262E" />
      <circle cx="50" cy="74" r="5" fill="#E3262E" />
    </g>
  ),
  italy: (
    <g stroke="#fff" strokeWidth="5">
      <rect x="6" y="20" width="30" height="60" fill="#009246" />
      <rect x="36" y="20" width="30" height="60" fill="#F1F2F1" />
      <rect x="66" y="20" width="30" height="60" fill="#CE2B37" />
    </g>
  ),
};

export const STICKER_NAMES = Object.keys(SHAPES);

export const Sticker: React.FC<{ s: StickerPlacement }> = ({ s }) => {
  const frame = useCurrentFrame();
  const shape = SHAPES[s.name];
  if (!shape) return null;
  const wobble = Math.sin(frame / 9 + s.x) * 4;
  return (
    <svg
      width={s.size}
      height={s.size}
      viewBox="0 0 100 100"
      style={{ position: "absolute", left: s.x, top: s.y, transform: `rotate(${(s.rotate ?? 0) + wobble}deg)`, filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.18))" }}
    >
      {shape}
    </svg>
  );
};
