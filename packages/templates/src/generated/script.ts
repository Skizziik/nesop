/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Скрипт ролика: то, что генерирует LLM / лежит в банке / правится в редакторе. body проверяется схемой формата.
 */
export interface Script {
  format:
    | "list_mystery"
    | "quiz_abc"
    | "spot_the_error"
    | "false_friends"
    | "fill_blank"
    | "level_ladder"
    | "tongue_twister"
    | "idiom"
    | "emoji_vocab"
    | "conjugation_challenge"
    | "daily_word";
  title: string;
  hook_text?: string;
  /**
   * Что голос говорит в первые 1.5 сек; пусто = hook_text
   */
  spoken_hook?: string;
  comment_hook?: CommentHook;
  level?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  topic?: string;
  body: {};
}
export interface CommentHook {
  type: "hidden_answer" | "abc" | "level" | "challenge" | "native_language" | "debate" | "streak";
  text: string;
  spoken?: string;
}
