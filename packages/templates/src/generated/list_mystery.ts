/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Классика канала: столбик пар, последовательная подсветка, последняя строка спрятана.
 */
export interface ListMysteryBody {
  /**
   * badge = бордовая плашка (числа), dark = чёрная (местоимения, EN-слова, артикли)
   */
  left_style: "badge" | "dark";
  /**
   * Что озвучивать: только итальянское справа или пару целиком
   */
  speak: "right" | "both";
  /**
   * Что спрятать в последней строке (??? справа или ?? слева)
   */
  hide: "right" | "left";
  /**
   * Показать ответ в конце (по умолчанию нет: ответ уходит в комменты)
   */
  reveal?: boolean;
  /**
   * @minItems 4
   * @maxItems 12
   */
  items: ListItem[];
}
export interface ListItem {
  left: string;
  right: string;
  /**
   * Подпись вторым языком
   */
  sub?: string | null;
}
