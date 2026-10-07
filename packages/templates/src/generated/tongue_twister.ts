/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Scioglilingua: медленно по словам с подсветкой, затем быстро. Челлендж «Riesci a dirlo 3 volte?».
 */
export interface TongueTwisterBody {
  /**
   * Скороговорка
   */
  text: string;
  translation?: string | null;
  slow_speed?: number;
  fast_speed?: number;
}
