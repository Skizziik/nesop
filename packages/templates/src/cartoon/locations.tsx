/**
 * Локации мультика. Мир 1920×1080, пол/земля — GROUND (ступни персонажей). Слои с параллаксом через <Layer depth>.
 * Новая локация = Back (за героями) и, по желанию, Front (передний план поверх героев).
 */
import type { ReactNode } from "react";
import { GardenForeground, GardenLife, GardenScene, GROUND, Layer, type Camera } from "./scenes";
import { shade } from "./rig";

const W = 1920;
const H = 1080;
type P = { cam: Camera; t: number };

function Sky({ id, top, bottom }: { id: string; top: string; bottom: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill={`url(#${id})`} />
    </>
  );
}

const out = (c: string, k = 0.32) => shade(c, k);

/* ------------------------------------------------------------------ гостиная */
function LivingRoom({ cam, t }: P) {
  const wall = "#FFE8C9";
  return (
    <g>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill={wall} />
      <Layer cam={cam} depth={0.85}>
        {/* обои — горошек */}
        {Array.from({ length: 12 * 7 }, (_, i) => (
          <circle key={i} cx={-300 + (i % 12) * 220 + (Math.floor(i / 12) % 2) * 110} cy={60 + Math.floor(i / 12) * 110} r={9} fill="#FFD9AE" />
        ))}
        {/* окно с садом */}
        <g transform="translate(1320 180)">
          <rect x={0} y={0} width={420} height={330} rx={16} fill="#8FD3FF" stroke="#C98F55" strokeWidth="14" />
          <path d={`M14 230 Q120 170 230 220 T 406 210 V316 H14 Z`} fill="#7ED36E" />
          <circle cx={330} cy={80} r={36} fill="#FFE04D" />
          <ellipse cx={130} cy={90} rx={60} ry={24} fill="#FFFFFF" transform={`translate(${Math.sin(t * 0.2) * 30} 0)`} />
          <path d="M210 0 V330 M0 165 H420" stroke="#C98F55" strokeWidth="12" />
          <path d="M-30 -20 Q60 160 30 360 L-60 360 L-60 -20 Z" fill="#FF8FA3" stroke={out("#FF8FA3")} strokeWidth="5" />
          <path d="M450 -20 Q360 160 390 360 L480 360 L480 -20 Z" fill="#FF8FA3" stroke={out("#FF8FA3")} strokeWidth="5" />
        </g>
        {/* картина */}
        <g transform="translate(380 190)">
          <rect x={0} y={0} width={220} height={160} rx={8} fill="#FFF7E8" stroke="#E0A33E" strokeWidth="12" />
          <path d="M20 140 L80 70 L120 110 L160 60 L200 140 Z" fill="#7BC96F" />
          <circle cx={170} cy={45} r={16} fill="#FFB23F" />
        </g>
        {/* полка с игрушками */}
        <g transform="translate(760 300)">
          <rect x={0} y={0} width={300} height={18} rx={6} fill="#C98F55" stroke={out("#C98F55")} strokeWidth="4" />
          <rect x={20} y={-60} width={46} height={60} rx={6} fill="#5DA9FF" stroke={out("#5DA9FF")} strokeWidth="4" />
          <rect x={72} y={-48} width={40} height={48} rx={6} fill="#FF6B6B" stroke={out("#FF6B6B")} strokeWidth="4" />
          <circle cx={170} cy={-30} r={30} fill="#FFD23F" stroke={out("#FFD23F")} strokeWidth="4" />
          <path d="M230 0 L250 -70 L270 0 Z" fill="#B38BFF" stroke={out("#B38BFF")} strokeWidth="4" strokeLinejoin="round" />
        </g>
        {/* плинтус и пол */}
        <rect x={-600} y={GROUND - 170} width={3200} height={24} fill="#E9C99A" />
        <rect x={-600} y={GROUND - 146} width={3200} height={H} fill="#D9A46A" />
        {Array.from({ length: 20 }, (_, i) => (
          <path key={i} d={`M${-600 + i * 180} ${GROUND - 146} V${H + 200}`} stroke="#C98F55" strokeWidth="4" />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.92}>
        {/* диван */}
        <g transform={`translate(420 ${GROUND - 110})`}>
          <rect x={-40} y={-210} width={560} height={150} rx={50} fill="#4FA3E0" stroke={out("#4FA3E0")} strokeWidth="6" />
          <rect x={-80} y={-110} width={640} height={110} rx={40} fill="#5DB2EE" stroke={out("#5DB2EE")} strokeWidth="6" />
          <rect x={-100} y={-170} width={90} height={170} rx={40} fill="#4FA3E0" stroke={out("#4FA3E0")} strokeWidth="6" />
          <rect x={510} y={-170} width={90} height={170} rx={40} fill="#4FA3E0" stroke={out("#4FA3E0")} strokeWidth="6" />
          <rect x={40} y={-180} width={110} height={80} rx={20} fill="#FFD23F" stroke={out("#FFD23F")} strokeWidth="5" transform="rotate(-8 95 -140)" />
        </g>
        {/* ковёр */}
        <ellipse cx={1100} cy={GROUND + 40} rx={560} ry={70} fill="#FF9FB2" stroke={out("#FF9FB2")} strokeWidth="6" />
        <ellipse cx={1100} cy={GROUND + 40} rx={430} ry={50} fill="none" stroke="#FFFFFF" strokeWidth="6" strokeDasharray="4 18" strokeLinecap="round" />
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ кухня */
function Kitchen({ cam, t }: P) {
  return (
    <g>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#E6F6EE" />
      <Layer cam={cam} depth={0.85}>
        {/* плитка */}
        {Array.from({ length: 14 * 4 }, (_, i) => (
          <rect key={i} x={-300 + (i % 14) * 180} y={300 + Math.floor(i / 14) * 90} width={176} height={86} fill={i % 2 ? "#FFFFFF" : "#D7F0E4"} />
        ))}
        {/* окно */}
        <g transform="translate(700 90)">
          <rect x={0} y={0} width={360} height={220} rx={14} fill="#9ADBFF" stroke="#7FB59A" strokeWidth="12" />
          <circle cx={280} cy={70} r={30} fill="#FFE04D" />
          <path d="M180 0 V220" stroke="#7FB59A" strokeWidth="10" />
        </g>
        {/* шкафчики сверху */}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={1180 + i * 190} y={110} width={180} height={170} rx={14} fill="#FFFFFF" stroke="#B9D9C8" strokeWidth="6" />
        ))}
        {/* холодильник */}
        <g transform={`translate(160 ${GROUND - 150})`}>
          <rect x={0} y={-560} width={260} height={560} rx={30} fill="#FFFFFF" stroke="#BFD0D8" strokeWidth="7" />
          <path d="M0 -340 H260" stroke="#BFD0D8" strokeWidth="6" />
          <rect x={220} y={-500} width={14} height={110} rx={7} fill="#BFD0D8" />
          <rect x={220} y={-300} width={14} height={110} rx={7} fill="#BFD0D8" />
          <circle cx={70} cy={-450} r={18} fill="#FF6B6B" />
          <rect x={110} y={-480} width={60} height={44} rx={6} fill="#FFD23F" transform="rotate(8 140 -458)" />
        </g>
        {/* столешница с плитой */}
        <rect x={1100} y={GROUND - 330} width={900} height={40} rx={10} fill="#F7C873" stroke={out("#F7C873")} strokeWidth="5" />
        <rect x={1120} y={GROUND - 290} width={860} height={150} fill="#FFFFFF" stroke="#B9D9C8" strokeWidth="6" />
        <g transform={`translate(1600 ${GROUND - 330})`}>
          <rect x={-60} y={-60} width={120} height={60} rx={10} fill="#E8574C" stroke={out("#E8574C")} strokeWidth="5" />
          <rect x={-80} y={-70} width={160} height={14} rx={7} fill={out("#E8574C", 0.15)} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${-30 + i * 30} -80 q-10 -20 0 -40 q10 -20 0 -40`} stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" opacity={0.6 + 0.3 * Math.sin(t * 3 + i)} transform={`translate(0 ${-(t * 20 + i * 15) % 30})`} />
          ))}
        </g>
        {/* миска с фруктами */}
        <g transform={`translate(1300 ${GROUND - 330})`}>
          <circle cx={-30} cy={-34} r={26} fill="#FF4D5A" stroke={out("#FF4D5A")} strokeWidth="4" />
          <circle cx={22} cy={-38} r={24} fill="#FFB23F" stroke={out("#FFB23F")} strokeWidth="4" />
          <path d="M-10 -60 q30 -40 60 -20 q-30 0 -60 20" fill="#FFE04D" stroke={out("#FFE04D")} strokeWidth="4" />
          <path d="M-70 -20 Q0 40 70 -20 Z" fill="#5DA9FF" stroke={out("#5DA9FF")} strokeWidth="5" />
        </g>
        <rect x={-600} y={GROUND - 146} width={3200} height={H} fill="#F3E2C3" />
        {Array.from({ length: 24 }, (_, i) => (
          <rect key={i} x={-600 + i * 160} y={GROUND - 146 + (i % 2) * 80} width={80} height={80} fill="#E8D0A5" />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.95}>
        {/* стол */}
        <g transform={`translate(1000 ${GROUND - 40})`}>
          <rect x={-280} y={-170} width={560} height={30} rx={12} fill="#C98F55" stroke={out("#C98F55")} strokeWidth="5" />
          <rect x={-250} y={-140} width={24} height={140} rx={8} fill="#B07A45" />
          <rect x={226} y={-140} width={24} height={140} rx={8} fill="#B07A45" />
          <ellipse cx={0} cy={-176} rx={60} ry={10} fill="#FFFFFF" />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ детская ночью */
function Bedroom({ cam, t }: P) {
  return (
    <g>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#3B3A7A" />
      <Layer cam={cam} depth={0.85}>
        {Array.from({ length: 30 }, (_, i) => (
          <path key={i} d={`M${-300 + (i % 10) * 280} ${80 + Math.floor(i / 10) * 200} l8 18 l20 2 l-15 13 l5 20 l-18 -10 l-18 10 l5 -20 l-15 -13 l20 -2 z`} fill="#5A58A8" />
        ))}
        {/* окно с луной */}
        <g transform="translate(1250 140)">
          <rect x={0} y={0} width={420} height={320} rx={210} fill="#1F2457" stroke="#E8D6A8" strokeWidth="14" />
          <circle cx={290} cy={110} r={48} fill="#FFF3B0" />
          <circle cx={310} cy={96} r={44} fill="#1F2457" />
          {[[80, 90], [150, 60], [120, 180], [220, 230], [330, 220]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4 + (i % 2)} fill="#FFFFFF" opacity={0.5 + 0.5 * Math.sin(t * 2 + i)} />
          ))}
          <path d="M210 0 V320" stroke="#E8D6A8" strokeWidth="10" />
        </g>
        <rect x={-600} y={GROUND - 146} width={3200} height={H} fill="#5E4B8B" />
        <ellipse cx={1000} cy={GROUND + 30} rx={520} ry={60} fill="#7E66B8" />
      </Layer>
      <Layer cam={cam} depth={0.93}>
        {/* кроватка */}
        <g transform={`translate(420 ${GROUND - 60})`}>
          <rect x={-60} y={-330} width={40} height={330} rx={14} fill="#E8B4FF" stroke={out("#E8B4FF")} strokeWidth="5" />
          <rect x={560} y={-250} width={40} height={250} rx={14} fill="#E8B4FF" stroke={out("#E8B4FF")} strokeWidth="5" />
          <rect x={-40} y={-150} width={620} height={110} rx={24} fill="#FFFFFF" stroke="#D8CBE8" strokeWidth="5" />
          <rect x={-30} y={-190} width={160} height={70} rx={30} fill="#FFFFFF" stroke="#D8CBE8" strokeWidth="5" />
          <path d="M100 -170 H570 V-60 H100 Z" fill="#7FC6FF" stroke={out("#7FC6FF")} strokeWidth="5" />
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={i} cx={150 + i * 90} cy={-115} r={14} fill="#FFFFFF" opacity={0.7} />
          ))}
        </g>
        {/* ночник */}
        <g transform={`translate(1150 ${GROUND - 60})`}>
          <rect x={-60} y={-120} width={120} height={120} rx={14} fill="#C98F55" stroke={out("#C98F55")} strokeWidth="5" />
          <circle cx={0} cy={-210} r={120} fill="#FFE9A0" opacity={0.18 + 0.03 * Math.sin(t * 2)} />
          <path d="M-50 -200 L50 -200 L30 -260 L-30 -260 Z" fill="#FFE9A0" stroke="#E5C467" strokeWidth="4" />
          <rect x={-6} y={-200} width={12} height={80} fill="#E5C467" />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ площадка */
function Playground({ cam, t }: P) {
  const swing = Math.sin(t * 2.2) * 18;
  return (
    <g>
      <Sky id="sky-play" top="#62C2FF" bottom="#D6F1FF" />
      <Layer cam={cam} depth={0.05}>
        <circle cx={300} cy={160} r={70} fill="#FFD93D" stroke="#F5B700" strokeWidth="6" />
        {[200, 900, 1500].map((cx, i) => (
          <g key={cx} transform={`translate(${((cx + t * (10 + i * 4)) % 2200) - 150} ${120 + i * 50})`} opacity={0.95}>
            <ellipse rx={90} ry={40} fill="#FFF" />
            <ellipse cx={-60} cy={10} rx={55} ry={30} fill="#FFF" />
            <ellipse cx={60} cy={8} rx={60} ry={30} fill="#FFF" />
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.3}>
        <path d={`M-400 740 Q 300 600 900 720 T 2500 700 V ${H + 300} H -400 Z`} fill="#8FD98A" />
        {[-100, 260, 1450, 1800].map((x) => (
          <g key={x} transform={`translate(${x} 720)`}>
            <rect x={-8} y={-80} width={16} height={80} fill="#8B5A2B" />
            <circle cx={0} cy={-110} r={50} fill="#5CC157" />
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.85}>
        <rect x={-600} y={GROUND - 120} width={3200} height={H} fill="#6CCB5F" />
        {/* горка */}
        <g transform={`translate(380 ${GROUND - 110})`}>
          <rect x={0} y={-330} width={20} height={330} fill="#3D8BFF" />
          <rect x={120} y={-330} width={20} height={330} fill="#3D8BFF" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={0} y={-300 + i * 60} width={140} height={12} rx={6} fill="#3D8BFF" />
          ))}
          <rect x={-10} y={-350} width={160} height={30} rx={12} fill="#FF5E5B" stroke={out("#FF5E5B")} strokeWidth="5" />
          <path d="M140 -340 Q330 -300 360 -20 L420 -20 Q390 -340 160 -380 Z" fill="#FFD23F" stroke={out("#FFD23F")} strokeWidth="6" strokeLinejoin="round" />
        </g>
        {/* качели */}
        <g transform={`translate(1300 ${GROUND - 120})`}>
          <path d="M-220 0 L-160 -380 L160 -380 L220 0" stroke="#E8574C" strokeWidth="18" fill="none" strokeLinejoin="round" />
          {[-80, 80].map((sx) => (
            <g key={sx} transform={`rotate(${sx < 0 ? swing : -swing * 0.6} ${sx} -380)`}>
              <path d={`M${sx - 34} -380 V-110 M${sx + 34} -380 V-110`} stroke="#7A6A5A" strokeWidth="5" />
              <rect x={sx - 46} y={-112} width={92} height={18} rx={8} fill="#5DA9FF" stroke={out("#5DA9FF")} strokeWidth="4" />
            </g>
          ))}
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-600} y={GROUND - 30} width={3200} height={H} fill="#5DBB52" />
        {/* песочница */}
        <g transform={`translate(900 ${GROUND + 60})`}>
          <rect x={-200} y={-40} width={400} height={90} rx={20} fill="#C98F55" stroke={out("#C98F55")} strokeWidth="6" />
          <ellipse cx={0} cy={-14} rx={180} ry={30} fill="#F5DB9A" />
          <path d="M60 -30 L90 -80 L120 -30 Z" fill="#FF5E5B" stroke={out("#FF5E5B")} strokeWidth="4" />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ пляж */
function Beach({ cam, t }: P) {
  return (
    <g>
      <Sky id="sky-beach" top="#4FB8FF" bottom="#C7EEFF" />
      <Layer cam={cam} depth={0.05}>
        <circle cx={1600} cy={170} r={80} fill="#FFDD44" stroke="#F5B700" strokeWidth="6" />
        {[0, 1].map((i) => (
          <path key={i} d="M0 0 q14 -12 28 0 q14 -12 28 0" stroke="#3A3A5A" strokeWidth="5" fill="none" strokeLinecap="round" transform={`translate(${(300 + i * 160 + t * 40) % 2100} ${200 + i * 40 + Math.sin(t * 2 + i) * 12})`} />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.3}>
        <rect x={-600} y={560} width={3200} height={260} fill="#2E9FE8" />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${-600 + i * 420 + Math.sin(t + i) * 30} ${620 + (i % 3) * 50} q30 -14 60 0 q30 -14 60 0`} stroke="#BDEBFF" strokeWidth="6" fill="none" strokeLinecap="round" />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.7}>
        <path d={`M-600 ${780 + Math.sin(t * 1.6) * 8} Q 400 ${750 + Math.sin(t * 1.6 + 1) * 10} 1000 ${780 + Math.sin(t * 1.6 + 2) * 8} T 2600 ${770 + Math.sin(t * 1.6) * 8} V 860 H -600 Z`} fill="#6CCBFF" />
        <path d={`M-600 ${800 + Math.sin(t * 1.6) * 8} Q 400 ${775 + Math.sin(t * 1.6 + 1) * 10} 1000 ${800 + Math.sin(t * 1.6 + 2) * 8} T 2600 ${795 + Math.sin(t * 1.6) * 8}`} stroke="#FFFFFF" strokeWidth="10" fill="none" opacity={0.85} />
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-600} y={820} width={3200} height={H} fill="#F7DFA5" />
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={-560 + i * 120} cy={900 + (i % 4) * 30} r={3} fill="#E3C27C" />
        ))}
        {/* зонтик */}
        <g transform={`translate(1450 ${GROUND - 10})`}>
          <rect x={-6} y={-300} width={12} height={300} fill="#FFFFFF" stroke="#CCC" strokeWidth="3" />
          <path d="M-220 -280 Q0 -420 220 -280 Z" fill="#FF5E5B" stroke={out("#FF5E5B")} strokeWidth="6" />
          <path d="M-73 -300 Q0 -420 73 -300 Z" fill="#FFFFFF" />
        </g>
        {/* ракушки и ведёрко */}
        <path d={`M500 ${GROUND + 40} q20 -40 40 0 z`} fill="#FFB3C6" stroke={out("#FFB3C6")} strokeWidth="4" />
        <path d={`M560 ${GROUND + 60} l20 -26 l20 26 z`} fill="#FFD23F" stroke={out("#FFD23F")} strokeWidth="4" strokeLinejoin="round" />
        <g transform={`translate(750 ${GROUND + 40})`}>
          <path d="M-40 -60 L40 -60 L30 0 L-30 0 Z" fill="#3D8BFF" stroke={out("#3D8BFF")} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-40 -60 Q0 -110 40 -60" stroke="#333" strokeWidth="4" fill="none" />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ лес */
