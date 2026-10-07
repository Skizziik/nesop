/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

export type FormatId =
  | "list_mystery"
  | "quiz_abc"
  | "spot_the_error"
  | "false_friends"
  | "fill_blank"
  | "level_ladder"
  | "tongue_twister"
  | "idiom"
  | "emoji_vocab"
  | "conjugation_challenge"
  | "daily_word";

/**
 * Единый вход любой Remotion-композиции. Один и тот же JSON идёт в @remotion/player и в renderer.
 */
export interface RenderProps {
  format: FormatId;
  video_id?: string | null;
  series_id?: string | null;
  episode_no?: number | null;
  canvas: Canvas;
  theme: Theme;
  hook_text: string;
  title: string;
  cta_text?: string;
  /**
   * Формат-специфичный объект, схема в schemas/formats/<format>.schema.json
   */
  body: {};
  timeline: TimelineEvent[];
  audio: Audio;
  avatar: Avatar;
  loop_seamless?: boolean;
  duration_s: number;
  /**
   * Префикс для относительных /media/... URL. Пусто в браузере, http://api:8000 в renderer.
   */
  asset_base?: string;
  seed: number;
  /**
   * Только для превью: оверлей интерфейса YouTube Shorts.
   */
  show_yt_overlay?: boolean;
  /**
   * Режим answer_tomorrow: ответ на загадку предыдущего ролика серии («Risposta di ieri»)
   */
  prev_answer?: string | null;
}
export interface Canvas {
  w: 1080;
  h: 1920;
  fps: 30;
}
export interface Theme {
  palette: Palette;
  font: "Montserrat" | "Fredoka" | "Nunito";
  badge_shape: "rounded" | "square" | "pill";
  layout: "center" | "left";
  stickers?: StickerPlacement[];
  bookmark?: Bookmark;
  watermark?: string;
  show_progress_bar?: boolean;
  /**
   * Язык подписей вторым языком (en, ru, uk, es) или null
   */
  second_lang?: string | null;
}
export interface Palette {
  name?: string;
  bg: string;
  /**
   * Второй цвет для градиента, null = однотонный
   */
  bg2?: string | null;
  title_bg: string;
  title_text: string;
  left_bg: string;
  left_text: string;
  right_bg: string;
  right_text: string;
  highlight_bg: string;
  highlight_text: string;
  highlight_left_text: string;
  accent: string;
}
export interface StickerPlacement {
  name: string;
  x: number;
  y: number;
  size: number;
  rotate?: number;
}
export interface Bookmark {
  enabled?: boolean;
  position?: "top_right" | "top_left" | "mid_right";
}
export interface TimelineEvent {
  t_start: number;
  t_end: number;
  action: "show_title" | "hook" | "highlight" | "reveal" | "countdown" | "cta" | "speak_slow" | "speak_fast" | "word";
  target?: number | string | null;
}
export interface Audio {
  voice_url: string | null;
  music_url?: string | null;
  music_volume?: number;
  sfx?: Sfx[];
  /**
   * RMS-огибающая голоса по кадрам (0..1) для маскота
   */
  envelope?: number[];
}
export interface Sfx {
  t: number;
  name: "pop" | "tick" | "ding" | "whoosh" | "buzz" | "confetti";
  volume?: number;
}
export interface Avatar {
  mode: "none" | "loop" | "mascot" | "lipsync";
  src?: string | null;
  position?: "bottom_right" | "bottom_left";
  height?: number;
}
