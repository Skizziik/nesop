/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Parola del giorno #N: слово, произношение, пример, номер эпизода.
 */
export interface DailyWordBody {
  word: string;
  article?: string | null;
  /**
   * Деление на слоги с ударением, напр. «buon-GIOR-no»
   */
  syllables: string;
  part_of_speech: "nome" | "verbo" | "aggettivo" | "avverbio" | "espressione" | "altro";
  /**
   * Перевод (2-й язык)
   */
  translation: string;
  example: string;
  example_translation?: string | null;
}
