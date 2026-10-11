/**
 * Единый каталог мультиков — одна точка правды (docs/cartoon-visual-variety.md, этап 0).
 * Здесь только данные (без React): id, подпись для дашборда (label), строка для промпта LLM (llm), теги и совместимость.
 * Отрисовка — в rig/props/locations; тест проверяет, что у каждой записи есть реализация.
 * Python получает каталог через `pnpm --filter @ipt/templates catalog:export` → services/api/app/pipeline/cartoon_catalog.json.
 */

export type TimeOfDay = "morning" | "day" | "evening" | "night";
export type Weather = "clear" | "cloudy" | "rain" | "snow" | "windy";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Compat {
  outdoor?: boolean; // только на улице
  indoor?: boolean; // только в помещении
  seasons?: Season[];
  weather?: Weather[];
  times?: TimeOfDay[];
}

export interface CharacterEntry {
  id: string;
  name: string;
  label: string;
  llm: string; // характер для библии сериала
  catchphrase: string;
  voice: { description: string; speed: number };
  adult?: boolean;
}
export interface LocationEntry {
  id: string;
  label: string;
  llm: string;
  outdoor: boolean;
  tags: string[];
  /** Состояния мира, которые локация умеет показывать (таблица совместимости; плюс общие правила в worldAllowed). */
  times: TimeOfDay[];
  weather: Weather[];
  seasons: Season[];
}
export interface PropEntry {
  id: string;
  label: string;
  llm: string;
  group: "toys" | "food" | "home" | "nature" | "clothes" | "party";
  ground?: boolean; // стоит на земле, а не в руке
  colors?: string[]; // имена цветов из палитры (для уроков про цвета)
  adult_only?: boolean;
  compat?: Compat;
}
export interface OutfitEntry {
  id: string;
  label: string;
  llm: string;
  slot: "head" | "body" | "feet" | "face" | "hand";
  auto?: { weather?: Weather[]; locations?: string[]; times?: TimeOfDay[]; dressing?: string[] };
}
export interface SimpleEntry {
  id: string;
  label: string;
  llm: string;
}

/** Цвета, которые сценарист может называть (уроки про цвета). Значения — утверждённая палитра стиль-гайда. */
export const COLORS: Record<string, string> = {
  red: "#FF4D5A",
  blue: "#3D8BFF",
  yellow: "#FFD23F",
  green: "#4CB944",
  orange: "#FF8A2A",
  purple: "#8E5CFF",
  pink: "#FF6FA8",
  white: "#FFFFFF",
  brown: "#A86B3C",
};

export const CHARACTERS: CharacterEntry[] = [
  {
    id: "benny",
    name: "Benny",
    label: "Бенни (зайчик)",
    llm: "a curious, cheerful little bunny (4), the main character; loves asking 'why?' and trying new things",
    catchphrase: "Hop hop, hooray!",
    voice: { description: "A cheerful, curious little boy about five years old with a bright, high, playful voice, excited and full of wonder, clear American English, speaking slowly.", speed: 0.95 },
  },
  {
    id: "mia",
    name: "Mia",
    label: "Мия (котёнок)",
    llm: "Benny's best friend, a clever kitten (5) with a pink bow; loves drawing, counting and solving problems",
    catchphrase: "I have an idea!",
    voice: { description: "A sweet, clever little girl about five years old with a high, clear, confident voice, kind and bubbly, clear American English, speaking slowly.", speed: 0.95 },
  },
  {
    id: "ollie",
    name: "Ollie",
    label: "Олли (медвежонок)",
    llm: "a big, gentle bear cub (5); slow, kind, always hungry, giggles a lot, sometimes a bit shy",
    catchphrase: "Yummy in my tummy!",
    voice: { description: "A gentle, chubby little boy about six years old with a soft, slightly lower, slow and cozy voice, giggly and kind, clear American English.", speed: 0.92 },
  },
  {
    id: "dot",
    name: "Dot",
    label: "Дот (щенок)",
    llm: "a tiny, super energetic puppy (3); silly, runs everywhere, says 'Me too!'",
    catchphrase: "Woof! Me too, me too!",
    voice: { description: "A tiny, squeaky, super energetic toddler about three years old, very high-pitched, giggly and silly, clear American English, short excited words.", speed: 1.0 },
  },
  {
    id: "mama",
    name: "Mama Bunny",
    label: "Мама-зайчиха",
    llm: "Benny's warm, patient mum; helps the kids find the answer themselves",
    catchphrase: "Let's think about it together.",
    voice: { description: "A warm, loving young mother in her early thirties with a soft, calm, gentle voice, patient and reassuring, clear American English.", speed: 0.95 },
    adult: true,
  },
];

