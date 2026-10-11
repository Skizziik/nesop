/**
 * Липсинк без тяжёлых инструментов: формы рта (визем) по ТЕКСТУ реплики + огибающей громкости (Line.envelope, 30 fps).
 *
 * Набор визем — как у Preston Blair / Rhubarb:
 *   A — губы сомкнуты (M, B, P)          B — чуть открыт, зубы (K, S, T, D, N, EE, IH…)
 *   C — открыт (EH, AE)                   D — широко открыт (AA, «a» на громком слоге)
 *   E — округлый (AO, ER, «o»)            F — трубочкой (UW, OO, W)
 *   G — зубы на губе (F, V)               H — язычок (L, TH)
 *   X — покой (пауза, тишина)
 *
 * Как считается (детерминированно и дёшево):
 *  1. Текст → слова → классы фонем по простым английским правилам (диграфы th/sh/ch/oo/ee/ou/ow/ai…, «волшебное e»).
 *  2. Огибающая → «звонкие» кадры (громче порога; короткие провалы ≤2 кадров — смычки согласных — считаются звонкими).
 *  3. Слова раскладываются по звонким кадрам пропорционально числу букв (если число фраз по пунктуации совпадает с числом
 *     групп звука между паузами — пофразно), внутри слова — по весам фонем (гласные длиннее согласных).
 *  4. Громкость кадра уточняет открытость гласных: на пике слога «C» → «D», на тихом краю — «B».
 *  5. Тишина — X; одиночные кадры обычных согласных сливаются с соседями (без дребезга), M/B/P и F/V сохраняются.
 * Без огибающей (черновик без озвучки) — ровный «голос» на всю реплику, кроме последних 0.15 с.
 */

