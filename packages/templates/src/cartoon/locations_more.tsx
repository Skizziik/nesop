/**
 * Новые локации (docs/cartoon-visual-variety.md, этап 5): ванная, детский сад, ферма, парк с прудом, снежная горка, поход,
 * и два воображаемых мира — космос и подводный мир. Те же правила, что в locations.tsx: мир 1920×1080, земля GROUND,
 * слои с параллаксом, только токены палитры (palette.ts), мелочи — по сиду, анимация — детерминированно от t.
 * Сцена держит свободной «сцену» для героев (x ≈ 330–1590 у линии земли): крупные детали — по краям или за героями.
 */
import type { ReactNode } from "react";
import { jitter, mix, pick, rnd, skyState, worldTone, type Palette, type WorldState } from "./palette";
import { FallenLeaves, Puddles, Puff, SnowDrifts, SnowStrip, Stars, SunMoon, WeatherClouds, WindowWeather } from "./world";
import { shade } from "./rig";
import { GROUND, Layer, Sky, type LocProps } from "./scenes";

const W = 1920;
const H = 1080;
type P = LocProps;
const FONT = "Nunito, 'Arial Rounded MT Bold', Arial, sans-serif";

/** Цветной контур на тон темнее заливки; у белых и почти белых — мягкий сиренево-серый, а не серый. */
function ln(c: string, k = 0.32): string {
  const n = parseInt(c.replace("#", ""), 16);
  const l = 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
  return l > 228 ? mix(c, "#7C86A8", 0.42) : shade(c, k);
}
const wrap = (x: number, span: number) => ((x % span) + span) % span;
/** Сила свечения ламп и окон: вечером слабее, ночью сильнее, днём нет. */
const glowK = (w: WorldState) => (w.time === "night" ? 1.4 : w.time === "evening" ? 0.7 : 0);
/** Цвет по сиду: при seed 0 — токен палитры, иначе вариант, тонированный под мир. */
function seeded(seed: number, key: string, opts: readonly string[], palVal: string, tone: (c: string) => string): string {
  const v = pick(seed, key, opts, "");
  return v ? tone(v) : palVal;
}
const BRIGHT = ["#FF5E5B", "#3D8BFF", "#FFD23F", "#4CB944", "#FF8A2A", "#8E5CFF", "#FF6FA8", "#5DA9FF"];
const SOFT = ["#FF9FB2", "#FFC94D", "#9EDB8A", "#B9A2FF", "#7FC6FF", "#FFB86B"];

/* ------------------------------------------------------------------ общие детали */

/** Тёплое пятно света (лампа, окно, костёр): мягкий радиальный градиент без колец. */
function Glow({ id, x, y, r, t, k, color, ry }: { id: string; x: number; y: number; r: number; t: number; k: number; color: string; ry?: number }) {
  if (k <= 0) return null;
  const a = Math.min(1, (0.42 + 0.05 * Math.sin(t * 2)) * k);
  return (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#FFF4D0" stopOpacity={a} />
          <stop offset="0.25" stopColor={color} stopOpacity={a * 0.7} />
          <stop offset="0.6" stopColor={color} stopOpacity={a * 0.25} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={r} ry={ry ?? r} fill={`url(#${id})`} />
    </g>
  );
}

/** Солнце или луна в окне (при тучах — ничего). */
function WinSky({ x, y, r, world, sun, t }: { x: number; y: number; r: number; world: WorldState; sun: string; t: number }) {
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

function WinStars({ pts, world, t }: { pts: [number, number][]; world: WorldState; t: number }) {
  if (!skyState(world).stars) return null;
  return (
    <g>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3 + (i % 2)} fill="#FFFFFF" opacity={0.5 + 0.5 * Math.sin(t * 2 + i)} />
      ))}
    </g>
  );
}

/** Светлячки тёплой ночью. */
function Fireflies({ world, t, seed, n = 12, top = 420, bottom = 860, from = 0, to = 1920 }: { world: WorldState; t: number; seed: number; n?: number; top?: number; bottom?: number; from?: number; to?: number }) {
  if (world.time !== "night" || world.season === "winter" || world.weather === "rain" || world.weather === "snow") return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = from + rnd(seed, `ff${i}`) * (to - from) + Math.sin(t * 0.7 + i * 1.7) * 60;
        const y = top + rnd(seed, `ffy${i}`) * (bottom - top) + Math.sin(t * 1.1 + i) * 30;
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

/** Небо улицы: градиент, звёзды, солнце/луна, тучи по погоде и пара плывущих облаков. */
function OutdoorSky({ cam, t, pal, seed, uid, world, sun = [1580, 170], starsBottom = 520, clouds = 3 }: P & { sun?: [number, number]; starsBottom?: number; clouds?: number }) {
  return (
    <>
      <Sky id={`${uid}-sky`} top={pal.sky1!} bottom={pal.sky2!} />
      <Layer cam={cam} depth={0.05}>
        <Stars world={world} t={t} seed={seed + 1} bottom={starsBottom} n={32} />
        <SunMoon x={sun[0]} y={sun[1]} r={70} world={world} pal={pal} t={t} />
        <WeatherClouds world={world} t={t} pal={pal} seed={seed + 2} />
        {Array.from({ length: clouds }, (_, i) => {
          const span = W + 700;
          const x = wrap(180 + i * 690 + jitter(seed, `cl${i}`, 240) + t * (8 + i * 4), span) - 350;
          return <Puff key={i} x={x} y={110 + ((i * 71) % 150)} s={0.55 + ((i * 37) % 40) / 100} fill={pal.skyCloud!} shadow={pal.skyCloudShade!} />;
        })}
      </Layer>
    </>
  );
}

/** Травинки вдоль земли. */
function Tufts({ from, to, step, y, c, rows = 3 }: { from: number; to: number; step: number; y: number; c: string; rows?: number }) {
  const n = Math.floor((to - from) / step);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${from + i * step + ((i * 37) % 23)} ${y + (i % rows) * 34} q6 -16 12 0 q6 -20 12 0`} stroke={c} strokeWidth="5" fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
}

/** Круглое дерево-«леденец». */
function RoundTree({ x, y, s, c, pal, t, wind, snow, dots }: { x: number; y: number; s: number; c: string; pal: Palette; t: number; wind: number; snow: boolean; dots?: string }) {
  const sway = Math.sin(t * 1.3 * (wind > 1 ? 1.8 : 1) + x) * 1.5 * wind;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 0 L-10 -120 Q0 -130 10 -120 L14 0 Z" fill={pal.trunk} stroke={ln(pal.trunk!)} strokeWidth="4" />
      <g transform={`rotate(${sway} 0 -120)`}>
        <circle cx={0} cy={-190} r={86} fill={c} stroke={ln(c, 0.3)} strokeWidth="5" />
        <circle cx={-62} cy={-140} r={58} fill={c} stroke={ln(c, 0.3)} strokeWidth="5" />
        <circle cx={64} cy={-142} r={60} fill={c} stroke={ln(c, 0.3)} strokeWidth="5" />
        <circle cx={0} cy={-170} r={70} fill={c} />
        <circle cx={-30} cy={-220} r={30} fill={shade(c, -0.22)} opacity={0.7} />
        {dots && !snow
          ? [[30, -170], [-40, -150], [54, -120], [-10, -240], [-70, -120]].map(([dx, dy], i) => <circle key={i} cx={dx} cy={dy} r={9} fill={dots} />)
          : null}
        {snow ? (
          <g fill="#FFFFFF">
            <ellipse cx={0} cy={-262} rx={52} ry={16} />
            <ellipse cx={-70} cy={-190} rx={38} ry={12} />
            <ellipse cx={72} cy={-194} rx={40} ry={12} />
          </g>
        ) : null}
      </g>
    </g>
  );
}

/** Ёлка из трёх ярусов. */
function Pine({ x, y, s, c, pal, t, wind, snow }: { x: number; y: number; s: number; c: string; pal: Palette; t: number; wind: number; snow: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-20} y={-120} width={40} height={120} rx={10} fill={pal.trunk} stroke={ln(pal.trunk!)} strokeWidth="5" />
      <g transform={`rotate(${Math.sin(t * 1.1 * (wind > 1 ? 1.7 : 1) + x) * 1.2 * wind} 0 -100)`}>
        <path d="M-150 -80 Q0 -60 150 -80 L0 -330 Z" fill={c} stroke={ln(c)} strokeWidth="6" strokeLinejoin="round" />
        <path d="M-125 -180 Q0 -160 125 -180 L0 -400 Z" fill={shade(c, -0.08)} stroke={ln(c)} strokeWidth="6" strokeLinejoin="round" />
        <path d="M-95 -280 Q0 -262 95 -280 L0 -460 Z" fill={shade(c, -0.16)} stroke={ln(c)} strokeWidth="6" strokeLinejoin="round" />
        {snow ? (
          <g fill="#FFFFFF">
            <path d="M-44 -380 L0 -460 L44 -380 Q22 -392 0 -374 Q-22 -392 -44 -380 Z" />
            <path d="M-80 -290 L-46 -330 Q0 -310 46 -330 L80 -290 Q40 -306 0 -292 Q-40 -306 -80 -290 Z" />
            <path d="M-112 -188 L-70 -232 Q0 -210 70 -232 L112 -188 Q56 -206 0 -192 Q-56 -206 -112 -188 Z" />
            <path d="M-140 -86 L-100 -126 Q0 -104 100 -126 L140 -86 Q70 -100 0 -90 Q-70 -100 -140 -86 Z" />
          </g>
        ) : null}
      </g>
    </g>
  );
}

/** Глаз-бусинка с бликом. */
const Eye = ({ x, y, r, ink }: { x: number; y: number; r: number; ink: string }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={ink} />
    <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.38} fill="#FFFFFF" />
  </g>
);

/* ------------------------------------------------------------------ ванная */
function Bathroom({ cam, t, pal, seed, uid, world }: P) {
  const tone = worldTone("bathroom", world);
  const k = glowK(world);
  const wallB = GROUND - 146;
  const tileTop = 455;
  const band = seeded(seed, "band", SOFT, pal.tileBand!, tone);
  const curtain = seeded(seed, "curtain", SOFT, pal.curtain!, tone);
  const towel1 = seeded(seed, "tw1", SOFT, pal.towel1!, tone);
  const towel2 = seeded(seed, "tw2", SOFT, pal.towel2!, tone);
  const mat = seeded(seed, "mat", SOFT, pal.mat!, tone);
  const stool = seeded(seed, "stool", BRIGHT, pal.stool!, tone);
  const bottles = [seeded(seed, "b1", BRIGHT, pal.bottle1!, tone), seeded(seed, "b2", BRIGHT, pal.bottle2!, tone), seeded(seed, "b3", BRIGHT, pal.bottle3!, tone)];
  const foam: [number, number, number][] = [
    [88, 594, 38], [150, 574, 50], [226, 562, 46], [300, 574, 50], [372, 556, 54], [446, 570, 48], [516, 560, 50], [586, 576, 44], [642, 594, 34], [196, 600, 36], [414, 600, 40], [560, 602, 36],
  ];
  const fb = (i: number) => Math.sin(t * 1.5 + i * 1.3) * 3;
  return (
    <g>
      <defs>
        <pattern id={`${uid}-dots`} width={180} height={150} patternUnits="userSpaceOnUse">
          <rect width={180} height={150} fill={pal.wall} />
          <circle cx={40} cy={40} r={14} fill={pal.wallDot} />
          <circle cx={130} cy={105} r={10} fill={pal.wallDot} />
          <circle cx={100} cy={30} r={6} fill={pal.wallDot} />
          <circle cx={30} cy={118} r={5} fill={pal.wallDot} />
        </pattern>
        <pattern id={`${uid}-tile`} width={180} height={180} patternUnits="userSpaceOnUse" x={0} y={tileTop}>
          <rect width={180} height={180} fill={pal.tile1} />
          <rect width={90} height={90} fill={pal.tile2} />
          <rect x={90} y={90} width={90} height={90} fill={pal.tile2} />
          <path d="M0 0 H180 M0 90 H180 M0 0 V180 M90 0 V180" stroke={pal.grout} strokeWidth="3" />
        </pattern>
        <pattern id={`${uid}-band`} width={60} height={30} patternUnits="userSpaceOnUse" x={0} y={tileTop - 26}>
          <circle cx={30} cy={15} r={6} fill={pal.tileBandDot} />
        </pattern>
        <pattern id={`${uid}-floor`} width={160} height={160} patternUnits="userSpaceOnUse" x={0} y={wallB}>
          <rect width={160} height={160} fill={pal.floor} />
          <rect width={80} height={80} fill={pal.floorTile} />
          <rect x={80} y={80} width={80} height={80} fill={pal.floorTile} />
        </pattern>
        <pattern id={`${uid}-cdots`} width={46} height={46} patternUnits="userSpaceOnUse">
          <circle cx={12} cy={12} r={6} fill={pal.curtainDot} opacity={0.85} />
          <circle cx={35} cy={35} r={6} fill={pal.curtainDot} opacity={0.85} />
        </pattern>
        <clipPath id={`${uid}-win`}>
          <rect x={790} y={110} width={340} height={270} rx={26} />
        </clipPath>
      </defs>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill={pal.wall} />
      <Layer cam={cam} depth={0.85}>
        <rect x={-700} y={-400} width={3400} height={tileTop + 400} fill={`url(#${uid}-dots)`} />
        <rect x={-700} y={tileTop} width={3400} height={wallB - tileTop} fill={`url(#${uid}-tile)`} />
        <rect x={-700} y={tileTop - 26} width={3400} height={30} fill={band} />
        <rect x={-700} y={tileTop - 26} width={3400} height={30} fill={`url(#${uid}-band)`} />
        <path d={`M-700 ${tileTop - 27} H2700 M-700 ${tileTop + 4} H2700`} stroke={ln(band)} strokeWidth="4" />
        {/* окно: внизу матовое стекло */}
        <g clipPath={`url(#${uid}-win)`}>
          <rect x={790} y={110} width={340} height={270} fill={pal.skyWindow} />
          <WinStars pts={[[840, 150], [910, 200], [1000, 140], [1080, 210]]} world={world} t={t} />
          <WinSky x={1050} y={170} r={30} world={world} sun={pal.skyWindowSun!} t={t} />
          {skyState(world).clouds > 1 || world.time !== "night" ? <ellipse cx={900} cy={190} rx={56} ry={22} fill={pal.skyWindowCloud} transform={`translate(${Math.sin(t * 0.2) * 26} 0)`} /> : null}
          <path d="M790 300 Q880 262 970 290 T1130 282 V380 H790 Z" fill={pal.windowHill} />
          {world.season === "winter" ? <path d="M790 304 Q880 266 970 294 T1130 286 V300 Q970 306 880 282 T790 318 Z" fill="#FFFFFF" /> : null}
          <WindowWeather x={790} y={110} w={340} h={270} rx={26} world={world} t={t} uid={uid} />
          <path d="M790 290 Q832 274 875 290 T960 290 T1045 290 T1130 290 V380 H790 Z" fill={pal.frost} opacity={0.86} />
          {[[830, 330], [905, 352], [990, 322], [1075, 346]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={7} fill="none" stroke={pal.skyWindow} strokeWidth="3" opacity={0.5} />
          ))}
        </g>
        <rect x={790} y={110} width={340} height={270} rx={26} fill="none" stroke={ln(pal.windowFrame!)} strokeWidth="22" />
        <rect x={790} y={110} width={340} height={270} rx={26} fill="none" stroke={pal.windowFrame} strokeWidth="15" />
        <path d="M960 110 V380 M790 245 H1130" stroke={pal.windowFrame} strokeWidth="12" />
        <rect x={766} y={374} width={388} height={22} rx={10} fill={pal.windowFrame} stroke={ln(pal.windowFrame!)} strokeWidth="4" />
        {/* цветок в горшке на подоконнике */}
        <g transform="translate(1094 374)">
          <path d="M-10 -30 Q-34 -60 -20 -78 Q-2 -60 -6 -30 Z" fill={pal.plant} stroke={ln(pal.plant!)} strokeWidth="3" />
          <path d="M8 -30 Q30 -66 16 -82 Q0 -62 2 -30 Z" fill={pal.plant} stroke={ln(pal.plant!)} strokeWidth="3" />
          <path d="M0 -30 Q4 -70 0 -96" stroke={ln(pal.plant!)} strokeWidth="4" fill="none" />
          <path d="M-22 -32 H22 L16 0 H-16 Z" fill={pal.pot} stroke={ln(pal.pot!)} strokeWidth="4" strokeLinejoin="round" />
        </g>
        {/* штанга и шторка */}
        <path d="M24 150 H700" stroke={pal.rail} strokeWidth="10" strokeLinecap="round" />
        <path d="M60 150 V90 M664 150 V90" stroke={pal.rail} strokeWidth="6" />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={30 + i * 44} cy={152} r={9} fill="none" stroke={ln(pal.rail!)} strokeWidth="4" />
        ))}
        <path d="M0 150 H236 Q212 330 158 424 Q198 520 222 612 H4 Q46 520 84 424 Q24 330 0 150 Z" fill={curtain} stroke={ln(curtain)} strokeWidth="5" strokeLinejoin="round" />
        <path d="M0 150 H236 Q212 330 158 424 Q198 520 222 612 H4 Q46 520 84 424 Q24 330 0 150 Z" fill={`url(#${uid}-cdots)`} />
        <path d="M60 160 Q80 300 110 420 M160 160 Q140 300 124 420 M110 432 Q100 520 70 610 M124 432 Q150 520 168 610" stroke={ln(curtain, 0.18)} strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x={74} y={412} width={96} height={22} rx={11} fill={band} stroke={ln(band)} strokeWidth="4" />
        {/* душ */}
        <path d="M642 520 V214 Q642 188 616 188 H588" stroke={pal.tap} strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d="M548 176 H600 L612 214 H536 Z" fill={pal.tap} stroke={ln(pal.tap!)} strokeWidth="4" strokeLinejoin="round" />
        {/* полочка с баночками */}
        <g transform="translate(300 420)">
          <rect x={0} y={0} width={240} height={16} rx={8} fill={pal.shelf} stroke={ln(pal.shelf!)} strokeWidth="4" />
          <rect x={18} y={-74} width={44} height={74} rx={12} fill={bottles[0]} stroke={ln(bottles[0]!)} strokeWidth="4" />
          <rect x={28} y={-92} width={24} height={20} rx={5} fill={ln(bottles[0]!, 0.12)} />
          <rect x={30} y={-52} width={20} height={26} rx={4} fill="#FFFFFF" opacity={0.75} />
          <rect x={86} y={-56} width={50} height={56} rx={16} fill={bottles[1]} stroke={ln(bottles[1]!)} strokeWidth="4" />
          <path d="M100 -56 V-74 H118 L128 -66" stroke={ln(bottles[1]!)} strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx={190} cy={-26} r={26} fill={bottles[2]} stroke={ln(bottles[2]!)} strokeWidth="4" />
          <circle cx={182} cy={-34} r={7} fill="#FFFFFF" opacity={0.6} />
        </g>
        {/* полотенца */}
        <g transform="translate(1240 300)">
          <rect x={-6} y={-12} width={12} height={28} rx={5} fill={pal.rack} />
          <rect x={214} y={-12} width={12} height={28} rx={5} fill={pal.rack} />
          <rect x={-4} y={-6} width={228} height={12} rx={6} fill={pal.rack} stroke={ln(pal.rack!)} strokeWidth="3" />
          <rect x={18} y={-4} width={94} height={206} rx={14} fill={towel1} stroke={ln(towel1)} strokeWidth="5" />
          <rect x={18} y={150} width={94} height={10} fill={pal.towelStripe} opacity={0.9} />
          <rect x={18} y={168} width={94} height={6} fill={pal.towelStripe} opacity={0.9} />
          <rect x={18} y={-4} width={94} height={30} rx={14} fill={ln(towel1, 0.08)} />
          <rect x={122} y={-4} width={84} height={172} rx={14} fill={towel2} stroke={ln(towel2)} strokeWidth="5" />
          <rect x={122} y={120} width={84} height={10} fill={pal.towelStripe} opacity={0.9} />
          <rect x={122} y={-4} width={84} height={30} rx={14} fill={ln(towel2, 0.08)} />
        </g>
        {/* лампа и зеркало */}
        <Glow id={`${uid}-g1`} x={1720} y={228} r={300} t={t} k={k} color={pal.glowLamp!} />
        <rect x={1690} y={198} width={60} height={14} rx={7} fill={pal.rack} />
        <path d="M1676 246 Q1676 206 1720 206 Q1764 206 1764 246 Z" fill={k ? pal.glowLamp : pal.lamp} stroke={ln(pal.lamp!)} strokeWidth="4" />
        <ellipse cx={1720} cy={385} rx={104} ry={128} fill={pal.mirror} stroke={pal.mirrorFrame} strokeWidth="18" />
        <ellipse cx={1720} cy={385} rx={115} ry={139} fill="none" stroke={ln(pal.mirrorFrame!)} strokeWidth="4" />
        <path d="M1660 330 L1700 290 M1662 372 L1734 300 M1748 460 L1772 436" stroke={pal.mirrorShine} strokeWidth="9" strokeLinecap="round" opacity={0.8} />
        {/* раковина */}
        <path d="M1690 660 L1750 660 L1766 800 L1674 800 Z" fill={pal.sink} stroke={pal.sinkLine} strokeWidth="5" strokeLinejoin="round" />
        <ellipse cx={1720} cy={800} rx={66} ry={12} fill={pal.sink} stroke={pal.sinkLine} strokeWidth="5" />
        <path d="M1590 560 H1850 Q1846 650 1760 664 H1680 Q1594 650 1590 560 Z" fill={pal.sink} stroke={pal.sinkLine} strokeWidth="6" strokeLinejoin="round" />
        <rect x={1578} y={548} width={284} height={22} rx={11} fill={pal.sink} stroke={pal.sinkLine} strokeWidth="5" />
        <path d="M1708 550 V522 Q1708 508 1722 508 H1752 V524" stroke={pal.tap} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={1676} cy={538} r={10} fill={pal.towel2} stroke={ln(pal.towel2!)} strokeWidth="3" />
        <circle cx={1782} cy={538} r={10} fill={pal.towel1} stroke={ln(pal.towel1!)} strokeWidth="3" />
        <path d={`M1752 ${532 + ((t * 0.9) % 1) * 22} q-6 9 0 12 q6 -3 0 -12 Z`} fill={pal.water} opacity={1 - ((t * 0.9) % 1)} />
        {/* стаканчик со щётками и мыло */}
        <g transform="translate(1614 548)">
          <path d="M-8 -40 L-20 -92" stroke={pal.brush1} strokeWidth="7" strokeLinecap="round" />
          <rect x={-30} y={-104} width={14} height={20} rx={4} fill={pal.foam} stroke={pal.brush1} strokeWidth="3" transform="rotate(-24 -23 -94)" />
          <path d="M6 -40 L16 -96" stroke={pal.brush2} strokeWidth="7" strokeLinecap="round" />
          <rect x={10} y={-110} width={14} height={20} rx={4} fill={pal.foam} stroke={pal.brush2} strokeWidth="3" transform="rotate(12 17 -100)" />
          <path d="M-20 -50 H20 L16 0 H-16 Z" fill={pal.cup} stroke={ln(pal.cup!)} strokeWidth="4" strokeLinejoin="round" />
        </g>
        <rect x={1806} y={526} width={44} height={22} rx={10} fill={pal.bottle3} stroke={ln(pal.bottle3!)} strokeWidth="3" />
        <circle cx={1820} cy={518} r={7} fill="none" stroke={pal.bubbleRim} strokeWidth="3" />
        <circle cx={1838} cy={508} r={5} fill="none" stroke={pal.bubbleRim} strokeWidth="3" />
        {/* пол */}
        <rect x={-700} y={wallB} width={3400} height={H} fill={`url(#${uid}-floor)`} />
        <rect x={-700} y={wallB - 6} width={3400} height={12} fill={pal.grout} />
      </Layer>
      <Layer cam={cam} depth={0.93}>
        {/* ванна на ножках с горой пены и уточкой */}
        {[150, 570].map((fx) => (
          <g key={fx}>
            <path d={`M${fx - 12} 800 L${fx - 18} 838 H${fx + 18} L${fx + 12} 800 Z`} fill={pal.tubFoot} stroke={ln(pal.tubFoot!)} strokeWidth="4" />
            <ellipse cx={fx} cy={842} rx={28} ry={14} fill={pal.tubFoot} stroke={ln(pal.tubFoot!)} strokeWidth="4" />
          </g>
        ))}
        {foam.map(([x, y, r], i) => (
          <circle key={`o${i}`} cx={x} cy={y + fb(i)} r={r + 4} fill={ln(pal.foam!)} />
        ))}
        {foam.map(([x, y, r], i) => (
          <circle key={`s${i}`} cx={x} cy={y + fb(i)} r={r} fill={pal.foamShade} />
        ))}
        {foam.map(([x, y, r], i) => (
          <circle key={`f${i}`} cx={x - r * 0.12} cy={y + fb(i) - r * 0.14} r={r * 0.84} fill={pal.foam} />
        ))}
        <path d="M44 606 H676 Q672 790 560 822 H160 Q48 790 44 606 Z" fill={pal.tub} stroke={pal.tubLine} strokeWidth="6" strokeLinejoin="round" />
        <path d="M70 690 Q360 720 650 690" stroke={band} strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d="M86 640 Q90 740 170 790" stroke={pal.mirrorShine} strokeWidth="10" fill="none" strokeLinecap="round" opacity={0.9} />
        <rect x={30} y={590} width={660} height={28} rx={14} fill={pal.tub} stroke={pal.tubLine} strokeWidth="5" />
        <g transform={`translate(470 ${542 + Math.sin(t * 1.8) * 4}) rotate(${Math.sin(t * 1.8 + 1) * 6})`}>
          <path d="M-34 -16 L-56 -38 L-26 -28 Z" fill={pal.duck} stroke={ln(pal.duck!)} strokeWidth="4" strokeLinejoin="round" />
          <ellipse cx={0} cy={-10} rx={44} ry={26} fill={pal.duck} stroke={ln(pal.duck!)} strokeWidth="4" />
          <circle cx={22} cy={-46} r={23} fill={pal.duck} stroke={ln(pal.duck!)} strokeWidth="4" />
          <ellipse cx={20} cy={-24} rx={22} ry={10} fill={pal.duck} />
          <path d="M42 -48 Q64 -46 62 -36 Q50 -32 40 -38 Z" fill={pal.duckBeak} stroke={ln(pal.duckBeak!)} strokeWidth="3" strokeLinejoin="round" />
          <Eye x={28} y={-52} r={4.5} ink={pal.ink!} />
          <path d="M-18 -14 Q0 -26 14 -8 Q-2 2 -18 -14 Z" fill={ln(pal.duck!, 0.08)} />
        </g>
        {/* пузыри поднимаются и тают */}
        {Array.from({ length: 9 }, (_, i) => {
          const p = (t * 0.2 + i * 0.113) % 1;
          const r = 8 + (i % 3) * 5;
          return (
            <g key={i} opacity={Math.min(1, (1 - p) * 1.8)}>
              <circle cx={90 + i * 66 + Math.sin(t * 1.3 + i * 2) * 14} cy={560 - p * 380} r={r} fill={pal.foam} fillOpacity={0.25} stroke={pal.bubbleRim} strokeWidth="3" />
              <circle cx={90 + i * 66 + Math.sin(t * 1.3 + i * 2) * 14 - r * 0.35} cy={560 - p * 380 - r * 0.35} r={r * 0.25} fill="#FFFFFF" />
            </g>
          );
        })}
        {[260, 520].map((sx, i) => (
          <path key={sx} d={`M${sx} 520 q-14 -26 0 -52 q14 -26 0 -52`} stroke={pal.foam} strokeWidth="7" fill="none" strokeLinecap="round" opacity={0.35 + 0.15 * Math.sin(t * 2 + i)} transform={`translate(0 ${-((t * 18 + i * 20) % 30)})`} />
        ))}
      </Layer>
      <Layer cam={cam} depth={1}>
        {/* коврик у ванны и ступенька у раковины */}
        <rect x={150} y={GROUND + 14} width={380} height={58} rx={29} fill={mat} stroke={ln(mat)} strokeWidth="5" />
        {Array.from({ length: 7 }, (_, i) => (
          <circle key={i} cx={196 + i * 48} cy={GROUND + 43} r={8} fill={pal.matDot} opacity={0.85} />
        ))}
        <g transform={`translate(1730 ${GROUND + 20})`}>
          <path d="M-70 -40 L-80 30 H-50 L-42 -40 Z M70 -40 L80 30 H50 L42 -40 Z" fill={ln(stool, 0.15)} stroke={ln(stool)} strokeWidth="4" strokeLinejoin="round" />
          <rect x={-92} y={-62} width={184} height={30} rx={14} fill={stool} stroke={ln(stool)} strokeWidth="5" />
          <path d="M0 -58 l5 9 l10 1 l-7 7 l2 10 l-10 -5 l-10 5 l2 -10 l-7 -7 l10 -1 z" fill="#FFFFFF" opacity={0.85} transform="translate(0 4)" />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ детский сад */
