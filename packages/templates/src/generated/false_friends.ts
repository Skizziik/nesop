/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Falsi amici: CAMERA ≠ camera. Последний пример спрятан.
 */
export interface FalseFriendsBody {
  /**
   * Язык, с которым «ложная дружба»
   */
  lang?: "en" | "es" | "fr" | "ru";
  /**
   * @minItems 3
   * @maxItems 6
   */
  items: FalseFriend[];
}
export interface FalseFriend {
  /**
   * Итальянское слово
   */
  it: string;
  /**
   * Похожее иностранное слово
   */
  looks_like: string;
  /**
   * Что на самом деле значит итальянское слово (на языке lang)
   */
  it_means: string;
  /**
   * Как по-итальянски сказать looks_like
   */
  say_instead: string;
}
