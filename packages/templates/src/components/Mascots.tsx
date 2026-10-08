/**
 * Маскоты канала — собственная SVG-отрисовка (без внешних лицензий).
 * Каждый персонаж: тело + общее «лицо» (глаза, брови, рот). Рот — по RMS голоса (0/1/2), моргание по таймеру, эмоции.
 */
import type { ReactNode } from "react";

export type Mouth = 0 | 1 | 2;
export type Emotion = "neutral" | "happy" | "surprised" | "thinking";

export interface FaceState {
  mouth: Mouth;
  blink: boolean;
  emotion: Emotion;
  t: number; // секунды — для мелких idle-анимаций
}

const INK = "#2B1206";

/** Лицо в локальных координатах: центр (0,0), ширина ~80. */
export function Face({ s, scale = 1, skin = "#FFFFFF", cheeks = "#FF8FB1" }: { s: FaceState; scale?: number; skin?: string; cheeks?: string }) {
  const { mouth, blink, emotion, t } = s;
  const look = emotion === "thinking" ? 4 : Math.sin(t * 0.7) * 1.5; // взгляд чуть гуляет
  const eyeRy = emotion === "surprised" ? 13 : 11;
  const brow = emotion === "surprised" ? -24 : emotion === "thinking" ? -19 : -20;
  const eyes = blink ? (
    <>
      <path d="M-26 -2 q10 6 20 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M6 -2 q10 6 20 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
    </>
  ) : emotion === "happy" && mouth === 0 ? (
    <>
      <path d="M-26 0 q10 -10 20 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M6 0 q10 -10 20 0" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
    </>
  ) : (
    <>
      <ellipse cx="-16" cy="-2" rx="9" ry={eyeRy} fill={skin} />
      <ellipse cx="16" cy="-2" rx="9" ry={eyeRy} fill={skin} />
      <circle cx={-14 + look} cy={emotion === "thinking" ? -6 : 0} r="5" fill={INK} />
      <circle cx={18 + look} cy={emotion === "thinking" ? -6 : 0} r="5" fill={INK} />
      <circle cx={-12 + look} cy={emotion === "thinking" ? -8 : -2} r="1.6" fill="#fff" />
      <circle cx={20 + look} cy={emotion === "thinking" ? -8 : -2} r="1.6" fill="#fff" />
    </>
  );
  const brows = (
    <>
      <path d={`M-26 ${brow + (emotion === "thinking" ? 3 : 0)} q10 ${emotion === "surprised" ? -6 : -3} 20 0`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d={`M6 ${brow - (emotion === "thinking" ? 3 : 0)} q10 ${emotion === "surprised" ? -6 : -3} 20 0`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  );
  let m: ReactNode;
  if (mouth === 0) {
    m =
      emotion === "surprised" ? (
        <ellipse cx="0" cy="26" rx="6" ry="7" fill="#7A1020" stroke={INK} strokeWidth="3.5" />
      ) : emotion === "thinking" ? (
        <path d="M-6 26 q9 -4 16 2" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      ) : (
        <path d={emotion === "happy" ? "M-16 20 q16 18 32 0" : "M-14 22 q14 10 28 0"} stroke={INK} strokeWidth="5" fill={emotion === "happy" ? "#7A1020" : "none"} strokeLinecap="round" />
      );
  } else {
    m = (
      <g>
        <ellipse cx="0" cy="25" rx={mouth === 1 ? 11 : 14} ry={mouth === 1 ? 6 : 12} fill="#7A1020" stroke={INK} strokeWidth="4" />
        {mouth === 2 ? <ellipse cx="0" cy="31" rx="7" ry="4" fill="#FF6F7D" /> : null}
      </g>
    );
  }
  return (
    <g transform={`scale(${scale})`}>
      {brows}
      {eyes}
      <circle cx="-30" cy="14" r="6" fill={cheeks} opacity="0.65" />
      <circle cx="30" cy="14" r="6" fill={cheeks} opacity="0.65" />
      {m}
    </g>
  );
}

const STROKE = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const };

type Body = (s: FaceState) => ReactNode;

const pizza: Body = (s) => (
  <g>
    <path d="M100 236 L18 52 Q100 14 182 52 Z" fill="#FFC857" {...STROKE} />
    <path d="M18 52 Q100 14 182 52 L172 72 Q100 36 28 72 Z" fill="#D9822B" {...STROKE} />
    <circle cx="62" cy="96" r="12" fill="#E3412E" />
    <circle cx="140" cy="102" r="11" fill="#E3412E" />
    <circle cx="110" cy="182" r="9" fill="#E3412E" />
    <g transform="translate(100 120)">
      <Face s={s} />
    </g>
    <g transform="translate(150 4)">
      <rect x="0" y="0" width="4" height="44" fill="#7A3E00" />
      <rect x="4" y="2" width="11" height="17" fill="#009246" />
      <rect x="15" y="2" width="11" height="17" fill="#F1F2F1" />
      <rect x="26" y="2" width="11" height="17" fill="#CE2B37" />
    </g>
  </g>
);

const espresso: Body = (s) => {
  const steam = (dx: number, ph: number) => (
    <path
      d={`M${100 + dx} 52 q-10 -14 0 -26 q10 -12 0 -26`}
      stroke="#ffffff"
      strokeWidth="6"
      fill="none"
      strokeLinecap="round"
      opacity={0.45 + 0.35 * Math.sin(s.t * 2 + ph)}
      transform={`translate(0 ${Math.sin(s.t * 1.6 + ph) * 3})`}
    />
  );
  return (
    <g>
      {steam(-22, 0)}
      {steam(4, 1.5)}
      {steam(28, 3)}
      <ellipse cx="100" cy="222" rx="92" ry="16" fill="#F4F1EA" {...STROKE} />
      <path d="M150 104 q46 0 46 36 q0 34 -50 34" fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
      <path d="M150 104 q46 0 46 36 q0 34 -50 34" fill="none" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" />
      <path d="M26 66 L174 66 L160 206 Q100 222 40 206 Z" fill="#FFFFFF" {...STROKE} />
      <ellipse cx="100" cy="66" rx="74" ry="14" fill="#6F3B1E" {...STROKE} />
      <ellipse cx="88" cy="63" rx="20" ry="4" fill="#C98A5A" opacity="0.8" />
      <rect x="30" y="170" width="140" height="10" fill="#009246" opacity="0.9" />
      <rect x="30" y="180" width="140" height="8" fill="#CE2B37" opacity="0.9" />
      <g transform="translate(100 124)">
        <Face s={s} />
      </g>
    </g>
  );
};

const gelato: Body = (s) => (
  <g>
    <path d="M52 124 L100 236 L148 124 Z" fill="#E7A867" {...STROKE} />
    {[0, 1, 2, 3].map((i) => (
      <path key={`a${i}`} d={`M${60 + i * 22} 128 L${84 + i * 14} 190`} stroke="#B87333" strokeWidth="3" />
    ))}
    {[0, 1, 2, 3].map((i) => (
      <path key={`b${i}`} d={`M${140 - i * 22} 128 L${116 - i * 14} 190`} stroke="#B87333" strokeWidth="3" />
    ))}
    <circle cx="100" cy="66" r="44" fill="#A7D676" {...STROKE} />
    <path d="M44 120 q8 -40 56 -40 q48 0 56 40 q-14 10 -28 4 q-14 10 -28 0 q-14 10 -28 0 q-14 8 -28 -4 Z" fill="#FF9EBB" {...STROKE} />
    <circle cx="104" cy="22" r="9" fill="#C8102E" {...STROKE} />
    <path d="M104 14 q8 -12 18 -10" stroke="#3B7A2A" strokeWidth="4" fill="none" />
    <g transform="translate(100 104) scale(0.9)">
      <Face s={s} />
    </g>
  </g>
);

const colosseo: Body = (s) => (
  <g>
    <path d="M14 96 Q100 40 186 96 L186 226 L14 226 Z" fill="#E8C99A" {...STROKE} />
    <path d="M14 96 Q100 40 186 96" fill="none" stroke="#C9A26B" strokeWidth="10" />
    <path d="M150 70 L186 96 L186 140 L162 124 Z" fill="#D4B07A" stroke={INK} strokeWidth="4" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <path key={i} d={`M${24 + i * 28} 226 v-26 a10 10 0 0 1 20 0 v26`} fill="#7A5A33" stroke={INK} strokeWidth="3" />
    ))}
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <path key={`u${i}`} d={`M${24 + i * 28} 186 v-14 a10 10 0 0 1 20 0 v14`} fill="#9E7A4D" stroke={INK} strokeWidth="2.5" />
    ))}
    <rect x="44" y="94" width="112" height="70" rx="20" fill="#F4E2C0" stroke={INK} strokeWidth="4" />
    <g transform="translate(100 124) scale(0.9)">
      <Face s={s} cheeks="#F2A07B" />
    </g>
  </g>
);