const DRAWINGS = ["sun", "house", "flower", "rainbow", "cat"] as const;
function KidDrawing({ kind, x, y, w, h, rot, pal, pin }: { kind: (typeof DRAWINGS)[number]; x: number; y: number; w: number; h: number; rot: number; pal: Palette; pin: string }) {
  const cx = w / 2;
  const cy = h / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot} ${cx} ${cy})`}>
      <rect x={0} y={0} width={w} height={h} rx={4} fill={pal.paper} stroke={ln(pal.paper!)} strokeWidth="3" />
      {kind === "sun" ? (
        <g>
          <circle cx={cx} cy={cy} r={h * 0.2} fill={pal.shape2} />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path key={a} d={`M${cx} ${cy - h * 0.28} V${cy - h * 0.4}`} stroke={pal.shape2} strokeWidth="5" strokeLinecap="round" transform={`rotate(${a} ${cx} ${cy})`} />
          ))}
        </g>
      ) : kind === "house" ? (
        <g>
          <rect x={w * 0.3} y={h * 0.45} width={w * 0.4} height={h * 0.38} fill={pal.shape4} />
          <path d={`M${w * 0.22} ${h * 0.47} L${cx} ${h * 0.18} L${w * 0.78} ${h * 0.47} Z`} fill={pal.shape1} />
          <rect x={w * 0.45} y={h * 0.62} width={w * 0.1} height={h * 0.21} fill={pal.shape2} />
        </g>
      ) : kind === "flower" ? (
        <g>
          <path d={`M${cx} ${h * 0.5} V${h * 0.88}`} stroke={pal.shape3} strokeWidth="5" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={cx} cy={h * 0.24} rx={w * 0.09} ry={h * 0.13} fill={pal.shape1} transform={`rotate(${a} ${cx} ${h * 0.4})`} />
          ))}
          <circle cx={cx} cy={h * 0.4} r={w * 0.08} fill={pal.shape2} />
        </g>
      ) : kind === "rainbow" ? (
        <g fill="none" strokeWidth="7">
          {[pal.shape1, pal.shape2, pal.shape3, pal.shape4].map((c, i) => (
            <path key={i} d={`M${w * 0.14 + i * 8} ${h * 0.8} A${w * 0.36 - i * 8} ${w * 0.36 - i * 8} 0 0 1 ${w * 0.86 - i * 8} ${h * 0.8}`} stroke={c} />
          ))}
        </g>
      ) : (
        <g>
          <circle cx={cx} cy={cy + 4} r={h * 0.26} fill={pal.shape2} />
          <path d={`M${cx - h * 0.24} ${cy - h * 0.08} L${cx - h * 0.2} ${cy - h * 0.38} L${cx - h * 0.04} ${cy - h * 0.2} Z M${cx + h * 0.24} ${cy - h * 0.08} L${cx + h * 0.2} ${cy - h * 0.38} L${cx + h * 0.04} ${cy - h * 0.2} Z`} fill={pal.shape2} />
          <circle cx={cx - 8} cy={cy} r={3} fill={pal.ink} />
          <circle cx={cx + 8} cy={cy} r={3} fill={pal.ink} />
        </g>
      )}
      <circle cx={cx} cy={8} r={6} fill={pin} stroke={ln(pin)} strokeWidth="2" />
    </g>
  );
}

function KidChair({ x, y, c, flip = 1 }: { x: number; y: number; c: string; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip} 1)`}>
      <rect x={-26} y={-150} width={18} height={150} rx={8} fill={c} stroke={ln(c)} strokeWidth="4" />
      <rect x={-36} y={-160} width={30} height={70} rx={12} fill={c} stroke={ln(c)} strokeWidth="4" />
      <rect x={34} y={-70} width={14} height={70} rx={6} fill={c} stroke={ln(c)} strokeWidth="4" />
      <rect x={-36} y={-80} width={90} height={18} rx={9} fill={c} stroke={ln(c)} strokeWidth="4" />
    </g>
  );
}

