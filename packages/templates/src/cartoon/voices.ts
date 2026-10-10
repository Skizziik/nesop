/** Голоса героев (Qwen3 Voice Design, английский). Описание → эталон → клон: голос одинаковый во всех эпизодах. */
export const CAST_VOICES: Record<string, { description: string; speed: number }> = {
  narrator: {
    description:
      "A friendly female storyteller in her thirties, like a beloved children's TV presenter: warm, smiling, expressive and gentle, clear American English, slow and easy for toddlers to follow.",
    speed: 0.95,
  },
  benny: {
    description: "A cheerful, curious little boy about five years old with a bright, high, playful voice, excited and full of wonder, clear American English, speaking slowly.",
    speed: 0.95,
  },
  mia: {
    description: "A sweet, clever little girl about five years old with a high, clear, confident voice, kind and bubbly, clear American English, speaking slowly.",
    speed: 0.95,
  },
  ollie: {
    description: "A gentle, chubby little boy about six years old with a soft, slightly lower, slow and cozy voice, giggly and kind, clear American English.",
    speed: 0.92,
  },
  dot: {
    description: "A tiny, squeaky, super energetic toddler about three years old, very high-pitched, giggly and silly, clear American English, short excited words.",
    speed: 1.0,
  },
  mama: {
    description: "A warm, loving young mother in her early thirties with a soft, calm, gentle voice, patient and reassuring, clear American English.",
    speed: 0.95,
  },
};
