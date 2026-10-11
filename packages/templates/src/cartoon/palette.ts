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
    sky1: "#62C2FF", sky2: "#D6F1FF", skySun: "#FFD93D", skySunRim: "#F5B700", skySunGlow: "#FFE45C", skyCloud: "#FFFFFF", skyCloudShade: "#E6F2FF", hillFar: "#8FD98A", trunk: "#8B5A2B", leafFar: "#5CC157",
    grassMid: "#6CCB5F", grass: "#5DBB52", frame: "#3D8BFF", deck: "#FF5E5B", slide: "#FFD23F", swingFrame: "#E8574C", rope: "#7A6A5A", seat: "#5DA9FF",
    wood: "#C98F55", sand: "#F5DB9A", toy: "#FF5E5B",
  },
  beach: {
    sky1: "#4FB8FF", sky2: "#C7EEFF", skySun: "#FFDD44", skySunRim: "#F5B700", skySunGlow: "#FFE45C", skyCloud: "#FFFFFF", skyCloudShade: "#E6F2FF", skyBird: "#3A3A5A", sea: "#2E9FE8", seaFoam: "#BDEBFF", surf: "#6CCBFF", surfLine: "#FFFFFF",
    sand: "#F7DFA5", sandDot: "#E3C27C", pole: "#FFFFFF", poleLine: "#CCCCCC", umbrella: "#FF5E5B", umbrellaStripe: "#FFFFFF", shell1: "#FFB3C6", shell2: "#FFD23F",
    bucket: "#3D8BFF", handle: "#333333",
  },
  forest: {
    sky1: "#8ED6C5", sky2: "#E6F7E1", skySun: "#FFE45C", skySunRim: "#F5C400", skySunGlow: "#FFF3A0", skyCloud: "#FFFFFF", skyCloudShade: "#E3F2EA", pineFar: "#7CC28A", pine: "#4FAE63", trunk: "#7A4E2A", grassMid: "#79C46B", grass: "#68B85A", water: "#6CCBFF", waterFoam: "#FFFFFF",
    skyRay: "#FFFBE0", stalk: "#FFF3DD", stalkLine: "#D8C6A5", cap1: "#FF4D5A", cap2: "#FFB23F", capDot: "#FFFFFF",
  },
  /* ---- этап 5: новые локации (locations_more.tsx) ---- */
  bathroom: {
    wall: "#DDF3F8", wallDot: "#C8EAF3", tile1: "#FFFFFF", tile2: "#BFE6F1", tileBand: "#FF9FB2", tileBandDot: "#FFFFFF", grout: "#A9D7E4",
    skyWindow: "#9ADBFF", skyWindowSun: "#FFE04D", skyWindowCloud: "#FFFFFF", windowHill: "#7ED36E", windowFrame: "#FFFFFF", frost: "#F2FBFF",
    tub: "#FFFFFF", tubLine: "#9CCBDD", tubFoot: "#FFC94D", foam: "#FFFFFF", foamShade: "#DDF2FB", water: "#8FDCFF", bubbleRim: "#9ED8F0",
    curtain: "#B9A2FF", curtainDot: "#FFFFFF", rail: "#C9D6E2", sink: "#FFFFFF", sinkLine: "#9CCBDD", tap: "#C9D6E2", mirror: "#CDEFFF", mirrorShine: "#FFFFFF",
    mirrorFrame: "#FFB86B", duck: "#FFD23F", duckBeak: "#FF8A2A", towel1: "#FF8FA3", towel2: "#7FC6FF", towelStripe: "#FFFFFF", rack: "#D9B98A",
    shelf: "#F2D9A8", bottle1: "#8E5CFF", bottle2: "#4CB944", bottle3: "#FF6FA8", cup: "#5DA9FF", brush1: "#FF6FA8", brush2: "#FFD23F", plant: "#4CB944", pot: "#FF8A5B",
    floor: "#FFE6BF", floorTile: "#F6D6A2", mat: "#9EDB8A", matDot: "#FFFFFF", stool: "#3D8BFF", lamp: "#FFF1C4", glowLamp: "#FFE9A0", ink: "#3A2A44",
  },
  classroom: {
    wall: "#FFF2CF", wallLow: "#BFE3FF", wallRail: "#FFFFFF", skirting: "#E9C99A", floor: "#E8B983", plank: "#D9A46A",
    skyWindow: "#9ADBFF", skyWindowSun: "#FFE04D", skyWindowCloud: "#FFFFFF", windowHill: "#7ED36E", windowFrame: "#FFFFFF", windowSill: "#F2D9A8",
    card: "#FFFFFF", cork: "#E8BE85", corkDot: "#D6A66A", paper: "#FFFFFF", easel: "#C98F55", table: "#FFD23F", tableLeg: "#F2A93B",
    chair1: "#FF5E5B", chair2: "#3D8BFF", chair3: "#4CB944", chair4: "#B38BFF", cubby: "#F7DDB0", cubbyIn: "#E6C38C", hook: "#FF8A5B",
    rug: "#9FD3FF", rugEdge: "#FFFFFF", shape1: "#FF6B6B", shape2: "#FFD23F", shape3: "#4CB944", shape4: "#8E5CFF",
    clock: "#FFFFFF", clockRim: "#FF6FA8", plant: "#4CB944", pot: "#FF8A5B", bowl: "#D6F2FF", fish: "#FF8A2A", ink: "#3A2A44",
  },
  farm: {
    sky1: "#6EC6FF", sky2: "#D4F0FF", skySun: "#FFD93D", skySunRim: "#F5B700", skySunGlow: "#FFE45C", skyCloud: "#FFFFFF", skyCloudShade: "#E6F2FF",
    hillFar: "#9ADB86", hillMid: "#79CC62", grassMid: "#6CC45A", grass: "#5DBB52", grassBlade: "#4CA442", leafFar: "#5CC157", leaf: "#4CB944", trunk: "#8B5A2B",
    bush1: "#4FB04A", bushLine: "#3E9139", field1: "#F4D56A", field2: "#B7E07A", field3: "#E9C25A", fruit: "#FF4D5A",
    barn: "#E8574C", barnTrim: "#FFFFFF", barnRoof: "#9C4A44", barnDark: "#B9453D", silo: "#D7DDE8", siloTop: "#8FA6C8", hay: "#F5CE5A", hayLine: "#D9A93A",
    fence: "#E3B479", windmill: "#FFFFFF", blade: "#FF8A5B", path: "#E9D3A8", pathEdge: "#D2B886", mud: "#B98A5E",
    cow: "#FFFFFF", cowSpot: "#6A5470", cowNose: "#FFB3C6", horn: "#FFE9B0", sheep: "#FFFFFF", sheepFace: "#6A5470", hen: "#FFFFFF", comb: "#FF4D5A",
    beak: "#FFB23F", chick: "#FFE04D", pig: "#FFB3C6", pigDark: "#FF94B0", tractor: "#4CB944", tractorCab: "#FFD23F", wheel: "#5A4E66", hub: "#FFD23F",
    flower1: "#FF6FA8", flower2: "#FFFFFF", flower3: "#FFB23F", flowerCenter: "#FFD54A", stem: "#3E9B3A", glass: "#BDE6FF", glowWindow: "#FFD97A", ink: "#3A2A44",
  },
  park_pond: {
    sky1: "#68C3FF", sky2: "#D2F0FF", skySun: "#FFD93D", skySunRim: "#F5B700", skySunGlow: "#FFE45C", skyCloud: "#FFFFFF", skyCloudShade: "#E6F2FF",
    hillFar: "#94D98A", hillMid: "#73CB64", grassMid: "#68C25B", grass: "#5DBB52", grassBlade: "#4CA442", leafFar: "#62C45A", leaf: "#4CB944", trunk: "#8B5A2B",
    bush1: "#4FB04A", bush2: "#5ABD52", bushLine: "#3E9139", fruit: "#FF7AB0", water: "#6CCBFF", waterDeep: "#52B6F0", waterFoam: "#FFFFFF", lily: "#5DBB6A", lilyFlower: "#FF9FC4",
    reed: "#6DAE4F", cattail: "#A8703E", path: "#EED9AE", pathEdge: "#D6BC8A", bench: "#D08C4E", benchMetal: "#5C6E91", lampPost: "#5C6E91", lampGlass: "#E8F4FF", glowLamp: "#FFE9A0",
    bridge: "#C98F55", bridgeRail: "#E8A15C", duck: "#FFFFFF", duckHead: "#4FB57A", beak: "#FFA63D", duckling: "#FFE04D", stone: "#C9C4D6",
    flower1: "#FF6FA8", flower2: "#FFFFFF", flower3: "#FFB23F", flower4: "#C38BFF", flowerCenter: "#FFD54A", stem: "#3E9B3A", ink: "#3A2A44",
  },
  snowy_hill: {
    sky1: "#7CC8FF", sky2: "#E2F4FF", skySun: "#FFE45C", skySunRim: "#F5C400", skySunGlow: "#FFF3A0", skyCloud: "#FFFFFF", skyCloudShade: "#E3EEF8",
    mountain: "#A9C3EC", mountainShade: "#93B0E0", peak: "#FFFFFF", snowFar: "#EEF5FC", snowMid: "#F6FAFE", snow: "#FFFFFF", snowShade: "#D7E7F5", snowLine: "#BFD5EA",
    pineFar: "#6FB38A", pine: "#4FA066", trunk: "#7A4E2A", cabin: "#C98F55", cabinLog: "#A86F3E", cabinRoof: "#E8574C", cabinDoor: "#6B4BB0", glass: "#BDE6FF", glowWindow: "#FFD97A",
    smoke: "#FFFFFF", sled: "#FF4D5A", sledRunner: "#5C6E91", flag: "#FFD23F", pole: "#A86F3E", carrot: "#FF8A2A", coal: "#5A4E66", scarf: "#3D8BFF", ink: "#3A2A44",
  },
  campsite: {
    sky1: "#72C4FF", sky2: "#D8F1FF", skySun: "#FFD93D", skySunRim: "#F5B700", skySunGlow: "#FFE45C", skyCloud: "#FFFFFF", skyCloudShade: "#E6F2FF",
    mountainFar: "#A9BFEA", mountain: "#8EA9DF", peak: "#FFFFFF", lake: "#7FD0F5", lakeShine: "#FFFFFF", pineFar: "#76BC86", pine: "#4FAE63", trunk: "#7A4E2A",
    hillFar: "#8ED68A", grassMid: "#70C462", grass: "#62BA55", grassBlade: "#4FA545", tent: "#FF8A2A", tentSide: "#E86F1E", tentFlap: "#FFD23F", tentIn: "#9B4A1F", rope: "#B59A7A",
    log: "#A8703E", logEnd: "#EDC98E", stone: "#BDB8CC", stoneShade: "#A39DB6", glowFire1: "#FF5A3C", glowFire2: "#FF9F2A", glowFire3: "#FFE04D",
    flag1: "#FF4D5A", flag2: "#3D8BFF", flag3: "#FFD23F", flag4: "#4CB944", glowLamp: "#FFE29A", lanternFrame: "#5C6E91", kettle: "#5DA9FF", backpack: "#8E5CFF", ink: "#3A2A44",
  },
  space: {
    sky1: "#2E2A7E", sky2: "#6A48C2", skyNebula1: "#C063D9", skyNebula2: "#4FA0F0", skyStar: "#FFF6C8",
    planet1: "#FF9A5B", planet1Band: "#FFC27A", ring: "#FFD23F", planet2: "#FF7AB8", planet2Spot: "#FFB3D6", earth: "#4FA3F5", earthLand: "#6CD36A",
    moonFar: "#9C8FD8", moonMid: "#B4A9E6", ground: "#D2CBF2", groundShade: "#BDB3EA", crater: "#AFA4E0", rock: "#9F95D6",
    rocket: "#FFFFFF", rocketLine: "#B9C2D8", rocketRed: "#FF4D5A", rocketBlue: "#3D8BFF", window: "#7FD6FF", flame1: "#FFD23F", flame2: "#FF8A2A",
    gem1: "#5DE0D0", gem2: "#FF8AD0", gem3: "#FFE04D", satellite: "#E6EAF2", panel: "#5DA9FF", comet: "#FFFFFF", ink: "#3A2A44",
  },
  underwater: {
    sky1: "#62D2F5", sky2: "#2A8ED8", skyRay: "#EAFDFF", surface: "#A8ECFF",
    reefFar: "#5DB3E0", reefMid: "#4FA9D9", sand: "#F7DFA5", sandShade: "#EACB8A", sandDot: "#E0BC78", rock: "#8C9FD8", rockShade: "#7A8DCB",
    coral1: "#FF6FA8", coral2: "#FF8A5B", coral3: "#B38BFF", coral4: "#FFD23F", weed1: "#4CC77A", weed2: "#36B36E",
    fish1: "#FFB23F", fish2: "#FF6B6B", fish3: "#FFE04D", fish4: "#B38BFF", fishStripe: "#FFFFFF", jelly: "#FFA8D8", whale: "#4F86D8", whaleBelly: "#BFE2FF",
    turtle: "#7FCB6A", shell: "#C98F55", starfish: "#FF8A2A", seashell: "#FFC1D6", chest: "#C98F55", gold: "#FFD23F", bubble: "#EAFDFF", ink: "#3A2A44",
  },
};