function Classroom({ cam, t, pal, seed, uid, world }: P) {
  const tone = worldTone("classroom", world);
  const wallB = GROUND - 146;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const cardC = (i: number) => [pal.shape1!, pal.chair2!, pal.shape3!, pal.shape2!, pal.shape4!, pal.clockRim!][(i + Math.floor(rnd(seed, "abc") * 6)) % 6]!;
  const chairs = [seeded(seed, "c1", BRIGHT, pal.chair1!, tone), seeded(seed, "c2", BRIGHT, pal.chair2!, tone), seeded(seed, "c3", BRIGHT, pal.chair3!, tone), seeded(seed, "c4", BRIGHT, pal.chair4!, tone)];
  const rug = seeded(seed, "rug", ["#9FD3FF", "#FFC94D", "#9EDB8A", "#FF9FB2", "#B9A2FF"], pal.rug!, tone);
  const valance = seeded(seed, "val", SOFT, pal.clockRim!, tone);
  const d = (key: string, def: (typeof DRAWINGS)[number]) => pick(seed, key, DRAWINGS, def);
  const bins = [0, 1, 2, 3, 4, 5].map((i) => seeded(seed, `bin${i}`, BRIGHT, [pal.chair1!, pal.chair2!, pal.chair3!, pal.chair4!, pal.shape2!, pal.hook!][i]!, tone));
  const hour = (t * 0.02) % 12;
  const fishX = Math.sin(t * 0.9) * 16;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-cw`}>
          <rect x={700} y={176} width={520} height={262} rx={16} />
        </clipPath>
      </defs>
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill={pal.wall} />
      <Layer cam={cam} depth={0.85}>
        {/* нижняя панель стены */}
        <rect x={-700} y={600} width={3400} height={wallB - 600} fill={pal.wallLow} />
        <rect x={-700} y={592} width={3400} height={16} rx={6} fill={pal.wallRail} stroke={ln(pal.wallRail!)} strokeWidth="3" />
        {/* азбука на верёвочке */}
        <path d="M-500 34 Q-200 54 100 34 T700 34 T1300 34 T1900 34 T2500 34" stroke={pal.easel} strokeWidth="4" fill="none" />
        {Array.from({ length: 26 }, (_, i) => {
          const x = 60 + i * 112;
          const c = cardC(i);
          const sw = Math.sin(t * 1.2 + i * 0.8) * 2.5;
          return (
            <g key={i} transform={`translate(${x} 40) rotate(${sw} 0 0)`}>
              <rect x={-44} y={0} width={88} height={92} rx={10} fill={pal.card} stroke={c} strokeWidth="5" />
              <text x={0} y={70} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={62} fill={c}>
                {letters[i]}
              </text>
            </g>
          );
        })}
        {/* большое окно с ламбрекеном */}
        <g clipPath={`url(#${uid}-cw)`}>
          <rect x={700} y={176} width={520} height={262} fill={pal.skyWindow} />
          <WinStars pts={[[760, 220], [880, 260], [1010, 210], [1150, 250]]} world={world} t={t} />
          <WinSky x={1120} y={240} r={32} world={world} sun={pal.skyWindowSun!} t={t} />
          {skyState(world).clouds > 1 || world.time !== "night" ? (
            <g transform={`translate(${Math.sin(t * 0.18) * 40} 0)`}>
              <ellipse cx={860} cy={250} rx={64} ry={24} fill={pal.skyWindowCloud} />
              <ellipse cx={830} cy={240} rx={30} ry={22} fill={pal.skyWindowCloud} />
            </g>
          ) : null}
          <path d="M700 380 Q820 330 960 368 T1220 356 V438 H700 Z" fill={pal.windowHill} />
          <circle cx={1040} cy={330} r={30} fill={shade(pal.windowHill!, 0.12)} />
          <rect x={1036} y={350} width={8} height={30} fill={shade(pal.windowHill!, 0.4)} />
          {world.season === "winter" ? <path d="M700 384 Q820 334 960 372 T1220 360 V378 Q960 388 820 352 T700 400 Z" fill="#FFFFFF" /> : null}
          <WindowWeather x={700} y={176} w={520} h={262} rx={16} world={world} t={t} uid={uid} />
        </g>
        <rect x={700} y={176} width={520} height={262} rx={16} fill="none" stroke={ln(pal.windowFrame!)} strokeWidth="22" />
        <rect x={700} y={176} width={520} height={262} rx={16} fill="none" stroke={pal.windowFrame} strokeWidth="15" />
        <path d="M873 176 V438 M1047 176 V438" stroke={pal.windowFrame} strokeWidth="12" />
        <path d={`M680 168 H1240 V198 ${Array.from({ length: 8 }, (_, i) => `q-35 34 -70 0`).join(" ")} Z`} fill={valance} stroke={ln(valance)} strokeWidth="4" strokeLinejoin="round" />
        <rect x={676} y={432} width={568} height={22} rx={10} fill={pal.windowSill} stroke={ln(pal.windowSill!)} strokeWidth="4" />
        {/* аквариум с рыбкой и горшок на подоконнике */}
        <g transform="translate(1176 432)">
          <path d="M-40 -6 Q-56 -50 -30 -78 H30 Q56 -50 40 -6 Z" fill={pal.bowl} stroke={ln(pal.bowl!)} strokeWidth="4" opacity={0.95} />
          <path d="M-46 -40 Q0 -34 46 -40" stroke={ln(pal.bowl!, 0.12)} strokeWidth="3" fill="none" />
          <g transform={`translate(${fishX} -26) scale(${Math.cos(t * 0.9) > 0 ? 1 : -1} 1)`}>
            <path d="M-14 0 L-26 -10 L-26 10 Z" fill={pal.fish} />
            <ellipse cx={0} cy={0} rx={15} ry={10} fill={pal.fish} stroke={ln(pal.fish!)} strokeWidth="2" />
            <circle cx={7} cy={-2} r={2.5} fill={pal.ink} />
          </g>
          <path d="M-12 -86 q-6 -10 0 -18" stroke={pal.bowl} strokeWidth="3" fill="none" opacity={0.8} />
        </g>
        <g transform="translate(740 432)">
          <circle cx={-14} cy={-44} r={18} fill={pal.plant} stroke={ln(pal.plant!)} strokeWidth="3" />
          <circle cx={12} cy={-52} r={20} fill={pal.plant} stroke={ln(pal.plant!)} strokeWidth="3" />
          <circle cx={0} cy={-34} r={18} fill={pal.plant} />
          <path d="M-22 -26 H22 L16 0 H-16 Z" fill={pal.pot} stroke={ln(pal.pot!)} strokeWidth="4" strokeLinejoin="round" />
        </g>
        {/* пробковая доска с рисунками */}
        <g transform="translate(330 196)">
          <rect x={0} y={0} width={300} height={226} rx={14} fill={pal.cork} stroke={pal.easel} strokeWidth="10" />
          {[[40, 40], [130, 150], [230, 60], [80, 180], [260, 180]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3} fill={pal.corkDot} />
          ))}
          <KidDrawing kind={d("d1", "sun")} x={20} y={20} w={120} h={90} rot={-5} pal={pal} pin={pal.shape1!} />
          <KidDrawing kind={d("d2", "house")} x={160} y={18} w={118} h={92} rot={4} pal={pal} pin={pal.chair2!} />
          <KidDrawing kind={d("d3", "rainbow")} x={30} y={122} w={124} h={86} rot={3} pal={pal} pin={pal.shape3!} />
          <KidDrawing kind={d("d4", "cat")} x={170} y={124} w={110} h={84} rot={-4} pal={pal} pin={pal.shape4!} />
        </g>
        {/* часы */}
        <g transform="translate(1420 270)">
          <circle r={62} fill={pal.clock} stroke={pal.clockRim} strokeWidth="12" />
          <circle r={69} fill="none" stroke={ln(pal.clockRim!)} strokeWidth="3" />
          {[0, 90, 180, 270].map((a) => (
            <circle key={a} cx={0} cy={-44} r={5} fill={pal.clockRim} transform={`rotate(${a})`} />
          ))}
          <path d="M0 0 V-26" stroke={pal.ink} strokeWidth="7" strokeLinecap="round" transform={`rotate(${hour * 30 + 300})`} />
          <path d="M0 0 V-40" stroke={pal.ink} strokeWidth="5" strokeLinecap="round" transform={`rotate(${(hour * 360) % 360})`} />
          <circle r={6} fill={pal.clockRim} />
        </g>
        {/* пол */}
        <rect x={-700} y={wallB - 12} width={3400} height={16} fill={pal.skirting} />
        <rect x={-700} y={wallB + 4} width={3400} height={H} fill={pal.floor} />
        {Array.from({ length: 20 }, (_, i) => (
          <path key={i} d={`M${-640 + i * 180} ${wallB + 4} L${-700 + i * 180} ${H + 200}`} stroke={pal.plank} strokeWidth="4" />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.9}>
        {/* шкафчики-ячейки */}
        <g transform={`translate(10 ${GROUND - 84})`}>
          <rect x={0} y={-310} width={340} height={310} rx={14} fill={pal.cubby} stroke={ln(pal.cubby!)} strokeWidth="6" />
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => {
              const i = r * 3 + c;
              const bx = 16 + c * 106;
              const by = -296 + r * 98;
              const bin = bins[i % 6]!;
              return (
                <g key={i}>
                  <rect x={bx} y={by} width={96} height={86} rx={8} fill={pal.cubbyIn} />
                  {i === 1 ? (
                    <circle cx={bx + 48} cy={by + 56} r={28} fill={bin} stroke={ln(bin)} strokeWidth="4" />
                  ) : i === 5 ? (
                    <g>
                      <rect x={bx + 14} y={by + 30} width={18} height={56} rx={3} fill={pal.shape1} />
                      <rect x={bx + 34} y={by + 22} width={16} height={64} rx={3} fill={pal.shape2} />
                      <rect x={bx + 52} y={by + 34} width={20} height={52} rx={3} fill={pal.chair2} transform={`rotate(10 ${bx + 62} ${by + 86})`} />
                    </g>
                  ) : (
                    <g>
                      <rect x={bx + 6} y={by + 30} width={84} height={56} rx={10} fill={bin} stroke={ln(bin)} strokeWidth="4" />
                      <rect x={bx + 32} y={by + 44} width={32} height={10} rx={5} fill="#FFFFFF" opacity={0.7} />
                    </g>
                  )}
                </g>
              );
            }),
          )}
          {/* на шкафчике: кубики */}
          <rect x={210} y={-356} width={46} height={46} rx={6} fill={pal.shape1} stroke={ln(pal.shape1!)} strokeWidth="4" />
          <rect x={258} y={-356} width={46} height={46} rx={6} fill={pal.chair2} stroke={ln(pal.chair2!)} strokeWidth="4" />
          <rect x={234} y={-402} width={46} height={46} rx={6} fill={pal.shape2} stroke={ln(pal.shape2!)} strokeWidth="4" />
          <text x={257} y={-366} textAnchor="middle" fontFamily={FONT} fontWeight={900} fontSize={32} fill="#FFFFFF">
            A
          </text>
        </g>
        {/* дальний столик */}
        <g transform={`translate(520 ${GROUND - 70})`}>
          <KidChair x={-120} y={0} c={chairs[2]!} />
          <KidChair x={120} y={0} c={chairs[3]!} flip={-1} />
          <rect x={-100} y={-122} width={200} height={22} rx={10} fill={pal.table} stroke={ln(pal.table!)} strokeWidth="5" />
          <rect x={-86} y={-100} width={16} height={100} rx={6} fill={pal.tableLeg} />
          <rect x={70} y={-100} width={16} height={100} rx={6} fill={pal.tableLeg} />
          <rect x={-50} y={-136} width={60} height={14} rx={3} fill={pal.paper} transform="rotate(-4 -20 -129)" />
          <rect x={30} y={-146} width={10} height={26} rx={4} fill={pal.shape1} transform="rotate(20 35 -133)" />
        </g>
      </Layer>
      <Layer cam={cam} depth={0.95}>
        {/* ближний столик с карандашами */}
        <g transform={`translate(1390 ${GROUND - 30})`}>
          <KidChair x={-150} y={0} c={chairs[0]!} />
          <KidChair x={150} y={0} c={chairs[1]!} flip={-1} />
          <rect x={-130} y={-130} width={260} height={24} rx={11} fill={pal.table} stroke={ln(pal.table!)} strokeWidth="5" />
          <rect x={-112} y={-106} width={18} height={106} rx={7} fill={pal.tableLeg} />
          <rect x={94} y={-106} width={18} height={106} rx={7} fill={pal.tableLeg} />
          <rect x={-90} y={-146} width={86} height={16} rx={3} fill={pal.paper} stroke={ln(pal.paper!)} strokeWidth="2" transform="rotate(-3 -47 -138)" />
          <path d="M40 -130 L44 -176 H76 L80 -130 Z" fill={pal.chair4} stroke={ln(pal.chair4!)} strokeWidth="4" strokeLinejoin="round" />
          {[pal.shape1, pal.shape2, pal.shape3].map((c, i) => (
            <path key={i} d={`M${50 + i * 10} -172 L${46 + i * 12} -206 L${52 + i * 12} -214 L${58 + i * 12} -206 L${60 + i * 10} -172 Z`} fill={c} />
          ))}
        </g>
        {/* мольберт с рисунком */}
        <g transform={`translate(1745 ${GROUND - 10})`}>
          <path d="M-90 0 L-20 -420 M90 0 L20 -420 M0 -300 L30 0" stroke={pal.easel} strokeWidth="14" strokeLinecap="round" />
          <rect x={-120} y={-410} width={240} height={200} rx={8} fill={pal.paper} stroke={ln(pal.paper!)} strokeWidth="4" />
          <KidDrawing kind={d("easel", "rainbow")} x={-108} y={-398} w={216} h={176} rot={0} pal={pal} pin={pal.paper!} />
          <rect x={-130} y={-212} width={260} height={18} rx={8} fill={pal.easel} stroke={ln(pal.easel!)} strokeWidth="4" />
          {[pal.shape1, pal.chair2, pal.shape2, pal.shape3].map((c, i) => (
            <rect key={i} x={-108 + i * 56} y={-232} width={36} height={22} rx={6} fill={c} stroke={ln(c!)} strokeWidth="3" />
          ))}
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        {/* ковёр с фигурами */}
        <rect x={500} y={GROUND - 26} width={920} height={110} rx={50} fill={rug} stroke={ln(rug)} strokeWidth="6" />
        <rect x={526} y={GROUND - 12} width={868} height={82} rx={38} fill="none" stroke={pal.rugEdge} strokeWidth="5" strokeDasharray="4 16" strokeLinecap="round" />
        <g transform={`translate(0 ${GROUND + 30}) scale(1 0.55)`}>
          <circle cx={610} cy={0} r={30} fill={pal.shape1} />
          <path d="M760 26 L790 -30 L820 26 Z" fill={pal.shape2} />
          <rect x={1100} y={-28} width={56} height={56} rx={6} fill={pal.shape3} />
          <path d="M1300 -34 l10 22 l24 3 l-18 16 l5 24 l-21 -12 l-21 12 l5 -24 l-18 -16 l24 -3 z" fill={pal.shape4} />
        </g>
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ ферма */
function Cow({ x, y, s, t, pal, flip = 1 }: { x: number; y: number; s: number; t: number; pal: Palette; flip?: 1 | -1 }) {
  const graze = (Math.sin(t * 0.7 + x) + 1) / 2; // голова опускается к траве
  const c = pal.cow!;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * flip} ${s})`}>
      {[-66, -36, 40, 68].map((lx) => (
        <g key={lx}>
          <rect x={lx - 11} y={-60} width={22} height={60} rx={9} fill={c} stroke={ln(c)} strokeWidth="5" />
          <rect x={lx - 11} y={-14} width={22} height={14} rx={5} fill={pal.cowSpot} />
        </g>
      ))}
      <path d={`M-92 -112 Q-118 -84 -112 ${-50 + Math.sin(t * 2.4 + x) * 6}`} stroke={ln(c)} strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx={-112} cy={-48 + Math.sin(t * 2.4 + x) * 6} r={8} fill={pal.cowSpot} />
      <rect x={-100} y={-150} width={200} height={100} rx={46} fill={c} stroke={ln(c)} strokeWidth="5" />
      <path d="M-60 -148 Q-30 -120 -52 -96 Q-80 -90 -84 -120 Q-82 -142 -60 -148 Z" fill={pal.cowSpot} />
      <ellipse cx={20} cy={-112} rx={26} ry={20} fill={pal.cowSpot} />
      <ellipse cx={60} cy={-138} rx={16} ry={10} fill={pal.cowSpot} />
      <ellipse cx={0} cy={-58} rx={22} ry={10} fill={pal.cowNose} />
      <g transform={`rotate(${graze * 38} 86 -128)`}>
        <path d="M78 -168 Q74 -188 84 -192 M114 -168 Q118 -188 108 -192" stroke={pal.horn} strokeWidth="9" strokeLinecap="round" fill="none" />
        <ellipse cx={66} cy={-160} rx={20} ry={10} fill={c} stroke={ln(c)} strokeWidth="4" transform="rotate(-25 66 -160)" />
        <ellipse cx={128} cy={-160} rx={20} ry={10} fill={c} stroke={ln(c)} strokeWidth="4" transform="rotate(25 128 -160)" />
        <ellipse cx={96} cy={-136} rx={38} ry={40} fill={c} stroke={ln(c)} strokeWidth="5" />
        <ellipse cx={100} cy={-108} rx={34} ry={22} fill={pal.cowNose} stroke={ln(pal.cowNose!)} strokeWidth="4" />
        <circle cx={90} cy={-108} r={4} fill={ln(pal.cowNose!, 0.4)} />
        <circle cx={110} cy={-108} r={4} fill={ln(pal.cowNose!, 0.4)} />
        <Eye x={84} y={-144} r={6} ink={pal.ink!} />
        <Eye x={112} y={-144} r={6} ink={pal.ink!} />
      </g>
    </g>
  );
}

function Sheep({ x, y, s, t, pal, flip = 1 }: { x: number; y: number; s: number; t: number; pal: Palette; flip?: 1 | -1 }) {
  const c = pal.sheep!;
  const bob = Math.sin(t * 0.8 + x * 0.3) * 6;
  const wool: [number, number, number][] = [[-50, -96, 30], [-18, -116, 34], [22, -112, 34], [52, -90, 28], [-36, -66, 30], [10, -64, 32], [44, -66, 26]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s * flip} ${s})`}>
      {[-40, -14, 18, 42].map((lx) => (
        <rect key={lx} x={lx - 7} y={-56} width={14} height={56} rx={6} fill={pal.sheepFace} />
      ))}
      {wool.map(([wx, wy, r], i) => (
        <circle key={`o${i}`} cx={wx} cy={wy} r={r + 4} fill={ln(c)} />
      ))}
      {wool.map(([wx, wy, r], i) => (
        <circle key={`w${i}`} cx={wx} cy={wy} r={r} fill={c} />
      ))}
      <g transform={`rotate(${bob} 62 -96)`}>
        <ellipse cx={88} cy={-90} rx={20} ry={10} fill={pal.sheepFace} transform="rotate(30 88 -90)" />
        <ellipse cx={80} cy={-86} rx={24} ry={30} fill={pal.sheepFace} />
        <circle cx={74} cy={-112} r={16} fill={c} />
        <circle cx={88} cy={-114} r={12} fill={c} />
        <circle cx={78} cy={-90} r={6} fill="#FFFFFF" />
        <circle cx={92} cy={-90} r={6} fill="#FFFFFF" />
        <circle cx={80} cy={-89} r={3} fill={pal.ink} />
        <circle cx={94} cy={-89} r={3} fill={pal.ink} />
        <ellipse cx={86} cy={-70} rx={8} ry={4} fill={pal.cowNose} opacity={0.8} />
      </g>
    </g>
  );
}

