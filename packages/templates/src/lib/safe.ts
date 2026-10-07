/** Безопасные зоны YouTube Shorts (раздел 4 ТЗ). */
export const CANVAS = { w: 1080, h: 1920 } as const;
export const SAFE = {
  top: 120, // заголовок не выше
  bottom: 320, // нижние кнопки/подпись
  right: 150, // колонка лайков/комментов
  left: 48,
} as const;
export const SAFE_RECT = {
  x0: SAFE.left,
  x1: CANVAS.w - SAFE.right,
  y0: SAFE.top,
  y1: CANVAS.h - SAFE.bottom,
} as const;