export const VISEMES = ["X", "A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type Viseme = (typeof VISEMES)[number];

/** Частота огибающей и дорожки визем (Line.envelope — 30 fps). */
export const LIPSYNC_FPS = 30;

/** Открытость рта у каждой виземы 0..1 — для растяжения головы, «филтрума» и т.п. */
export const VISEME_OPEN: Record<Viseme, number> = { X: 0, A: 0, B: 0.2, C: 0.55, D: 1, E: 0.6, F: 0.25, G: 0.15, H: 0.45 };

/** Минимум, что нужно от реплики (совместимо с Episode.Line). */
export interface LipLine {
  char?: string;
  start?: number;
  dur: number;
  text: string;
  envelope?: number[];
}

interface Tok {
  v: Viseme;
  w: number; // вес (длительность относительно соседей)
}

const VOWELS = "aeiouy";
const isVowel = (c: string | undefined) => !!c && "aeiou".includes(c);

/** Диграфы и триграфы — сначала длинные. */
const MULTI: [string, Tok[]][] = (
  [
    ["tch", [["B", 1]]],
    ["igh", [["D", 1.4], ["B", 0.8]]],
    ["ough", [["E", 2]]],
    ["eigh", [["C", 1.2], ["B", 0.8]]],
    ["air", [["C", 1.4], ["E", 0.8]]],
    ["ear", [["B", 1.2], ["E", 0.8]]],
    ["our", [["D", 1.2], ["E", 1]]],
    ["th", [["H", 1]]],
    ["sh", [["B", 1]]],
    ["ch", [["B", 1]]],
    ["ph", [["G", 1]]],
    ["wh", [["F", 1]]],
    ["ck", [["B", 1]]],
    ["ng", [["B", 1]]],
    ["qu", [["B", 0.7], ["F", 0.8]]],
    ["oo", [["F", 2]]],
    ["ee", [["B", 2]]],
    ["ea", [["B", 2]]],
    ["ai", [["C", 1.3], ["B", 0.8]]],
    ["ay", [["C", 1.3], ["B", 0.8]]],
    ["ei", [["C", 1.3], ["B", 0.8]]],
    ["ey", [["C", 1.3], ["B", 0.8]]],
    ["ie", [["D", 1.3], ["B", 0.8]]],
    ["ou", [["D", 1.2], ["F", 0.9]]],
    ["ow", [["D", 1.2], ["F", 0.9]]],
    ["oi", [["E", 1.2], ["B", 0.8]]],
    ["oy", [["E", 1.2], ["B", 0.8]]],
    ["au", [["E", 2]]],
    ["aw", [["E", 2]]],
    ["oa", [["E", 1.2], ["F", 0.8]]],
    ["ew", [["F", 2]]],
    ["ue", [["F", 2]]],
    ["ui", [["F", 2]]],
    ["er", [["E", 1.6]]],
    ["ir", [["E", 1.6]]],
    ["ur", [["E", 1.6]]],
    ["ar", [["D", 1.8]]],
    ["or", [["E", 1.8]]],
    ["ll", [["H", 1]]],
    ["mm", [["A", 1]]],
    ["bb", [["A", 1]]],
    ["pp", [["A", 1]]],
    ["ff", [["G", 1]]],
    ["ss", [["B", 1]]],
    ["tt", [["B", 1]]],
    ["dd", [["B", 1]]],
    ["nn", [["B", 1]]],
    ["gg", [["B", 1]]],
    ["zz", [["B", 1]]],
  ] as [string, [Viseme, number][]][]
).map(([k, v]) => [k, v.map(([vv, w]) => ({ v: vv, w }))]);

const SINGLE: Record<string, Tok[]> = {
  a: [{ v: "C", w: 2 }],
  e: [{ v: "C", w: 2 }],
  i: [{ v: "B", w: 2 }],
  o: [{ v: "E", w: 2 }],
  u: [{ v: "C", w: 2 }],
  m: [{ v: "A", w: 1 }],
  b: [{ v: "A", w: 1 }],
  p: [{ v: "A", w: 1 }],
  f: [{ v: "G", w: 1 }],
  v: [{ v: "G", w: 1 }],
  w: [{ v: "F", w: 1 }],
  l: [{ v: "H", w: 1 }],
  r: [{ v: "E", w: 1 }],
  h: [], // выдох: рот уже в форме следующей гласной
};
/** Долгие гласные перед «волшебным e» (cake, like, home, cute). */
const LONG: Record<string, Tok[]> = {
  a: [{ v: "C", w: 1.3 }, { v: "B", w: 0.8 }],
  e: [{ v: "B", w: 2 }],
  i: [{ v: "D", w: 1.4 }, { v: "B", w: 0.8 }],
  o: [{ v: "E", w: 1.2 }, { v: "F", w: 0.9 }],
  u: [{ v: "F", w: 2 }],
};

/** Короткие слова с особым произношением. */
const WORDS: Record<string, Tok[]> = {
  i: [{ v: "D", w: 1.4 }, { v: "B", w: 0.8 }],
  a: [{ v: "C", w: 1 }],
  the: [{ v: "H", w: 1 }, { v: "C", w: 1 }],
  you: [{ v: "B", w: 0.6 }, { v: "F", w: 2 }],
  to: [{ v: "B", w: 1 }, { v: "F", w: 2 }],
  do: [{ v: "B", w: 1 }, { v: "F", w: 2 }],
  two: [{ v: "B", w: 1 }, { v: "F", w: 2 }],
  who: [{ v: "F", w: 2 }],
  one: [{ v: "F", w: 1 }, { v: "C", w: 1.6 }, { v: "B", w: 1 }],
  oh: [{ v: "E", w: 1.4 }, { v: "F", w: 1 }],
  ok: [{ v: "E", w: 1.2 }, { v: "F", w: 0.6 }, { v: "B", w: 1 }, { v: "C", w: 1.3 }, { v: "B", w: 0.8 }],
  okay: [{ v: "E", w: 1.2 }, { v: "F", w: 0.6 }, { v: "B", w: 1 }, { v: "C", w: 1.3 }, { v: "B", w: 0.8 }],
  wow: [{ v: "F", w: 1 }, { v: "D", w: 1.6 }, { v: "F", w: 1 }],
  yay: [{ v: "B", w: 0.6 }, { v: "C", w: 1.6 }, { v: "B", w: 0.8 }],
  hi: [{ v: "D", w: 1.4 }, { v: "B", w: 0.8 }],
  bye: [{ v: "A", w: 1 }, { v: "D", w: 1.4 }, { v: "B", w: 0.8 }],
  my: [{ v: "A", w: 1 }, { v: "D", w: 1.4 }, { v: "B", w: 0.8 }],
};

/** Классы фонем одного слова (строчные латинские буквы и цифры). */
export function wordVisemes(word: string): Tok[] {
  const w = word.toLowerCase().replace(/[^a-z0-9']/g, "").replace(/'/g, "");
  if (!w) return [];
  const known = WORDS[w];
  if (known) return known;
  if (/^[0-9]+$/.test(w)) return [...w].flatMap(() => [{ v: "B", w: 1 } as Tok, { v: "C", w: 1.5 } as Tok]);
  let s = w;
  // «волшебное e»: гласная + согласная + e на конце — долгая гласная, e немое (cake, like, home, cute)
  let longAt = -1;
  const mm = /([aeiou])([^aeiouy])e$/.exec(s);
  if (mm && s.length > 3 && !isVowel(s[mm.index - 1])) {
    longAt = mm.index;
    s = s.slice(0, -1);
  } else if (s.length > 3 && s.endsWith("e") && !isVowel(s[s.length - 2])) s = s.slice(0, -1); // немое e (house → hous)
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    if (i === longAt) {
      out.push(...LONG[s[i]!]!);
      i++;
      continue;
    }
    const m = MULTI.find(([k]) => s.startsWith(k, i));
    if (m) {
      out.push(...m[1]);
      i += m[0].length;
      continue;
    }
    const c = s[i]!;
    if (c === "y") {
      // y в начале — согласная (yes), в конце — «и» (happy) или «ай» в коротких (fly, why)
      if (i === 0) out.push({ v: "B", w: 0.6 });
      else if (i === s.length - 1 && s.length <= 3) out.push({ v: "D", w: 1.4 }, { v: "B", w: 0.8 });
      else out.push({ v: "B", w: 2 });
    } else if (c === "o" && i === s.length - 1) out.push({ v: "E", w: 1.2 }, { v: "F", w: 0.9 }); // go, no, so
    else if (SINGLE[c]) out.push(...SINGLE[c]!);
    else if (/[0-9]/.test(c)) out.push({ v: "B", w: 1 }, { v: "C", w: 1.5 });
    else if (!VOWELS.includes(c)) out.push({ v: "B", w: 1 }); // c d g j k n q s t x z
    i++;
  }
  // соседние одинаковые — одним звуком
  const merged: Tok[] = [];
  for (const t of out) {
    const last = merged[merged.length - 1];
    if (last && last.v === t.v) last.w += t.w * 0.6;
    else merged.push({ ...t });
  }
  return merged;
}

interface Word {
  toks: Tok[];
  len: number; // букв (вес слова по времени)
}

/** Фразы (по знакам препинания) из слов с их фонемами. */
export function textPhrases(text: string): Word[][] {
  const phrases: Word[][] = [[]];
  for (const m of text.matchAll(/[A-Za-z0-9']+|[.,!?;:…—–]+/g)) {
    const tok = m[0];
    if (/^[.,!?;:…—–]+$/.test(tok)) {
      if (phrases[phrases.length - 1]!.length) phrases.push([]);
      continue;
    }
    const toks = wordVisemes(tok);
    if (toks.length) phrases[phrases.length - 1]!.push({ toks, len: tok.replace(/[^A-Za-z0-9]/g, "").length || 1 });
  }
  return phrases.filter((p) => p.length);
}

const THR = 0.1; // порог «звонкого» кадра (огибающая нормирована к пику реплики)
const GAP_FILL = 2; // провалы короче — смычки внутри слова
const PAUSE = 6; // провал от 0.2 с — пауза между фразами
const PRIORITY = new Set<Viseme>(["A", "G", "F"]);

/** Звонкие отрезки [from, to) по огибающей. */
function voicedSegments(env: number[]): [number, number][] {
  const segs: [number, number][] = [];
  let s = -1;
  for (let i = 0; i <= env.length; i++) {
    const on = i < env.length && (env[i] ?? 0) > THR;
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      segs.push([s, i]);
      s = -1;
    }
  }
  const out: [number, number][] = [];
  for (const g of segs) {
    const last = out[out.length - 1];
    if (last && g[0] - last[1] <= GAP_FILL) last[1] = g[1];
    else out.push([g[0], g[1]]);
  }
  return out.filter(([a, b]) => b - a >= 2 || env.slice(a, b).some((v) => v > THR * 3));
}

/** Раскладывает слова по звонким кадрам frames (индексы кадров по порядку). */
function place(track: Viseme[], frames: number[], words: Word[], env: number[]) {
  const n = frames.length;
  if (!n || !words.length) return;
  const total = words.reduce((a, w) => a + w.len, 0);
  let acc = 0;
  for (const w of words) {
    const f0 = (acc / total) * n;
    acc += w.len;
    const f1 = (acc / total) * n;
    const W = w.toks.reduce((a, t) => a + t.w, 0);
    let c = 0;
    const spans = w.toks.map((t) => {
      const a = f0 + (c / W) * (f1 - f0);
      c += t.w;
      return { t, a, b: f0 + (c / W) * (f1 - f0) };
    });
    const taken = new Set<number>();
    for (const sp of spans) {
      for (let i = Math.ceil(sp.a - 0.5); i + 0.5 < sp.b; i++) if (i >= 0 && i < n && i + 0.5 >= sp.a) track[frames[i]!] = sp.t.v;
    }
    // M/B/P и F/V короче кадра всё равно видны хотя бы кадр
    for (const sp of spans) {
      if (!PRIORITY.has(sp.t.v)) continue;
      const i = Math.min(n - 1, Math.max(0, Math.floor((sp.a + sp.b) / 2)));
      const fi = frames[i]!;
      if (track[fi] !== sp.t.v && !taken.has(fi)) track[fi] = sp.t.v;
      taken.add(fi);
    }
  }
  // громкость уточняет открытость гласных
  for (const fi of frames) {
    const e = env[fi] ?? 0;
    const v = track[fi];
    if (v === "C" && e > 0.72) track[fi] = "D";
    else if (v === "C" && e < 0.22) track[fi] = "B";
    else if (v === "D" && e < 0.3) track[fi] = "C";
  }
}

/** Синтетическая огибающая для реплики без озвучки: «слоги» ~4.5/с, последние 0.15 с — тишина. */
function synthEnvelope(dur: number): number[] {
  const n = Math.max(1, Math.round(dur * LIPSYNC_FPS));
  const tail = Math.round(0.15 * LIPSYNC_FPS);
  return Array.from({ length: n }, (_, i) => (i >= n - tail ? 0 : 0.45 + 0.5 * Math.abs(Math.sin((i / LIPSYNC_FPS) * Math.PI * 4.5))));
}

/** Дорожка визем по кадрам 30 fps для всей реплики. */
export function visemeTrack(line: LipLine): Viseme[] {
  const env = line.envelope?.length ? line.envelope : synthEnvelope(line.dur);
  const n = Math.max(env.length, Math.round(line.dur * LIPSYNC_FPS));
  const track: Viseme[] = new Array<Viseme>(n).fill("X");
  const segs = voicedSegments(env);
  const phrases = textPhrases(line.text);
  if (!segs.length || !phrases.length) return track;
  // группы звука между паузами
  const groups: [number, number][][] = [[]];
  for (const g of segs) {
    const cur = groups[groups.length - 1]!;
    const last = cur[cur.length - 1];
    if (last && g[0] - last[1] >= PAUSE) groups.push([g]);
    else cur.push(g);
  }
  const framesOf = (gs: [number, number][]) => gs.flatMap(([a, b]) => Array.from({ length: b - a }, (_, k) => a + k));
  if (phrases.length > 1 && phrases.length === groups.length) phrases.forEach((p, i) => place(track, framesOf(groups[i]!), p, env));
  else place(track, framesOf(segs), phrases.flat(), env);
  // одиночные кадры обычных согласных/гласных между соседями — сливаются с предыдущим (рот не «дребезжит»)
  for (let i = 1; i < n - 1; i++) {
    const v = track[i]!;
    if (v === "X" || PRIORITY.has(v)) continue;
    if (track[i - 1] !== v && track[i + 1] !== v && track[i - 1] !== "X" && track[i + 1] !== "X" && !PRIORITY.has(track[i - 1]!)) track[i] = track[i - 1]!;
  }
  return track;
}

const cache = new WeakMap<object, Viseme[]>();
function cachedTrack(line: LipLine): Viseme[] {
  let tr = cache.get(line);
  if (!tr) {
    tr = visemeTrack(line);
    cache.set(line, tr);
  }
  return tr;
}

/** Визема реплики на кадре frameIndex (30 fps от начала реплики). Вне реплики — X. */
export function visemeAt(line: LipLine, frameIndex: number): Viseme {
  if (frameIndex < 0) return "X";
  return cachedTrack(line)[Math.floor(frameIndex)] ?? "X";
}

/** Визема героя char в момент t сцены (сек) — или undefined, если он сейчас не говорит (рот по эмоции/действию). */
export function visemeFor(lines: LipLine[], char: string, t: number): Viseme | undefined {
  for (const l of lines) {
    const st = l.start ?? 0;
    if (l.char !== char || t < st || t > st + l.dur) continue;
    return visemeAt(l, (t - st) * LIPSYNC_FPS);
  }
  return undefined;
}