function Hen({ x, y, s, t, pal, flip = 1, phase = 0 }: { x: number; y: number; s: number; t: number; pal: Palette; flip?: 1 | -1; phase?: number }) {
  const ph = (t * 0.6 + phase) % 1;
  const peck = ph > 0.72 ? Math.sin(((ph - 0.72) / 0.28) * Math.PI * 2) * 22 + 22 : 0;
  const c = pal.hen!;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * flip} ${s})`}>
      <path d="M-6 -30 V0 M-6 0 l-8 2 M-6 0 l8 2 M10 -30 V0 M10 0 l-8 2 M10 0 l8 2" stroke={pal.beak} strokeWidth="5" strokeLinecap="round" />
      <g transform={`rotate(${peck} 10 -30)`}>
        <path d="M-50 -78 Q-60 -110 -40 -104 Q-36 -118 -24 -100 Q-20 -112 -10 -94" fill={c} stroke={ln(c)} strokeWidth="5" strokeLinejoin="round" />
        <path d="M-48 -76 Q-50 -26 0 -28 Q40 -28 42 -60 Q44 -86 26 -96 Q20 -60 -10 -74 Q-30 -84 -48 -76 Z" fill={c} stroke={ln(c)} strokeWidth="5" strokeLinejoin="round" />
        <circle cx={28} cy={-96} r={22} fill={c} stroke={ln(c)} strokeWidth="5" />
        <path d="M18 -116 q4 -14 12 -6 q6 -12 12 0 q8 -6 8 8 Z" fill={pal.comb} />
        <path d="M48 -98 L64 -92 L48 -86 Z" fill={pal.beak} stroke={ln(pal.beak!)} strokeWidth="3" strokeLinejoin="round" />
        <path d="M46 -84 q4 12 -4 14 q-6 -6 4 -14 Z" fill={pal.comb} />
        <Eye x={34} y={-100} r={4} ink={pal.ink!} />
        <path d="M-20 -60 Q0 -74 14 -54 Q-4 -44 -20 -60 Z" fill={ln(c, 0.06)} />
      </g>
    </g>
  );
}

function Chick({ x, y, t, pal, phase = 0 }: { x: number; y: number; t: number; pal: Palette; phase?: number }) {
  const hop = Math.max(0, Math.sin(t * 5 + phase)) * 6;
  return (
    <g transform={`translate(${x} ${y - hop})`}>
      <ellipse cx={0} cy={-14} rx={16} ry={14} fill={pal.chick} stroke={ln(pal.chick!)} strokeWidth="3" />
      <circle cx={10} cy={-30} r={10} fill={pal.chick} stroke={ln(pal.chick!)} strokeWidth="3" />
      <path d="M19 -31 L27 -28 L19 -25 Z" fill={pal.beak} />
      <circle cx={13} cy={-33} r={2.2} fill={pal.ink} />
    </g>
  );
}

function Pig({ x, y, s, t, pal, flip = 1 }: { x: number; y: number; s: number; t: number; pal: Palette; flip?: 1 | -1 }) {
  const c = pal.pig!;
  const wig = Math.sin(t * 2) * 3;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * flip} ${s})`}>
      {[-46, -18, 26, 50].map((lx) => (
        <rect key={lx} x={lx - 10} y={-40} width={20} height={40} rx={8} fill={pal.pigDark} stroke={ln(c)} strokeWidth="4" />
      ))}
      <path d={`M-76 -78 q-22 -6 -18 -24 q4 -12 14 -4 q6 8 -6 12`} stroke={ln(c)} strokeWidth="5" fill="none" strokeLinecap="round" transform={`rotate(${wig * 3} -76 -78)`} />
      <ellipse cx={0} cy={-74} rx={80} ry={52} fill={c} stroke={ln(c)} strokeWidth="5" />
      <path d="M-30 -40 Q-20 -24 -4 -40" fill={pal.mud} opacity={0.8} />
      <circle cx={-30} cy={-96} r={10} fill={pal.mud} opacity={0.6} />
      <g transform={`rotate(${wig} 60 -90)`}>
        <path d="M44 -132 L52 -160 L70 -132 Z M84 -130 L98 -156 L104 -124 Z" fill={pal.pigDark} stroke={ln(c)} strokeWidth="4" strokeLinejoin="round" />
        <circle cx={76} cy={-100} r={40} fill={c} stroke={ln(c)} strokeWidth="5" />
        <ellipse cx={110} cy={-92} rx={18} ry={22} fill={pal.pigDark} stroke={ln(c)} strokeWidth="4" />
        <ellipse cx={106} cy={-98} rx={3} ry={5} fill={ln(c, 0.45)} />
        <ellipse cx={114} cy={-86} rx={3} ry={5} fill={ln(c, 0.45)} />
        <Eye x={82} y={-118} r={5} ink={pal.ink!} />
        <circle cx={70} cy={-90} r={8} fill={pal.pigDark} opacity={0.8} />
      </g>
    </g>
  );
}

function Tractor({ x, y, s, t, pal, body }: { x: number; y: number; s: number; t: number; pal: Palette; body: string }) {
  const rumble = Math.sin(t * 9) * 1.2;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 1, 2].map((i) => {
        const p = (t * 0.5 + i / 3) % 1;
        return <circle key={i} cx={78 + p * 30} cy={-270 - p * 110} r={10 + p * 22} fill={pal.skyCloud} opacity={0.75 * (1 - p)} />;
      })}
      <g transform={`translate(0 ${rumble})`}>
        <rect x={70} y={-270} width={16} height={90} rx={6} fill={pal.wheel} />
        <path d="M-120 -170 V-300 Q-120 -312 -108 -312 H-10 Q2 -312 2 -300 V-170 Z" fill={pal.tractorCab} stroke={ln(pal.tractorCab!)} strokeWidth="6" strokeLinejoin="round" />
        <rect x={-100} y={-290} width={84} height={80} rx={12} fill={pal.glass} stroke={ln(pal.tractorCab!)} strokeWidth="5" />
        <path d="M-90 -280 L-70 -224" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity={0.7} />
        <path d="M-140 -60 V-170 H120 Q150 -170 150 -140 V-60 Z" fill={body} stroke={ln(body)} strokeWidth="6" strokeLinejoin="round" />
        <rect x={20} y={-150} width={110} height={14} rx={7} fill={ln(body, 0.12)} />
        <rect x={20} y={-124} width={110} height={14} rx={7} fill={ln(body, 0.12)} />
        <circle cx={150} cy={-112} r={10} fill={pal.tractorCab} />
      </g>
      <g transform={`translate(-70 -84) rotate(${t * 60})`}>
        <circle r={84} fill={pal.wheel} stroke={ln(pal.wheel!, 0.3)} strokeWidth="6" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect key={a} x={-8} y={-92} width={16} height={18} rx={4} fill={pal.wheel} transform={`rotate(${a})`} />
        ))}
        <circle r={40} fill={pal.hub} stroke={ln(pal.hub!)} strokeWidth="5" />
        <circle r={12} fill={ln(pal.hub!, 0.2)} />
      </g>
      <g transform={`translate(104 -46) rotate(${t * 110})`}>
        <circle r={46} fill={pal.wheel} stroke={ln(pal.wheel!, 0.3)} strokeWidth="5" />
        <circle r={22} fill={pal.hub} stroke={ln(pal.hub!)} strokeWidth="4" />
        <rect x={-4} y={-22} width={8} height={12} rx={3} fill={ln(pal.hub!, 0.2)} />
      </g>
    </g>
  );
}

function HayBale({ x, y, s, pal }: { x: number; y: number; s: number; pal: Palette }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-70} y={-110} width={110} height={110} rx={20} fill={pal.hay} stroke={pal.hayLine} strokeWidth="5" />
      <ellipse cx={40} cy={-55} rx={34} ry={55} fill={pal.hay} stroke={pal.hayLine} strokeWidth="5" />
      <path d="M40 -55 m-6 0 a6 6 0 1 1 12 0 a14 14 0 1 1 -26 0 a22 22 0 1 1 42 0" stroke={pal.hayLine} strokeWidth="4" fill="none" />
      <path d="M-50 -110 V0 M-20 -110 V0" stroke={pal.hayLine} strokeWidth="3" opacity={0.6} />
    </g>
  );
}

