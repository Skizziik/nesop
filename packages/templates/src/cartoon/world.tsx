/**
 * Мир сцены (docs/cartoon-visual-variety.md, этап 1): время суток, погода, сезон.
 * Здесь общие детали, которые локации расставляют у себя (солнце/луна, звёзды, тучи, снежные шапки, лужи, листья, погода в окне),
 * и экранные эффекты поверх кадра (дождь, снег, листопад, ветер, свет ночью). Всё детерминировано по t и сиду.
 */
import type { ReactNode } from "react";
import { rnd, skyState, type Palette, type WorldState } from "./palette";

const W = 1920;
const H = 1080;

/** Солнце днём, луна с сиянием ночью; при тучах — ничего. */
export function SunMoon({ x, y, r, world, pal, t }: { x: number; y: number; r: number; world: WorldState; pal: Palette; t: number }) {
  const sky = skyState(world);
  const low = world.time === "morning" || world.time === "evening" ? r * 1.6 : 0; // утром и вечером солнце ниже и крупнее
  if (sky.sun)
    return (
      <g transform={`translate(${x} ${y + low})`}>
        <circle r={r * 1.36} fill={pal.skySunGlow ?? pal.skySun} opacity={0.35} transform={`scale(${1 + Math.sin(t * 1.5) * 0.04})`} />
        <circle r={r * (low ? 1.15 : 1)} fill={pal.skySun} stroke={pal.skySunRim ?? pal.skySun} strokeWidth="6" />
      </g>
    );
  if (sky.moon)
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r={r * 1.9} fill="#FFF6C8" opacity={0.08 + 0.02 * Math.sin(t)} />
        <circle r={r * 1.35} fill="#FFF6C8" opacity={0.12} />
        <circle r={r * 0.95} fill="#FFF3B0" stroke="#E8D88A" strokeWidth="4" />
        <circle cx={-r * 0.3} cy={-r * 0.2} r={r * 0.16} fill="#EDE09A" />
        <circle cx={r * 0.25} cy={r * 0.3} r={r * 0.11} fill="#EDE09A" />
        <circle cx={r * 0.32} cy={-r * 0.35} r={r * 0.08} fill="#EDE09A" />
      </g>
    );
  return null;
}

/** Мерцающие звёзды ночью при ясном небе. */
export function Stars({ world, t, seed, n = 26, top = 30, bottom = 520 }: { world: WorldState; t: number; seed: number; n?: number; top?: number; bottom?: number }) {
  if (!skyState(world).stars) return null;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = rnd(seed, `sx${i}`) * (W + 400) - 200;
        const y = top + rnd(seed, `sy${i}`) * (bottom - top);
        const s = 0.6 + rnd(seed, `ss${i}`) * 0.9;
        const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + (i % 5) * 0.4) + i);
        return i % 4 === 0 ? (
          <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill="#FFF6C8" opacity={tw} />
        ) : (
          <circle key={i} cx={x} cy={y} r={2.5 * s + 1} fill="#FFFFFF" opacity={tw * 0.9} />
        );
      })}
    </g>
  );
}

/** Пухлое облако; tone — цвет тела, shade — подложка. */
export function Puff({ x, y, s, fill, shadow, opacity = 0.95 }: { x: number; y: number; s: number; fill: string; shadow: string; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <ellipse cx={0} cy={22} rx={150} ry={20} fill={shadow} />
      <ellipse cx={0} cy={0} rx={90} ry={42} fill={fill} />
      <ellipse cx={-62} cy={10} rx={62} ry={32} fill={fill} />
      <ellipse cx={64} cy={8} rx={66} ry={34} fill={fill} />
      <ellipse cx={10} cy={-26} rx={58} ry={38} fill={fill} />
    </g>
  );
}

/** Дополнительные тучи при пасмурной погоде, дожде и снеге — плывут медленнее обычных облаков. */
export function WeatherClouds({ world, t, pal, seed }: { world: WorldState; t: number; pal: Palette; seed: number }) {
  const extra = skyState(world).clouds - 1;
  if (extra <= 0) return null;
  const n = extra * 3;
  const fill = pal.skyCloud ?? "#E9EDF2";
  const shadow = pal.skyCloudShade ?? "#CDD5DF";
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const base = rnd(seed, `wc${i}`) * (W + 600);
        const x = ((((base + t * (6 + (i % 3) * 3)) % (W + 600)) + W + 600) % (W + 600)) - 300;
        return <Puff key={i} x={x} y={40 + (i % 3) * 70 + rnd(seed, `wy${i}`) * 40} s={0.9 + rnd(seed, `ws${i}`) * 0.7} fill={fill} shadow={shadow} />;
      })}
    </g>
  );
}

