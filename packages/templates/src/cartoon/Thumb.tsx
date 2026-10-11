/**
 * Обложка мультика 1280×720 в стиле топовых детских каналов: 1-2 крупных СЧАСТЛИВЫХ героя, один большой предмет истории,
 * 1-3 огромных слова, насыщенный фон в дополнительном к герою цвете, толстые белые «стикерные» обводки и маленький логотип серии.
 * Должна читаться на ширине 160 px. Без SVG-фильтров: обводка — CSS-силуэт (stroke поверх копии), «зум-блюр» — радиальные полосы.
 *
 * Макеты (layout): face — огромное лицо героя + предмет; duo — двое радуются предмету в центре; song — радуга, ноты, танец;
 * learn — большие буквы/цифры/цвета; world — сцена с погодой и сезоном (снеговик, дождь, пляж); action — герой в прыжке.
 * Старые пропсы (text, chars, emotions, actions, location, emoji, variant) работают как раньше.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, continueRender, delayRender, random } from "remotion";
import { actionPose, type ActionKind } from "./actions";
import { CAST } from "./cast";
import { COLORS, LOCATION_CATALOG, OUTFIT_CATALOG } from "./catalog";
import { locationDef, locationProps } from "./locations";
import { DEFAULT_WORLD, TOY_COLORS, type WorldState } from "./palette";
import { Prop, PROP_IDS } from "./props";
import { Character, handPositions, rigMetrics, shade, WEAR_IDS, type CEmotion, type Pose, type Wear } from "./rig";
import { WorldFx } from "./world";

export const THUMB_LAYOUTS = ["face", "duo", "world", "song", "learn", "action"] as const;
export type ThumbLayout = (typeof THUMB_LAYOUTS)[number];

export interface CartoonThumbProps {
  text: string;
  chars: string[]; // 1-3 героя, первый — главный (по нему цвет фона)
  emotions?: CEmotion[];
  actions?: ActionKind[];
  location?: string;
  emoji?: string; // старый способ задать предмет; если есть prop — игнорируется
  variant?: number; // без layout выбирает макет по кругу
  layout?: ThumbLayout;
  prop?: string; // id предмета из каталога — большой «предмет истории»
  propColor?: string; // имя цвета каталога или hex
  world?: Partial<WorldState>;
  wear?: string[][]; // костюмы по героям; без него — авто по миру (дождевик, шапка, панамка)
  big?: string; // learn: «ABC», «123», «A»
  colors?: string[]; // learn: цвета урока (имена каталога или hex)
  badge?: string; // логотип серии в углу; "" — без логотипа
  seed?: number;
}

export const CARTOON_THUMB_ID = "CartoonThumb";
export const SERIES_NAME = "Benny & Friends";

const W = 1280;
const H = 720;
const INK = "#2A1B5E";

/** Фон — в дополнительном к герою цвете (герой «выпрыгивает»), текст — контрастный к фону. */
const HERO_BG: Record<string, { a: string; b: string; text: [string, string] }> = {
  benny: { a: "#FF8A00", b: "#FFB02E", text: ["#FFFFFF", "#7DF3FF"] },
  mia: { a: "#1677FF", b: "#3FA2FF", text: ["#FFF04D", "#FFFFFF"] },
  ollie: { a: "#00A8D6", b: "#2CC7EE", text: ["#FFF04D", "#FFFFFF"] },
  dot: { a: "#7A3DFF", b: "#9A68FF", text: ["#FFF04D", "#FFFFFF"] },
  mama: { a: "#FF3D8B", b: "#FF6BA8", text: ["#FFFFFF", "#FFF04D"] },
  papa: { a: "#FF8A00", b: "#FFB02E", text: ["#FFFFFF", "#7DF3FF"] },
  finn: { a: "#1E9BFF", b: "#52B6FF", text: ["#FFF04D", "#FFFFFF"] },
  molly: { a: "#14B8A6", b: "#3FD0BF", text: ["#FFF04D", "#FFFFFF"] },
  ellie: { a: "#FFB300", b: "#FFC93D", text: ["#FFFFFF", "#7A3DFF"] },
  leo: { a: "#6A4CFF", b: "#8C74FF", text: ["#FFF04D", "#FFFFFF"] },
};

const EMOJI_PROP: Record<string, string> = {
  "🍎": "apple", "🍏": "apple", "🎈": "balloon", "🧸": "teddy", "⭐": "star", "🌟": "star", "🎂": "cake", "🍰": "cake", "⚽": "ball", "🏀": "ball",
  "☂️": "umbrella", "☂": "umbrella", "🌂": "umbrella", "☔": "umbrella", "⛄": "snowman", "☃️": "snowman", "🍪": "cookie", "🍦": "ice_cream", "🍨": "ice_cream",
  "🎁": "gift", "🥕": "carrot", "🍌": "banana", "📚": "book", "📖": "book", "🌸": "flower", "🌼": "flower", "🌷": "flower", "🍂": "leaf", "🍁": "leaf",
  "🐚": "shell", "🥁": "drum", "🚗": "toy_car", "🪁": "kite", "🫧": "bubbles", "🖍️": "crayon", "🖍": "crayon", "🥪": "sandwich", "🪥": "toothbrush",
  "🧱": "blocks", "🥣": "bowl", "🔍": "magnifier", "🏰": "sandcastle", "🪣": "bucket", "🥤": "cup", "☕": "cup",
};

