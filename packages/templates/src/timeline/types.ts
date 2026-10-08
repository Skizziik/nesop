/** Свойства клипов таймлайна по типу (поле Clip.props). Схема документа — schemas/timeline.schema.json. */
import type { Clip, Palette, RenderProps, TimelineDoc } from "../generated";
import type { Emotion } from "../components/Mascots";

export type { Clip, TimelineDoc };

export type SlideKind = "title" | "explain" | "examples" | "table" | "quiz" | "recap";

export interface SlideProps {
  kind: SlideKind;
  chapter?: string; // «Capitolo 2»
  title: string;
  subtitle?: string;
  bullets?: string[];
  rows?: { it: string; tr?: string; note?: string }[];
  table?: { header: string[]; rows: string[][] };
  quiz?: { question: string; options: string[]; correct: number; timer_s?: number };
  /** Время (сек от начала клипа), когда появляется / подсвечивается i-й пункт, строка или ряд. */
  marks?: number[];
  /** Для квиза: начало таймера и момент ответа (сек от начала клипа). */
  countdown_at?: number;
  reveal_at?: number;
}

export interface ShortClipProps {
  render_props: RenderProps;
}

export interface TextProps {
  text: string;
  size?: number; // px при высоте холста 1080
  color?: string;
  bg?: string | null;
  weight?: number;
  align?: "left" | "center" | "right";
  stroke?: string | null;
  radius?: number;
  font?: string;
}

export interface SubtitleProps {
  text: string;
  tr?: string | null;
  /** Пословный тайминг для караоке: [начало, длительность] каждого слова, сек от начала клипа. */
  words?: [number, number][];
}

export interface MascotProps {
  character: string;
  emotion?: Emotion | "auto";
  flip?: boolean;
  talk?: boolean; // рот по огибающей голоса
}

export interface StickerProps {
  name: string;
}

export interface MediaProps {
  src: string;
  fit?: "cover" | "contain";
  volume?: number;
  loop?: boolean;
  muted?: boolean;
}

export interface AudioProps {
  src: string;
  volume?: number;
  loop?: boolean;
  fade_in?: number;
  fade_out?: number;
}

export interface ShapeProps {
  fill?: string;
  radius?: number;
  stroke?: string | null;
}

export const DEFAULT_PALETTE: Palette = {
  name: "notte",
  bg: "#1B1035",
  bg2: "#3C1E6E",
  title_bg: "#FFE135",
  title_text: "#1B1B1B",
  left_bg: "#000000",
  left_text: "#FFFFFF",
  right_bg: "#FFFFFF",
  right_text: "#1B1035",
  highlight_bg: "#2DE53A",
  highlight_text: "#0B2E0F",
  highlight_left_text: "#FFE600",
  accent: "#FF4D6D",
};

/** Индекс последней отметки, которая уже наступила (-1, если ни одной). */
export function activeMark(marks: number[] | undefined, t: number): number {
  if (!marks?.length) return -1;
  let i = -1;
  for (let k = 0; k < marks.length; k++) if (t >= marks[k]!) i = k;
  return i;
}

/** Клипы, видимые в момент t (для оверлея выделения в редакторе). */
export function clipsAt(doc: TimelineDoc, t: number): { trackId: string; clip: Clip }[] {
  const out: { trackId: string; clip: Clip }[] = [];
  for (const tr of doc.tracks) {
    if (tr.hidden) continue;
    for (const c of tr.clips) if (t >= c.start && t < c.start + c.duration) out.push({ trackId: tr.id, clip: c });
  }
  return out;
}

export const docFrames = (doc: Pick<TimelineDoc, "duration_s" | "canvas">) => Math.max(1, Math.ceil(doc.duration_s * doc.canvas.fps));