/** Снежная шапка вдоль верхней кромки (крыша, забор, кусты): волнистая белая полоса. */
export function SnowStrip({ x, y, w, h = 18 }: { x: number; y: number; w: number; h?: number }) {
  const bumps = Math.max(2, Math.round(w / 60));
  const step = w / bumps;
  let d = `M${x} ${y + h * 0.4}`;
  for (let i = 0; i < bumps; i++) d += ` q${step / 2} ${-h} ${step} 0`;
  d += ` v${h * 0.5} q${-w / 2} ${h * 0.6} ${-w} 0 Z`;
  return <path d={d} fill="#FFFFFF" stroke="#D6E4F0" strokeWidth="3" strokeLinejoin="round" />;
}

/** Сугробы по земле: светлые холмики с голубоватой тенью. */
export function SnowDrifts({ y, seed, from = -600, to = 2600 }: { y: number; seed: number; from?: number; to?: number }) {
  const n = Math.round((to - from) / 260);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = from + i * 260 + rnd(seed, `dr${i}`) * 120;
        const w = 120 + rnd(seed, `drw${i}`) * 120;
        return <ellipse key={i} cx={x} cy={y} rx={w} ry={18 + rnd(seed, `drh${i}`) * 10} fill="#FFFFFF" stroke="#DCE8F2" strokeWidth="3" />;
      })}
    </g>
  );
}

/** Лужи с расходящимися кругами от капель (дождь). */
export function Puddles({ xs, y, t, color = "#8FB7E0" }: { xs: number[]; y: number; t: number; color?: string }) {
  return (
    <g>
      {xs.map((x, i) => {
        const ph = (t * 0.9 + i * 0.37) % 1;
        return (
          <g key={i} transform={`translate(${x} ${y + (i % 2) * 24})`}>
            <ellipse rx={110} ry={20} fill={color} opacity={0.85} />
            <ellipse rx={80} ry={11} cx={-12} cy={-3} fill="#FFFFFF" opacity={0.25} />
            <ellipse rx={10 + ph * 60} ry={2 + ph * 10} fill="none" stroke="#FFFFFF" strokeWidth="3" opacity={0.8 * (1 - ph)} />
          </g>
        );
      })}
    </g>
  );
}

const LEAF_COLORS = ["#FF8A2A", "#FFB23F", "#E8453C", "#D9822B"];
const LEAF = "M0 -14 C10 -10 12 4 0 14 C-12 4 -10 -10 0 -14 Z";

/** Опавшие листья на земле (осень). */
export function FallenLeaves({ y, seed, from = -500, to = 2500, n = 26 }: { y: number; seed: number; from?: number; to?: number; n?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = from + rnd(seed, `fl${i}`) * (to - from);
        const yy = y + rnd(seed, `fly${i}`) * 70;
        return <path key={i} d={LEAF} transform={`translate(${x} ${yy}) rotate(${rnd(seed, `flr${i}`) * 180 - 90}) scale(1.1 0.7)`} fill={LEAF_COLORS[i % 4]} />;
      })}
    </g>
  );
}

/** Погода в окне помещения: дождь, снег, листопад; рисуется внутри рамки окна (clipPath). */
export function WindowWeather({ x, y, w, h, world, t, uid, rx = 0 }: { x: number; y: number; w: number; h: number; world: WorldState; t: number; uid: string; rx?: number }) {
  const kind = world.weather === "rain" ? "rain" : world.weather === "snow" ? "snow" : world.season === "autumn" && world.weather === "windy" ? "leaves" : null;
  if (!kind) return null;
  const id = `${uid}-win-${Math.round(x)}-${Math.round(y)}`;
  const n = kind === "rain" ? 26 : kind === "snow" ? 22 : 8;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={w} height={h} rx={rx} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {Array.from({ length: n }, (_, i) => {
          const s0 = (i * 7919) % 1000;
          const speed = kind === "rain" ? 700 : kind === "snow" ? 60 : 90;
          const yy = y + ((((t * speed + s0 * 3.1) % (h + 60)) + h + 60) % (h + 60)) - 30;
          const xx = x + ((s0 * 1.7) % w) + (kind === "rain" ? 0 : Math.sin(t * 1.4 + i) * 14);
          if (kind === "rain") return <path key={i} d={`M${xx} ${yy} l-5 22`} stroke="#E4F1FF" strokeWidth="3" strokeLinecap="round" opacity={0.8} />;
          if (kind === "snow") return <circle key={i} cx={xx} cy={yy} r={3 + (s0 % 4)} fill="#FFFFFF" opacity={0.95} />;
          return <path key={i} d={LEAF} transform={`translate(${xx} ${yy}) rotate(${t * 90 + s0}) scale(0.7)`} fill={LEAF_COLORS[i % 4]} />;
        })}
        {kind === "snow" ? <rect x={x} y={y + h - 14} width={w} height={14} fill="#FFFFFF" opacity={0.9} /> : null}
      </g>
    </g>
  );
}

