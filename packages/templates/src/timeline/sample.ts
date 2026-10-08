import type { TimelineDoc } from "../generated";

/** Пример проекта 16:9: несколько слайдов лекции + маскот + субтитры. Дефолт композиции и фикстура тестов. */
export const SAMPLE_TIMELINE: TimelineDoc = {
  version: 1,
  title: "Gli articoli determinativi",
  canvas: { w: 1920, h: 1080, fps: 30 },
  duration_s: 40,
  background: "#1B1035",
  font: "Montserrat",
  subtitle_style: { size: 44, y: 0.9, show_translation: true, highlight_words: true },
  envelope: [],
  asset_base: "",
  seed: 1,
  tracks: [
    {
      id: "scenes",
      kind: "scene",
      name: "Сцены",
      clips: [
        { id: "s1", type: "slide", start: 0, duration: 6, anim_in: "fade", props: { kind: "title", chapter: "Lezione 1", title: "Gli articoli determinativi", subtitle: "il, lo, la, l', i, gli, le" } },
        {
          id: "s2",
          type: "slide",
          start: 6,
          duration: 10,
          anim_in: "slide_left",
          props: { kind: "explain", chapter: "Capitolo 1", title: "Quando si usa «lo»?", bullets: ["Davanti a s + consonante: lo studente", "Davanti a z: lo zaino", "Davanti a gn, ps, y: lo gnomo, lo psicologo"], marks: [1, 4, 7] },
        },
        {
          id: "s3",
          type: "slide",
          start: 16,
          duration: 8,
          anim_in: "slide_left",
          props: { kind: "examples", chapter: "Capitolo 1", title: "Esempi", rows: [{ it: "il gatto", tr: "кот" }, { it: "lo zaino", tr: "рюкзак" }, { it: "la casa", tr: "дом" }, { it: "l'acqua", tr: "вода", note: "перед гласной — l'" }], marks: [0.5, 2.3, 4.1, 5.9] },
        },
        {
          id: "s4",
          type: "slide",
          start: 24,
          duration: 7,
          props: { kind: "table", chapter: "Capitolo 2", title: "Singolare → plurale", table: { header: ["Singolare", "Plurale"], rows: [["il", "i"], ["lo / l'", "gli"], ["la / l'", "le"]] }, marks: [0.5, 2.5, 4.5] },
        },
        {
          id: "s5",
          type: "slide",
          start: 31,
          duration: 9,
          props: { kind: "quiz", chapter: "Mini-quiz", title: "Tocca a te!", quiz: { question: "___ zaino è nuovo.", options: ["Il", "Lo", "La"], correct: 1, timer_s: 4 }, countdown_at: 2, reveal_at: 6 },
        },
      ],
    },
    {
      id: "mascot",
      kind: "mascot",
      name: "Маскот",
      clips: [{ id: "m1", type: "mascot", start: 0, duration: 40, x: 0.72, y: 0.36, w: 0.24, h: 0.5, props: { character: "espresso", emotion: "auto", talk: true } }],
    },
    {
      id: "subs",
      kind: "subtitle",
      name: "Субтитры",
      clips: [
        { id: "sub1", type: "subtitle", start: 0.5, duration: 4, props: { text: "Ciao a tutti! Oggi parliamo degli articoli.", tr: "Всем привет! Сегодня говорим об артиклях.", words: [[0, 0.5], [0.5, 0.3], [0.8, 0.5], [1.3, 0.5], [1.8, 0.6], [2.4, 0.5], [2.9, 0.8]] } },
        { id: "sub2", type: "subtitle", start: 7, duration: 3, props: { text: "Lo studente, lo zaino.", tr: "Студент, рюкзак." } },
      ],
    },
    {
      id: "text",
      kind: "overlay",
      name: "Текст",
      clips: [{ id: "t1", type: "text", start: 1, duration: 4, x: 0.62, y: 0.08, w: 0.33, h: 0.1, anim_in: "pop", anim_out: "fade", rotation: -3, props: { text: "🇮🇹 Livello A1", size: 52, bg: "#FFE135", color: "#1B1B1B" } }],
    },
  ],
};