export const NARRATOR = {
  id: "narrator",
  voice: { description: "A friendly female storyteller in her thirties, like a beloved children's TV presenter: warm, smiling, expressive and gentle, clear American English, slow and easy for toddlers to follow.", speed: 0.95 },
};

const ALL_TIMES: TimeOfDay[] = ["morning", "day", "evening", "night"];
const ALL_WEATHER: Weather[] = ["clear", "cloudy", "rain", "snow", "windy"];
const ALL_SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

export const LOCATION_CATALOG: LocationEntry[] = [
  { id: "garden", label: "Сад у дома", llm: "the garden outside Benny's house (fence, flowers, butterflies)", outdoor: true, tags: ["home", "nature"], times: ALL_TIMES, weather: ALL_WEATHER, seasons: ALL_SEASONS },
  { id: "garden_evening", label: "Сад вечером", llm: "the garden at sunset", outdoor: true, tags: ["home", "evening"], times: ["evening"], weather: ["clear", "cloudy", "windy"], seasons: ALL_SEASONS },
  { id: "living_room", label: "Гостиная", llm: "Benny's cosy living room (sofa, toys shelf, lamp, big window)", outdoor: false, tags: ["home"], times: ALL_TIMES, weather: ALL_WEATHER, seasons: ALL_SEASONS },
  { id: "kitchen", label: "Кухня", llm: "the kitchen (table, fridge, fruit bowl, stove, window)", outdoor: false, tags: ["home", "food"], times: ALL_TIMES, weather: ALL_WEATHER, seasons: ALL_SEASONS },
  { id: "bedroom", label: "Детская", llm: "Benny's bedroom (bed, round window, night light) — mornings and bedtime", outdoor: false, tags: ["home", "night"], times: ALL_TIMES, weather: ALL_WEATHER, seasons: ALL_SEASONS },
  { id: "playground", label: "Детская площадка", llm: "the playground (slide, swings, sandbox)", outdoor: true, tags: ["play"], times: ["morning", "day", "evening"], weather: ALL_WEATHER, seasons: ALL_SEASONS },
  { id: "beach", label: "Пляж", llm: "the beach (waves, umbrella, bucket, shells)", outdoor: true, tags: ["summer", "water"], times: ALL_TIMES, weather: ["clear", "cloudy", "windy"], seasons: ["spring", "summer"] },
  { id: "forest", label: "Лес", llm: "the forest (tall pine trees, stream, mushrooms, fireflies at night)", outdoor: true, tags: ["nature"], times: ALL_TIMES, weather: ALL_WEATHER, seasons: ALL_SEASONS },
];

/** Общие правила мира: снег только зимой, дождь не зимой. */
export function worldAllowed(loc: LocationEntry, w: { time: TimeOfDay; weather: Weather; season: Season }): boolean {
  if (!loc.times.includes(w.time) || !loc.weather.includes(w.weather) || !loc.seasons.includes(w.season)) return false;
  if (w.weather === "snow" && w.season !== "winter") return false;
  if (w.weather === "rain" && w.season === "winter") return false;
  return true;
}