// ------------------------------------------------------------------ чистые функции (тестируются)

/** Макет: явный, иначе по номеру варианта. */
export function pickLayout(layout: string | undefined, variant = 0): ThumbLayout {
  if (layout && (THUMB_LAYOUTS as readonly string[]).includes(layout)) return layout as ThumbLayout;
  return THUMB_LAYOUTS[((variant % THUMB_LAYOUTS.length) + THUMB_LAYOUTS.length) % THUMB_LAYOUTS.length]!;
}

/** Оценка ширины строки Fredoka 700 в em (заглавные + обводка). */
const lineEm = (l: string) => l.length * 0.64 + 0.5;

/** Кегль, с которым строки влезают в рамку w×h. */
export function linesFontSize(lines: string[], w: number, h: number): number {
  return Math.min(h / (lines.length * 0.92 + 0.4), ...lines.map((l) => w / (lineEm(l) + 0.34)));
}

/**
 * 1-3 слова → 1-2 строки так, чтобы текст в рамке w×h был максимально крупным.
 * Короткое слово («A», «IT») одно на строке не остаётся.
 */
export function splitLines(text: string, w = 600, h = 240): string[] {
  const words = text.toUpperCase().replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, 3);
  if (words.length <= 1) return words.length ? words : [""];
  const cands: string[][] = [[words.join(" ")]];
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    if (a.length > 2 && b.length > 2) cands.push([a, b]);
  }
  return cands.reduce((best, c) => (linesFontSize(c, w, h) > linesFontSize(best, w, h) * 1.04 ? c : best));
}

/** Предмет истории: id каталога, иначе по эмодзи. */
export function resolveProp(prop?: string, emoji?: string): string | null {
  if (prop && PROP_IDS.includes(prop)) return prop;
  if (emoji) {
    const e = emoji.trim();
    if (EMOJI_PROP[e]) return EMOJI_PROP[e]!;
    const base = e.replace(/️/g, "");
    if (EMOJI_PROP[base]) return EMOJI_PROP[base]!;
  }
  return null;
}

export const colorOf = (c?: string): string | undefined => (!c ? undefined : c.startsWith("#") ? c : COLORS[c.toLowerCase()]);

/** Авто-костюмы по миру — те же правила каталога, что и в эпизоде (cartoon_world.auto_wear). */
export function autoWear(location: string, world: WorldState, adult = false): Wear[] {
  const loc = LOCATION_CATALOG.find((l) => l.id === location);
  const outdoor = loc ? loc.outdoor : true;
  const out: Wear[] = [];
  const slots = new Set<string>();
  for (const o of OUTFIT_CATALOG) {
    const a = o.auto;
    if (!a) continue;
    if (a.outdoor && !outdoor) continue;
    if (a.weather && !a.weather.includes(world.weather)) continue;
    if (a.seasons && !a.seasons.includes(world.season)) continue;
    if (a.times && !a.times.includes(world.time)) continue;
    if (a.locations && !a.locations.includes(location)) continue;
    if (a.dressing && !a.dressing.includes(world.dressing ?? "")) continue;
    if (o.id === "pajamas" && adult) continue;
    const key = o.id === "scarf" ? "scarf" : o.slot;
    if (slots.has(key)) continue;
    slots.add(key);
    out.push(o.id as Wear);
  }
  return out;
}

// ------------------------------------------------------------------ графические кирпичики

/** CSS-силуэт: любая SVG-группа, перекрашенная в один цвет с толстой обводкой. Кладём под оригинал — получается стикер. */
const SIL_CSS = `
.ct-sil *{fill:var(--sc)!important;stroke:var(--sc)!important;stroke-width:var(--ow)!important;stroke-linejoin:round!important;stroke-linecap:round!important;opacity:1!important;stroke-dasharray:none!important}
.ct-sil [fill="none"]{fill:none!important}
.ct-sil ellipse[fill^="rgba"],.ct-sil text{display:none}
`;

function silStyle(color: string, w: number): CSSProperties {
  return { "--sc": color, "--ow": `${w}px` } as CSSProperties;
}

/** Стикер: тень + белая обводка + оригинал. scale — во сколько раз группа увеличена (обводка задаётся в пикселях кадра). */
function Sticker({ children, scale, ow = 9, shadow = true }: { children: ReactNode; scale: number; ow?: number; shadow?: boolean }) {
  const w = (ow * 2) / scale;
  return (
    <g>
      {shadow ? (
        <g opacity={0.3} transform={`translate(${5 / scale} ${9 / scale})`}>
          <g className="ct-sil" style={silStyle(INK, w)}>
            {children}
          </g>
        </g>
      ) : null}
      {/* тонкий тёмный кант снаружи белой обводки — стикер читается и на светлом фоне (снег, небо) */}
      <g className="ct-sil" style={silStyle(INK, w + 6 / scale)}>
        {children}
      </g>
      <g className="ct-sil" style={silStyle("#FFFFFF", w)}>
        {children}
      </g>
      {children}
    </g>
  );
}

