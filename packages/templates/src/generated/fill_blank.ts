/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Completa la frase: пропуск и варианты (предлоги, артикли).
 */
export interface FillBlankBody {
  /**
   * Фраза с пропуском ___ (ровно один)
   */
  sentence: string;
  /**
   * @minItems 2
   * @maxItems 4
   */
  options: string[];
  correct: number;
  /**
   * Перевод фразы
   */
  translation?: string | null;
  timer_s?: number;
  /**
   * Показать ответ в конце ролика
   */
  reveal?: boolean;
}