export const PROP_CATALOG: PropEntry[] = [
  { id: "ball", label: "Мяч", llm: "a bouncy ball", group: "toys", colors: ["red", "blue", "yellow", "green"] },
  { id: "balloon", label: "Воздушный шарик", llm: "a balloon on a string", group: "party", colors: ["red", "blue", "yellow", "pink", "purple"] },
  { id: "kite", label: "Воздушный змей", llm: "a kite", group: "toys", colors: ["blue", "red", "yellow"], compat: { outdoor: true, weather: ["clear", "windy"] } },
  { id: "umbrella", label: "Зонтик", llm: "an umbrella", group: "clothes", colors: ["red", "yellow", "blue"] },
  { id: "toothbrush", label: "Зубная щётка", llm: "a toothbrush", group: "home", colors: ["blue", "pink", "green"] },
  { id: "book", label: "Книжка", llm: "a picture book", group: "home", colors: ["purple", "blue", "red"] },
  { id: "teddy", label: "Плюшевый мишка", llm: "a teddy bear", group: "toys" },
  { id: "apple", label: "Яблоко", llm: "an apple", group: "food", colors: ["red", "green"] },
  { id: "banana", label: "Банан", llm: "a banana", group: "food" },
  { id: "carrot", label: "Морковка", llm: "a carrot", group: "food" },
  { id: "cake", label: "Торт со свечками", llm: "a birthday cake with candles", group: "party", ground: true },
  { id: "cookie", label: "Печенье", llm: "a cookie", group: "food" },
  { id: "ice_cream", label: "Мороженое", llm: "an ice cream cone", group: "food", colors: ["pink", "white", "brown"] },
  { id: "cup", label: "Чашка", llm: "a cup", group: "home", colors: ["blue", "red", "yellow"] },
  { id: "bucket", label: "Ведёрко", llm: "a toy bucket", group: "toys", ground: true, colors: ["blue", "red", "yellow"] },
  { id: "spade", label: "Лопатка", llm: "a toy spade", group: "toys", colors: ["red", "blue", "green"] },
  { id: "flower", label: "Цветок", llm: "a flower", group: "nature", colors: ["pink", "yellow", "purple", "red"] },
  { id: "star", label: "Звёздочка", llm: "a shiny star", group: "party", colors: ["yellow"] },
  { id: "gift", label: "Подарок", llm: "a wrapped present", group: "party", ground: true, colors: ["purple", "red", "blue"] },
  { id: "crayon", label: "Карандаш", llm: "a crayon", group: "party", colors: ["red", "blue", "green", "yellow", "purple"] },
  { id: "drawing", label: "Рисунок", llm: "a drawing on paper", group: "party" },
  { id: "blocks", label: "Кубики", llm: "toy blocks", group: "toys", ground: true },
  { id: "toy_car", label: "Машинка", llm: "a toy car", group: "toys", ground: true, colors: ["red", "blue", "yellow"] },
  { id: "drum", label: "Барабан", llm: "a toy drum", group: "toys", ground: true },
  { id: "sandwich", label: "Бутерброд", llm: "a sandwich", group: "food" },
  { id: "bowl", label: "Миска", llm: "a bowl", group: "home", colors: ["blue", "red", "yellow"] },
  { id: "pillow", label: "Подушка", llm: "a pillow", group: "home", ground: true, colors: ["blue", "pink", "yellow"] },
  { id: "bubbles", label: "Мыльные пузыри", llm: "a bubble wand blowing bubbles", group: "toys" },
  { id: "leaf", label: "Листик", llm: "an autumn leaf", group: "nature", colors: ["orange", "red", "yellow"], compat: { seasons: ["autumn"] } },
  { id: "shell", label: "Ракушка", llm: "a sea shell", group: "nature", ground: true, colors: ["pink", "white"] },
  { id: "sandcastle", label: "Замок из песка", llm: "a sandcastle", group: "toys", ground: true, compat: { outdoor: true } },
  { id: "snowman", label: "Снеговик", llm: "a snowman", group: "nature", ground: true, compat: { outdoor: true, weather: ["snow"], seasons: ["winter"] } },
  { id: "puddle", label: "Лужа", llm: "a puddle", group: "nature", ground: true, compat: { outdoor: true, weather: ["rain"] } },
  { id: "magnifier", label: "Лупа", llm: "a magnifying glass", group: "nature" },
  { id: "plaster", label: "Пластырь", llm: "a plaster (band-aid)", group: "home" },
];

