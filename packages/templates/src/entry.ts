// Точка входа бандла для @remotion/bundler (используется только renderer).
import { continueRender, delayRender, registerRoot } from "remotion";
import { loadAllFonts } from "./fonts";
import { RemotionRoot } from "./Root";

const handle = delayRender("Загрузка шрифтов");
loadAllFonts()
  .catch((e: unknown) => console.error("Шрифты не загрузились", e))
  .finally(() => continueRender(handle));

registerRoot(RemotionRoot);