function wedge(cx: number, cy: number, a0: number, a1: number, r0: number, r1: number): string {
  const p = (a: number, r: number) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  return r0 > 0 ? `M${p(a0, r0)} L${p(a0, r1)} L${p(a1, r1)} L${p(a1, r0)} Z` : `M${cx} ${cy} L${p(a0, r1)} L${p(a1, r1)} Z`;
}

/** Солнечные лучи из точки — классический фон детских обложек. */
function Sunburst({ cx, cy, colors, n = 20, rot = 0 }: { cx: number; cy: number; colors: string[]; n?: number; rot?: number }) {
  const step = (Math.PI * 2) / n;
  return (
    <g>
      <rect width={W} height={H} fill={colors[0]} />
      {Array.from({ length: n }, (_, i) =>
        i % 2 === 1 || colors.length > 2 ? <path key={i} d={wedge(cx, cy, rot + i * step, rot + (i + 1) * step, 0, 2200)} fill={colors.length > 2 ? colors[i % colors.length] : colors[1]} /> : null,
      )}
    </g>
  );
}

/** Мягкая виньетка (radialGradient — не фильтр): края темнее, центр светлее. */
function Vignette({ id, cx, cy, color = "#1B0E3D", strength = 0.5, glow = 0.35 }: { id: string; cx: number; cy: number; color?: string; strength?: number; glow?: number }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-v`} cx={cx / W} cy={cy / H} r="0.85" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={glow} />
          <stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="0.7" stopColor={color} stopOpacity={0} />
          <stop offset="1" stopColor={color} stopOpacity={strength} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-v)`} />
    </g>
  );
}

/** «Зум-блюр»: тонкие светлые клинья от точки интереса, центр свободен. */
function ZoomLines({ cx, cy, seed, n = 46, r0 = 260, opacity = 0.22, color = "#FFFFFF" }: { cx: number; cy: number; seed: number; n?: number; r0?: number; opacity?: number; color?: string }) {
  return (
    <g opacity={opacity}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`zl-a-${seed}-${i}`) * 0.08;
        const wdt = 0.006 + random(`zl-w-${seed}-${i}`) * 0.018;
        const rr = r0 * (0.85 + random(`zl-r-${seed}-${i}`) * 0.6);
        return <path key={i} d={wedge(cx, cy, a - wdt, a + wdt, rr, 1700)} fill={color} />;
      })}
    </g>
  );
}

function Glow({ id, cx, cy, r, color = "#FFFFFF", opacity = 0.95 }: { id: string; cx: number; cy: number; r: number; color?: string; opacity?: number }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-g`}>
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.55} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-g)`} />
    </g>
  );
}

function Sparkle({ x, y, s, color = "#FFFFFF", rot = 0 }: { x: number; y: number; s: number; color?: string; rot?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
      d="M0 -30 C4 -8 8 -4 30 0 C8 4 4 8 0 30 C-4 8 -8 4 -30 0 C-8 -4 -4 -8 0 -30 Z"
      fill={color}
      stroke={INK}
      strokeWidth={3 / s}
      strokeLinejoin="round"
    />
  );
}

function Sparkles({ cx, cy, r, seed, n = 5 }: { cx: number; cy: number; r: number; seed: number; n?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`sp-${seed}-${i}`) * 0.7 - 0.6;
        const rr = r * (0.95 + random(`spr-${seed}-${i}`) * 0.25);
        return <Sparkle key={i} x={cx + Math.cos(a) * rr} y={cy + Math.sin(a) * rr} s={0.7 + random(`sps-${seed}-${i}`) * 0.8} color={i % 2 ? "#FFF04D" : "#FFFFFF"} rot={i * 17} />;
      })}
    </g>
  );
}

/** Нота со стикерной обводкой. */
function Note({ x, y, s, color, rot = 0, double = false }: { x: number; y: number; s: number; color: string; rot?: number; double?: boolean }) {
  const body = double ? (
    <g fill={color} stroke={INK} strokeWidth={5} strokeLinejoin="round">
      <ellipse cx={-34} cy={34} rx={26} ry={20} transform="rotate(-20 -34 34)" />
      <ellipse cx={42} cy={22} rx={26} ry={20} transform="rotate(-20 42 22)" />
      <path d="M-12 30 V-70 L64 -86 V18 L54 18 V-62 L-2 -50 V30 Z" />
    </g>
  ) : (
    <g fill={color} stroke={INK} strokeWidth={5} strokeLinejoin="round">
      <ellipse cx={-20} cy={40} rx={28} ry={21} transform="rotate(-20 -20 40)" />
      <path d="M2 36 V-80 L12 -80 Q22 -50 52 -40 Q66 -30 56 -6 Q48 -30 14 -40 V36 Z" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <Sticker scale={s} ow={7}>
        {body}
      </Sticker>
    </g>
  );
}

