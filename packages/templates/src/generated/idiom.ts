/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Espressioni: буквальный смысл vs реальный, затем вопрос со скрытым ответом.
 */
export interface IdiomBody {
  /**
   * Выражение
   */
  idiom: string;
  /**
   * Буквальный перевод (2-й язык)
   */
  literal: string;
  /**
   * Реальный смысл (2-й язык)
   */
  meaning: string;
  /**
   * Вопрос-продолжение, напр. «E cosa si risponde?»
   */
  question?: string | null;
  /**
   * Скрытый ответ, напр. «Crepi!»
   */
  answer?: string | null;
  /**
   * Пример употребления
   */
  example?: string | null;
}
