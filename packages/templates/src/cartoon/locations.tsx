/**
 * Локации мультика. Мир 1920×1080, пол/земля — GROUND (ступни персонажей). Слои с параллаксом через <Layer depth>.
 * Новая локация = Back (за героями) и, по желанию, Front (передний план поверх героев); цвета — токены палитры (palette.ts).
 */
import type { ReactNode } from "react";
import { DEFAULT_WORLD, jitter, pick, resolvePalette, skyState, TOY_COLORS, type WorldState } from "./palette";
import { FallenLeaves, Puddles, SnowDrifts, SnowStrip, Stars, SunMoon, WeatherClouds, WindowWeather } from "./world";
import { shade } from "./rig";
import { GardenForeground, GardenLife, GardenScene, GROUND, Layer, Sky, type LocProps } from "./scenes";

const W = 1920;
const H = 1080;
type P = LocProps;

const out = (c: string, k = 0.32) => shade(c, k);

/** Небесное тело в окне: солнце днём, луна ночью (при тучах — ничего). */
function WindowSky({ x, y, r, world, sun, t }: { x: number; y: number; r: number; world: WorldState; sun: string; t: number }) {
  const sky = skyState(world);
  if (sky.sun) return <circle cx={x} cy={y + (world.time === "morning" || world.time === "evening" ? r : 0)} r={r} fill={sun} />;
  if (sky.moon)
    return (
      <g>
        <circle cx={x} cy={y} r={r * 1.7} fill="#FFF6C8" opacity={0.1 + 0.02 * Math.sin(t)} />
        <circle cx={x} cy={y} r={r} fill="#FFF3B0" />
        <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.18} fill="#EDE09A" />
      </g>
    );
  return null;
}

/** Звёздочки в окне ночью. */
function WindowStars({ pts, world, t }: { pts: [number, number][]; world: WorldState; t: number }) {
  if (!skyState(world).stars) return null;
  return (
    <g>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3 + (i % 2)} fill="#FFFFFF" opacity={0.5 + 0.5 * Math.sin(t * 2 + i)} />
      ))}
    </g>
  );
}

/** Тёплое пятно света от лампы (вечером и ночью). */
function LampGlow({ x, y, r, world, t }: { x: number; y: number; r: number; world: WorldState; t: number }) {
  if (world.time !== "night" && world.time !== "evening") return null;
  const k = world.time === "night" ? 1.4 : 0.6;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#FFE29A" opacity={(0.12 + 0.02 * Math.sin(t * 2)) * k} />
      <circle cx={x} cy={y} r={r * 0.6} fill="#FFE29A" opacity={0.14 * k} />
      <circle cx={x} cy={y} r={r * 0.3} fill="#FFF1C4" opacity={0.18 * k} />
    </g>
  );
}