function Farm({ cam, t, pal, seed, uid, world }: P) {
  const sky = skyState(world);
  const tone = worldTone("farm", world);
  const winter = world.season === "winter";
  const k = glowK(world);
  const barn = seeded(seed, "barn", ["#E8574C", "#E8574C", "#D9604F", "#FF7A5C", "#5DA9FF"], pal.barn!, tone);
  const tractor = seeded(seed, "tractor", ["#4CB944", "#FF5E5B", "#3D8BFF", "#FF8A2A"], pal.tractor!, tone);
  const fields = [pal.field2!, pal.field1!, pal.hillFar!, pal.field3!];
  const cowX = 1180 + jitter(seed, "cow", 60);
  const sheepFlip = pick(seed, "sf", [1, -1] as const, 1);
  const farHill = (o: number) => `M-500 ${640 + o} Q 150 ${500 + o} 800 ${580 + o} T 2000 ${560 + o} T 2700 ${600 + o} V 1400 H -500 Z`;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-hill`}>
          <path d={farHill(0)} />
        </clipPath>
      </defs>
      <OutdoorSky cam={cam} t={t} pal={pal} seed={seed} uid={uid} world={world} sun={[1650, 160]} />
      <Layer cam={cam} depth={0.18}>
        <path d={farHill(0)} fill={pal.hillFar} stroke={ln(pal.hillFar!, 0.12)} strokeWidth="4" />
        {/* лоскутные поля: полосы по склону, между ними живые изгороди */}
        <g clipPath={`url(#${uid}-hill)`}>
          {[34, 78, 128, 186].map((o, i) => (
            <path key={i} d={farHill(o)} fill={winter ? shade(pal.hillFar!, 0.03 * (i % 2)) : fields[i]} />
          ))}
          {[34, 78, 128, 186].map((o) => (
            <path key={`e${o}`} d={farHill(o).split(" V")[0]} stroke={pal.bush1} strokeWidth="7" fill="none" />
          ))}
          {[-260, 180, 560, 1020, 1380, 1880, 2280].map((hx, i) => (
            <path key={`v${i}`} d={`M${hx} 480 Q${hx + 30} 640 ${hx + 6} 900`} stroke={pal.bush1} strokeWidth="7" fill="none" />
          ))}
          {!winter
            ? Array.from({ length: 16 }, (_, i) => (
                <path key={`r${i}`} d={`M${-440 + i * 200} ${634 + (i % 2) * 12} q50 -5 100 0`} stroke={shade(pal.field1!, 0.12)} strokeWidth="4" fill="none" opacity={0.55} strokeLinecap="round" />
              ))
            : null}
        </g>
        {[-120, 980, 1240, 2160].map((tx, i) => (
          <RoundTree key={tx} x={tx} y={[600, 594, 590, 610][i]!} s={0.3} c={pal.leafFar!} pal={pal} t={t} wind={sky.wind} snow={winter} />
        ))}
        {/* мельница */}
        <g transform="translate(1530 592)">
          <path d="M-40 0 L-26 -170 H26 L40 0 Z" fill={pal.windmill} stroke={ln(pal.windmill!)} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-34 -166 Q0 -214 34 -166 Z" fill={pal.barnRoof} stroke={ln(pal.barnRoof!)} strokeWidth="4" />
          <rect x={-12} y={-40} width={24} height={40} rx={12} fill={pal.barnRoof} />
          <circle cx={0} cy={-110} r={10} fill={pal.glass} stroke={ln(pal.windmill!)} strokeWidth="3" />
          {winter ? <SnowStrip x={-38} y={-196} w={76} h={12} /> : null}
          <g transform={`translate(0 -170) rotate(${t * 22 * sky.wind})`}>
            {[0, 90, 180, 270].map((a) => (
              <g key={a} transform={`rotate(${a})`}>
                <rect x={-5} y={-120} width={10} height={120} fill={ln(pal.windmill!)} />
                <rect x={5} y={-116} width={30} height={84} rx={4} fill={pal.blade} stroke={ln(pal.blade!)} strokeWidth="3" />
              </g>
            ))}
            <circle r={12} fill={pal.windmill} stroke={ln(pal.windmill!)} strokeWidth="4" />
          </g>
        </g>
      </Layer>
      <Layer cam={cam} depth={0.5}>
        <path d="M-500 790 Q 300 690 1000 760 T 2700 750 V 1400 H -500 Z" fill={pal.hillMid} />
        {/* амбар и силосная башня */}
        <g transform="translate(250 800)">
          <rect x={250} y={-330} width={110} height={330} rx={20} fill={pal.silo} stroke={ln(pal.silo!)} strokeWidth="6" />
          <path d="M250 -322 Q305 -400 360 -322 Z" fill={pal.siloTop} stroke={ln(pal.siloTop!)} strokeWidth="6" />
          {[-250, -170, -90].map((sy) => (
            <path key={sy} d={`M252 ${sy} H358`} stroke={ln(pal.silo!, 0.12)} strokeWidth="4" />
          ))}
          {winter ? <path d="M246 -322 Q305 -404 364 -322 Q330 -340 305 -334 Q280 -340 246 -322 Z" fill="#FFFFFF" /> : null}
          <path d="M-190 0 V-210 L-150 -300 L0 -360 L150 -300 L190 -210 V0 Z" fill={barn} stroke={ln(barn)} strokeWidth="6" strokeLinejoin="round" />
          <path d="M-206 -206 L-160 -312 L0 -378 L160 -312 L206 -206" stroke={pal.barnRoof} strokeWidth="26" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {winter ? <path d="M-212 -214 L-164 -322 L0 -390 L164 -322 L212 -214 Q190 -230 160 -296 L0 -360 L-160 -296 Q-190 -230 -212 -214 Z" fill="#FFFFFF" stroke="#D6E4F0" strokeWidth="3" strokeLinejoin="round" /> : null}
          {/* сеновал */}
          <rect x={-46} y={-286} width={92} height={80} rx={8} fill={k ? pal.glowWindow : pal.barnDark} stroke={pal.barnTrim} strokeWidth="8" />
          {!k ? <path d="M-40 -212 q10 -26 20 -6 q8 -22 18 -4 q10 -24 20 -2 q8 -18 20 0 Z" fill={pal.hay} /> : null}
          {k ? <rect x={-80} y={-320} width={160} height={150} rx={40} fill={pal.glowWindow} opacity={0.18 * k} /> : null}
          {/* ворота */}
          <rect x={-110} y={-170} width={220} height={170} fill={pal.barnDark} stroke={pal.barnTrim} strokeWidth="10" />
          <path d="M0 -170 V0 M-110 -170 L0 0 M0 -170 L-110 0 M110 -170 L0 0 M0 -170 L110 0" stroke={pal.barnTrim} strokeWidth="9" />
          <path d="M-190 -200 H190" stroke={pal.barnTrim} strokeWidth="8" />
          {/* флюгер-петушок */}
          <path d="M0 -380 V-440" stroke={pal.wheel} strokeWidth="5" />
          <path d="M-18 -440 Q-20 -462 0 -460 Q6 -476 18 -466 L14 -452 L26 -446 Q16 -432 -18 -440 Z" fill={pal.wheel} />
        </g>
        <Tractor x={810} y={796} s={0.6} t={t} pal={pal} body={tractor} />
        {winter ? null : (
          <>
            <Cow x={cowX} y={776} s={0.7} t={t} pal={pal} />
            <Sheep x={1370} y={784} s={0.62} t={t} pal={pal} flip={sheepFlip} />
            <Sheep x={1580} y={792} s={0.55} t={t + 2} pal={pal} flip={-1} />
          </>
        )}
        {winter ? <SnowDrifts y={800} seed={seed + 5} from={-400} to={2400} /> : null}
      </Layer>
      <Layer cam={cam} depth={0.8}>
        <rect x={-700} y={GROUND - 112} width={3400} height={300} fill={pal.grassMid} />
        {/* деревянный забор — низкий, животные видны поверх */}
        {Array.from({ length: 30 }, (_, i) => -600 + i * 120).map((fx) => (
          <rect key={fx} x={fx - 10} y={GROUND - 176} width={20} height={78} rx={6} fill={pal.fence} stroke={ln(pal.fence!)} strokeWidth="4" />
        ))}
        <rect x={-700} y={GROUND - 162} width={3400} height={14} rx={7} fill={pal.fence} stroke={ln(pal.fence!)} strokeWidth="4" />
        <rect x={-700} y={GROUND - 130} width={3400} height={14} rx={7} fill={pal.fence} stroke={ln(pal.fence!)} strokeWidth="4" />
        {winter ? Array.from({ length: 30 }, (_, i) => -600 + i * 120).map((fx) => <ellipse key={fx} cx={fx} cy={GROUND - 178} rx={14} ry={6} fill="#FFFFFF" />) : null}
        {winter ? <SnowStrip x={-700} y={GROUND - 170} w={3400} h={10} /> : null}
      </Layer>
      <Layer cam={cam} depth={0.9}>
        {/* тюки сена у амбара */}
        <HayBale x={140} y={GROUND - 30} s={0.9} pal={pal} />
        <HayBale x={262} y={GROUND - 24} s={0.8} pal={pal} />
        <HayBale x={196} y={GROUND - 118} s={0.8} pal={pal} />
        {winter ? <SnowStrip x={140} y={GROUND - 212} w={96} h={12} /> : null}
        {/* курочки с цыплятами и свинка в луже */}
        {world.weather === "rain" && !winter ? null : (
          <>
            <Hen x={1530} y={GROUND - 46} s={0.75} t={t} pal={pal} />
            <Hen x={1640} y={GROUND - 40} s={0.7} t={t} pal={pal} flip={-1} phase={0.4} />
            <Chick x={1590} y={GROUND - 30} t={t} pal={pal} />
            <Chick x={1616} y={GROUND - 26} t={t} pal={pal} phase={1.6} />
          </>
        )}
        {!winter ? (
          <g>
            <ellipse cx={1810} cy={GROUND - 14} rx={150} ry={28} fill={pal.mud} />
            <ellipse cx={1790} cy={GROUND - 20} rx={90} ry={12} fill={shade(pal.mud!, -0.12)} />
            <Pig x={1810} y={GROUND - 10} s={0.62} t={t} pal={pal} flip={-1} />
          </g>
        ) : null}
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-700} y={GROUND - 10} width={3400} height={H} fill={pal.grass} />
        <path d={`M-700 ${GROUND + 34} Q 300 ${GROUND + 10} 960 ${GROUND + 30} T 2700 ${GROUND + 24} V ${GROUND + 92} Q 1500 ${GROUND + 110} 960 ${GROUND + 92} T -700 ${GROUND + 100} Z`} fill={pal.path} stroke={pal.pathEdge} strokeWidth="4" />
        <Tufts from={-600} to={2600} step={92} y={GROUND + 4} c={pal.grassBlade!} />
        {skyState(world).flowers
          ? [120, 380, 1540, 1880].map((fx, i) => (
              <g key={fx} transform={`translate(${fx + jitter(seed, `fl${i}`, 40)} ${GROUND + 6}) rotate(${Math.sin(t * 2 + fx) * 4})`}>
                <path d="M0 0 V-30" stroke={pal.stem} strokeWidth="5" />
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse key={a} cx={0} cy={-42} rx={7} ry={11} fill={[pal.flower1, pal.flower2, pal.flower3][i % 3]} transform={`rotate(${a} 0 -30)`} />
                ))}
                <circle cx={0} cy={-30} r={6} fill={pal.flowerCenter} />
              </g>
            ))
          : null}
        {winter ? <SnowDrifts y={GROUND + 110} seed={seed + 3} /> : null}
        {world.season === "autumn" ? <FallenLeaves y={GROUND + 20} seed={seed + 4} n={18} /> : null}
        {world.weather === "rain" ? <Puddles xs={[-120, 640, 1300, 2100]} y={GROUND + 60} t={t} /> : null}
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ парк с прудом */
function Duck({ x, y, s, t, pal, dir, baby = false }: { x: number; y: number; s: number; t: number; pal: Palette; dir: number; baby?: boolean }) {
  const bob = Math.sin(t * 2.4 + x * 0.05) * 3;
  const c = baby ? pal.duckling! : pal.duck!;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s * (dir >= 0 ? 1 : -1)} ${s})`}>
      <ellipse cx={0} cy={6} rx={44} ry={6} fill={pal.waterFoam} opacity={0.6} />
      <path d="M-36 -12 L-52 -30 L-26 -24 Z" fill={c} stroke={ln(c)} strokeWidth="4" strokeLinejoin="round" />
      <path d="M-40 -10 Q-40 6 0 6 Q38 6 40 -12 Q34 -30 0 -28 Q-36 -30 -40 -10 Z" fill={c} stroke={ln(c)} strokeWidth="4" />
      <circle cx={28} cy={-42} r={19} fill={baby ? c : pal.duckHead} stroke={ln(baby ? c : pal.duckHead!)} strokeWidth="4" />
      {!baby ? <path d="M14 -26 Q28 -20 40 -26" stroke={pal.duck} strokeWidth="5" fill="none" /> : null}
      <path d="M44 -44 Q62 -42 60 -34 Q50 -30 42 -36 Z" fill={pal.beak} stroke={ln(pal.beak!)} strokeWidth="3" strokeLinejoin="round" />
      <Eye x={33} y={-47} r={4} ink={pal.ink!} />
      <path d="M-18 -14 Q0 -24 12 -8 Q-2 0 -18 -14 Z" fill={ln(c, 0.08)} />
    </g>
  );
}

function ParkPond({ cam, t, pal, seed, uid, world }: P) {
  const sky = skyState(world);
  const tone = worldTone("park_pond", world);
  const winter = world.season === "winter";
  const k = glowK(world);
  const bench = seeded(seed, "bench", ["#D08C4E", "#3D8BFF", "#4CB944", "#FF5E5B"], pal.bench!, tone);
  const ice = winter;
  const water = ice ? pal.water! : pal.water!;
  const deep = ice ? shade(pal.water!, 0.05) : pal.waterDeep!;
  const ducksOut = !winter && world.time !== "night";
  // утки плавают туда-обратно по пруду
  const dx = Math.sin(t * 0.12 + jitter(seed, "dk", 2)) * 380;
  const dir = Math.cos(t * 0.12 + jitter(seed, "dk", 2));
  const pond = "M390 796 Q430 740 720 734 Q1020 728 1260 742 Q1410 752 1480 776 Q1600 792 2700 786 V836 Q1600 840 1480 848 Q1300 878 900 874 Q520 872 430 852 Q360 830 390 796 Z";
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-pond`}>
          <path d={pond} />
        </clipPath>
      </defs>
      <OutdoorSky cam={cam} t={t} pal={pal} seed={seed} uid={uid} world={world} sun={[1560, 170]} />
      <Layer cam={cam} depth={0.18}>
        <path d="M-500 720 Q 200 600 800 680 T 2700 670 V 1400 H -500 Z" fill={pal.hillFar} />
        {/* дальняя полоса деревьев */}
        {Array.from({ length: 14 }, (_, i) => {
          const x = -420 + i * 230 + jitter(seed, `ft${i}`, 40);
          const y = 700 - ((i * 53) % 40);
          const r = 46 + ((i * 29) % 24);
          return (
            <g key={i}>
              <rect x={x - 6} y={y - 30} width={12} height={40} fill={pal.trunk} />
              <circle cx={x} cy={y - r} r={r} fill={pal.leafFar} stroke={ln(pal.leafFar!, 0.22)} strokeWidth="4" />
              {winter ? <ellipse cx={x} cy={y - r * 1.8} rx={r * 0.6} ry={10} fill="#FFFFFF" /> : null}
            </g>
          );
        })}
      </Layer>
      <Layer cam={cam} depth={0.45}>
        <path d="M-500 790 Q 300 700 1000 750 T 2700 740 V 1400 H -500 Z" fill={pal.hillMid} />
        <RoundTree x={330} y={772} s={0.78} c={pal.leaf!} pal={pal} t={t} wind={sky.wind} snow={winter} dots={pal.fruit} />
        <RoundTree x={1590} y={762} s={0.7} c={pal.leaf!} pal={pal} t={t + 1} wind={sky.wind} snow={winter} dots={pal.fruit} />
        {[-80, 700, 1180, 2000].map((bx, i) => (
          <g key={bx} transform={`translate(${bx} ${768 - (i % 2) * 10})`}>
            <circle cx={0} cy={0} r={44} fill={pal.bush1} stroke={pal.bushLine} strokeWidth="4" />
            <circle cx={44} cy={8} r={34} fill={pal.bush2} stroke={pal.bushLine} strokeWidth="4" />
            <circle cx={20} cy={4} r={34} fill={pal.bush1} />
            {winter ? <path d="M-44 -6 Q-20 -54 20 -42 Q60 -46 78 0 Q40 -20 10 -18 Q-20 -24 -44 -6 Z" fill="#FFFFFF" /> : null}
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.75}>
        <rect x={-700} y={772} width={3400} height={400} fill={pal.grassMid} />
        {/* пруд и ручей под мостиком */}
        <path d={pond} fill={water} stroke={ln(pal.grassMid!, 0.15)} strokeWidth="6" />
        <g clipPath={`url(#${uid}-pond)`}>
          <ellipse cx={920} cy={810} rx={480} ry={44} fill={deep} />
          {sky.sun || sky.moon ? <ellipse cx={1200} cy={770} rx={40} ry={10} fill={sky.moon ? "#FFF3B0" : "#FFFFFF"} opacity={0.6} /> : null}
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M${wrap(i * 330 + t * (ice ? 0 : 24), 2600) - 300} ${776 + (i % 3) * 26} h${ice ? 90 : 50}`} stroke={pal.waterFoam} strokeWidth={ice ? 6 : 5} strokeLinecap="round" opacity={ice ? 0.9 : 0.75} />
          ))}
          {!ice ? (
            <g>
              {[[560, 846], [780, 760], [1200, 852]].map(([lx, ly], i) => (
                <g key={i} transform={`translate(${lx} ${ly! + Math.sin(t + i) * 2})`}>
                  <path d="M0 0 m-34 0 a34 12 0 1 0 68 0 a34 12 0 1 0 -68 0 M0 0 L30 -6 L26 6 Z" fill={pal.lily} stroke={ln(pal.lily!)} strokeWidth="3" />
                  {i === 0 && sky.flowers ? (
                    <g transform="translate(-4 -6)">
                      {[-30, 0, 30].map((a) => (
                        <ellipse key={a} cx={0} cy={-10} rx={6} ry={13} fill={pal.lilyFlower} transform={`rotate(${a} 0 0)`} />
                      ))}
                    </g>
                  ) : null}
                </g>
              ))}
            </g>
          ) : null}
        </g>
        {ducksOut ? (
          <g>
            <Duck x={900 + dx} y={804} s={0.85} t={t} pal={pal} dir={dir} />
            {[1, 2, 3].map((i) => (
              <Duck key={i} x={900 + dx - dir * (i * 70 + 24)} y={808 + (i % 2) * 6} s={0.46} t={t + i * 0.6} pal={pal} dir={dir} baby />
            ))}
            <Duck x={1100 - dx * 0.5} y={842} s={0.72} t={t + 2} pal={pal} dir={-dir} />
          </g>
        ) : null}
        {/* камыши */}
        {[[400, 800], [450, 826], [1410, 772], [1460, 788]].map(([rx, ry], i) => (
          <g key={i} transform={`translate(${rx} ${ry}) rotate(${Math.sin(t * 1.4 + i) * 3 * sky.wind})`}>
            <path d="M0 0 Q-6 -60 2 -110 M10 0 Q16 -50 24 -80 M-8 0 Q-24 -40 -30 -70" stroke={pal.reed} strokeWidth="6" fill="none" strokeLinecap="round" />
            {!winter ? <rect x={-4} y={-140} width={13} height={40} rx={6} fill={pal.cattail} /> : null}
          </g>
        ))}
        {/* деревянный мостик через ручей */}
        <g transform="translate(1690 846)">
          {[-180, -120, -60, 0, 60, 120, 180].map((px) => {
            const u = (px + 230) / 460;
            const deck = 2 * u * (1 - u) * -200;
            const v = (px + 220) / 440;
            const rail = -70 + 2 * v * (1 - v) * -200;
            return <rect key={px} x={px - 7} y={rail} width={14} height={deck - rail + 4} rx={5} fill={pal.bridgeRail} stroke={ln(pal.bridgeRail!)} strokeWidth="3" />;
          })}
          <path d="M-230 0 Q0 -200 230 0 L206 14 Q0 -164 -206 14 Z" fill={pal.bridge} stroke={ln(pal.bridge!)} strokeWidth="6" strokeLinejoin="round" />
          {[-150, -90, -30, 30, 90, 150].map((px) => {
            const u = (px + 230) / 460;
            const y = 2 * u * (1 - u) * -200;
            return <path key={px} d={`M${px} ${y + 2} l${-px * 0.04} 14`} stroke={ln(pal.bridge!, 0.18)} strokeWidth="4" strokeLinecap="round" />;
          })}
          <path d="M-220 -70 Q0 -270 220 -70" stroke={pal.bridgeRail} strokeWidth="16" fill="none" strokeLinecap="round" />
          {[-222, 222].map((ex) => (
            <g key={ex}>
              <rect x={ex - 10} y={-84} width={20} height={88} rx={6} fill={pal.bridgeRail} stroke={ln(pal.bridgeRail!)} strokeWidth="4" />
              <circle cx={ex} cy={-88} r={13} fill={pal.bridgeRail} stroke={ln(pal.bridgeRail!)} strokeWidth="4" />
            </g>
          ))}
          {winter ? <path d="M-224 -78 Q0 -280 224 -78" stroke="#FFFFFF" strokeWidth="9" fill="none" strokeLinecap="round" /> : null}
        </g>
      </Layer>
      <Layer cam={cam} depth={0.95}>
        {/* лавочка */}
        <g transform={`translate(190 ${GROUND - 30})`}>
          <path d="M-130 0 V-70 M130 0 V-70" stroke={pal.benchMetal} strokeWidth="12" strokeLinecap="round" />
          <rect x={-160} y={-82} width={320} height={22} rx={8} fill={bench} stroke={ln(bench)} strokeWidth="4" />
          <rect x={-160} y={-170} width={320} height={22} rx={8} fill={bench} stroke={ln(bench)} strokeWidth="4" />
          <rect x={-160} y={-136} width={320} height={22} rx={8} fill={bench} stroke={ln(bench)} strokeWidth="4" />
          <path d="M-140 -60 V-176 M140 -60 V-176" stroke={pal.benchMetal} strokeWidth="10" strokeLinecap="round" />
          {winter ? <SnowStrip x={-162} y={-186} w={324} h={12} /> : null}
        </g>
        {/* фонарь */}
        <g transform={`translate(1630 ${GROUND - 24})`}>
          <Glow id={`${uid}-g1`} x={0} y={-430} r={260} t={t} k={k} color={pal.glowLamp!} />
          <rect x={-9} y={-410} width={18} height={410} rx={8} fill={pal.lampPost} stroke={ln(pal.lampPost!)} strokeWidth="3" />
          <rect x={-26} y={-20} width={52} height={22} rx={8} fill={pal.lampPost} />
          <path d="M-34 -400 H34 L26 -470 H-26 Z" fill={k ? pal.glowLamp : pal.lampGlass} stroke={pal.lampPost} strokeWidth="6" strokeLinejoin="round" />
          <path d="M-42 -470 H42 L0 -506 Z" fill={pal.lampPost} stroke={ln(pal.lampPost!)} strokeWidth="3" strokeLinejoin="round" />
          {winter ? <path d="M-40 -472 L0 -512 L40 -472 Q20 -482 0 -478 Q-20 -482 -40 -472 Z" fill="#FFFFFF" /> : null}
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-700} y={GROUND - 10} width={3400} height={H} fill={pal.grass} />
        <path d={`M-700 ${GROUND + 26} Q 300 ${GROUND + 4} 960 ${GROUND + 22} T 2700 ${GROUND + 16} V ${GROUND + 86} Q 1500 ${GROUND + 104} 960 ${GROUND + 88} T -700 ${GROUND + 96} Z`} fill={pal.path} stroke={pal.pathEdge} strokeWidth="4" />
        {[120, 420, 860, 1300, 1720].map((sx, i) => (
          <ellipse key={sx} cx={sx + jitter(seed, `st${i}`, 40)} cy={GROUND + 54 + (i % 2) * 12} rx={22} ry={8} fill={pal.stone} opacity={0.7} />
        ))}
        <Tufts from={-600} to={2600} step={96} y={GROUND - 6} c={pal.grassBlade!} rows={1} />
        {sky.flowers
          ? [-60, 470, 1450, 1860].map((fx, i) => (
              <g key={fx} transform={`translate(${fx + jitter(seed, `pf${i}`, 40)} ${GROUND - 14}) rotate(${Math.sin(t * 2 + fx) * 4})`}>
                <path d="M0 0 V-30" stroke={pal.stem} strokeWidth="5" />
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse key={a} cx={0} cy={-42} rx={7} ry={11} fill={pick(seed, `pc${i}`, [pal.flower1!, pal.flower3!, pal.flower4!], [pal.flower1!, pal.flower4!, pal.flower3!, pal.flower2!][i]!)} transform={`rotate(${a} 0 -30)`} />
                ))}
                <circle cx={0} cy={-30} r={6} fill={pal.flowerCenter} />
              </g>
            ))
          : null}
        {winter ? <SnowDrifts y={GROUND + 110} seed={seed + 3} /> : null}
        {world.season === "autumn" ? <FallenLeaves y={GROUND + 10} seed={seed + 4} n={20} /> : null}
        {world.weather === "rain" ? <Puddles xs={[-160, 560, 1380, 2100]} y={GROUND + 60} t={t} /> : null}
        <Fireflies world={world} t={t} seed={seed} top={560} bottom={880} />
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ снежная горка */
function SnowyHill({ cam, t, pal, seed, uid, world }: P) {
  const sky = skyState(world);
  const tone = worldTone("snowy_hill", world);
  const k = glowK(world);
  const scarf = seeded(seed, "scarf", BRIGHT, pal.scarf!, tone);
  const sled = seeded(seed, "sled", ["#FF4D5A", "#3D8BFF", "#FF8A2A", "#8E5CFF"], pal.sled!, tone);
  const flagWave = Math.sin(t * 3 * sky.wind) * 6;
  const hill = "M-500 600 Q -150 450 380 440 Q 760 432 1020 620 Q 1240 790 1560 830 Q 2000 862 2700 850 V 1400 H -500 Z";
  return (
    <g>
      <OutdoorSky cam={cam} t={t} pal={pal} seed={seed} uid={uid} world={world} sun={[1180, 140]} clouds={2} />
      <Layer cam={cam} depth={0.08}>
        {/* горы со снежными вершинами */}
        {[
          [-120, 330, 560],
          [420, 250, 620],
          [1000, 300, 560],
          [1560, 230, 640],
          [2160, 310, 560],
        ].map(([mx, my, mw], i) => (
          <g key={i}>
            <path d={`M${mx! - mw! / 2} 720 L${mx} ${my} L${mx! + mw! / 2} 720 Z`} fill={pal.mountain} stroke={ln(pal.mountain!, 0.18)} strokeWidth="5" strokeLinejoin="round" />
            <path d={`M${mx} ${my} L${mx! + mw! / 2} 720 H${mx! + 40} Z`} fill={pal.mountainShade} />
            <path d={`M${mx! - mw! * 0.16} ${my! + 108} L${mx} ${my} L${mx! + mw! * 0.16} ${my! + 108} L${mx! + mw! * 0.08} ${my! + 92} L${mx! + 10} ${my! + 116} L${mx! - mw! * 0.06} ${my! + 90} Z`} fill={pal.peak} strokeLinejoin="round" />
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.25}>
        <path d="M-500 700 Q 100 610 700 660 T 1900 630 T 2700 660 V 1400 H -500 Z" fill={pal.snowFar} stroke={pal.snowLine} strokeWidth="4" />
        {[1180, 1290, 1880, 1990, 2300].map((px, i) => (
          <Pine key={px} x={px} y={664 - (i % 2) * 14} s={0.32} c={pal.pineFar!} pal={pal} t={t} wind={sky.wind} snow />
        ))}
        {/* домик с дымом */}
        <g transform="translate(1600 648)">
          {[0, 1, 2, 3].map((i) => {
            const p = (t * 0.25 + i / 4) % 1;
            return <circle key={i} cx={58 + Math.sin(p * 6 + i) * 14 + p * 40 * sky.wind} cy={-176 - p * 170} r={12 + p * 26} fill={pal.smoke} opacity={0.8 * (1 - p)} />;
          })}
          <rect x={46} y={-190} width={26} height={60} fill={pal.cabinLog} stroke={ln(pal.cabinLog!)} strokeWidth="4" />
          <rect x={-100} y={-110} width={200} height={110} rx={6} fill={pal.cabin} stroke={ln(pal.cabin!)} strokeWidth="5" />
          {[-84, -58, -32].map((ly) => (
            <path key={ly} d={`M-100 ${ly + 0} H100`} stroke={pal.cabinLog} strokeWidth="5" opacity={0.8} />
          ))}
          <path d="M-126 -100 L0 -186 L126 -100 Z" fill={pal.cabinRoof} stroke={ln(pal.cabinRoof!)} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-136 -96 L0 -196 L136 -96 Q120 -84 104 -100 L0 -170 L-104 -100 Q-120 -84 -136 -96 Z" fill={pal.snow} stroke={pal.snowLine} strokeWidth="3" strokeLinejoin="round" />
          <rect x={-74} y={-80} width={50} height={44} rx={6} fill={k ? pal.glowWindow : pal.glass} stroke={pal.cabinLog} strokeWidth="5" />
          <path d="M-49 -80 V-36 M-74 -58 H-24" stroke={pal.cabinLog} strokeWidth="4" />
          <rect x={20} y={-70} width={48} height={70} rx={20} fill={pal.cabinDoor} stroke={ln(pal.cabinDoor!)} strokeWidth="4" />
          <Glow id={`${uid}-g1`} x={-49} y={-58} r={110} t={t} k={k} color={pal.glowWindow!} />
          <path d="M-110 0 Q0 -14 110 0 Q60 10 0 8 Q-60 10 -110 0 Z" fill={pal.snow} />
        </g>
      </Layer>
      <Layer cam={cam} depth={0.5}>
        {/* горка для санок */}
        <path d={hill} fill={pal.snowMid} stroke={pal.snowLine} strokeWidth="5" />
        <path d="M420 446 Q 780 452 1010 630 Q 1230 800 1600 840 Q 1180 830 950 670 Q 760 520 420 446 Z" fill={pal.snowShade} opacity={0.5} />
        {/* следы санок по склону */}
        <path d="M470 452 Q 800 470 1000 640 Q 1180 790 1560 846" stroke={pal.snowShade} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M440 462 Q 770 486 970 654 Q 1150 806 1520 866" stroke={pal.snowShade} strokeWidth="7" fill="none" strokeLinecap="round" />
        <g transform="translate(360 442)">
          <path d="M0 0 V-120" stroke={pal.pole} strokeWidth="7" strokeLinecap="round" />
          <path d={`M3 -118 Q40 ${-110 + flagWave} 74 ${-100 + flagWave * 0.5} Q40 ${-92 + flagWave} 3 -78 Z`} fill={pal.flag} stroke={ln(pal.flag!)} strokeWidth="3" strokeLinejoin="round" />
        </g>
        {[-170, 30, 150].map((px, i) => (
          <Pine key={px} x={px} y={[560, 474, 470][i]!} s={[0.55, 0.48, 0.42][i]!} c={pal.pine!} pal={pal} t={t} wind={sky.wind} snow />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.85}>
        <path d={`M-700 ${GROUND - 100} Q 200 ${GROUND - 130} 900 ${GROUND - 104} T 2700 ${GROUND - 110} V 1400 H -700 Z`} fill={pal.snowMid} stroke={pal.snowLine} strokeWidth="4" />
        <Pine x={-60} y={GROUND - 96} s={0.82} c={pal.pine!} pal={pal} t={t} wind={sky.wind} snow />
        <Pine x={1960} y={GROUND - 100} s={0.86} c={pal.pine!} pal={pal} t={t + 1} wind={sky.wind} snow />
        {/* санки у подножия горки */}
        <g transform={`translate(1460 ${GROUND - 88}) scale(0.85)`}>
          <path d="M-90 0 H80 Q110 0 110 -26" stroke={pal.sledRunner} strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d="M-60 0 V-24 M40 0 V-24" stroke={pal.sledRunner} strokeWidth="7" />
          <rect x={-90} y={-46} width={180} height={24} rx={10} fill={sled} stroke={ln(sled)} strokeWidth="5" />
          <path d="M100 -30 Q150 -50 170 -6" stroke={pal.pole} strokeWidth="4" fill="none" />
        </g>
        {/* снеговик */}
        <g transform={`translate(190 ${GROUND - 96})`}>
          <path d="M-40 -170 L-110 -214 M-110 -214 l-10 -16 M-110 -214 l-18 0 M40 -170 L104 -220 M104 -220 l4 -18 M104 -220 l18 2" stroke={pal.pole} strokeWidth="6" strokeLinecap="round" />
          <circle cx={0} cy={-62} r={70} fill={pal.snow} stroke={pal.snowLine} strokeWidth="5" />
          <circle cx={0} cy={-170} r={52} fill={pal.snow} stroke={pal.snowLine} strokeWidth="5" />
          <circle cx={0} cy={-254} r={40} fill={pal.snow} stroke={pal.snowLine} strokeWidth="5" />
          <path d="M-44 -212 Q0 -194 44 -212 L40 -196 Q0 -180 -40 -196 Z" fill={scarf} stroke={ln(scarf)} strokeWidth="3" />
          <path d="M20 -200 L34 -150 L50 -156 L34 -202 Z" fill={scarf} stroke={ln(scarf)} strokeWidth="3" strokeLinejoin="round" />
          <path d="M-6 -252 L40 -244 L-6 -238 Z" fill={pal.carrot} stroke={ln(pal.carrot!)} strokeWidth="3" strokeLinejoin="round" />
          <circle cx={-14} cy={-266} r={6} fill={pal.coal} />
          <circle cx={14} cy={-266} r={6} fill={pal.coal} />
          {[-16, -6, 6, 16].map((mx, i) => (
            <circle key={mx} cx={mx} cy={-228 + (i === 0 || i === 3 ? -4 : 0)} r={3.5} fill={pal.coal} />
          ))}
          {[-150, -120, -84].map((by) => (
            <circle key={by} cx={0} cy={by} r={6} fill={pal.coal} />
          ))}
          <path d="M-36 -286 H36 V-298 H-36 Z M-24 -298 V-336 H24 V-298" fill={scarf} stroke={ln(scarf)} strokeWidth="4" strokeLinejoin="round" />
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <path d={`M-700 ${GROUND - 30} Q 400 ${GROUND - 50} 960 ${GROUND - 34} T 2700 ${GROUND - 40} V 1400 H -700 Z`} fill={pal.snow} />
        {[[-200, 70], [380, 110], [820, 60], [1320, 120], [1880, 80]].map(([sx, sy], i) => (
          <path key={i} d={`M${sx! - 160} ${GROUND + sy!} q160 -30 320 0`} stroke={pal.snowShade} strokeWidth="8" fill="none" strokeLinecap="round" />
        ))}
        {/* следы */}
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx={1360 + i * 64} cy={GROUND + 40 + (i % 2) * 22} rx={13} ry={7} fill={pal.snowShade} />
        ))}
        {/* искорки на снегу */}
        {Array.from({ length: 7 }, (_, i) => {
          const tw = Math.max(0, Math.sin(t * 2.4 + i * 1.9));
          const x = -100 + rnd(seed, `sp${i}`) * 2100;
          const y = GROUND + 20 + rnd(seed, `spy${i}`) * 120;
          return <path key={i} d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z" transform={`translate(${x} ${y}) scale(${0.6 + tw * 0.8})`} fill="#FFFFFF" opacity={tw} />;
        })}
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ поход с палаткой */
function Campfire({ x, y, t, pal, world, uid }: { x: number; y: number; t: number; pal: Palette; world: WorldState; uid: string }) {
  const k = glowK(world);
  const f = (i: number) => 1 + Math.sin(t * (7 + i) + i * 2) * 0.08;
  const lean = Math.sin(t * 3.1) * 6 * skyState(world).wind;
  return (
    <g transform={`translate(${x} ${y})`}>
      {k ? (
        <g>
          <Glow id={`${uid}-fireg`} x={0} y={0} r={420} ry={110} t={t * 2.5} k={k * 0.9} color={pal.glowFire2!} />
          <Glow id={`${uid}-firea`} x={0} y={-100} r={340} t={t * 3} k={k * 0.7} color={pal.glowFire3!} />
        </g>
      ) : (
        [0, 1, 2].map((i) => {
          const p = (t * 0.3 + i / 3) % 1;
          return <circle key={i} cx={Math.sin(p * 5 + i) * 18 + p * 40} cy={-150 - p * 260} r={14 + p * 30} fill="#F2F4FA" opacity={0.55 * (1 - p)} />;
        })
      )}
      <path d="M-90 -14 L80 -54 M-80 -54 L90 -14" stroke={pal.log} strokeWidth="26" strokeLinecap="round" />
      <circle cx={84} cy={-54} r={13} fill={pal.logEnd} />
      <circle cx={94} cy={-14} r={13} fill={pal.logEnd} />
      <g transform={`skewX(${lean})`}>
        <path d={`M-70 -30 Q-80 -110 -30 -150 Q-34 -110 0 ${-200 * f(0)} Q30 -120 34 -150 Q80 -110 70 -30 Z`} fill={pal.glowFire1} />
        <path d={`M-50 -30 Q-56 -90 -16 -120 Q-10 -90 4 ${-160 * f(1)} Q26 -100 30 -116 Q60 -80 50 -30 Z`} fill={pal.glowFire2} />
        <path d={`M-28 -30 Q-30 -70 0 ${-110 * f(2)} Q30 -70 28 -30 Z`} fill={pal.glowFire3} />
      </g>
      {Array.from({ length: 6 }, (_, i) => {
        const p = (t * 0.6 + i / 6) % 1;
        return <circle key={i} cx={Math.sin(t * 2 + i * 2) * 30 + (i - 3) * 8} cy={-120 - p * 200} r={4 - p * 2} fill={pal.glowFire3} opacity={1 - p} />;
      })}
      {[-110, -66, -20, 26, 72, 116].map((sx, i) => (
        <ellipse key={sx} cx={sx} cy={-8 + (i === 0 || i === 5 ? -10 : 0)} rx={30} ry={18} fill={i % 2 ? pal.stone : pal.stoneShade} stroke={ln(pal.stone!, 0.25)} strokeWidth="4" />
      ))}
      {[-88, -44, 0, 44, 88].map((sx, i) => (
        <ellipse key={`f${sx}`} cx={sx} cy={12} rx={30} ry={18} fill={i % 2 ? pal.stoneShade : pal.stone} stroke={ln(pal.stone!, 0.25)} strokeWidth="4" />
      ))}
    </g>
  );
}

function Campsite({ cam, t, pal, seed, uid, world }: P) {
  const sky = skyState(world);
  const tone = worldTone("campsite", world);
  const autumn = world.season === "autumn";
  const k = glowK(world);
  const tent = seeded(seed, "tent", ["#FF8A2A", "#3D8BFF", "#4CB944", "#FF5E5B", "#8E5CFF"], pal.tent!, tone);
  const flags = [pal.flag1!, pal.flag2!, pal.flag3!, pal.flag4!];
  const sway = Math.sin(t * 1.6) * 4 * sky.wind;
  return (
    <g>
      <OutdoorSky cam={cam} t={t} pal={pal} seed={seed} uid={uid} world={world} sun={[1500, 150]} starsBottom={560} clouds={2} />
      {world.time === "night" && sky.stars ? (
        <Layer cam={cam} depth={0.04}>
          <Stars world={world} t={t + 3} seed={seed + 11} n={30} top={20} bottom={420} />
        </Layer>
      ) : null}
      <Layer cam={cam} depth={0.1}>
        {[
          [-80, 360, 700],
          [560, 270, 760],
          [1240, 330, 700],
          [1900, 280, 760],
        ].map(([mx, my, mw], i) => (
          <g key={i}>
            <path d={`M${mx! - mw! / 2} 700 Q${mx! - mw! * 0.12} ${my! + 30} ${mx} ${my} Q${mx! + mw! * 0.12} ${my! + 30} ${mx! + mw! / 2} 700 Z`} fill={i % 2 ? pal.mountain : pal.mountainFar} stroke={ln(pal.mountain!, 0.16)} strokeWidth="4" />
            <path d={`M${mx} ${my} Q${mx! + mw! * 0.12} ${my! + 30} ${mx! + mw! / 2} 700 H${mx! + mw! * 0.08} Q${mx! + 20} ${my! + 200} ${mx} ${my} Z`} fill={shade(i % 2 ? pal.mountain! : pal.mountainFar!, 0.08)} />
            <path d={`M${mx! - mw! * 0.14} ${my! + 90} Q${mx! - mw! * 0.05} ${my! + 20} ${mx} ${my} Q${mx! + mw! * 0.05} ${my! + 20} ${mx! + mw! * 0.14} ${my! + 90} Q${mx! + 30} ${my! + 70} ${mx} ${my! + 92} Q${mx! - 30} ${my! + 70} ${mx! - mw! * 0.14} ${my! + 90} Z`} fill={pal.peak} />
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.2}>
        {/* озеро */}
        <rect x={-600} y={650} width={3200} height={80} fill={pal.lake} />
        {sky.sun || sky.moon ? (
          Array.from({ length: 4 }, (_, i) => (
            <rect key={i} x={1460 - i * 12 + Math.sin(t * 2 + i) * 10} y={662 + i * 16} width={80 + i * 24} height={6} rx={3} fill={sky.moon ? "#FFF3B0" : pal.lakeShine} opacity={0.5 - i * 0.08} />
          ))
        ) : null}
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d={`M${wrap(i * 420 + t * 16, 3000) - 500} ${668 + (i % 3) * 18} h60`} stroke={pal.lakeShine} strokeWidth="4" strokeLinecap="round" opacity={0.6} />
        ))}
        {Array.from({ length: 13 }, (_, i) => -420 + i * 240 + jitter(seed, `lp${i}`, 50)).map((px, i) => (
          <Pine key={i} x={px} y={720 + (i % 2) * 8} s={0.28 + (i % 3) * 0.04} c={pal.pineFar!} pal={pal} t={t} wind={sky.wind} snow={false} />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.45}>
        <path d="M-500 800 Q 300 720 1000 770 T 2700 760 V 1400 H -500 Z" fill={pal.hillFar} />
        <Pine x={-30} y={800} s={0.7} c={pal.pine!} pal={pal} t={t} wind={sky.wind} snow={false} />
        <Pine x={130} y={786} s={0.56} c={pal.pine!} pal={pal} t={t + 1} wind={sky.wind} snow={false} />
        <Pine x={1700} y={782} s={0.62} c={pal.pine!} pal={pal} t={t + 2} wind={sky.wind} snow={false} />
        <Pine x={1880} y={800} s={0.74} c={pal.pine!} pal={pal} t={t + 3} wind={sky.wind} snow={false} />
      </Layer>
      <Layer cam={cam} depth={0.82}>
        <rect x={-700} y={GROUND - 120} width={3400} height={400} fill={pal.grassMid} />
        {/* палатка */}
        <g transform={`translate(330 ${GROUND - 92})`}>
          <path d="M-280 0 L-206 -26 M276 0 L210 -26" stroke={pal.rope} strokeWidth="3" />
          <path d="M-10 -300 L-280 0 M-10 -300 L276 0" stroke={pal.rope} strokeWidth="3" />
          <path d="M-10 -296 L220 -18 L250 0 H60 Z" fill={shade(tent, 0.12)} stroke={ln(tent)} strokeWidth="6" strokeLinejoin="round" />
          <path d="M-10 -300 L-210 0 H190 Z" fill={tent} stroke={ln(tent)} strokeWidth="6" strokeLinejoin="round" />
          <path d="M-10 -250 L-90 0 H70 Z" fill={pal.tentIn} />
          {k ? <path d="M-10 -250 L-90 0 H70 Z" fill={pal.glowLamp} opacity={0.35 * k} /> : null}
          <path d="M-10 -252 L-96 0 H-150 Q-80 -110 -10 -252 Z" fill={pal.tentFlap} stroke={ln(pal.tentFlap!)} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-10 -252 L76 0 H128 Q60 -110 -10 -252 Z" fill={pal.tentFlap} stroke={ln(pal.tentFlap!)} strokeWidth="5" strokeLinejoin="round" />
          <rect x={-16} y={-320} width={12} height={30} rx={4} fill={pal.log} />
          {/* гирлянда флажков от палатки к ёлке */}
          <path d={`M-10 -300 Q 120 ${-200 + sway} 300 -250`} stroke={pal.rope} strokeWidth="3" fill="none" />
          {Array.from({ length: 6 }, (_, i) => {
            const u = (i + 0.7) / 6.5;
            const fx = -10 + u * 310;
            const fy = (1 - u) * (1 - u) * -300 + 2 * (1 - u) * u * (-200 + sway) + u * u * -250;
            const c = flags[i % 4]!;
            return <path key={i} d={`M${fx - 14} ${fy} L${fx + 14} ${fy} L${fx} ${fy + 30} Z`} fill={c} stroke={ln(c)} strokeWidth="2.5" strokeLinejoin="round" transform={`rotate(${Math.sin(t * 2.2 + i) * 6 * sky.wind} ${fx} ${fy})`} />;
          })}
          {/* фонарик у входа */}
          <g transform={`translate(-160 -10) rotate(${Math.sin(t * 1.4) * 2})`}>
            <Glow id={`${uid}-g1`} x={0} y={-40} r={150} t={t} k={k} color={pal.glowLamp!} />
            <rect x={-18} y={-64} width={36} height={56} rx={10} fill={pal.glowLamp} stroke={pal.lanternFrame} strokeWidth="5" />
            <path d="M-12 -72 Q0 -92 12 -72" stroke={pal.lanternFrame} strokeWidth="4" fill="none" />
            <rect x={-22} y={-12} width={44} height={12} rx={4} fill={pal.lanternFrame} />
          </g>
          {/* рюкзак */}
          <g transform="translate(230 0)">
            <rect x={-38} y={-96} width={76} height={96} rx={24} fill={pal.backpack} stroke={ln(pal.backpack!)} strokeWidth="5" />
            <rect x={-26} y={-52} width={52} height={36} rx={10} fill={shade(pal.backpack!, 0.12)} />
            <path d="M-20 -96 Q0 -124 20 -96" stroke={ln(pal.backpack!)} strokeWidth="6" fill="none" />
          </g>
        </g>
        {/* бревно-скамейка за героями */}
        <g transform={`translate(960 ${GROUND - 98})`}>
          <rect x={-200} y={-50} width={400} height={50} rx={25} fill={pal.log} stroke={ln(pal.log!)} strokeWidth="5" />
          <path d="M-150 -36 H-40 M20 -18 H140" stroke={ln(pal.log!, 0.15)} strokeWidth="4" strokeLinecap="round" />
          <ellipse cx={200} cy={-25} rx={16} ry={25} fill={pal.logEnd} stroke={ln(pal.log!)} strokeWidth="5" />
          <ellipse cx={200} cy={-25} rx={7} ry={12} fill="none" stroke={ln(pal.logEnd!, 0.2)} strokeWidth="3" />
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <rect x={-700} y={GROUND - 36} width={3400} height={H} fill={pal.grass} />
        <Campfire x={1700} y={GROUND - 10} t={t} pal={pal} world={world} uid={uid} />
        {/* чайник на камне */}
        <g transform={`translate(1500 ${GROUND + 18})`}>
          <ellipse cx={0} cy={0} rx={46} ry={18} fill={pal.stone} stroke={ln(pal.stone!, 0.25)} strokeWidth="4" />
          <path d="M-30 -10 Q-34 -64 0 -66 Q34 -64 30 -10 Z" fill={pal.kettle} stroke={ln(pal.kettle!)} strokeWidth="5" />
          <path d="M28 -40 L52 -58" stroke={pal.kettle} strokeWidth="9" strokeLinecap="round" />
          <path d="M-20 -62 Q0 -96 20 -62" stroke={ln(pal.kettle!)} strokeWidth="5" fill="none" />
          <circle cx={0} cy={-70} r={6} fill={ln(pal.kettle!)} />
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <Tufts from={-600} to={2600} step={88} y={GROUND + 10} c={pal.grassBlade!} />
        {[[560, 54], [1240, 86], [-120, 70]].map(([px, py], i) => (
          <ellipse key={i} cx={px} cy={GROUND + py!} rx={26} ry={10} fill={pal.stone} opacity={0.75} />
        ))}
        {/* грибочки и цветы у края поляны */}
        {[[90, 40], [1880, 64]].map(([mx, my], i) => (
          <g key={i} transform={`translate(${mx} ${GROUND + my!})`}>
            <rect x={-9} y={-36} width={18} height={36} rx={8} fill={pal.logEnd} stroke={ln(pal.logEnd!)} strokeWidth="3" />
            <path d="M-36 -32 Q0 -80 36 -32 Z" fill={pal.flag1} stroke={ln(pal.flag1!)} strokeWidth="4" />
            <circle cx={-12} cy={-48} r={5} fill="#FFFFFF" />
            <circle cx={12} cy={-42} r={4} fill="#FFFFFF" />
          </g>
        ))}
        {world.season !== "autumn"
          ? [[220, 70, pal.flag3], [420, 30, pal.flag2], [1400, 74, pal.flag1], [1980, 20, pal.flag3]].map(([fx, fy, c], i) => (
              <g key={i} transform={`translate(${fx} ${GROUND + (fy as number)}) rotate(${Math.sin(t * 2 + i) * 4})`}>
                <path d="M0 0 V-24" stroke={pal.grassBlade} strokeWidth="4" />
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse key={a} cx={0} cy={-34} rx={6} ry={9} fill={c as string} transform={`rotate(${a} 0 -24)`} />
                ))}
                <circle cx={0} cy={-24} r={5} fill="#FFFFFF" />
              </g>
            ))
          : null}
        {autumn ? <FallenLeaves y={GROUND + 10} seed={seed + 4} n={22} /> : null}
        <Fireflies world={world} t={t} seed={seed} top={500} bottom={860} />
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ космос (понарошку) */
function SpaceWorld({ cam, t, pal, seed, uid }: P) {
  const rocket = pick(seed, "rocket", ["#FF4D5A", "#3D8BFF", "#FF8A2A", "#8E5CFF"], pal.rocketRed!);
  const ringed = pick(seed, "pl1", ["#FF9A5B", "#5DD3B6", "#FF7AB8", "#7FB8FF"], pal.planet1!);
  const shoot = (t * 0.16) % 1;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-earth`}>
          <circle cx={1660} cy={250} r={78} />
        </clipPath>
        <radialGradient id={`${uid}-neb1`}>
          <stop offset="0" stopColor={pal.skyNebula1} stopOpacity={0.55} />
          <stop offset="1" stopColor={pal.skyNebula1} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}-neb2`}>
          <stop offset="0" stopColor={pal.skyNebula2} stopOpacity={0.5} />
          <stop offset="1" stopColor={pal.skyNebula2} stopOpacity={0} />
        </radialGradient>
      </defs>
      <Sky id={`${uid}-sky`} top={pal.sky1!} bottom={pal.sky2!} />
      <Layer cam={cam} depth={0.02}>
        <ellipse cx={700} cy={300} rx={700} ry={260} fill={`url(#${uid}-neb1)`} />
        <ellipse cx={1500} cy={520} rx={620} ry={240} fill={`url(#${uid}-neb2)`} />
        {Array.from({ length: 56 }, (_, i) => {
          const x = rnd(seed, `st${i}`) * 2400 - 240;
          const y = rnd(seed, `sty${i}`) * 700;
          const tw = 0.5 + 0.5 * Math.sin(t * (1.4 + (i % 5) * 0.5) + i);
          return i % 6 === 0 ? (
            <path key={i} d="M0 -14 L3.5 -3.5 L14 0 L3.5 3.5 L0 14 L-3.5 3.5 L-14 0 L-3.5 -3.5 Z" transform={`translate(${x} ${y}) scale(${0.7 + tw * 0.5})`} fill={pal.skyStar} opacity={0.6 + tw * 0.4} />
          ) : (
            <circle key={i} cx={x} cy={y} r={2 + (i % 3)} fill={i % 4 ? "#FFFFFF" : pal.skyStar} opacity={0.4 + tw * 0.6} />
          );
        })}
        {/* падающая звезда */}
        {shoot < 0.25 ? (
          <g opacity={Math.sin((shoot / 0.25) * Math.PI)} transform={`translate(${200 + shoot * 4 * 900} ${80 + shoot * 4 * 260})`}>
            <path d="M0 0 L-120 -36" stroke={pal.comet} strokeWidth="5" strokeLinecap="round" opacity={0.6} />
            <path d="M0 -9 L2.5 -2.5 L9 0 L2.5 2.5 L0 9 L-2.5 2.5 L-9 0 L-2.5 -2.5 Z" fill={pal.comet} transform="scale(1.4)" />
          </g>
        ) : null}
      </Layer>
      <Layer cam={cam} depth={0.07}>
        {/* планета с кольцом */}
        <g transform={`translate(330 240) rotate(-14)`}>
          <path d="M-190 0 A190 46 0 0 1 190 0" stroke={pal.ring} strokeWidth="18" fill="none" />
          <circle r={110} fill={ringed} stroke={ln(ringed)} strokeWidth="6" />
          <path d="M-104 -30 Q0 -10 104 -30 M-108 24 Q0 44 108 24" stroke={pal.planet1Band} strokeWidth="14" fill="none" opacity={0.75} />
          <circle cx={-40} cy={-50} r={22} fill="#FFFFFF" opacity={0.25} />
          <path d="M-190 0 A190 46 0 0 0 190 0" stroke={pal.ring} strokeWidth="18" fill="none" />
          <path d="M-190 0 A190 46 0 0 0 190 0" stroke={ln(pal.ring!)} strokeWidth="3" fill="none" transform="translate(0 10)" opacity={0.5} />
        </g>
        {/* розовая планетка */}
        <g transform={`translate(1180 ${140 + Math.sin(t * 0.5) * 6})`}>
          <circle r={48} fill={pal.planet2} stroke={ln(pal.planet2!)} strokeWidth="5" />
          <circle cx={-14} cy={-10} r={10} fill={pal.planet2Spot} />
          <circle cx={16} cy={14} r={7} fill={pal.planet2Spot} />
          <circle cx={10} cy={-22} r={5} fill={pal.planet2Spot} />
        </g>
        {/* Земля вдалеке: материки медленно плывут */}
        <circle cx={1660} cy={250} r={90} fill={pal.earth} opacity={0.25} />
        <circle cx={1660} cy={250} r={78} fill={pal.earth} stroke={ln(pal.earth!)} strokeWidth="5" />
        <g clipPath={`url(#${uid}-earth)`}>
          <g transform={`translate(${wrap(t * 5, 180) - 90} 0)`}>
            {[-180, 0, 180].map((ox) => (
              <g key={ox} transform={`translate(${ox} 0)`}>
                <path d="M1604 214 Q1626 188 1654 204 Q1670 230 1646 250 Q1618 268 1608 242 Z" fill={pal.earthLand} />
                <path d="M1668 276 Q1700 258 1716 282 Q1708 312 1684 306 Q1662 296 1668 276 Z" fill={pal.earthLand} />
                <path d="M1660 190 Q1684 178 1706 194" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" fill="none" opacity={0.85} />
              </g>
            ))}
          </g>
          <circle cx={1636} cy={226} r={20} fill="#FFFFFF" opacity={0.18} />
        </g>
      </Layer>
      <Layer cam={cam} depth={0.14}>
        {/* спутник */}
        <g transform={`translate(${wrap(t * 22 + 600, 2600) - 340} ${420 + Math.sin(t * 0.6) * 20}) rotate(${Math.sin(t * 0.4) * 12})`}>
          <rect x={-70} y={-12} width={46} height={24} rx={3} fill={pal.panel} stroke={ln(pal.panel!)} strokeWidth="3" />
          <rect x={24} y={-12} width={46} height={24} rx={3} fill={pal.panel} stroke={ln(pal.panel!)} strokeWidth="3" />
          <rect x={-22} y={-20} width={44} height={40} rx={8} fill={pal.satellite} stroke={ln(pal.satellite!)} strokeWidth="4" />
          <path d="M0 -20 V-36" stroke={ln(pal.satellite!)} strokeWidth="3" />
          <circle cx={0} cy={-38} r={5} fill={pal.gem3} opacity={0.6 + 0.4 * Math.sin(t * 4)} />
        </g>
      </Layer>
      <Layer cam={cam} depth={0.3}>
        <path d="M-500 760 Q -200 660 200 700 Q 600 740 900 680 Q 1300 610 1700 690 Q 2100 760 2700 690 V 1400 H -500 Z" fill={pal.moonFar} />
        {[[100, 712, 50], [760, 712, 34], [1500, 676, 44], [2000, 726, 30]].map(([cx, cy, r], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r! * 0.32} fill={shade(pal.moonFar!, 0.08)} />
        ))}
      </Layer>
      <Layer cam={cam} depth={0.6}>
        <path d="M-500 830 Q 0 760 500 800 Q 900 830 1300 780 Q 1700 740 2700 810 V 1400 H -500 Z" fill={pal.moonMid} stroke={ln(pal.moonMid!, 0.14)} strokeWidth="4" />
        {[[260, 812, 60], [1120, 800, 48], [1560, 776, 40]].map(([cx, cy, r], i) => (
          <g key={i}>
            <ellipse cx={cx} cy={cy} rx={r} ry={r! * 0.3} fill={pal.crater} />
            <ellipse cx={cx} cy={cy! + 3} rx={r! * 0.8} ry={r! * 0.2} fill={shade(pal.crater!, 0.07)} />
          </g>
        ))}
        {/* кристаллы */}
        {[[60, 820, pal.gem1], [690, 808, pal.gem2], [1880, 800, pal.gem3]].map(([gx, gy, c], i) => (
          <g key={i} transform={`translate(${gx} ${gy})`}>
            <path d="M-16 0 L-10 -44 L0 -60 L10 -44 L16 0 Z" fill={c as string} stroke={ln(c as string)} strokeWidth="3" strokeLinejoin="round" />
            <path d="M8 0 L18 -30 L28 -36 L30 0 Z" fill={c as string} stroke={ln(c as string)} strokeWidth="3" strokeLinejoin="round" />
            <path d="M-4 -44 L0 -54" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity={0.6 + 0.4 * Math.sin(t * 3 + i)} />
          </g>
        ))}
      </Layer>
      <Layer cam={cam} depth={0.9}>
        {/* дружелюбная ракета */}
        <g transform={`translate(1720 ${GROUND - 34})`}>
          {[0, 1, 2].map((i) => {
            const p = (t * 0.45 + i / 3) % 1;
            return <circle key={i} cx={(i - 1) * 40 * (1 + p)} cy={-6 - p * 20} r={14 + p * 20} fill="#FFFFFF" opacity={0.5 * (1 - p)} />;
          })}
          <path d="M-60 -40 L-110 0 L-100 -96 L-60 -130 Z" fill={rocket} stroke={ln(rocket)} strokeWidth="5" strokeLinejoin="round" />
          <path d="M60 -40 L110 0 L100 -96 L60 -130 Z" fill={rocket} stroke={ln(rocket)} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-36 -40 L-24 -14 H24 L36 -40 Z" fill={pal.rocketLine} stroke={ln(pal.rocketLine!)} strokeWidth="4" />
          <path d="M-70 -40 Q-90 -260 0 -400 Q90 -260 70 -40 Z" fill={pal.rocket} stroke={pal.rocketLine} strokeWidth="6" strokeLinejoin="round" />
          <path d="M-40 -330 Q0 -350 40 -330 Q30 -372 0 -400 Q-30 -372 -40 -330 Z" fill={rocket} stroke={ln(rocket)} strokeWidth="5" strokeLinejoin="round" />
          <path d="M-78 -90 Q0 -76 78 -90" stroke={pal.rocketBlue} strokeWidth="14" fill="none" />
          <circle cx={0} cy={-230} r={44} fill={pal.rocketLine} />
          <circle cx={0} cy={-230} r={34} fill={pal.window} stroke={ln(pal.window!)} strokeWidth="4" />
          <path d="M-16 -244 Q-6 -256 8 -252" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M0 -40 V-10" stroke={ln(rocket)} strokeWidth="10" strokeLinecap="round" />
          <circle cx={0} cy={-404} r={8} fill={pal.gem3} opacity={0.5 + 0.5 * Math.sin(t * 3)} />
          <path d="M-36 -150 Q-44 -200 -30 -260" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" fill="none" opacity={0.7} />
        </g>
        {/* флажок со звездой */}
        <g transform={`translate(190 ${GROUND - 40})`}>
          <path d="M0 0 V-220" stroke={pal.rocketLine} strokeWidth="8" strokeLinecap="round" />
          <path d={`M4 -216 Q60 ${-206 + Math.sin(t * 2) * 6} 110 -200 Q60 ${-180 + Math.sin(t * 2) * 6} 4 -146 Z`} fill={pal.rocketBlue} stroke={ln(pal.rocketBlue!)} strokeWidth="4" strokeLinejoin="round" />
          <path d="M50 -196 l5 11 l12 1 l-9 8 l3 12 l-11 -6 l-11 6 l3 -12 l-9 -8 l12 -1 z" fill={pal.gem3} />
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <path d={`M-700 ${GROUND - 40} Q 300 ${GROUND - 60} 960 ${GROUND - 44} T 2700 ${GROUND - 50} V 1400 H -700 Z`} fill={pal.ground} />
        {[[-80, 60, 90], [430, 120, 70], [1180, 70, 60], [1700, 130, 100], [2200, 70, 80]].map(([cx, cy, r], i) => (
          <g key={i}>
            <ellipse cx={cx} cy={GROUND + cy!} rx={r} ry={r! * 0.26} fill={pal.groundShade} />
            <ellipse cx={cx} cy={GROUND + cy! + 4} rx={r! * 0.78} ry={r! * 0.16} fill={pal.crater} />
          </g>
        ))}
        {[[260, 30], [880, 140], [1500, 40]].map(([rx, ry], i) => (
          <ellipse key={i} cx={rx} cy={GROUND + ry!} rx={18} ry={10} fill={pal.rock} />
        ))}
        {Array.from({ length: 6 }, (_, i) => {
          const p = (t * 0.12 + i / 6) % 1;
          const x = 200 + rnd(seed, `fs${i}`) * 1500;
          return <circle key={i} cx={x + Math.sin(t + i) * 30} cy={GROUND - 40 - p * 500} r={3} fill={pal.skyStar} opacity={Math.sin(p * Math.PI) * 0.8} />;
        })}
      </Layer>
    </g>
  );
}