export const OUTFIT_CATALOG: OutfitEntry[] = [
  { id: "raincoat", label: "Дождевик", llm: "a yellow raincoat with a hood", slot: "body", auto: { weather: ["rain"] } },
  { id: "pajamas", label: "Пижама", llm: "striped pajamas", slot: "body", auto: { locations: ["bedroom"], times: ["night"] } },
  { id: "party_hat", label: "Праздничный колпак", llm: "a party hat", slot: "head", auto: { dressing: ["birthday"] } },
  { id: "scarf", label: "Шарф", llm: "a warm scarf", slot: "body", auto: { weather: ["snow"] } },
  { id: "sun_hat", label: "Панамка", llm: "a sun hat", slot: "head", auto: { locations: ["beach"] } },
  { id: "winter_hat", label: "Зимняя шапка", llm: "a woolly winter hat", slot: "head", auto: { weather: ["snow"] } },
];

export const FX_CATALOG: SimpleEntry[] = [
  { id: "hearts", label: "Сердечки", llm: "little hearts (love, joy, hugs)" },
  { id: "sparkles", label: "Искорки", llm: "sparkles (magic, wow moments)" },
  { id: "zzz", label: "Zzz", llm: "zzz (sleepy)" },
  { id: "notes", label: "Ноты", llm: "music notes (singing, happy)" },
  { id: "sweat", label: "Капелька", llm: "a sweat drop (oops, nervous)" },
  { id: "exclaim", label: "!", llm: "an exclamation mark (surprise)" },
  { id: "question", label: "?", llm: "a question mark (puzzled)" },
  { id: "puff", label: "Облачко пыли", llm: "a dust puff (landing, running)" },
];

export const ACTION_CATALOG: SimpleEntry[] = [
  { id: "talk", label: "говорит", llm: "talking with gestures" },
  { id: "idle", label: "стоит", llm: "standing" },
  { id: "wave", label: "машет", llm: "waving" },
  { id: "point", label: "показывает", llm: "pointing" },
  { id: "jump", label: "прыгает", llm: "jumping" },
  { id: "clap", label: "хлопает", llm: "clapping" },
  { id: "dance", label: "танцует", llm: "dancing" },
  { id: "think", label: "думает", llm: "thinking, hand on chin" },
  { id: "shrug", label: "пожимает плечами", llm: "shrugging" },
  { id: "cheer", label: "ликует", llm: "cheering with arms up" },
  { id: "sad", label: "грустит", llm: "sad, head down" },
  { id: "scared", label: "боится", llm: "a little scared" },
  { id: "hug", label: "обнимает", llm: "hugging" },
  { id: "bow", label: "кланяется", llm: "bowing" },
  { id: "walk", label: "идёт", llm: "walking" },
  { id: "run", label: "бежит", llm: "running" },
  { id: "sit", label: "сидит", llm: "sitting" },
];

export const EMOTION_CATALOG: SimpleEntry[] = [
  { id: "neutral", label: "спокойный", llm: "calm" },
  { id: "happy", label: "радостный", llm: "happy" },
  { id: "laugh", label: "смеётся", llm: "laughing" },
  { id: "sad", label: "грустный", llm: "sad" },
  { id: "surprised", label: "удивлён", llm: "surprised" },
  { id: "angry", label: "сердится", llm: "cross (mildly angry)" },
  { id: "scared", label: "испуган", llm: "a bit scared" },
  { id: "thinking", label: "думает", llm: "thinking" },
  { id: "sleepy", label: "сонный", llm: "sleepy" },
];

export const DRESSING_CATALOG: SimpleEntry[] = [{ id: "birthday", label: "День рождения", llm: "a birthday party (bunting, balloons, cake, party hats)" }];

/** Каталог для экспорта в Python (JSON). */
export function exportCatalog() {
  return {
    version: 1,
    colors: COLORS,
    characters: CHARACTERS,
    narrator: NARRATOR,
    locations: LOCATION_CATALOG,
    props: PROP_CATALOG,
    outfits: OUTFIT_CATALOG,
    fx: FX_CATALOG,
    actions: ACTION_CATALOG,
    emotions: EMOTION_CATALOG,
    dressings: DRESSING_CATALOG,
  };
}
