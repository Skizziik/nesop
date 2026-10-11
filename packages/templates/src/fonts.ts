// Шрифты (OFL-1.1) вшиваются в бандл: рендер работает офлайн. Импортируется и web, и renderer.
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/andika/700.css"; // карточки слов в мультиках: однокомнатные «a» и «g», как в детских прописях

export const FONT_FAMILIES = ["Montserrat", "Fredoka", "Nunito", "Andika"] as const;

/** Явно грузит все начертания (иначе браузер грузит шрифт лениво и первые кадры рендерятся системным). */
export async function loadAllFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    FONT_FAMILIES.flatMap((f) => ["700", "800"].map((w) => document.fonts.load(`${w} 64px "${f}"`, "AÀÈÉÌÒÙ?0"))),
  );
  await document.fonts.ready;
}
