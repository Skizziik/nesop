/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Проект-таймлайн: дорожки с клипами. Генерирует LLM (длинные лекции), правит видеоредактор, рендерит композиция Timeline. Время — в секундах, геометрия — доли холста (0..1).
 */
export interface TimelineDoc {
  version: 1;
  title: string;
  canvas: TlCanvas;
  duration_s: number;
  /**
   * Цвет фона под всеми дорожками
   */
  background?: string;
  /**
   * Палитра (как в RenderProps.theme.palette) для слайдов и текста
   */
  palette?: {};
  font?: "Montserrat" | "Fredoka" | "Nunito";
  subtitle_style?: SubtitleStyle;
  tracks: Track[];
  /**
   * RMS голоса по кадрам (0..1) — рот маскотов
   */
  envelope?: number[];
  asset_base?: string;
  seed?: number;
  /**
   * Только для редактора
   */
  show_safe_area?: boolean;
}
export interface TlCanvas {
  w: 1920 | 1080;
  h: 1080 | 1920;
  fps: 30;
}
export interface SubtitleStyle {
  size?: number;
  /**
   * Вертикаль центра субтитров (доля высоты)
   */
  y?: number;
  color?: string;
  bg?: string;
  show_translation?: boolean;
  /**
   * Караоке: подсветка текущего слова
   */
  highlight_words?: boolean;
}
export interface Track {
  id: string;
  kind: "scene" | "overlay" | "subtitle" | "mascot" | "audio";
  name: string;
  hidden?: boolean;
  muted?: boolean;
  locked?: boolean;
  clips: Clip[];
}
export interface Clip {
  id: string;
  type: "slide" | "short" | "text" | "subtitle" | "mascot" | "sticker" | "image" | "video" | "audio" | "shape";
  start: number;
  duration: number;
  /**
   * Сдвиг начала медиа (обрезка слева), сек
   */
  trim?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  opacity?: number;
  anim_in?: "none" | "fade" | "pop" | "slide_up" | "slide_left" | "zoom";
  anim_out?: "none" | "fade" | "pop" | "slide_up" | "slide_left" | "zoom";
  label?: string;
  /**
   * Свойства по типу клипа: см. packages/templates/src/timeline/types.ts
   */
  props?: {};
}
