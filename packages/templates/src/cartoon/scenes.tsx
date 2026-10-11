/**
 * Локации мультика: слоистые векторные фоны. Мир 1920×1080, земля на y=GROUND.
 * Камера {x, y, zoom}: дальние слои сдвигаются меньше (параллакс) — даёт глубину при панораме.
 * Цвета — только токены палитры (palette.ts), мелочи — по сиду сцены.
 */
import type { ReactNode } from "react";
import { jitter, pick, skyState, TOY_COLORS, type Palette, type WorldState } from "./palette";
import { FallenLeaves, Puddles, SnowDrifts, SnowStrip, Stars, SunMoon, WeatherClouds } from "./world";
import { shade } from "./rig";

export const GROUND = 905;
export interface Camera {
  x: number; // центр кадра по миру
  y: number;
  zoom: number;
}

/** Пропсы любой локации: камера, время, палитра мира и сид сцены. */
export interface LocProps {
  cam: Camera;
  t: number;
  pal: Palette;
  seed: number;
  uid: string; // уникальный префикс для id градиентов (на листе ассетов локаций несколько в одном SVG)
  world: WorldState; // время суток, погода, сезон — детали мира (солнце/луна, снег, лужи, листья)
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

export function Sky({ id, top, bottom }: { id: string; top: string; bottom: string }) {
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

function Cloud({ x, y, s, t, speed, pal }: { x: number; y: number; s: number; t: number; speed: number; pal: Palette }) {
  const cx = ((((x + t * speed) % (W + 600)) + W + 600) % (W + 600)) - 300;
  return (
    <g transform={`translate(${cx} ${y}) scale(${s})`} opacity={0.95}>
      <ellipse cx={0} cy={0} rx={90} ry={42} fill={pal.skyCloud} />
      <ellipse cx={-60} cy={10} rx={60} ry={32} fill={pal.skyCloud} />
      <ellipse cx={62} cy={8} rx={66} ry={34} fill={pal.skyCloud} />
      <ellipse cx={10} cy={-26} rx={58} ry={38} fill={pal.skyCloud} />
      <ellipse cx={0} cy={22} rx={150} ry={16} fill={pal.skyCloudShade} />
    </g>
  );
}

function Tree({ x, y, s, hue, t, pal, wind = 1, snow = false }: { x: number; y: number; s: number; hue: string; t: number; pal: Palette; wind?: number; snow?: boolean }) {
  const sway = Math.sin(t * 1.3 * (wind > 1 ? 1.8 : 1) + x) * 1.5 * wind;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 0 L-10 -120 Q0 -130 10 -120 L14 0 Z" fill={pal.trunk} stroke={shade(pal.trunk!, 0.3)} strokeWidth="4" />
      <g transform={`rotate(${sway} 0 -120)`}>
        <circle cx={0} cy={-190} r={86} fill={hue} stroke={shade(hue, 0.3)} strokeWidth="5" />
        <circle cx={-62} cy={-140} r={58} fill={hue} stroke={shade(hue, 0.3)} strokeWidth="5" />
        <circle cx={64} cy={-142} r={60} fill={hue} stroke={shade(hue, 0.3)} strokeWidth="5" />
        <circle cx={-30} cy={-220} r={30} fill={shade(hue, -0.25)} opacity={0.7} />
        <circle cx={30} cy={-170} r={9} fill={pal.fruit} />
        <circle cx={-40} cy={-150} r={9} fill={pal.fruit} />
        <circle cx={54} cy={-120} r={9} fill={pal.fruit} />
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

function Flower({ x, y, c, t, pal }: { x: number; y: number; c: string; t: number; pal: Palette }) {
  const sw = Math.sin(t * 2 + x * 0.1) * 4;
  return (
    <g transform={`translate(${x} ${y}) rotate(${sw})`}>
      <path d="M0 0 L0 -34" stroke={pal.stem} strokeWidth="5" />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={0} cy={-46} rx={8} ry={13} fill={c} transform={`rotate(${a} 0 -34)`} />
      ))}
      <circle cx={0} cy={-34} r={7} fill={pal.flowerCenter} />
    </g>
  );
}