function Forest({ cam, t }: P) {
  const tree = (x: number, y: number, s: number, c: string, k: number) => (
    <g key={`${x}-${k}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-22} y={-260} width={44} height={260} rx={10} fill="#7A4E2A" stroke={out("#7A4E2A")} strokeWidth="5" />
      <g transform={`rotate(${Math.sin(t * 1.1 + x) * 1.2} 0 -260)`}>
        <path d="M-150 -220 L0 -470 L150 -220 Z" fill={c} stroke={out(c)} strokeWidth="6" strokeLinejoin="round" />
        <path d="M-130 -320 L0 -540 L130 -320 Z" fill={shade(c, -0.1)} stroke={out(c)} strokeWidth="6" strokeLinejoin="round" />
        <path d="M-100 -420 L0 -600 L100 -420 Z" fill={shade(c, -0.2)} stroke={out(c)} strokeWidth="6" strokeLinejoin="round" />
      </g>
    </g>
  );
  return (
    <g>
      <Sky id="sky-forest" top="#8ED6C5" bottom="#E6F7E1" />
      <Layer cam={cam} depth={0.2}>{[-200, 150, 520, 880, 1240, 1600, 1960].map((x, i) => tree(x, 760, 0.55, "#7CC28A", i))}</Layer>
      <Layer cam={cam} depth={0.5}>{[-50, 420, 1100, 1700, 2100].map((x, i) => tree(x, 830, 0.8, "#4FAE63", i))}</Layer>
      <Layer cam={cam} depth={0.8}>
        <rect x={-600} y={GROUND - 120} width={3200} height={H} fill="#79C46B" />
        {/* ручеёк */}
        <path d={`M-600 ${GROUND - 60} Q 300 ${GROUND - 100} 900 ${GROUND - 70} T 2600 ${GROUND - 80} V ${GROUND - 30} Q 1500 ${GROUND - 40} 900 ${GROUND - 25} T -600 ${GROUND - 20} Z`} fill="#6CCBFF" />
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M${((i * 400 + t * 60) % 3000) - 600} ${GROUND - 55 + (i % 2) * 12} h40`} stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity={0.8} />
        ))}
      </Layer>
      {/* лучи солнца сквозь деревья */}
      <g opacity={0.18 + 0.05 * Math.sin(t)}>
        <path d="M900 -50 L760 1100 L960 1100 Z" fill="#FFFBE0" />
        <path d="M1300 -50 L1250 1100 L1420 1100 Z" fill="#FFFBE0" />
      </g>
      <Layer cam={cam} depth={1}>
        <rect x={-600} y={GROUND - 20} width={3200} height={H} fill="#68B85A" />
        {[[300, "#FF4D5A"], [1600, "#FFB23F"], [1750, "#FF4D5A"]].map(([x, c]) => (
          <g key={String(x)} transform={`translate(${x} ${GROUND + 30})`}>
            <rect x={-12} y={-50} width={24} height={50} rx={10} fill="#FFF3DD" stroke="#D8C6A5" strokeWidth="4" />
            <path d="M-50 -46 Q0 -110 50 -46 Z" fill={String(c)} stroke={out(String(c))} strokeWidth="5" />
            <circle cx={-16} cy={-70} r={7} fill="#FFF" />
            <circle cx={14} cy={-62} r={6} fill="#FFF" />
          </g>
        ))}
      </Layer>
    </g>
  );
}

export interface LocationDef {
  label: string;
  Back: (p: P) => ReactNode;
  Front?: (p: P) => ReactNode;
}

export const LOCATIONS: Record<string, LocationDef> = {
  garden: { label: "Сад у дома", Back: ({ cam, t }) => <GardenScene cam={cam} t={t} />, Front: ({ cam, t }) => (<><GardenLife cam={cam} t={t} /><GardenForeground cam={cam} t={t} /></>) },
  garden_evening: { label: "Сад вечером", Back: ({ cam, t }) => <GardenScene cam={cam} t={t} time="evening" />, Front: ({ cam, t }) => <GardenForeground cam={cam} t={t} /> },
  living_room: { label: "Гостиная", Back: (p) => <LivingRoom {...p} /> },
  kitchen: { label: "Кухня", Back: (p) => <Kitchen {...p} /> },
  bedroom: { label: "Детская ночью", Back: (p) => <Bedroom {...p} /> },
  playground: { label: "Детская площадка", Back: (p) => <Playground {...p} /> },
  beach: { label: "Пляж", Back: (p) => <Beach {...p} /> },
  forest: { label: "Лес", Back: (p) => <Forest {...p} /> },
};

export const LOCATION_IDS = Object.keys(LOCATIONS);
export { GROUND };
