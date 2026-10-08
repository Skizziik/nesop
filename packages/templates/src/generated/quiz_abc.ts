/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Вопрос и три варианта A/B/C, кольцо-таймер, затем ответ с конфетти (или ответ только в комментах).
 */
export interface QuizAbcBody {
  /**
   * Вопрос, напр. «Come si dice "cucchiaio" in inglese?»
   */
  question: string;
  /**
   * Что говорит голос (пусто = question)
   */
  spoken_question?: string;
  /**
   * @minItems 3
   * @maxItems 3
   */
  options: string[];
  correct: number;
  timer_s?: number;
  /**
   * Показать ответ в конце ролика
   */
  reveal?: boolean;
  /**
   * Короткое пояснение после ответа
   */
  explanation?: string | null;
  /**
   * Язык вопроса
   */
  question_lang?: "it" | "en";
  /**
   * Язык вариантов
   */
  options_lang?: "it" | "en";
}