function House({ x, y, s, pal, door, world }: { x: number; y: number; s: number; pal: Palette; door: string; world: WorldState }) {
  const lit = world.time === "night" || world.time === "evening";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-170} y={-260} width={340} height={260} rx={10} fill={pal.houseWall} stroke={pal.houseTrim} strokeWidth="6" />
      <path d="M-200 -250 L0 -410 L200 -250 Z" fill={pal.roof} stroke={pal.roofLine} strokeWidth="6" strokeLinejoin="round" />
      <rect x={110} y={-400} width={40} height={90} fill={pal.chimney} stroke={pal.chimneyLine} strokeWidth="5" />
      {world.season === "winter" ? (
        <g>
          <path d="M-212 -248 Q-100 -330 0 -418 Q100 -330 212 -248 Q190 -228 170 -246 Q100 -310 0 -392 Q-100 -310 -170 -246 Q-190 -228 -212 -248 Z" fill="#FFFFFF" stroke="#D6E4F0" strokeWidth="4" strokeLinejoin="round" />
          <SnowStrip x={106} y={-414} w={48} h={14} />
        </g>
      ) : null}
      <rect x={-40} y={-140} width={80} height={140} rx={40} fill={door} stroke={shade(door, 0.35)} strokeWidth="6" />
      <circle cx={24} cy={-70} r={7} fill={pal.knob} />
      {[-120, 120].map((wx) => (
        <g key={wx}>
          <rect x={wx - 42} y={-210} width={84} height={76} rx={10} fill={lit ? "#FFD97A" : pal.glass} stroke={pal.houseTrim} strokeWidth="6" />
          {lit ? <rect x={wx - 62} y={-230} width={124} height={116} rx={30} fill="#FFD97A" opacity={0.18} /> : null}
          <path d={`M${wx} -210 V-134 M${wx - 42} -172 H${wx + 42}`} stroke={pal.houseTrim} strokeWidth="5" />
        </g>
      ))}
    </g>
  );
}

/** Сад у дома: небо, солнце, облака, холмы, дом, деревья, забор, трава, цветы. */
export function GardenScene({ cam, t, pal, seed, uid, world }: LocProps) {
  const sky = skyState(world);
  const winter = world.season === "winter";
  const flowers = [pal.flower1!, pal.flower2!, pal.flower3!, pal.flower4!];
  const door = pick(seed, "door", ["#6B4BB0", "#3D8BFF", "#4CB944", "#FF8A2A", "#E8574C"], pal.door!);
  const flowerXs = [-200, 120, 330, 1500, 1720, 1960, 2150];
  return (
    <g>
      <Sky id={`${uid}-sky`} top={pal.sky1!} bottom={pal.sky2!} />
      <Layer cam={cam} depth={0.05}>
        <Stars world={world} t={t} seed={seed + 1} />
        <SunMoon x={1580} y={170} r={70} world={world} pal={pal} t={t} />
        <WeatherClouds world={world} t={t} pal={pal} seed={seed + 2} />
        <Cloud x={200 + jitter(seed, "c1", 300)} y={160} s={1} t={t} speed={14} pal={pal} />
        <Cloud x={900 + jitter(seed, "c2", 300)} y={110} s={0.75} t={t} speed={10} pal={pal} />
        <Cloud x={1500 + jitter(seed, "c3", 300)} y={240} s={0.6} t={t} speed={18} pal={pal} />
      </Layer>
      <Layer cam={cam} depth={0.25}>
        <path d={`M-400 760 Q 200 560 700 720 T 1700 690 T 2600 740 V ${H + 300} H -400 Z`} fill={pal.hillFar} />
        <Tree x={220} y={735} s={0.45} hue={pal.leafFar!} t={t} pal={pal} wind={sky.wind} snow={winter} />
        <Tree x={1500} y={705} s={0.4} hue={pal.leafFar!} t={t} pal={pal} wind={sky.wind} snow={winter} />
      </Layer>
      <Layer cam={cam} depth={0.55}>
        <path d={`M-400 820 Q 400 700 1000 800 T 2500 790 V ${H + 300} H -400 Z`} fill={pal.hillMid} />
        <House x={560} y={812} s={0.82} pal={pal} door={door} world={world} />
        <Tree x={1260} y={815} s={0.8} hue={pal.leaf!} t={t} pal={pal} wind={sky.wind} snow={winter} />
      </Layer>
      <Layer cam={cam} depth={0.8}>
        {/* забор — за героями, чуть ниже их роста */}
        {Array.from({ length: 34 }, (_, i) => -700 + i * 96).map((fx) => (
          <path key={fx} d={`M${fx} ${GROUND - 95} V${GROUND - 190} l20 -18 l20 18 V${GROUND - 95} Z`} fill={pal.fence} stroke={pal.fenceLine} strokeWidth="4" strokeLinejoin="round" />
        ))}
        <rect x={-800} y={GROUND - 172} width={3600} height={12} fill={pal.fence} stroke={pal.fenceLine} strokeWidth="3" />
        {winter ? Array.from({ length: 34 }, (_, i) => -700 + i * 96).map((fx) => <ellipse key={fx} cx={fx + 20} cy={GROUND - 206} rx={20} ry={8} fill="#FFFFFF" />) : null}
        <rect x={-800} y={GROUND - 132} width={3600} height={12} fill={pal.fence} stroke={pal.fenceLine} strokeWidth="3" />
        {[-420, 300, 1160, 1900, 2500].map((bx) => (
          <g key={bx} transform={`translate(${bx} ${GROUND - 92})`}>
            <circle cx={0} cy={0} r={52} fill={pal.bush1} stroke={pal.bushLine} strokeWidth="4" />
            <circle cx={50} cy={8} r={40} fill={pal.bush2} stroke={pal.bushLine} strokeWidth="4" />
            <circle cx={-46} cy={10} r={38} fill={pal.bush3} stroke={pal.bushLine} strokeWidth="4" />
            <circle cx={10} cy={-20} r={7} fill={pal.bushFlower1} />
            <circle cx={-30} cy={4} r={7} fill={pal.bushFlower2} />
            <circle cx={44} cy={-4} r={7} fill={pal.bushFlower1} />
            {winter ? <path d="M-80 -6 Q-50 -66 0 -54 Q50 -70 88 -4 Q40 -26 0 -24 Q-44 -30 -80 -6 Z" fill="#FFFFFF" /> : null}
          </g>
        ))}
        <rect x={-800} y={GROUND - 100} width={3600} height={200} fill={pal.grass} />
      </Layer>
      <Layer cam={cam} depth={1}>
        {/* земля */}
        <rect x={-600} y={GROUND - 60} width={3400} height={H} fill={pal.grass} />
        {/* тропинка */}
        <path d={`M-600 ${GROUND + 20} Q 400 ${GROUND - 10} 960 ${GROUND + 10} T 2800 ${GROUND + 5} V ${GROUND + 70} Q 1500 ${GROUND + 90} 960 ${GROUND + 72} T -600 ${GROUND + 80} Z`} fill={pal.path} stroke={pal.pathEdge} strokeWidth="4" />
        {Array.from({ length: 40 }, (_, i) => -560 + i * 90).map((gx, i) => (
          <path key={gx} d={`M${gx} ${GROUND + 40 + (i % 3) * 30} q6 -16 12 0 q6 -20 12 0`} stroke={pal.grassBlade} strokeWidth="5" fill="none" strokeLinecap="round" />
        ))}
        {sky.flowers
          ? flowerXs.map((fx, i) => (
              <Flower key={fx} x={fx + jitter(seed, `fx${i}`, 50)} y={GROUND - 26} c={pick(seed, `f${i}`, [...flowers, TOY_COLORS[0]!, TOY_COLORS[5]!], flowers[i % 4]!)} t={t} pal={pal} />
            ))
          : null}
        {winter ? <SnowDrifts y={GROUND + 110} seed={seed + 3} /> : null}
        {world.season === "autumn" ? <FallenLeaves y={GROUND + 20} seed={seed + 4} /> : null}
        {world.weather === "rain" ? <Puddles xs={[-120, 640, 1380, 2100]} y={GROUND + 60} t={t} /> : null}
      </Layer>
    </g>
  );
}