const limone: Body = (s) => (
  <g>
    <path d="M100 30 q34 -26 62 -10 q-24 6 -34 28" fill="#3B9B3A" {...STROKE} />
    <path d="M128 42 q-10 -20 -28 -20" stroke="#2A6E28" strokeWidth="4" fill="none" />
    <ellipse cx="100" cy="132" rx="84" ry="96" fill="#FFE135" {...STROKE} />
    <ellipse cx="100" cy="36" rx="10" ry="8" fill="#FFE135" {...STROKE} />
    <ellipse cx="100" cy="228" rx="9" ry="7" fill="#FFE135" {...STROKE} />
    {[[50, 80], [150, 90], [60, 190], [140, 196], [100, 70]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="3" fill="#E9C700" />
    ))}
    <g transform="translate(100 136)">
      <Face s={s} />
    </g>
  </g>
);

const vespa: Body = (s) => (
  <g>
    <rect x="34" y="40" width="132" height="10" rx="5" fill="#555" {...STROKE} />
    <rect x="20" y="34" width="26" height="20" rx="8" fill="#2B2B2B" />
    <rect x="154" y="34" width="26" height="20" rx="8" fill="#2B2B2B" />
    <circle cx="100" cy="52" r="20" fill="#FFF6C2" {...STROKE} />
    <circle cx="100" cy="52" r={12 + Math.sin(s.t * 3) * 1} fill="#FFFFFF" opacity="0.9" />
    <path d="M40 84 Q100 58 160 84 L150 210 Q100 226 50 210 Z" fill="#8FD3C1" {...STROKE} />
    <path d="M56 96 Q100 78 144 96" stroke="#FFFFFF" strokeWidth="6" fill="none" opacity="0.6" />
    <rect x="86" y="206" width="28" height="12" fill="#2B2B2B" />
    <circle cx="100" cy="226" r="16" fill="#2B2B2B" stroke={INK} strokeWidth="4" />
    <circle cx="100" cy="226" r="6" fill="#999" />
    <g transform="translate(100 140)">
      <Face s={s} />
    </g>
  </g>
);