/** Ночные палитры помещений, нарисованные вручную (детская ночью — свой глубокий синий, а не затемнённый день). */
const NIGHT: Record<string, Palette> = {
  bedroom: { wall: "#3B3A7A", wallStar: "#5A58A8", skyWindow: "#1F2457", floor: "#5E4B8B", rug: "#7E66B8" },
};

const INDOOR = new Set(["living_room", "kitchen", "bedroom"]);
INDOOR.add("bathroom").add("classroom");
/** Воображаемые миры («понарошку»): своя яркая палитра, модификаторы времени/погоды/сезона не применяются. */
export const IMAGINARY = new Set(["space", "underwater"]);
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
export function resolvePalette(location: string, world: WorldState = DEFAULT_WORLD, extra?: Palette): Palette {
  const w: WorldState = location === "garden_evening" ? { ...world, time: world.time === "day" ? "evening" : world.time } : world;
  const base = extra ?? BASE[location] ?? GARDEN; // extra — свои цвета (например, выбранные по сиду) в освещении этой локации
  if (IMAGINARY.has(location)) return { ...base };
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
    if (k.startsWith("glow")) {
      out[k] = v0; // источники света (огонь, фонари, окна) не темнеют ночью и не тускнеют в дождь
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
    else if (w.time === "night") v = indoor ? mix(mix(v, "#4A3570", 0.24), "#FFC870", 0.05) : mix(v, "#1B2A6B", 0.52);
    out[k] = v;
  }
  return out;
}

export const PALETTE_LOCATIONS = Object.keys(BASE);

/** Тонировщик для цветов вне палитры (выбранных по сиду): тот же свет, погода и время суток, что у палитры локации. */
export const worldTone = (location: string, world: WorldState) => (c: string): string => resolvePalette(location, world, { c }).c ?? c;