function Butterfly({ x, y, t, c, pal }: { x: number; y: number; t: number; c: string; pal: Palette }) {
  const fx = x + Math.sin(t * 0.6 + x) * 140;
  const fy = y + Math.sin(t * 1.3 + x) * 40;
  const flap = Math.abs(Math.sin(t * 14 + x));
  return (
    <g transform={`translate(${fx} ${fy})`}>
      <ellipse cx={-9} cy={0} rx={10 * (0.3 + flap * 0.7)} ry={12} fill={c} stroke={shade(c, 0.35)} strokeWidth="2" />
      <ellipse cx={9} cy={0} rx={10 * (0.3 + flap * 0.7)} ry={12} fill={c} stroke={shade(c, 0.35)} strokeWidth="2" />
      <rect x={-2} y={-9} width={4} height={18} rx={2} fill={pal.ink} />
    </g>
  );
}

/** Бабочки — на слое персонажей (оживляют кадр). */
export function GardenLife({ cam, t, pal, world }: LocProps) {
  const sky = skyState(world);
  if (!sky.flowers || world.time === "night" || world.weather === "rain" || world.weather === "snow") return null;
  return (
    <Layer cam={cam} depth={1}>
      <Butterfly x={420} y={GROUND - 330} t={t} c={pal.butterfly1!} pal={pal} />
      <Butterfly x={1500} y={GROUND - 420} t={t + 3} c={pal.butterfly2!} pal={pal} />
    </Layer>
  );
}

/** Передний план (поверх персонажей): кусты по краям — глубина кадра. */
export function GardenForeground({ cam, t, pal, world }: LocProps) {
  return (
    <Layer cam={cam} depth={1.35}>
      {[-260, 2160].map((bx) => (
        <g key={bx} transform={`translate(${bx} ${GROUND + 190}) rotate(${Math.sin(t * 1.2 + bx) * 1.2})`}>
          <circle cx={0} cy={0} r={150} fill={pal.fg1} />
          <circle cx={120} cy={30} r={110} fill={pal.fg2} />
          <circle cx={-110} cy={40} r={120} fill={pal.fg3} />
          {world.season === "winter" ? <path d="M-200 -40 Q-120 -160 0 -150 Q130 -160 210 -20 Q100 -90 0 -90 Q-110 -96 -200 -40 Z" fill="#FFFFFF" opacity={0.95} /> : null}
        </g>
      ))}
    </Layer>
  );
}
