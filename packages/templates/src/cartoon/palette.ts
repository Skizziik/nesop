/**
 * Палитры локаций на токенах (docs/cartoon-visual-variety.md, «Палитры вместо жёстких цветов»).
 * Локации не держат hex в JSX — только pal.<токен>. resolvePalette(location, world) = база × время суток × погода × сезон,
 * поэтому вечер, дождь и осень достаются любой локации, включая будущие.
 * Детали, выбираемые по сиду сцены (цвет двери, игрушек, цветов), — через pick/rnd из Remotion random: Math.random запрещён.
 */
import { random } from "remotion";
import type { Season, TimeOfDay, Weather } from "./catalog";

export interface WorldState {
  time: TimeOfDay;
  weather: Weather;
  season: Season;
  dressing?: string;
}
export const DEFAULT_WORLD: WorldState = { time: "day", weather: "clear", season: "summer" };

/** Набор токенов. Префиксы задают, как токен реагирует на мир: sky* — небо, остальные — «земные» цвета. */
export type Palette = Record<string, string>;

/** Сочные «игрушечные» цвета из утверждённой палитры — для мелочей, выбираемых по сиду. */
export const TOY_COLORS = ["#FF4D5A", "#3D8BFF", "#FFD23F", "#4CB944", "#FF8A2A", "#8E5CFF", "#FF6FA8", "#5DA9FF", "#FF6B6B", "#B38BFF"];

/** Детерминированное 0..1 по сиду и ключу. seed 0 — каноническая раскладка (старые документы рендерятся как раньше). */
export const rnd = (seed: number, key: string) => random(`${seed}:${key}`);
/** Выбор по сиду; при seed 0 — значение по умолчанию. */
export function pick<T>(seed: number, key: string, options: readonly T[], def: T): T {
  if (!seed) return def;
  return options[Math.floor(rnd(seed, key) * options.length) % options.length] ?? def;
}
/** Сдвиг по сиду в диапазоне ±amp (при seed 0 — 0). */
export const jitter = (seed: number, key: string, amp: number) => (seed ? (rnd(seed, key) * 2 - 1) * amp : 0);

const GARDEN: Palette = {
  sky1: "#6EC6FF", sky2: "#CFEFFF", skySun: "#FFD93D", skySunRim: "#F5B700", skySunGlow: "#FFE45C", skyCloud: "#FFFFFF", skyCloudShade: "#E6F2FF",
  hillFar: "#8FD98A", hillMid: "#6CCB5F", grass: "#5DBB52", grassBlade: "#4CA442", leafFar: "#5CC157", leaf: "#4CB944", trunk: "#8B5A2B", fruit: "#FF4D5A",
  path: "#E9D3A8", pathEdge: "#D2B886", fence: "#FFFFFF", fenceLine: "#D8CBB8", bush1: "#4FB04A", bush2: "#58BA52", bush3: "#4AA845", bushLine: "#3E9139",
  bushFlower1: "#FF7AB0", bushFlower2: "#FFFFFF", stem: "#3E9B3A", flowerCenter: "#FFD54A", flower1: "#FF6FA8", flower2: "#FFFFFF", flower3: "#FFB23F", flower4: "#C38BFF",
  houseWall: "#FFE3B3", houseTrim: "#C99A5A", roof: "#E8574C", roofLine: "#A8352C", chimney: "#C9564C", chimneyLine: "#8C3A33", door: "#6B4BB0", knob: "#FFD54A",
  glass: "#BDE6FF", fg1: "#3FA243", fg2: "#47AE4A", fg3: "#3A9A3E", butterfly1: "#FFB23F", butterfly2: "#B38BFF", ink: "#3A2A44",
};

