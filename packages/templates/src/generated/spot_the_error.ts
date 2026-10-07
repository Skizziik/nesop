/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Trova l'errore: фраза с типичной ошибкой, таймер, затем зачёркивание и правильный вариант.
 */
export interface SpotTheErrorBody {
  /**
   * Фраза с ОДНОЙ типичной ошибкой иностранца
   */
  sentence: string;
  /**
   * Ошибочный фрагмент ровно как в sentence
   */
  wrong: string;
  /**
   * Правильный вариант фрагмента
   */
  right: string;
  category: "articoli" | "preposizioni" | "ausiliare" | "accordo" | "verbi" | "pronomi" | "altro";
  /**
   * Почему так (коротко)
   */
  explanation?: string | null;
  timer_s?: number;
  /**
   * Показать ответ в конце ролика
   */
  reveal?: boolean;
}
