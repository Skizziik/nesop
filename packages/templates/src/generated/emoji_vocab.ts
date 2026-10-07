/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Come si dice? Эмодзи → слово, последнее скрыто.
 */
export interface EmojiVocabBody {
  /**
   * @minItems 4
   * @maxItems 9
   */
  items: EmojiItem[];
}
export interface EmojiItem {
  emoji: string;
  word: string;
  /**
   * Артикль, если нужен: il, la, l'...
   */
  article?: string | null;
}