/** Экранные эффекты мира поверх сцены: осадки, листопад, порывы ветра, свет. outdoor=false — только свет (осадки видны в окнах). */
export function WorldFx({ world, t, outdoor, legacy }: { world: WorldState; t: number; outdoor: boolean; legacy?: "rain" | "snow" | "leaves" | null }) {
  const rain = outdoor && (world.weather === "rain" || legacy === "rain");
  const snow = outdoor && (world.weather === "snow" || legacy === "snow");
  const leaves = outdoor && (legacy === "leaves" || (world.season === "autumn" && (world.weather === "windy" || world.weather === "clear" || world.weather === "cloudy")));
  const windy = outdoor && world.weather === "windy";
  const parts: ReactNode[] = [];
  if (rain) {
    parts.push(<rect key="rt" width={W} height={H} fill="#3A5A8C" opacity={0.12} />);
    for (let i = 0; i < 110; i++) {
      const s0 = (i * 7919) % 1000;
      const y = ((t * 950 + s0 * 3.7) % 1200) - 60;
      const x = ((s0 * 1.93) % 2100) - 90 - y * 0.18;
      parts.push(<path key={`r${i}`} d={`M${x} ${y} l-8 36`} stroke="#DCEBFF" strokeWidth={i % 3 ? 3 : 4} strokeLinecap="round" opacity={0.7} />);
    }
  }
  if (snow) {
    for (let i = 0; i < 90; i++) {
      const s0 = (i * 7919) % 1000;
      const depth = 0.5 + (s0 % 10) / 10; // ближние хлопья крупнее и быстрее
      const y = ((t * 70 * depth + s0 * 3.7) % 1200) - 60;
      const x = ((s0 * 1.93) % 1920) + Math.sin(t * 1.1 + i) * 26 * depth;
      parts.push(<circle key={`s${i}`} cx={x} cy={y} r={3 + depth * 4} fill="#FFFFFF" opacity={0.75 + depth * 0.2} />);
    }
  }
  if (leaves) {
    const n = windy || legacy === "leaves" ? 26 : 9;
    for (let i = 0; i < n; i++) {
      const s0 = (i * 7919) % 1000;
      const fall = windy ? 150 : 90;
      const y = ((t * fall + s0 * 3.7) % 1200) - 60;
      const drift = windy ? ((t * 260 + s0 * 2.3) % 2300) - 200 : ((s0 * 1.93) % 1920) + Math.sin(t * 1.3 + i) * 60;
      parts.push(<path key={`l${i}`} d={LEAF} transform={`translate(${drift} ${y}) rotate(${t * 120 + s0}) scale(${0.9 + (s0 % 5) * 0.1})`} fill={LEAF_COLORS[i % 4]} />);
    }
  }
  if (windy) {
    // мультяшные порывы ветра: белые завитки, пролетающие через кадр
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.45 + i * 0.27) % 1;
      const x = -400 + ph * (W + 800);
      const y = 180 + i * 150 + Math.sin(i * 2.1) * 40;
      const op = Math.sin(ph * Math.PI) * 0.55;
      parts.push(
        <path key={`w${i}`} d={`M${x} ${y} q90 -40 180 0 t180 0 q50 -30 20 -60 q-30 -10 -30 20`} stroke="#FFFFFF" strokeWidth="7" fill="none" strokeLinecap="round" opacity={op} />,
      );
    }
  }
  // свет: ночью — тёмная виньетка (в помещении — тёплое пятно лампы в центре), вечером — тёплая дымка
  if (world.time === "night")
    parts.push(
      <g key="night">
        <defs>
          <radialGradient id="night-vignette" cx="50%" cy="58%" r="75%">
            <stop offset="0.35" stopColor={outdoor ? "#0E1640" : "#FFC870"} stopOpacity={outdoor ? 0.05 : 0.07} />
            <stop offset="1" stopColor="#0E1640" stopOpacity={outdoor ? 0.36 : 0.3} />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="#1B2A6B" opacity={outdoor ? 0.16 : 0.07} />
        <rect width={W} height={H} fill="url(#night-vignette)" />
      </g>,
    );
  else if (world.time === "evening") parts.push(<rect key="eve" width={W} height={H} fill="#FF7A3D" opacity={0.07} />);
  else if (world.time === "morning") parts.push(<rect key="morn" width={W} height={H} fill="#FFD9B0" opacity={0.05} />);
  return <g>{parts}</g>;
}