const gondoliere: Body = (s) => (
  <g>
    <path d="M30 236 Q30 150 100 150 Q170 150 170 236 Z" fill="#FFFFFF" {...STROKE} />
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M${36 + i * 2} ${176 + i * 16} Q100 ${170 + i * 16} ${164 - i * 2} ${176 + i * 16}`} stroke="#1F3A93" strokeWidth="9" fill="none" />
    ))}
    <path d="M86 152 L100 172 L114 152" fill="#CE2B37" stroke={INK} strokeWidth="3" />
    <circle cx="100" cy="104" r="52" fill="#F6C9A4" {...STROKE} />
    <ellipse cx="46" cy="106" rx="8" ry="12" fill="#F6C9A4" {...STROKE} />
    <ellipse cx="154" cy="106" rx="8" ry="12" fill="#F6C9A4" {...STROKE} />
    <path d="M70 128 q30 18 60 0" stroke="#5A3A1E" strokeWidth="8" fill="none" strokeLinecap="round" />
    <ellipse cx="100" cy="58" rx="86" ry="14" fill="#E8C766" {...STROKE} />
    <path d="M48 58 Q52 18 100 18 Q148 18 152 58 Z" fill="#F2D57A" {...STROKE} />
    <rect x="52" y="40" width="96" height="12" fill="#CE2B37" />
    <path d="M148 46 l22 -6 l-6 18 z" fill="#CE2B37" />
    <g transform="translate(100 104) scale(0.85)">
      <Face s={s} skin="#FFFFFF" cheeks="#F28C8C" />
    </g>
  </g>
);

export const MASCOTS: Record<string, { name: string; body: Body }> = {
  pizza: { name: "Пицца", body: pizza },
  espresso: { name: "Эспрессо", body: espresso },
  gelato: { name: "Джелато", body: gelato },
  colosseo: { name: "Колизей", body: colosseo },
  limone: { name: "Лимон Амальфи", body: limone },
  vespa: { name: "Веспа", body: vespa },
  gondoliere: { name: "Гондольер", body: gondoliere },
};
export const MASCOT_IDS = Object.keys(MASCOTS);

/** Персонаж целиком: viewBox 200×240; idle — лёгкое покачивание. */
export function Mascot({ character, s, height, flip = false }: { character: string; s: FaceState; height: number; flip?: boolean }) {
  const m = MASCOTS[character] ?? MASCOTS.pizza!;
  const sway = Math.sin(s.t * 1.3) * 2;
  return (
    <svg width={(height * 200) / 240} height={height} viewBox="0 0 200 240" style={{ overflow: "visible", filter: "drop-shadow(0 8px 0 rgba(0,0,0,0.2))" }}>
      <g transform={`${flip ? "translate(200 0) scale(-1 1) " : ""}rotate(${sway} 100 236)`}>{m.body(s)}</g>
    </svg>
  );
}
