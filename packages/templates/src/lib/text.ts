/**
 * Детерминированный подбор размера шрифта без измерения DOM (одинаково в Player и в renderer).
 * Коэффициент — средняя ширина символа в em для жирных капсов (Montserrat 800 ≈ 0.72, с запасом).
 */
const CHAR_EM: Record<string, number> = { Montserrat: 0.74, Fredoka: 0.64, Nunito: 0.66, Andika: 0.62 };

export function fitFontSize(text: string, boxWidth: number, maxSize: number, font: string, minSize = 22): number {
  const em = CHAR_EM[font] ?? 0.72;
  const chars = Math.max([...text].length, 1);
  const size = Math.floor(boxWidth / (chars * em));
  return Math.max(minSize, Math.min(maxSize, size));
}

/** Минимальная ширина плашки, при которой текст влезает шрифтом `size`. Используется валидатором длин строк. */
export function requiredWidth(text: string, size: number, font: string): number {
  const em = CHAR_EM[font] ?? 0.72;
  return Math.ceil([...text].length * em * size);
}

export const upper = (s: string): string => s.toLocaleUpperCase("it-IT");
