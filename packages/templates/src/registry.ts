import type { FormatId, RenderProps } from "./generated";
import { DailyWord, Idiom, TongueTwister } from "./formats/Cards";
import { ListMystery } from "./formats/ListMystery";
import { FillBlank, QuizAbc } from "./formats/Quiz";
import { Conjugation, EmojiVocab, FalseFriends, LevelLadder } from "./formats/Rows";
import { SpotTheError } from "./formats/SpotTheError";

export type FormatComponent = React.FC<{ props: RenderProps }>;

/** Реализованные форматы. Новый формат = schemas/formats/<id>.schema.json + компонент здесь + services/api/app/formats. */
export const FORMAT_COMPONENTS: Partial<Record<FormatId, FormatComponent>> = {
  list_mystery: ListMystery,
  quiz_abc: QuizAbc,
  fill_blank: FillBlank,
  spot_the_error: SpotTheError,
  false_friends: FalseFriends,
  emoji_vocab: EmojiVocab,
  level_ladder: LevelLadder,
  conjugation_challenge: Conjugation,
  tongue_twister: TongueTwister,
  idiom: Idiom,
  daily_word: DailyWord,
};

export const IMPLEMENTED_FORMATS = Object.keys(FORMAT_COMPONENTS) as FormatId[];