const BASE: Record<string, Palette> = {
  garden: GARDEN,
  garden_evening: { ...GARDEN, sky1: "#FF9A6B", sky2: "#FFD9A0" },
  living_room: {
    wall: "#FFE8C9", wallDot: "#FFD9AE", skyWindow: "#8FD3FF", windowHill: "#7ED36E", skyWindowSun: "#FFE04D", skyWindowCloud: "#FFFFFF", wood: "#C98F55",
    curtain: "#FF8FA3", frame: "#E0A33E", canvas: "#FFF7E8", art1: "#7BC96F", art2: "#FFB23F", toy1: "#5DA9FF", toy2: "#FF6B6B", toy3: "#FFD23F", toy4: "#B38BFF",
    skirting: "#E9C99A", floor: "#D9A46A", sofa: "#4FA3E0", sofaSeat: "#5DB2EE", cushion: "#FFD23F", rug: "#FF9FB2", rugStitch: "#FFFFFF",
  },
  kitchen: {
    wall: "#E6F6EE", tile1: "#FFFFFF", tile2: "#D7F0E4", skyWindow: "#9ADBFF", skyWindowSun: "#FFE04D", windowFrame: "#7FB59A", cupboard: "#FFFFFF", cupboardLine: "#B9D9C8",
    fridge: "#FFFFFF", fridgeLine: "#BFD0D8", magnet1: "#FF6B6B", magnet2: "#FFD23F", counter: "#F7C873", pot: "#E8574C", steam: "#FFFFFF", fruit1: "#FF4D5A", fruit2: "#FFB23F",
    fruit3: "#FFE04D", bowl: "#5DA9FF", floor: "#F3E2C3", floorTile: "#E8D0A5", table: "#C98F55", tableLeg: "#B07A45", plate: "#FFFFFF",
  },
  bedroom: {
    wall: "#DCD3F5", wallStar: "#C9BDEE", skyWindow: "#9ADBFF", skyMoon: "#FFF3B0", skyWindowSun: "#FFE04D", skyWindowCloud: "#FFFFFF", skyStar: "#FFFFFF",
    windowFrame: "#E8D6A8", floor: "#B69BD9", rug: "#D9B8F0",
    bed: "#E8B4FF", sheet: "#FFFFFF", sheetLine: "#D8CBE8", blanket: "#7FC6FF", blanketDot: "#FFFFFF", wood: "#C98F55", lamp: "#FFE9A0", lampLine: "#E5C467",
  },
  playground: {
    sky1: "#62C2FF", sky2: "#D6F1FF", skySun: "#FFD93D", skySunRim: "#F5B700", skyCloud: "#FFFFFF", hillFar: "#8FD98A", trunk: "#8B5A2B", leafFar: "#5CC157",
    grassMid: "#6CCB5F", grass: "#5DBB52", frame: "#3D8BFF", deck: "#FF5E5B", slide: "#FFD23F", swingFrame: "#E8574C", rope: "#7A6A5A", seat: "#5DA9FF",
    wood: "#C98F55", sand: "#F5DB9A", toy: "#FF5E5B",
  },
  beach: {
    sky1: "#4FB8FF", sky2: "#C7EEFF", skySun: "#FFDD44", skySunRim: "#F5B700", skyBird: "#3A3A5A", sea: "#2E9FE8", seaFoam: "#BDEBFF", surf: "#6CCBFF", surfLine: "#FFFFFF",
    sand: "#F7DFA5", sandDot: "#E3C27C", pole: "#FFFFFF", poleLine: "#CCCCCC", umbrella: "#FF5E5B", umbrellaStripe: "#FFFFFF", shell1: "#FFB3C6", shell2: "#FFD23F",
    bucket: "#3D8BFF", handle: "#333333",
  },
  forest: {
    sky1: "#8ED6C5", sky2: "#E6F7E1", pineFar: "#7CC28A", pine: "#4FAE63", trunk: "#7A4E2A", grassMid: "#79C46B", grass: "#68B85A", water: "#6CCBFF", waterFoam: "#FFFFFF",
    skyRay: "#FFFBE0", stalk: "#FFF3DD", stalkLine: "#D8C6A5", cap1: "#FF4D5A", cap2: "#FFB23F", capDot: "#FFFFFF",
  },
};

/** Ночные палитры помещений, нарисованные вручную (детская ночью — свой глубокий синий, а не затемнённый день). */
const NIGHT: Record<string, Palette> = {
  bedroom: { wall: "#3B3A7A", wallStar: "#5A58A8", skyWindow: "#1F2457", floor: "#5E4B8B", rug: "#7E66B8" },
};

const INDOOR = new Set(["living_room", "kitchen", "bedroom"]);
const GROUND_T = new Set(["grass", "grassBlade", "grassMid", "hillFar", "hillMid", "windowHill"]);
const LEAF_T = new Set(["leaf", "leafFar", "bush1", "bush2", "bush3", "fg1", "fg2", "fg3"]);
const PINE_T = new Set(["pine", "pineFar"]);
const FLOWER_T = new Set(["flower1", "flower2", "flower3", "flower4", "bushFlower1", "bushFlower2"]);

const rgb = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
/** Смесь цветов: k=0 — a, k=1 — b. */
export function mix(a: string, b: string, k: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}
/** Приглушить насыщенность (к серому той же яркости). */
function desat(a: string, k: number): string {
  const [r, g, b] = rgb(a);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return hex(r + (l - r) * k, g + (l - g) * k, b + (l - b) * k);
}
const darken = (a: string, k: number) => mix(a, "#000000", k);

/** Что видно на небе в этом мире: солнце, луна, звёзды, сколько облаков и какие они. */
export function skyState(world: WorldState) {
  const overcast = world.weather === "rain" || world.weather === "snow" || world.weather === "cloudy";
  const night = world.time === "night";
  return {
    sun: !night && !overcast,
    moon: night && world.weather !== "rain" && world.weather !== "snow",
    stars: night && !overcast,
    clouds: world.weather === "cloudy" ? 2 : overcast ? 3 : 1, // множитель числа облаков
    wind: world.weather === "windy" ? 3 : world.weather === "rain" ? 1.6 : 1, // размах качания деревьев
    snowCover: world.season === "winter",
    flowers: world.season !== "winter",
  };
}

