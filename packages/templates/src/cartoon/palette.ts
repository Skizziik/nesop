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
    wall: "#3B3A7A", wallStar: "#5A58A8", skyWindow: "#1F2457", skyMoon: "#FFF3B0", skyStar: "#FFFFFF", windowFrame: "#E8D6A8", floor: "#5E4B8B", rug: "#7E66B8",
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

/** Палитра локации для состояния мира. Этап 0 — база; модификаторы времени/погоды/сезона добавляет этап 1. */
export function resolvePalette(location: string, world: WorldState = DEFAULT_WORLD): Palette {
  void world;
  return BASE[location] ?? GARDEN;
}

export const PALETTE_LOCATIONS = Object.keys(BASE);