/* ------------------------------------------------------------------ подводный мир (понарошку) */
function Fish({ x, y, s, c, t, pal, dir, stripe = true }: { x: number; y: number; s: number; c: string; t: number; pal: Palette; dir: number; stripe?: boolean }) {
  const wag = Math.sin(t * 8 + x) * 14;
  return (
    <g transform={`translate(${x} ${y}) scale(${s * (dir >= 0 ? 1 : -1)} ${s})`}>
      <g transform={`rotate(${wag} -34 0)`}>
        <path d="M-30 0 L-62 -24 Q-54 0 -62 24 Z" fill={c} stroke={ln(c)} strokeWidth="4" strokeLinejoin="round" />
      </g>
      <path d="M-6 -26 Q6 -46 22 -30 Z" fill={c} stroke={ln(c)} strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx={0} cy={0} rx={40} ry={28} fill={c} stroke={ln(c)} strokeWidth="4" />
      {stripe ? <path d="M-6 -26 Q-14 0 -6 26" stroke={pal.fishStripe} strokeWidth="8" fill="none" /> : null}
      <circle cx={20} cy={-6} r={8} fill="#FFFFFF" />
      <circle cx={22} cy={-6} r={4.5} fill={pal.ink} />
      <path d="M30 10 Q34 13 38 10" stroke={ln(c, 0.45)} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M0 6 Q8 16 16 8" fill={shade(c, 0.1)} />
    </g>
  );
}

