/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Таблица спряжения, одна-две формы скрыты (не обязательно последняя).
 */
export interface ConjugationChallengeBody {
  verb: string;
  /**
   * Время, напр. «presente», «passato prossimo»
   */
  tense: string;
  /**
   * io, tu, lui/lei, noi, voi, loro
   *
   * @minItems 6
   * @maxItems 6
   */
  forms: string[];
  /**
   * Какие формы спрятать
   *
   * @minItems 1
   * @maxItems 2
   */
  hidden: number[];
  reveal?: boolean;
}