/** Предметы на длинной нитке: вписываем само тело (воздушный змей, шарик), нитка свисает за рамку. */
const FIT_BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  kite: { x: 24, y: -292, w: 92, h: 150 },
  balloon: { x: -34, y: -208, w: 82, h: 104 },
};

/**
 * Предмет, вписанный в квадрат size×size вокруг (cx, cy): рамку меряем getBBox (предметы нарисованы вокруг «хвата», а не центра).
 * До замера (первый кадр React) группа невидима; рендер Remotion ждёт delayRender.
 */
function FitProp({ id, color, cx, cy, size, rot = 0, ow = 9 }: { id: string; color?: string; cx: number; cy: number; size: number; rot?: number; ow?: number }) {
  const ref = useRef<SVGGElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [handle] = useState(() => delayRender(`thumb prop ${id}`));
  useLayoutEffect(() => {
    let b = { x: -50, y: -50, w: 100, h: 100 };
    try {
      const r = ref.current?.getBBox();
      if (r && r.width > 1 && r.height > 1) b = { x: r.x, y: r.y, w: r.width, h: r.height };
    } catch {
      // нет layout (тесты) — квадрат по умолчанию
    }
    setBox(FIT_BOX[id] ?? b);
    continueRender(handle);
  }, [handle, id]);
  // тонкие предметы (зубная щётка, карандаш) чуть крупнее: вписываем по площади, но не больше 1.35 по длинной стороне
  const s = box ? Math.min((size * 1.35) / Math.max(box.w, box.h), size / Math.sqrt(box.w * box.h)) : 1;
  return (
    <g>
      <g ref={ref} opacity={0}>
        <Prop id={id} color={color} t={0} />
      </g>
      {box ? (
        <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${s}) translate(${-(box.x + box.w / 2)} ${-(box.y + box.h / 2)})`}>
          <Sticker scale={s} ow={ow}>
            <Prop id={id} color={color} t={0} />
          </Sticker>
        </g>
      ) : null}
    </g>
  );
}

/** Предмет истории: из каталога или (если не нашли) эмодзи на белом круге. */
function KeyObject({ prop, emoji, color, cx, cy, size, rot = 0, seed, glow = true, uid }: { prop: string | null; emoji?: string; color?: string; cx: number; cy: number; size: number; rot?: number; seed: number; glow?: boolean; uid: string }) {
  if (!prop && !emoji) return null;
  return (
    <g>
      {glow ? <Glow id={`${uid}-ko`} cx={cx} cy={cy} r={size * 0.95} color="#FFF6B0" opacity={0.9} /> : null}
      {prop ? (
        <FitProp id={prop} color={color} cx={cx} cy={cy} size={size} rot={rot} />
      ) : (
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={size * 0.52} fill="#FFFFFF" stroke={INK} strokeWidth={6} />
          <text x={cx} y={cy + size * 0.24} fontSize={size * 0.66} textAnchor="middle">
            {emoji}
          </text>
        </g>
      )}
      <Sparkles cx={cx} cy={cy} r={size * 0.62} seed={seed} />
    </g>
  );
}

interface HeroCfg {
  id: string;
  emotion: CEmotion;
  action: ActionKind;
  tl: number;
  wear: Wear[];
  facing?: 1 | -1;
  look?: [number, number];
  flip?: boolean; // зеркально (например, указывает налево)
}

const T = 1.2;

/**
 * Поза для обложки. В риге поднятые руки (cheer/jump/dance) рисуются поверх головы и закрывают щёки на крупном плане,
 * поэтому «ура» здесь — руки в стороны-вверх ЗА головой: лицо всегда открыто.
 */
export function thumbPose(action: ActionKind, tl: number): Pose {
  const p = actionPose(action, tl, T);
  if (action === "cheer" || action === "jump") {
    return { ...p, armL: [112, 26], armR: [112, 26], lift: action === "jump" ? 70 : 0, bob: 0, lean: 0, tilt: 0 };
  }
  return p;
}

function heroPose(h: HeroCfg): Pose {
  return thumbPose(h.action, h.tl);
}

function heroState(h: HeroCfg) {
  const open = h.emotion === "laugh" || h.emotion === "happy" ? 0.62 : h.emotion === "surprised" ? 0.55 : h.emotion === "scared" ? 0.3 : 0;
  // «happy» с открытыми глазами в риге читается строго (плоские брови) — на обложке рисуем «восторг»:
  // поднятые брови и большие глаза («surprised») + широкая улыбка. Закрытые глазки «laugh» оставляем как есть.
  const emotion: CEmotion = h.emotion === "happy" ? "surprised" : h.emotion;
  return { pose: heroPose(h), emotion, mouth: open, blink: false, look: h.look ?? ([0, 0] as [number, number]), facing: h.facing ?? 1, wear: h.wear } as const;
}

/** Герой: ступни в (x, y), масштаб s. */
function Hero({ h, x, y, s, ow = 10 }: { h: HeroCfg; x: number; y: number; s: number; ow?: number }) {
  const spec = CAST[h.id];
  if (!spec) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${h.flip ? -s : s} ${s})`}>
      <Sticker scale={s} ow={ow}>
        <Character spec={spec} st={{ ...heroState(h), wear: h.wear }} t={T} />
      </Sticker>
    </g>
  );
}