function Seaweed({ x, y, h, c, t, n = 3 }: { x: number; y: number; h: number; c: string; t: number; n?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: n }, (_, i) => {
        const ox = (i - (n - 1) / 2) * 22;
        const hh = h * (0.75 + ((i * 37) % 30) / 100);
        const s1 = Math.sin(t * 1.3 + i + x) * 18;
        const s2 = Math.sin(t * 1.3 + i + x + 1) * 26;
        return <path key={i} d={`M${ox} 0 Q${ox + s1 - 20} ${-hh * 0.33} ${ox + s1} ${-hh * 0.55} Q${ox + s2 + 20} ${-hh * 0.8} ${ox + s2} ${-hh}`} stroke={c} strokeWidth="16" fill="none" strokeLinecap="round" />;
      })}
    </g>
  );
}

function Coral({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 V-90 M0 -50 Q-40 -60 -44 -110 M0 -70 Q36 -80 40 -130 M-44 -110 Q-60 -130 -56 -150 M-44 -110 Q-30 -140 -24 -150 M40 -130 Q30 -150 34 -170" stroke={ln(c)} strokeWidth="26" fill="none" strokeLinecap="round" />
      <path d="M0 0 V-90 M0 -50 Q-40 -60 -44 -110 M0 -70 Q36 -80 40 -130 M-44 -110 Q-60 -130 -56 -150 M-44 -110 Q-30 -140 -24 -150 M40 -130 Q30 -150 34 -170" stroke={c} strokeWidth="18" fill="none" strokeLinecap="round" />
      {[[0, -90], [-56, -150], [-24, -150], [34, -170]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={6} fill={shade(c, -0.25)} />
      ))}
    </g>
  );
}

