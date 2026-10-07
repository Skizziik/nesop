/* eslint-disable */
// АВТОГЕНЕРАЦИЯ из /schemas. Не редактировать руками: `pnpm codegen`.

/**
 * Da A1 a C2: одно понятие на разных уровнях. Хук «Che livello sei?».
 */
export interface LevelLadderBody {
  /**
   * Понятие, напр. «bello» или «Sono stanco»
   */
  concept: string;
  concept_translation?: string | null;
  /**
   * @minItems 4
   * @maxItems 6
   */
  steps: Step[];
}
export interface Step {
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  text: string;
  /**
   * Перевод/оттенок
   */
  note?: string | null;
}