/** Герой, поставленный по центру головы (hx, hy) с радиусом головы R — для крупных планов. */
function HeroByHead({ h, hx, hy, R, ow = 10 }: { h: HeroCfg; hx: number; hy: number; R: number; ow?: number }) {
  const spec = CAST[h.id];
  if (!spec) return null;
  const s = R / rigMetrics(spec).r;
  const head = handPositions(spec, heroPose(h), T).head;
  const dir = h.flip ? -1 : 1;
  return <Hero h={h} x={hx - head[0] * s * dir} y={hy - head[1] * s} s={s} ow={ow} />;
}

/** Огромный текст: заливка-градиент, тёмная обводка, внешняя белая обводка, тень. Точно вписывается в рамку (замер getBBox). */
function BigText({ text, x, y, w, h, colors, rot = -4, anchor = "middle", maxFs = 190, uid }: { text: string; x: number; y: number; w: number; h: number; colors: [string, string]; rot?: number; anchor?: "start" | "middle" | "end"; maxFs?: number; uid: string }) {
  const lines = splitLines(text, w, h);
  const ref = useRef<SVGGElement>(null);
  const [k, setK] = useState<number | null>(null);
  const [handle] = useState(() => delayRender("thumb text fit"));
  const fs0 = Math.min(maxFs, linesFontSize(lines, w, h));
  useLayoutEffect(() => {
    let kk = 1;
    try {
      const b = ref.current?.getBBox();
      // высота — по оценке (рамка шрифта выше заглавных), ширина — по замеру
      if (b && b.width > 1) kk = Math.min((w - 0.34 * fs0) / b.width, h / ((lines.length * 0.92 + 0.4) * fs0));
    } catch {
      // без layout оставляем оценку
    }
    setK(kk);
    continueRender(handle);
  }, [handle, w, h, fs0, lines.length]);
  const fs = fs0 * (k ?? 1);
  const lh = fs * 0.92;
  const ax = anchor === "middle" ? x + w / 2 : anchor === "start" ? x : x + w;
  // центрируем блок заглавных (высота заглавной ≈ 0.7 кегля), а не рамку шрифта
  const top = y + h / 2 - ((lines.length - 1) * lh + 0.7 * fs) / 2 + 0.7 * fs;
  const layer = (kind: "shadow" | "white" | "ink" | "fill", i: number, line: string) => {
    const common = { x: ax, y: top + i * lh, textAnchor: anchor, fontFamily: "Fredoka", fontWeight: 700, fontSize: fs, strokeLinejoin: "round" as const, paintOrder: "stroke" as const };
    if (kind === "shadow") return <text key={`s${i}`} {...common} y={common.y + fs * 0.07} fill={INK} stroke={INK} strokeWidth={fs * 0.34} opacity={0.35}>{line}</text>;
    if (kind === "white") return <text key={`w${i}`} {...common} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={fs * 0.32}>{line}</text>;
    if (kind === "ink") return <text key={`k${i}`} {...common} fill={INK} stroke={INK} strokeWidth={fs * 0.15}>{line}</text>;
    return <text key={`f${i}`} {...common} fill={`url(#${uid}-tg${i % 2})`}>{line}</text>;
  };
  return (
    <g transform={`rotate(${rot} ${ax} ${y + h / 2})`} opacity={k == null ? 0 : 1}>
      <defs>
        {colors.map((c, i) => (
          <linearGradient key={i} id={`${uid}-tg${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.4" stopColor={c} />
            <stop offset="1" stopColor={c === "#FFFFFF" ? "#FFEBB0" : shade(c, 0.14)} />
          </linearGradient>
        ))}
      </defs>
      <g ref={ref}>
        {(["shadow", "white", "ink", "fill"] as const).map((kind) => lines.map((l, i) => layer(kind, i, l)))}
      </g>
    </g>
  );
}

/** Маленький логотип серии в углу (одинаковый на всех обложках — узнаваемость канала). */
const BADGE_FS = 25;
const badgeW = (text: string) => text.length * BADGE_FS * 0.55 + 62;

function Badge({ text, x, y }: { text: string; x: number; y: number }) {
  if (!text) return null;
  const w = badgeW(text);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={w} height={46} rx={23} fill="#FFFFFF" stroke={INK} strokeWidth={4.5} />
      {/* ушки зайчика — фирменный знак */}
      <g transform="translate(27 24)">
        <ellipse cx={-6} cy={-8} rx={5} ry={12} fill="#FFC7D6" stroke={INK} strokeWidth={3} transform="rotate(-12 -6 -8)" />
        <ellipse cx={6} cy={-8} rx={5} ry={12} fill="#FFC7D6" stroke={INK} strokeWidth={3} transform="rotate(12 6 -8)" />
        <circle cx={0} cy={7} r={9.5} fill="#EDE7F2" stroke={INK} strokeWidth={3} />
      </g>
      <text x={47} y={32} fontFamily="Fredoka" fontWeight={700} fontSize={BADGE_FS} fill="#FF3D8B">
        {text}
      </text>
    </g>
  );
}

/**
 * Локация в мире 1920×1080, вписанная в кадр 1280×720. Пастельные палитры эпизода на обложке выглядят бледно —
 * поднимаем сочность смешиванием soft-light с цветом фона героя (mix-blend-mode, не фильтр).
 */
function LocationBg({ location, world, seed, cam, tint, pop = 0.55, fx = true }: { location: string; world: WorldState; seed: number; cam: { x: number; y: number; zoom: number }; tint: string; pop?: number; fx?: boolean }) {
  const loc = locationDef(location);
  const lp = locationProps(location, cam, T, { world, seed, uid: `thumb-${location}` });
  const outdoor = LOCATION_CATALOG.find((l) => l.id === location)?.outdoor ?? true;
  return (
    <g>
      <g transform={`scale(${W / 1920})`}>
        <loc.Back {...lp} />
        {fx ? <WorldFx world={lp.world} t={T} outdoor={outdoor} /> : null}
      </g>
      <rect width={W} height={H} fill={tint} opacity={pop} style={{ mixBlendMode: "soft-light" }} />
      <rect width={W} height={H} fill="#000000" opacity={0.22} style={{ mixBlendMode: "soft-light" }} />
    </g>
  );
}

// ------------------------------------------------------------------ композиция

export function CartoonThumb(props: CartoonThumbProps) {
  const { text, chars, emotions = [], actions = [], location = "garden", emoji, variant = 0, propColor, big, colors, badge = SERIES_NAME, seed = 0 } = props;
  const layout = pickLayout(props.layout, variant);
  const world: WorldState = { ...DEFAULT_WORLD, ...(props.world ?? {}) };
  const ids = chars.filter((c) => CAST[c]).slice(0, 3);
  const list = ids.length ? ids : ["benny"];
  const main = list[0]!;
  const pal = HERO_BG[main] ?? HERO_BG.benny!;
  const prop = resolveProp(props.prop, emoji);
  const pColor = colorOf(propColor);
  const uid = `ct${variant}`;
  const s0 = seed * 7 + variant;
  const defEmo: CEmotion[] = ["happy", "laugh", "happy"];
  const hero = (i: number, action: ActionKind, tl: number, extra: Partial<HeroCfg> = {}): HeroCfg => {
    const id = list[i]!;
    const given = props.wear?.[i];
    const wear = (given ? given.filter((x): x is Wear => (WEAR_IDS as readonly string[]).includes(x)) : autoWear(location, world, !!CAST[id]?.adult)).filter((x) => x !== "pajamas" || layout === "world");
    return { id, emotion: emotions[i] ?? defEmo[i % 3]!, action: actions[i] ?? action, tl, wear, ...extra };
  };
  // логотип — в свободном углу макета (низ-право занимает таймкод YouTube)
  let badgeAt: [number, number] = [18, H - 64];

  let body: ReactNode = null;

  if (layout === "face") {
    // гигантское лицо героя + предмет + слово
    const h = hero(0, "wave", 0.42, { look: [-0.15, 0.15], facing: -1 });
    body = (
      <>
        <Sunburst cx={880} cy={390} colors={[pal.a, pal.b]} n={22} rot={0.05} />
        <ZoomLines cx={880} cy={390} seed={s0} r0={330} opacity={0.18} />
        <Vignette id={uid} cx={880} cy={390} />
        <HeroByHead h={h} hx={880} hy={420} R={225} ow={11} />
        <KeyObject prop={prop} emoji={emoji} color={pColor} cx={330} cy={488} size={270} rot={-10} seed={s0} uid={uid} />
        <BigText text={text} x={28} y={10} w={610} h={300} colors={pal.text} rot={-4} uid={uid} />
      </>
    );
  } else if (layout === "duo") {
    // двое радуются большому предмету в центре
    const two = list.length >= 2;
    const a = hero(0, "point", 0.6, { look: [0.9, 0.2], facing: 1 });
    const b = two ? hero(1, "cheer", 0.3, { look: [-0.9, 0.2], facing: -1 }) : null;
    const cam = { x: 960, y: 640, zoom: 1.15 };
    const cx = two ? 640 : 820;
    badgeAt = [cx - badgeW(badge) / 2, H - 60];
    body = (
      <>
        <LocationBg location={location} world={world} seed={seed} cam={cam} tint={pal.a} />
        <Glow id={`${uid}-c`} cx={cx} cy={440} r={500} color="#FFF8D0" opacity={0.6} />
        <ZoomLines cx={cx} cy={440} seed={s0} r0={230} opacity={0.32} />
        <Vignette id={uid} cx={cx} cy={440} strength={0.55} glow={0} />
        <HeroByHead h={a} hx={two ? 235 : 290} hy={470} R={two ? 150 : 185} ow={10} />
        {b ? <HeroByHead h={b} hx={1045} hy={470} R={150} ow={10} /> : null}
        <KeyObject prop={prop} emoji={emoji} color={pColor} cx={cx} cy={455} size={two ? 310 : 350} rot={-6} seed={s0} uid={uid} />
        <BigText text={text} x={two ? 300 : 520} y={14} w={two ? 680 : 740} h={200} colors={pal.text} rot={-3} uid={uid} />
      </>
    );
  } else if (layout === "song") {
    // радуга, ноты, все танцуют
    const n = Math.min(3, list.length);
    const xs = n === 1 ? [640] : n === 2 ? [440, 840] : [300, 640, 980];
    const notes = ["#FF4D5A", "#FFD23F", "#4CB944", "#3D8BFF", "#FF6FA8", "#8E5CFF"];
    const rainbow = ["#FF4D5A", "#FF8A2A", "#FFD23F", "#4CB944", "#3D8BFF", "#8E5CFF"];
    badgeAt = [18, 16];
    body = (
      <>
        <Sunburst cx={640} cy={800} colors={["#2FA8FF", "#5BC2FF"]} n={26} />
        <ZoomLines cx={640} cy={800} seed={s0} r0={420} opacity={0.16} />
        {rainbow.map((c, i) => (
          <path key={c} d={`M${640 - (600 - i * 42)} 820 A${600 - i * 42} ${600 - i * 42} 0 0 1 ${640 + (600 - i * 42)} 820`} fill="none" stroke={c} strokeWidth={44} />
        ))}
        <path d={`M${640 - 622} 820 A622 622 0 0 1 ${640 + 622} 820`} fill="none" stroke="#FFFFFF" strokeWidth={8} />
        <path d={`M${640 - 368} 820 A368 368 0 0 1 ${640 + 368} 820`} fill="none" stroke="#FFFFFF" strokeWidth={8} />
        <Vignette id={uid} cx={640} cy={420} strength={0.45} glow={0.15} />
        {xs.map((x, i) => (
          <Hero key={i} h={hero(i, "dance", [0.26, 0.78, 0.5][i]!, { emotion: emotions[i] ?? (i === 1 ? "happy" : "laugh") })} x={x} y={770} s={n === 1 ? 1.75 : 1.38} ow={9} />
        ))}
        <Note x={110} y={330} s={1.15} color={notes[s0 % 6]!} rot={-14} double />
        <Note x={1170} y={300} s={1.05} color={notes[(s0 + 2) % 6]!} rot={12} />
        <Note x={150} y={600} s={0.8} color={notes[(s0 + 4) % 6]!} rot={10} />
        <Note x={1150} y={580} s={0.85} color={notes[(s0 + 3) % 6]!} rot={-8} double />
        {prop && n < 3 ? <KeyObject prop={prop} emoji={emoji} color={pColor} cx={n === 1 ? 960 : 640} cy={470} size={170} rot={8} seed={s0} uid={uid} glow={false} /> : null}
        <BigText text={text || "Sing along"} x={290} y={12} w={700} h={210} colors={["#FFF04D", "#FFFFFF"]} rot={-3} uid={uid} />
      </>
    );
  } else if (layout === "learn") {
    // большие буквы/цифры или цвета урока + герой указывает на них
    const h = hero(0, "point", 0.6, { flip: true, look: [0.15, 0.1], facing: 1 });
    const glyphs = (big ?? "").toUpperCase().replace(/\s+/g, "").slice(0, 4);
    const swatches = (colors ?? []).map(colorOf).filter((c): c is string => !!c).slice(0, 5);
    let center: ReactNode = null;
    if (glyphs) {
      const sz = glyphs.length <= 3 ? 205 : 160;
      const span = glyphs.length * (sz + 22);
      center = (
        <g>
          {glyphs.split("").map((g, i) => {
            const x = 400 - span / 2 + i * (sz + 22) + sz / 2 + 11;
            const y = 210 + (i % 2 ? 30 : -6);
            const c = TOY_COLORS[(i * 3 + s0) % TOY_COLORS.length]!;
            return (
              <g key={i} transform={`rotate(${i % 2 ? 7 : -7} ${x} ${y})`}>
                <rect x={x - sz / 2 - 10} y={y - sz / 2 - 10} width={sz + 20} height={sz + 20} rx={42} fill="#FFFFFF" />
                <rect x={x - sz / 2 + 4} y={y - sz / 2 + 14} width={sz} height={sz} rx={34} fill={INK} opacity={0.3} />
                <rect x={x - sz / 2} y={y - sz / 2} width={sz} height={sz} rx={34} fill={c} stroke={INK} strokeWidth={6} />
                <text x={x} y={y + sz * 0.29} textAnchor="middle" fontFamily="Fredoka" fontWeight={700} fontSize={sz * 0.82} fill="#FFFFFF" stroke={INK} strokeWidth={sz * 0.07} paintOrder="stroke" strokeLinejoin="round">
                  {g}
                </text>
              </g>
            );
          })}
        </g>
      );
    } else if (swatches.length) {
      // краски-кляксы урока цветов
      const n = swatches.length;
      const r = n > 3 ? 96 : 118;
      center = (
        <g>
          {swatches.map((c, i) => {
            const x = n > 1 ? 130 + (i * 560) / (n - 1) : 400;
            const y = 215 + (i % 2 ? 40 : -24);
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${i * 40})`}>
                <path d={blob(r)} fill={INK} opacity={0.3} transform="translate(5 10)" />
                <path d={blob(r)} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={24} strokeLinejoin="round" />
                <path d={blob(r)} fill={c} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
                <ellipse cx={-r * 0.3} cy={-r * 0.35} rx={r * 0.25} ry={r * 0.14} fill="#FFFFFF" opacity={0.55} transform={`rotate(${-i * 40})`} />
              </g>
            );
          })}
        </g>
      );
    } else {
      center = <KeyObject prop={prop} emoji={emoji} color={pColor} cx={400} cy={240} size={300} rot={-8} seed={s0} uid={uid} />;
    }
    body = (
      <>
        <Sunburst cx={1000} cy={420} colors={[pal.a, pal.b]} n={20} />
        <ZoomLines cx={1000} cy={420} seed={s0} r0={300} opacity={0.16} />
        <Vignette id={uid} cx={700} cy={360} />
        <HeroByHead h={h} hx={1030} hy={450} R={185} ow={11} />
        {center}
        <BigText text={text} x={30} y={398} w={730} h={244} colors={pal.text} rot={-3} uid={uid} />
      </>
    );
  } else if (layout === "world") {
    // сцена с погодой и сезоном: снеговик, дождь с зонтиком, пляж
    const two = list.length >= 2;
    const a = hero(0, "wave", 0.42, { look: [-0.5, 0], facing: -1 });
    const b = two ? hero(1, "cheer", 0.3, { look: [-0.5, 0], facing: -1 }) : null;
    const cam = { x: 960, y: 610, zoom: 1.2 };
    body = (
      <>
        {/* серую погоду (снег, дождь, тучи) подкрашиваем голубым небом, ясную — цветом героя */}
        <LocationBg location={location} world={world} seed={seed} cam={cam} tint={world.weather === "clear" || world.weather === "windy" ? pal.a : "#1E8CFF"} pop={0.85} />
        <ZoomLines cx={900} cy={420} seed={s0} r0={300} opacity={0.14} />
        <Vignette id={uid} cx={800} cy={400} strength={0.45} glow={0.2} />
        {b ? <Hero h={b} x={1110} y={845} s={1.6} ow={9} /> : null}
        <Hero h={a} x={two ? 800 : 900} y={880} s={1.85} ow={10} />
        <KeyObject prop={prop} emoji={emoji} color={pColor} cx={300} cy={475} size={310} rot={-6} seed={s0} uid={uid} glow={false} />
        <BigText text={text} x={24} y={10} w={630} h={262} colors={pal.text} rot={-4} uid={uid} />
      </>
    );
  } else {
    // action: герой в прыжке, лучи скорости, летящий предмет
    const a = hero(0, "jump", 0.4, { look: [-0.6, -0.4], facing: -1 });
    const b = list.length >= 2 ? hero(1, "cheer", 0.3, { look: [-0.8, -0.2], facing: -1 }) : null;
    const cam = { x: 960, y: 640, zoom: 1.1 };
    body = (
      <>
        <LocationBg location={location} world={world} seed={seed} cam={cam} tint={pal.a} />
        <ZoomLines cx={830} cy={330} seed={s0} r0={250} opacity={0.42} n={60} />
        <Vignette id={uid} cx={830} cy={330} strength={0.5} glow={0.3} />
        {b ? <Hero h={b} x={1150} y={800} s={1.25} ow={9} /> : null}
        <Hero h={a} x={820} y={800} s={1.75} ow={11} />
        <KeyObject prop={prop} emoji={emoji} color={pColor} cx={300} cy={200} size={250} rot={-14} seed={s0} uid={uid} />
        <BigText text={text} x={26} y={384} w={640} h={240} colors={pal.text} rot={-4} uid={uid} />
      </>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: pal.a }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <style>{SIL_CSS}</style>
        {body}
        <Badge text={badge} x={badgeAt[0]} y={badgeAt[1]} />
      </svg>
    </AbsoluteFill>
  );
}

/** Клякса краски: круг с волнистым краем. */
function blob(r: number): string {
  const n = 9;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (i % 2 ? 0.86 : 1.06);
    return [Math.cos(a) * rr, Math.sin(a) * rr] as const;
  });
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    d += i === 0 ? `M${mx.toFixed(1)} ${my.toFixed(1)}` : "";
    const nq = pts[(i + 2) % n]!;
    d += ` Q${q[0].toFixed(1)} ${q[1].toFixed(1)} ${((q[0] + nq[0]) / 2).toFixed(1)} ${((q[1] + nq[1]) / 2).toFixed(1)}`;
  }
  return `${d} Z`;
}