function Underwater({ cam, t, pal, seed, uid }: P) {
  const fishC = [pal.fish1!, pal.fish2!, pal.fish3!, pal.fish4!];
  const fc = (i: number) => fishC[(i + Math.floor(rnd(seed, "fish") * 4)) % 4]!;
  const whaleX = wrap(t * 14 + 400 + jitter(seed, "wh", 400), 3200) - 600;
  const fog = (c: string, k: number) => mix(c, pal.sky1!, k);
  return (
    <g>
      <Sky id={`${uid}-sky`} top={pal.sky1!} bottom={pal.sky2!} />
      <Layer cam={cam} depth={0.04}>
        {/* поверхность и лучи света */}
        <path d={`M-600 0 V40 ${Array.from({ length: 16 }, (_, i) => `Q${-540 + i * 240} ${40 + (i % 2 ? -16 : 16) + Math.sin(t * 1.5 + i) * 6} ${-480 + i * 240} 40`).join(" ")} V0 Z`} fill={pal.surface} opacity={0.8} />
        {[220, 640, 1060, 1480, 1860].map((rx, i) => (
          <path key={rx} d={`M${rx - 50} -20 L${rx + 50} -20 L${rx + 230 + Math.sin(t * 0.5 + i) * 40} 1000 L${rx + 10 + Math.sin(t * 0.5 + i) * 40} 1000 Z`} fill={pal.skyRay} opacity={0.13 + 0.05 * Math.sin(t * 0.8 + i * 2)} />
        ))}
        {/* кит вдалеке */}
        <g transform={`translate(${whaleX} 300)`} opacity={0.9}>
          <path d="M-200 0 Q-200 -80 -60 -86 Q120 -90 180 -20 Q200 10 170 30 Q60 70 -120 50 Q-200 40 -200 0 Z" fill={fog(pal.whale!, 0.45)} />
          <path d="M-180 30 Q-40 64 160 30 Q120 56 -120 54 Z" fill={fog(pal.whaleBelly!, 0.45)} />
          <path d={`M-196 -4 L-270 ${-50 + Math.sin(t * 1.2) * 10} L-250 0 L-270 ${46 + Math.sin(t * 1.2) * 10} Z`} fill={fog(pal.whale!, 0.45)} />
          <circle cx={110} cy={-20} r={7} fill={fog(pal.ink!, 0.5)} />
          <path d="M120 14 Q140 22 160 10" stroke={fog(pal.ink!, 0.5)} strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </Layer>
      <Layer cam={cam} depth={0.2}>
        <path d="M-500 760 Q -300 640 -100 700 Q 100 600 360 690 Q 560 740 760 680 Q 1000 610 1200 700 Q 1450 640 1700 680 Q 1950 600 2200 690 Q 2450 650 2700 700 V 1400 H -500 Z" fill={pal.reefFar} />
        {[[-200, 700], [420, 690], [1300, 700], [2100, 690]].map(([cx, cy], i) => (
          <Coral key={i} x={cx!} y={cy!} s={0.55} c={fog(pal.coral3!, 0.55)} />
        ))}
        {/* стайка рыбок */}
        {Array.from({ length: 7 }, (_, i) => {
          const bx = wrap(-t * 50 + 1800 + (i % 4) * 40, 3000) - 500;
          return <Fish key={i} x={bx + (i % 3) * 46} y={500 + (i % 4) * 30 + Math.sin(t * 1.4 + i) * 8} s={0.28} c={fog(pal.fish3!, 0.3)} t={t + i} pal={pal} dir={-1} stripe={false} />;
        })}
      </Layer>
      <Layer cam={cam} depth={0.45}>
        <path d="M-500 820 Q -200 760 200 790 Q 600 820 900 780 Q 1300 740 1700 790 Q 2100 830 2700 780 V 1400 H -500 Z" fill={pal.reefMid} />
        <Seaweed x={120} y={810} h={200} c={fog(pal.weed2!, 0.25)} t={t} />
        <Seaweed x={1640} y={800} h={230} c={fog(pal.weed2!, 0.25)} t={t + 1} n={4} />
        <Coral x={760} y={800} s={0.7} c={fog(pal.coral2!, 0.25)} />
        {/* черепаха */}
        <g transform={`translate(${wrap(t * 30 + jitter(seed, "tt", 500), 3000) - 500} ${330 + Math.sin(t * 0.8) * 18})`}>
          <g transform={`rotate(${Math.sin(t * 2) * 18} -30 10)`}>
            <ellipse cx={-36} cy={18} rx={26} ry={10} fill={pal.turtle} stroke={ln(pal.turtle!)} strokeWidth="3" />
          </g>
          <g transform={`rotate(${-Math.sin(t * 2) * 22} 30 0)`}>
            <ellipse cx={40} cy={10} rx={32} ry={12} fill={pal.turtle} stroke={ln(pal.turtle!)} strokeWidth="3" transform="rotate(30 40 10)" />
          </g>
          <circle cx={78} cy={-10} r={20} fill={pal.turtle} stroke={ln(pal.turtle!)} strokeWidth="4" />
          <circle cx={84} cy={-14} r={4} fill={pal.ink} />
          <path d="M84 -2 Q90 2 96 -2" stroke={ln(pal.turtle!)} strokeWidth="3" fill="none" />
          <path d="M-60 6 Q-56 -56 0 -58 Q56 -56 62 6 Z" fill={pal.shell} stroke={ln(pal.shell!)} strokeWidth="5" />
          <path d="M-30 -10 L0 -36 L30 -10 L0 4 Z" fill={shade(pal.shell!, -0.18)} />
        </g>
      </Layer>
      <Layer cam={cam} depth={0.7}>
        {/* медуза */}
        <g transform={`translate(${430 + Math.sin(t * 0.3) * 40} ${250 + Math.sin(t * 0.9) * 30})`}>
          {[-24, -8, 8, 24].map((tx, i) => (
            <path key={tx} d={`M${tx} 0 q${Math.sin(t * 2 + i) * 10} 30 0 60 q${-Math.sin(t * 2 + i) * 10} 30 0 60`} stroke={pal.jelly} strokeWidth="6" fill="none" strokeLinecap="round" opacity={0.85} />
          ))}
          <path d={`M-46 4 Q-46 ${-54 - Math.sin(t * 2) * 6} 0 ${-56 - Math.sin(t * 2) * 6} Q46 ${-54 - Math.sin(t * 2) * 6} 46 4 Q24 -6 0 6 Q-24 -6 -46 4 Z`} fill={pal.jelly} stroke={ln(pal.jelly!)} strokeWidth="4" />
          <circle cx={-14} cy={-22} r={4} fill={pal.ink} />
          <circle cx={14} cy={-22} r={4} fill={pal.ink} />
          <path d="M-8 -10 Q0 -4 8 -10" stroke={pal.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx={-22} cy={-36} r={6} fill="#FFFFFF" opacity={0.6} />
        </g>
        {/* рыбки плавают туда-сюда */}
        {[
          [520, 0.9, 0.1],
          [380, 0.7, 2.2],
          [610, 0.8, 4.1],
        ].map(([fy, fs, ph], i) => {
          const sp = 0.09 + i * 0.03;
          const fx = 960 + Math.sin(t * sp + ph!) * (700 + i * 120);
          const dir = Math.cos(t * sp + ph!);
          return <Fish key={i} x={fx} y={fy! + Math.sin(t * 1.2 + i) * 16} s={fs!} c={fc(i)} t={t} pal={pal} dir={dir} />;
        })}
      </Layer>
      <Layer cam={cam} depth={0.85}>
        <path d={`M-700 ${GROUND - 110} Q 200 ${GROUND - 140} 900 ${GROUND - 112} T 2700 ${GROUND - 120} V 1400 H -700 Z`} fill={pal.sandShade} />
        {/* скалы и кораллы по краям */}
        <path d={`M-200 ${GROUND - 100} Q-180 ${GROUND - 300} 60 ${GROUND - 320} Q260 ${GROUND - 320} 300 ${GROUND - 100} Z`} fill={pal.rock} stroke={ln(pal.rock!, 0.2)} strokeWidth="5" />
        <path d={`M40 ${GROUND - 300} Q160 ${GROUND - 300} 200 ${GROUND - 200}`} stroke={pal.rockShade} strokeWidth="10" fill="none" strokeLinecap="round" />
        <Coral x={80} y={GROUND - 300} s={0.8} c={pal.coral1!} />
        <Coral x={250} y={GROUND - 110} s={0.9} c={pal.coral4!} />
        <Seaweed x={-20} y={GROUND - 100} h={300} c={pal.weed1!} t={t} n={3} />
        <path d={`M1600 ${GROUND - 100} Q1640 ${GROUND - 260} 1820 ${GROUND - 270} Q2000 ${GROUND - 260} 2100 ${GROUND - 100} Z`} fill={pal.rock} stroke={ln(pal.rock!, 0.2)} strokeWidth="5" />
        <g transform={`translate(1810 ${GROUND - 268})`}>
          <circle r={56} fill={pal.coral3} stroke={ln(pal.coral3!)} strokeWidth="5" />
          <path d="M-36 -20 Q-20 -40 0 -24 Q20 -8 36 -26 M-40 10 Q-20 -6 0 10 Q20 26 40 8 M-26 36 Q0 24 26 36" stroke={ln(pal.coral3!, 0.18)} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
        <Coral x={1660} y={GROUND - 110} s={0.85} c={pal.coral2!} />
        <Seaweed x={1960} y={GROUND - 100} h={280} c={pal.weed1!} t={t + 2} n={3} />
        {/* актиния с рыбкой-клоуном */}
        <g transform={`translate(560 ${GROUND - 96})`}>
          <Fish x={10 + Math.sin(t * 0.8) * 50} y={-104 + Math.sin(t * 1.6) * 10} s={0.55} c={pal.coral2!} t={t} pal={pal} dir={Math.cos(t * 0.8)} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = -64 + i * 16;
            const sw = Math.sin(t * 1.6 + i * 0.7) * 10;
            return <path key={i} d={`M${(i - 4) * 9} 0 q${a * 0.3 + sw} -30 ${a * 0.6 + sw * 1.4} -64`} stroke={i % 2 ? pal.jelly : pal.coral3} strokeWidth="14" fill="none" strokeLinecap="round" />;
          })}
          <ellipse cx={0} cy={4} rx={50} ry={16} fill={pal.coral3} stroke={ln(pal.coral3!)} strokeWidth="4" />
        </g>
        {/* сундучок с сокровищами */}
        <g transform={`translate(1480 ${GROUND - 64})`}>
          <rect x={-70} y={-70} width={140} height={70} rx={10} fill={pal.chest} stroke={ln(pal.chest!)} strokeWidth="5" />
          <path d="M-74 -70 Q-74 -122 0 -124 Q74 -122 74 -70 Z" fill={shade(pal.chest!, -0.1)} stroke={ln(pal.chest!)} strokeWidth="5" />
          <path d="M-74 -70 H74 M-40 -122 V0 M40 -122 V0" stroke={pal.gold} strokeWidth="9" />
          <rect x={-12} y={-82} width={24} height={26} rx={5} fill={pal.gold} stroke={ln(pal.gold!)} strokeWidth="3" />
          <path d="M-60 -72 Q0 -60 60 -72" stroke={pal.gold} strokeWidth="5" opacity={0.6 + 0.4 * Math.sin(t * 3)} fill="none" />
          <path d="M50 -110 l3 7 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1 z" fill="#FFFFFF" opacity={Math.max(0, Math.sin(t * 2.5))} />
        </g>
      </Layer>
      <Layer cam={cam} depth={1}>
        <path d={`M-700 ${GROUND - 50} Q 300 ${GROUND - 70} 960 ${GROUND - 52} T 2700 ${GROUND - 60} V 1400 H -700 Z`} fill={pal.sand} />
        {[[-140, 40], [300, 100], [760, 50], [1180, 120], [1620, 60], [2050, 110]].map(([sx, sy], i) => (
          <path key={i} d={`M${sx! - 120} ${GROUND + sy!} q60 -16 120 0 q60 16 120 0`} stroke={pal.sandShade} strokeWidth="6" fill="none" strokeLinecap="round" />
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <circle key={i} cx={-500 + i * 170 + ((i * 53) % 60)} cy={GROUND + 20 + (i % 4) * 34} r={3.5} fill={pal.sandDot} />
        ))}
        {/* морская звезда и ракушки */}
        <path d="M0 -26 L8 -8 L28 -8 L12 4 L18 24 L0 12 L-18 24 L-12 4 L-28 -8 L-8 -8 Z" fill={pal.starfish} stroke={ln(pal.starfish!)} strokeWidth="4" strokeLinejoin="round" transform={`translate(${380 + jitter(seed, "sf", 60)} ${GROUND + 70}) rotate(14) scale(1.3 0.8)`} />
        <path d={`M1300 ${GROUND + 54} q22 -44 44 0 z`} fill={pal.seashell} stroke={ln(pal.seashell!)} strokeWidth="4" strokeLinejoin="round" />
        <path d={`M1316 ${GROUND + 52} l6 -30 M1328 ${GROUND + 52} l-1 -32`} stroke={ln(pal.seashell!)} strokeWidth="3" />
        <path d={`M140 ${GROUND + 110} q18 -36 36 0 z`} fill={pal.coral4} stroke={ln(pal.coral4!)} strokeWidth="4" strokeLinejoin="round" />
        {/* пузырьки поднимаются со дна */}
        {Array.from({ length: 12 }, (_, i) => {
          const p = (t * (0.14 + (i % 3) * 0.03) + i / 12) % 1;
          const bx = [60, 120, 270, 1480, 1500, 1830, 1990, 700, 960, 1250, 400, 1700][i]!;
          const r = 5 + (i % 4) * 3;
          return (
            <g key={i} opacity={Math.min(1, (1 - p) * 3) * 0.9}>
              <circle cx={bx + Math.sin(t * 2 + i) * 12} cy={GROUND - 80 - p * 900} r={r} fill={pal.bubble} fillOpacity={0.2} stroke={pal.bubble} strokeWidth="3" />
              <circle cx={bx + Math.sin(t * 2 + i) * 12 - r * 0.35} cy={GROUND - 80 - p * 900 - r * 0.35} r={r * 0.28} fill="#FFFFFF" />
            </g>
          );
        })}
      </Layer>
    </g>
  );
}

export interface MoreLocationDef {
  label: string;
  Back: (p: P) => ReactNode;
  Front?: (p: P) => ReactNode;
}

export const BathroomLoc: MoreLocationDef = { label: "Ванная", Back: Bathroom };
export const ClassroomLoc: MoreLocationDef = { label: "Детский сад", Back: Classroom };
export const FarmLoc: MoreLocationDef = { label: "Ферма", Back: Farm };
export const ParkPondLoc: MoreLocationDef = { label: "Парк с прудом", Back: ParkPond };
export const SnowyHillLoc: MoreLocationDef = { label: "Снежная горка", Back: SnowyHill };
export const CampsiteLoc: MoreLocationDef = { label: "Поход с палаткой", Back: Campsite };
export const SpaceLoc: MoreLocationDef = { label: "Космос (понарошку)", Back: SpaceWorld };
export const UnderwaterLoc: MoreLocationDef = { label: "Под водой (понарошку)", Back: Underwater };