/** Светлячки летней ночью (сад, лес, площадка). */
export function Fireflies({ world, t, seed, n = 14, top = 380, bottom = 880 }: { world: WorldState; t: number; seed: number; n?: number; top?: number; bottom?: number }) {
  if (world.time !== "night" || world.season === "winter" || world.weather === "rain" || world.weather === "snow") return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const bx = ((seed * 37 + i * 211) % 1900) + 10;
        const by = top + ((seed * 13 + i * 97) % Math.max(1, bottom - top));
        const x = bx + Math.sin(t * 0.7 + i * 1.7) * 60;
        const y = by + Math.sin(t * 1.1 + i) * 30;
        const on = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 + i * 2.3));
        return (
          <g key={i} opacity={on}>
            <circle cx={x} cy={y} r={16} fill="#F5FF9A" opacity={0.25} />
            <circle cx={x} cy={y} r={5} fill="#FBFFD0" />
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ гостиная */
function LivingRoom({ cam, t, pal, seed, uid, world }: P) {
  const toys = [pick(seed, "t1", TOY_COLORS, pal.toy1!), pick(seed, "t2", TOY_COLORS, pal.toy2!), pick(seed, "t3", TOY_COLORS, pal.toy3!), pick(seed, "t4", TOY_COLORS, pal.toy4!)];
  const art = pick(seed, "art", ["hills", "sun", "boat"] as const, "hills");
  const cushion = pick(seed, "cushion", TOY_COLORS, pal.cushion!);
  const rug = pick(seed, "rug", ["#FF9FB2", "#9FD3FF", "#B9E59A", "#FFD27A", "#D2B4FF"], pal.rug!);
  return (
    <g>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill={pal.wall} />
      <Layer cam={cam} depth={0.85}>
        {/* обои — горошек */}
        {Array.from({ length: 12 * 7 }, (_, i) => (
          <circle key={i} cx={-300 + (i % 12) * 220 + (Math.floor(i / 12) % 2) * 110} cy={60 + Math.floor(i / 12) * 110} r={9} fill={pal.wallDot} />
        ))}
        {/* окно с садом */}
        <g transform="translate(1320 180)">
          <rect x={0} y={0} width={420} height={330} rx={16} fill={pal.skyWindow} stroke={pal.wood} strokeWidth="14" />
          <WindowStars pts={[[60, 50], [150, 120], [260, 40], [380, 140], [90, 160]]} world={world} t={t} />
          <WindowSky x={330} y={80} r={36} world={world} sun={pal.skyWindowSun!} t={t} />
          <path d={`M14 230 Q120 170 230 220 T 406 210 V316 H14 Z`} fill={pal.windowHill} />
          {world.season === "winter" ? <path d={`M14 236 Q120 176 230 226 T 406 216 V246 Q230 236 120 210 T 14 252 Z`} fill="#FFFFFF" /> : null}
          {skyState(world).clouds > 1 || world.time !== "night" ? <ellipse cx={130} cy={90} rx={60} ry={24} fill={pal.skyWindowCloud} transform={`translate(${Math.sin(t * 0.2) * 30} 0)`} /> : null}
          <WindowWeather x={0} y={0} w={420} h={330} rx={16} world={world} t={t} uid={uid} />
          <path d="M210 0 V330 M0 165 H420" stroke={pal.wood} strokeWidth="12" />
          <path d="M-30 -20 Q60 160 30 360 L-60 360 L-60 -20 Z" fill={pal.curtain} stroke={out(pal.curtain!)} strokeWidth="5" />
          <path d="M450 -20 Q360 160 390 360 L480 360 L480 -20 Z" fill={pal.curtain} stroke={out(pal.curtain!)} strokeWidth="5" />
        </g>
        {/* картина — сюжет по сиду */}
        <g transform="translate(380 190)">
          <rect x={0} y={0} width={220} height={160} rx={8} fill={pal.canvas} stroke={pal.frame} strokeWidth="12" />
          {art === "hills" ? (
            <>
              <path d="M20 140 L80 70 L120 110 L160 60 L200 140 Z" fill={pal.art1} />
              <circle cx={170} cy={45} r={16} fill={pal.art2} />
            </>
          ) : art === "sun" ? (
            <>
              <circle cx={110} cy={80} r={34} fill={pal.art2} />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <path key={a} d="M110 30 V14" stroke={pal.art2} strokeWidth="8" strokeLinecap="round" transform={`rotate(${a} 110 80)`} />
              ))}
            </>
          ) : (
            <>
              <path d="M14 120 Q110 100 206 120 V146 H14 Z" fill={toys[0]} />
              <path d="M60 110 H160 L145 130 H75 Z" fill={pal.art2} />
              <path d="M110 108 V44 L150 98 Z" fill={pal.art1} />
            </>
          )}
        </g>
        {/* полка с игрушками */}
        <g transform="translate(760 300)">
          <rect x={0} y={0} width={300} height={18} rx={6} fill={pal.wood} stroke={out(pal.wood!)} strokeWidth="4" />
          <rect x={20} y={-60} width={46} height={60} rx={6} fill={toys[0]} stroke={out(toys[0]!)} strokeWidth="4" />
          <rect x={72} y={-48} width={40} height={48} rx={6} fill={toys[1]} stroke={out(toys[1]!)} strokeWidth="4" />
          <circle cx={170} cy={-30} r={30} fill={toys[2]} stroke={out(toys[2]!)} strokeWidth="4" />
          <path d="M230 0 L250 -70 L270 0 Z" fill={toys[3]} stroke={out(toys[3]!)} strokeWidth="4" strokeLinejoin="round" />
        </g>
        {/* плинтус и пол */}
        <rect x={-600} y={GROUND - 170} width={3200} height={24} fill={pal.skirting} />
        <rect x={-600} y={GROUND - 146} width={3200} height={H} fill={pal.floor} />
        {Array.from({ length: 20 }, (_, i) => (
          <path key={i} d={`M${-600 + i * 180} ${GROUND - 146} V${H + 200}`} stroke={pal.wood} strokeWidth="4" />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.92}>
        {/* диван */}
        <g transform={`translate(420 ${GROUND - 110})`}>
          <rect x={-40} y={-210} width={560} height={150} rx={50} fill={pal.sofa} stroke={out(pal.sofa!)} strokeWidth="6" />
          <rect x={-80} y={-110} width={640} height={110} rx={40} fill={pal.sofaSeat} stroke={out(pal.sofaSeat!)} strokeWidth="6" />
          <rect x={-100} y={-170} width={90} height={170} rx={40} fill={pal.sofa} stroke={out(pal.sofa!)} strokeWidth="6" />
          <rect x={510} y={-170} width={90} height={170} rx={40} fill={pal.sofa} stroke={out(pal.sofa!)} strokeWidth="6" />
          <rect x={40} y={-180} width={110} height={80} rx={20} fill={cushion} stroke={out(cushion)} strokeWidth="5" transform="rotate(-8 95 -140)" />
        </g>
        {/* торшер */}
        <g transform={`translate(1150 ${GROUND - 120})`}>
          <LampGlow x={0} y={-330} r={260} world={world} t={t} />
          <rect x={-6} y={-320} width={12} height={320} rx={6} fill={pal.wood} />
          <ellipse cx={0} cy={0} rx={50} ry={12} fill={out(pal.wood!, 0.15)} />
          <path d="M-70 -300 L70 -300 L45 -390 L-45 -390 Z" fill={world.time === "night" || world.time === "evening" ? "#FFE9A0" : pal.cushion} stroke={out(pal.cushion!)} strokeWidth="5" strokeLinejoin="round" />
        </g>
        {/* ковёр */}
        <ellipse cx={1100} cy={GROUND + 40} rx={560} ry={70} fill={rug} stroke={out(rug)} strokeWidth="6" />
        <ellipse cx={1100} cy={GROUND + 40} rx={430} ry={50} fill="none" stroke={pal.rugStitch} strokeWidth="6" strokeDasharray="4 18" strokeLinecap="round" />
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ кухня */
function Kitchen({ cam, t, pal, seed, uid, world }: P) {
  const m1 = pick(seed, "m1", TOY_COLORS, pal.magnet1!);
  const m2 = pick(seed, "m2", TOY_COLORS, pal.magnet2!);
  const bowl = pick(seed, "bowl", TOY_COLORS, pal.bowl!);
  return (
    <g>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill={pal.wall} />
      <Layer cam={cam} depth={0.85}>
        {/* плитка */}
        {Array.from({ length: 14 * 4 }, (_, i) => (
          <rect key={i} x={-300 + (i % 14) * 180} y={300 + Math.floor(i / 14) * 90} width={176} height={86} fill={i % 2 ? pal.tile1 : pal.tile2} />
        ))}
        {/* окно */}
        <g transform="translate(700 90)">
          <rect x={0} y={0} width={360} height={220} rx={14} fill={pal.skyWindow} stroke={pal.windowFrame} strokeWidth="12" />
          <WindowStars pts={[[50, 40], [120, 110], [230, 50], [320, 150]]} world={world} t={t} />
          <WindowSky x={280} y={70} r={30} world={world} sun={pal.skyWindowSun!} t={t} />
          {world.season === "winter" ? <rect x={6} y={200} width={348} height={14} rx={6} fill="#FFFFFF" /> : null}
          <WindowWeather x={0} y={0} w={360} h={220} rx={14} world={world} t={t} uid={uid} />
          <path d="M180 0 V220" stroke={pal.windowFrame} strokeWidth="10" />
        </g>
        {/* шкафчики сверху */}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={1180 + i * 190} y={110} width={180} height={170} rx={14} fill={pal.cupboard} stroke={pal.cupboardLine} strokeWidth="6" />
        ))}
        {/* холодильник */}
        <g transform={`translate(160 ${GROUND - 150})`}>
          <rect x={0} y={-560} width={260} height={560} rx={30} fill={pal.fridge} stroke={pal.fridgeLine} strokeWidth="7" />
          <path d="M0 -340 H260" stroke={pal.fridgeLine} strokeWidth="6" />
          <rect x={220} y={-500} width={14} height={110} rx={7} fill={pal.fridgeLine} />
          <rect x={220} y={-300} width={14} height={110} rx={7} fill={pal.fridgeLine} />
          <circle cx={70} cy={-450} r={18} fill={m1} />
          <rect x={110} y={-480} width={60} height={44} rx={6} fill={m2} transform="rotate(8 140 -458)" />
        </g>
        {/* столешница с плитой */}
        <rect x={1100} y={GROUND - 330} width={900} height={40} rx={10} fill={pal.counter} stroke={out(pal.counter!)} strokeWidth="5" />
        <rect x={1120} y={GROUND - 290} width={860} height={150} fill={pal.cupboard} stroke={pal.cupboardLine} strokeWidth="6" />
        <g transform={`translate(1600 ${GROUND - 330})`}>
          <rect x={-60} y={-60} width={120} height={60} rx={10} fill={pal.pot} stroke={out(pal.pot!)} strokeWidth="5" />
          <rect x={-80} y={-70} width={160} height={14} rx={7} fill={out(pal.pot!, 0.15)} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${-30 + i * 30} -80 q-10 -20 0 -40 q10 -20 0 -40`} stroke={pal.steam} strokeWidth="6" fill="none" strokeLinecap="round" opacity={0.6 + 0.3 * Math.sin(t * 3 + i)} transform={`translate(0 ${-(t * 20 + i * 15) % 30})`} />
          ))}
        </g>
        {/* миска с фруктами */}
        <g transform={`translate(1300 ${GROUND - 330})`}>
          <circle cx={-30} cy={-34} r={26} fill={pal.fruit1} stroke={out(pal.fruit1!)} strokeWidth="4" />
          <circle cx={22} cy={-38} r={24} fill={pal.fruit2} stroke={out(pal.fruit2!)} strokeWidth="4" />
          <path d="M-10 -60 q30 -40 60 -20 q-30 0 -60 20" fill={pal.fruit3} stroke={out(pal.fruit3!)} strokeWidth="4" />
          <path d="M-70 -20 Q0 40 70 -20 Z" fill={bowl} stroke={out(bowl)} strokeWidth="5" />
        </g>
        <rect x={-600} y={GROUND - 146} width={3200} height={H} fill={pal.floor} />
        {Array.from({ length: 24 }, (_, i) => (
          <rect key={i} x={-600 + i * 160} y={GROUND - 146 + (i % 2) * 80} width={80} height={80} fill={pal.floorTile} />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.9}>
        {/* лампа над столом */}
        <g transform="translate(1000 0)">
          <path d="M0 -40 V250" stroke={out(pal.counter!, 0.5)} strokeWidth="5" />
          <LampGlow x={0} y={300} r={300} world={world} t={t} />
          <path d="M-90 300 Q0 200 90 300 Z" fill={pal.pot} stroke={out(pal.pot!)} strokeWidth="5" />
          <ellipse cx={0} cy={300} rx={34} ry={10} fill={world.time === "night" || world.time === "evening" ? "#FFF1C4" : "#FFFFFF"} />
        </g>
      </Layer>
      <Layer cam={cam} depth={0.95}>
        {/* стол */}
        <g transform={`translate(1000 ${GROUND - 40})`}>
          <rect x={-280} y={-170} width={560} height={30} rx={12} fill={pal.table} stroke={out(pal.table!)} strokeWidth="5" />
          <rect x={-250} y={-140} width={24} height={140} rx={8} fill={pal.tableLeg} />
          <rect x={226} y={-140} width={24} height={140} rx={8} fill={pal.tableLeg} />
          <ellipse cx={0} cy={-176} rx={60} ry={10} fill={pal.plate} />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ детская ночью */
function Bedroom({ cam, t, pal, seed, uid, world }: P) {
  const night = world.time === "night";
  const blanket = pick(seed, "blanket", ["#7FC6FF", "#FF9FB2", "#B9E59A", "#FFD27A", "#C9A8FF"], pal.blanket!);
  return (
    <g>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill={pal.wall} />
      <Layer cam={cam} depth={0.85}>
        {Array.from({ length: 30 }, (_, i) => (
          <path key={i} d={`M${-300 + (i % 10) * 280} ${80 + Math.floor(i / 10) * 200} l8 18 l20 2 l-15 13 l5 20 l-18 -10 l-18 10 l5 -20 l-15 -13 l20 -2 z`} fill={pal.wallStar} />
        ))}
        {/* окно с луной */}
        <g transform="translate(1250 140)">
          <rect x={0} y={0} width={420} height={320} rx={210} fill={pal.skyWindow} stroke={pal.windowFrame} strokeWidth="14" />
          {night && skyState(world).moon ? (
            <>
              <circle cx={290} cy={110} r={48} fill={pal.skyMoon} />
              <circle cx={310} cy={96} r={44} fill={pal.skyWindow} />
            </>
          ) : !night ? (
            <>
              <WindowSky x={300} y={100} r={40} world={world} sun={pal.skyWindowSun!} t={t} />
              <ellipse cx={130} cy={110} rx={70} ry={26} fill={pal.skyWindowCloud} transform={`translate(${Math.sin(t * 0.2) * 24} 0)`} />
            </>
          ) : null}
          {skyState(world).stars
            ? [[80, 90], [150, 60], [120, 180], [220, 230], [330, 220]].map(([x, y], i) => (
                <circle key={i} cx={x! + jitter(seed, `s${i}x`, 20)} cy={y! + jitter(seed, `s${i}y`, 20)} r={4 + (i % 2)} fill={pal.skyStar} opacity={0.5 + 0.5 * Math.sin(t * 2 + i)} />
              ))
            : null}
          <WindowWeather x={0} y={0} w={420} h={320} rx={160} world={world} t={t} uid={uid} />
          <path d="M210 0 V320" stroke={pal.windowFrame} strokeWidth="10" />
        </g>
        <rect x={-600} y={GROUND - 146} width={3200} height={H} fill={pal.floor} />
        <ellipse cx={1000} cy={GROUND + 30} rx={520} ry={60} fill={pal.rug} />
      </Layer>
      <Layer cam={cam} depth={0.93}>
        {/* кроватка */}
        <g transform={`translate(420 ${GROUND - 60})`}>
          <rect x={-60} y={-330} width={40} height={330} rx={14} fill={pal.bed} stroke={out(pal.bed!)} strokeWidth="5" />
          <rect x={560} y={-250} width={40} height={250} rx={14} fill={pal.bed} stroke={out(pal.bed!)} strokeWidth="5" />
          <rect x={-40} y={-150} width={620} height={110} rx={24} fill={pal.sheet} stroke={pal.sheetLine} strokeWidth="5" />
          <rect x={-30} y={-190} width={160} height={70} rx={30} fill={pal.sheet} stroke={pal.sheetLine} strokeWidth="5" />
          <path d="M100 -170 H570 V-60 H100 Z" fill={blanket} stroke={out(blanket)} strokeWidth="5" />
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={i} cx={150 + i * 90} cy={-115} r={14} fill={pal.blanketDot} opacity={0.7} />
          ))}
        </g>
        {/* ночник */}
        <g transform={`translate(1150 ${GROUND - 60})`}>
          <rect x={-60} y={-120} width={120} height={120} rx={14} fill={pal.wood} stroke={out(pal.wood!)} strokeWidth="5" />
          {night || world.time === "evening" ? <circle cx={0} cy={-210} r={120} fill={pal.lamp} opacity={0.18 + 0.03 * Math.sin(t * 2)} /> : null}
          <LampGlow x={0} y={-220} r={300} world={world} t={t} />
          <path d="M-50 -200 L50 -200 L30 -260 L-30 -260 Z" fill={pal.lamp} stroke={pal.lampLine} strokeWidth="4" />
          <rect x={-6} y={-200} width={12} height={80} fill={pal.lampLine} />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ площадка */
function Playground({ cam, t, pal, seed, uid, world }: P) {
  const sky = skyState(world);
  const winter = world.season === "winter";
  const swing = Math.sin(t * 2.2) * 18 * (sky.wind > 1 ? 1.6 : 1);
  const toy = pick(seed, "toy", TOY_COLORS, pal.toy!);
  return (
    <g>
      <Sky id={`${uid}-sky`} top={pal.sky1!} bottom={pal.sky2!} />
      <Layer cam={cam} depth={0.05}>
        <Stars world={world} t={t} seed={seed + 1} />
        <SunMoon x={300} y={160} r={70} world={world} pal={pal} t={t} />
        <WeatherClouds world={world} t={t} pal={pal} seed={seed + 2} />
        {[200, 900, 1500].map((cx, i) => (
          <g key={cx} transform={`translate(${(((cx + jitter(seed, `c${i}`, 300) + t * (10 + i * 4)) % 2200) + 2200) % 2200 - 150} ${120 + i * 50})`} opacity={0.95}>
            <ellipse rx={90} ry={40} fill={pal.skyCloud} />
            <ellipse cx={-60} cy={10} rx={55} ry={30} fill={pal.skyCloud} />
            <ellipse cx={60} cy={8} rx={60} ry={30} fill={pal.skyCloud} />
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.3}>
        <path d={`M-400 740 Q 300 600 900 720 T 2500 700 V ${H + 300} H -400 Z`} fill={pal.hillFar} />
        {[-100, 260, 1450, 1800].map((x) => (
          <g key={x} transform={`translate(${x} 720)`}>
            <rect x={-8} y={-80} width={16} height={80} fill={pal.trunk} />
            <circle cx={0} cy={-110} r={50} fill={pal.leafFar} transform={`rotate(${Math.sin(t * 1.3 + x) * 1.5 * sky.wind} 0 -80)`} />
            {winter ? <ellipse cx={0} cy={-150} rx={36} ry={12} fill="#FFFFFF" /> : null}
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.85}>
        <rect x={-600} y={GROUND - 120} width={3200} height={H} fill={pal.grassMid} />
        {/* горка */}
        <g transform={`translate(380 ${GROUND - 110})`}>
          <rect x={0} y={-330} width={20} height={330} fill={pal.frame} />
          <rect x={120} y={-330} width={20} height={330} fill={pal.frame} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={0} y={-300 + i * 60} width={140} height={12} rx={6} fill={pal.frame} />
          ))}
          <rect x={-10} y={-350} width={160} height={30} rx={12} fill={pal.deck} stroke={out(pal.deck!)} strokeWidth="5" />
          {winter ? <SnowStrip x={-12} y={-364} w={164} h={14} /> : null}
          <path d="M140 -340 Q330 -300 360 -20 L420 -20 Q390 -340 160 -380 Z" fill={pal.slide} stroke={out(pal.slide!)} strokeWidth="6" strokeLinejoin="round" />
        </g>
        {/* качели */}
        <g transform={`translate(1300 ${GROUND - 120})`}>
          <path d="M-220 0 L-160 -380 L160 -380 L220 0" stroke={pal.swingFrame} strokeWidth="18" fill="none" strokeLinejoin="round" />
          {winter ? <SnowStrip x={-170} y={-400} w={340} h={12} /> : null}
          {[-80, 80].map((sx) => (
            <g key={sx} transform={`rotate(${sx < 0 ? swing : -swing * 0.6} ${sx} -380)`}>
              <path d={`M${sx - 34} -380 V-110 M${sx + 34} -380 V-110`} stroke={pal.rope} strokeWidth="5" />
              <rect x={sx - 46} y={-112} width={92} height={18} rx={8} fill={pal.seat} stroke={out(pal.seat!)} strokeWidth="4" />
            </g>
          ))}
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-600} y={GROUND - 30} width={3200} height={H} fill={pal.grass} />
        {/* песочница */}
        <g transform={`translate(900 ${GROUND + 60})`}>
          <rect x={-200} y={-40} width={400} height={90} rx={20} fill={pal.wood} stroke={out(pal.wood!)} strokeWidth="6" />
          <ellipse cx={0} cy={-14} rx={180} ry={30} fill={winter ? "#FFFFFF" : pal.sand} />
          <path d="M60 -30 L90 -80 L120 -30 Z" fill={toy} stroke={out(toy)} strokeWidth="4" />
        </g>
        {winter ? <SnowDrifts y={GROUND + 130} seed={seed + 3} /> : null}
        {world.season === "autumn" ? <FallenLeaves y={GROUND + 10} seed={seed + 4} /> : null}
        {world.weather === "rain" ? <Puddles xs={[-200, 400, 1500, 2150]} y={GROUND + 110} t={t} /> : null}
        <Fireflies world={world} t={t} seed={seed} />
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ пляж */
function Beach({ cam, t, pal, seed, uid, world }: P) {
  const sky = skyState(world);
  const wave = sky.wind > 1 ? 1.8 : 1;
  const umbrella = pick(seed, "umbrella", ["#FF5E5B", "#3D8BFF", "#4CB944", "#FF8A2A", "#8E5CFF"], pal.umbrella!);
  const bucket = pick(seed, "bucket", TOY_COLORS, pal.bucket!);
  return (
    <g>
      <Sky id={`${uid}-sky`} top={pal.sky1!} bottom={pal.sky2!} />
      <Layer cam={cam} depth={0.05}>
        <Stars world={world} t={t} seed={seed + 1} />
        <SunMoon x={1600} y={170} r={80} world={world} pal={pal} t={t} />
        <WeatherClouds world={world} t={t} pal={pal} seed={seed + 2} />
        {[0, 1].map((i) => (
          <path key={i} d="M0 0 q14 -12 28 0 q14 -12 28 0" stroke={pal.skyBird} strokeWidth="5" fill="none" strokeLinecap="round" transform={`translate(${(300 + i * 160 + t * 40) % 2100} ${200 + i * 40 + Math.sin(t * 2 + i) * 12})`} />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.3}>
        <rect x={-600} y={560} width={3200} height={260} fill={pal.sea} />
        {/* дорожка света от солнца/луны на воде */}
        {sky.sun || sky.moon
          ? Array.from({ length: 6 }, (_, i) => (
              <rect key={i} x={1600 - 60 - i * 10 + Math.sin(t * 2 + i) * 14} y={580 + i * 34} width={120 + i * 20} height={8} rx={4} fill={sky.moon ? "#FFF3B0" : "#FFFFFF"} opacity={0.35 - i * 0.04} />
            ))
          : null}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${-600 + i * 420 + Math.sin(t * wave + i) * 30 * wave} ${620 + (i % 3) * 50} q30 ${-14 * wave} 60 0 q30 ${-14 * wave} 60 0`} stroke={pal.seaFoam} strokeWidth="6" fill="none" strokeLinecap="round" />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.7}>
        <path d={`M-600 ${780 + Math.sin(t * 1.6) * 8} Q 400 ${750 + Math.sin(t * 1.6 + 1) * 10} 1000 ${780 + Math.sin(t * 1.6 + 2) * 8} T 2600 ${770 + Math.sin(t * 1.6) * 8} V 860 H -600 Z`} fill={pal.surf} />
        <path d={`M-600 ${800 + Math.sin(t * 1.6) * 8} Q 400 ${775 + Math.sin(t * 1.6 + 1) * 10} 1000 ${800 + Math.sin(t * 1.6 + 2) * 8} T 2600 ${795 + Math.sin(t * 1.6) * 8}`} stroke={pal.surfLine} strokeWidth="10" fill="none" opacity={0.85} />
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-600} y={820} width={3200} height={H} fill={pal.sand} />
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={-560 + i * 120} cy={900 + (i % 4) * 30} r={3} fill={pal.sandDot} />
        ))}
        {/* зонтик */}
        <g transform={`translate(1450 ${GROUND - 10})`}>
          <rect x={-6} y={-300} width={12} height={300} fill={pal.pole} stroke={pal.poleLine} strokeWidth="3" />
          <path d="M-220 -280 Q0 -420 220 -280 Z" fill={umbrella} stroke={out(umbrella)} strokeWidth="6" />
          <path d="M-73 -300 Q0 -420 73 -300 Z" fill={pal.umbrellaStripe} />
        </g>
        {/* ракушки и ведёрко */}
        <path d={`M500 ${GROUND + 40} q20 -40 40 0 z`} fill={pal.shell1} stroke={out(pal.shell1!)} strokeWidth="4" />
        <path d={`M560 ${GROUND + 60} l20 -26 l20 26 z`} fill={pal.shell2} stroke={out(pal.shell2!)} strokeWidth="4" strokeLinejoin="round" />
        <g transform={`translate(750 ${GROUND + 40})`}>
          <path d="M-40 -60 L40 -60 L30 0 L-30 0 Z" fill={bucket} stroke={out(bucket)} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-40 -60 Q0 -110 40 -60" stroke={pal.handle} strokeWidth="4" fill="none" />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ лес */