/** Небо по времени суток при ясной погоде: [верх, низ]. */
const SKY_TIME: Record<TimeOfDay, [string, string] | null> = {
  morning: ["#8FD0FF", "#FFD6B8"],
  day: null,
  evening: ["#FF9A6B", "#FFD9A0"],
  night: ["#141B4A", "#34407E"],
};
const SKY_WEATHER: Partial<Record<Weather, [string, number]>> = { cloudy: ["#B7C4D3", 0.6], rain: ["#8696AB", 0.72], snow: ["#D5DEE8", 0.75] };

function seasonal(k: string, v: string, season: Season, pal: Palette): string {
  if (season === "summer") return v;
  if (GROUND_T.has(k)) return season === "spring" ? mix(v, "#9BE38F", 0.25) : season === "autumn" ? mix(v, "#C8B45A", 0.4) : mix(v, "#F4F8FC", 0.86);
  if (LEAF_T.has(k)) return season === "spring" ? mix(v, "#8EE07F", 0.22) : season === "autumn" ? mix(v, k === "leafFar" ? "#FFB23F" : "#FF8A2A", 0.55) : mix(v, "#E6EEF5", 0.72);
  if (k === "bushLine") return season === "autumn" ? mix(v, "#B5651D", 0.5) : season === "winter" ? mix(v, "#AFC2D3", 0.7) : v;
  if (PINE_T.has(k)) return season === "autumn" ? mix(v, "#4F7F4A", 0.2) : season === "winter" ? mix(v, "#3F6F5A", 0.35) : v;
  if (k === "fruit") return season === "spring" ? "#FF9FC4" : season === "winter" ? seasonal("leaf", pal.leaf ?? v, season, pal) : v;
  if (k === "water" && season === "winter") return "#CFE9F7";
  if (k === "path" && season === "winter") return mix(v, "#F4F8FC", 0.6);
  if (FLOWER_T.has(k) && season === "autumn") return mix(v, "#C9884A", 0.25);
  return v;
}

/**
 * Палитра локации для состояния мира: база × сезон (растения, вода) × погода (небо, приглушение) × время суток (небо, свет).
 * Небо (токены sky*) и «земля» меняются по-разному; помещения ночью темнеют меньше — горит свет.
 */
export function resolvePalette(location: string, world: WorldState = DEFAULT_WORLD): Palette {
  const w: WorldState = location === "garden_evening" ? { ...world, time: world.time === "day" ? "evening" : world.time } : world;
  const base = BASE[location] ?? GARDEN;
  const indoor = INDOOR.has(location);
  const night = w.time === "night" ? NIGHT[location] : undefined;
  const out: Palette = {};
  const timeSky = SKY_TIME[w.time];
  const wx = SKY_WEATHER[w.weather];
  const skyColor = (v: string, pos: number): string => {
    let c = v;
    if (wx) c = mix(c, wx[0], wx[1]);
    if (timeSky) c = mix(c, mix(timeSky[0], timeSky[1], pos), wx ? (w.time === "night" ? 0.75 : 0.4) : 1);
    return c;
  };
  for (const [k, v0] of Object.entries(base)) {
    if (night?.[k]) {
      out[k] = night[k]!;
      continue;
    }
    let v = seasonal(k, v0, w.season, base);
    if (k.startsWith("sky")) {
      if (k === "sky1" || k === "skyWindow") v = location === "garden_evening" && w.time === "evening" && !wx ? v : skyColor(v, k === "sky1" ? 0 : 0.35);
      else if (k === "sky2") v = location === "garden_evening" && w.time === "evening" && !wx ? v : skyColor(v, 1);
      else if (k === "skyCloud" || k === "skyWindowCloud") v = w.time === "night" ? "#4B5694" : w.weather === "rain" ? "#9AA6B8" : w.weather === "cloudy" || w.weather === "snow" ? "#E9EDF2" : w.time === "evening" ? "#FFE2C8" : v;
      else if (k === "skyCloudShade") v = w.time === "night" ? "#3B4580" : w.weather === "rain" ? "#7E8BA0" : w.weather === "cloudy" || w.weather === "snow" ? "#CDD5DF" : w.time === "evening" ? "#F5B99A" : v;
      else if (k === "skySun" || k === "skyWindowSun") v = w.time === "night" ? "#FFF3B0" : w.time === "evening" ? "#FFB23F" : v;
      else if (k === "skyRay") v = w.time === "evening" ? "#FFD9A0" : v;
      out[k] = v;
      continue;
    }
    if (wx) v = w.weather === "rain" ? desat(darken(v, 0.1), 0.2) : desat(v, w.weather === "snow" ? 0.08 : 0.14);
    if (w.time === "morning") v = mix(v, "#FFD9B0", 0.06);
    else if (w.time === "evening") v = darken(mix(v, "#FF8A4A", 0.14), 0.04);
    else if (w.time === "night") v = indoor ? mix(v, "#2A2560", 0.3) : mix(v, "#1B2A6B", 0.52);
    out[k] = v;
  }
  return out;
}

export const PALETTE_LOCATIONS = Object.keys(BASE);