function Forest({ cam, t, pal, seed, uid, world }: P) {
  const sky = skyState(world);
  const winter = world.season === "winter";
  const tree = (x: number, y: number, s: number, c: string, k: number) => (
    <g key={`${x}-${k}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-22} y={-260} width={44} height={260} rx={10} fill={pal.trunk} stroke={out(pal.trunk!)} strokeWidth="5" />
      <g transform={`rotate(${Math.sin(t * 1.1 * (sky.wind > 1 ? 1.7 : 1) + x) * 1.2 * sky.wind} 0 -260)`}>
        <path d="M-150 -220 L0 -470 L150 -220 Z" fill={c} stroke={out(c)} strokeWidth="6" strokeLinejoin="round" />
        <path d="M-130 -320 L0 -540 L130 -320 Z" fill={shade(c, -0.1)} stroke={out(c)} strokeWidth="6" strokeLinejoin="round" />
        <path d="M-100 -420 L0 -600 L100 -420 Z" fill={shade(c, -0.2)} stroke={out(c)} strokeWidth="6" strokeLinejoin="round" />
        {winter ? (
          <g fill="#FFFFFF">
            <path d="M-56 -508 L0 -600 L56 -508 Q28 -520 0 -500 Q-28 -520 -56 -508 Z" />
            <path d="M-80 -410 L-40 -466 Q0 -440 40 -466 L80 -410 Q40 -428 0 -414 Q-40 -428 -80 -410 Z" />
            <path d="M-110 -306 L-60 -360 Q0 -336 60 -360 L110 -306 Q56 -324 0 -310 Q-56 -324 -110 -306 Z" />
          </g>
        ) : null}
      </g>
    </g>
  );
  const mush: [number, string][] = [
    [300 + jitter(seed, "m1", 120), pick(seed, "mc1", [pal.cap1!, pal.cap2!], pal.cap1!)],
    [1600 + jitter(seed, "m2", 120), pick(seed, "mc2", [pal.cap1!, pal.cap2!], pal.cap2!)],
    [1750 + jitter(seed, "m3", 120), pick(seed, "mc3", [pal.cap1!, pal.cap2!], pal.cap1!)],
  ];
  return (
    <g>
      <Sky id={`${uid}-sky`} top={pal.sky1!} bottom={pal.sky2!} />
      <Layer cam={cam} depth={0.05}>
        <Stars world={world} t={t} seed={seed + 1} bottom={360} />
        <SunMoon x={1500} y={130} r={60} world={world} pal={pal} t={t} />
        <WeatherClouds world={world} t={t} pal={pal} seed={seed + 2} />
      </Layer>
      <Layer cam={cam} depth={0.2}>{[-200, 150, 520, 880, 1240, 1600, 1960].map((x, i) => tree(x, 760, 0.55, pal.pineFar!, i))}</Layer>
      <Layer cam={cam} depth={0.5}>{[-50, 420, 1100, 1700, 2100].map((x, i) => tree(x, 830, 0.8, pal.pine!, i))}</Layer>
      <Layer cam={cam} depth={0.8}>
        <rect x={-600} y={GROUND - 120} width={3200} height={H} fill={pal.grassMid} />
        {/* ручеёк */}
        <path d={`M-600 ${GROUND - 60} Q 300 ${GROUND - 100} 900 ${GROUND - 70} T 2600 ${GROUND - 80} V ${GROUND - 30} Q 1500 ${GROUND - 40} 900 ${GROUND - 25} T -600 ${GROUND - 20} Z`} fill={pal.water} />
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M${((i * 400 + t * 60) % 3000) - 600} ${GROUND - 55 + (i % 2) * 12} h40`} stroke={pal.waterFoam} strokeWidth="5" strokeLinecap="round" opacity={0.8} />
        ))}
      </Layer>
      {/* лучи солнца сквозь деревья */}
      <g opacity={sky.sun ? 0.18 + 0.05 * Math.sin(t) : 0}>
        <path d="M900 -50 L760 1100 L960 1100 Z" fill={pal.skyRay} />
        <path d="M1300 -50 L1250 1100 L1420 1100 Z" fill={pal.skyRay} />
      </g>
      <Layer cam={cam} depth={1}>
        <rect x={-600} y={GROUND - 20} width={3200} height={H} fill={pal.grass} />
        {winter ? <SnowDrifts y={GROUND + 100} seed={seed + 3} /> : null}
        {world.season === "autumn" ? <FallenLeaves y={GROUND + 10} seed={seed + 4} /> : null}
        {world.weather === "rain" ? <Puddles xs={[-100, 700, 1350, 2050]} y={GROUND + 90} t={t} /> : null}
        <Fireflies world={world} t={t} seed={seed} top={300} />
        {(winter ? [] : mush).map(([x, c], i) => (
          <g key={i} transform={`translate(${x} ${GROUND + 30})`}>
            <rect x={-12} y={-50} width={24} height={50} rx={10} fill={pal.stalk} stroke={pal.stalkLine} strokeWidth="4" />
            <path d="M-50 -46 Q0 -110 50 -46 Z" fill={c} stroke={out(c)} strokeWidth="5" />
            <circle cx={-16} cy={-70} r={7} fill={pal.capDot} />
            <circle cx={14} cy={-62} r={6} fill={pal.capDot} />
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
  garden: { label: "Сад у дома", Back: GardenScene, Front: (p) => (<><GardenLife {...p} /><Fireflies world={p.world} t={p.t} seed={p.seed} /><GardenForeground {...p} /></>) },
  garden_evening: { label: "Сад вечером", Back: GardenScene, Front: GardenForeground },
  living_room: { label: "Гостиная", Back: LivingRoom },
  kitchen: { label: "Кухня", Back: Kitchen },
  bedroom: { label: "Детская", Back: Bedroom },
  playground: { label: "Детская площадка", Back: Playground },
  beach: { label: "Пляж", Back: Beach },
  forest: { label: "Лес", Back: Forest },
};

export const LOCATION_IDS = Object.keys(LOCATIONS);
export { GROUND };

/** Задник и передний план локации с палитрой мира и сидом сцены. */
export function locationProps(id: string, cam: LocProps["cam"], t: number, opts: { world?: WorldState; seed?: number; uid?: string } = {}): LocProps {
  const w0 = opts.world ?? DEFAULT_WORLD;
  const world: WorldState = id === "garden_evening" && w0.time === "day" ? { ...w0, time: "evening" } : w0;
  return { cam, t, pal: resolvePalette(id, world), seed: opts.seed ?? 0, uid: opts.uid ?? `loc-${id}`, world };
}
export const locationDef = (id: string): LocationDef => LOCATIONS[id] ?? LOCATIONS.garden!;
