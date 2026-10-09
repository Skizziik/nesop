/**
 * Визуальная проверка: кадры композиции в png без запуска сервера.
 *   tsx scripts/still.ts <props.json> <Timeline|Short> <outDir> <сек> [сек...]
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { bundleTemplates } from "../src/bundle";

const [propsPath, comp = "Timeline", outDir = "stills", ...secs] = process.argv.slice(2);
if (!propsPath) {
  console.error("usage: tsx scripts/still.ts <props.json> <Timeline|Short> <outDir> <sec...>");
  process.exit(1);
}
const inputProps = JSON.parse(readFileSync(propsPath, "utf-8")) as Record<string, unknown>;
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundleTemplates();
const composition = await selectComposition({ serveUrl, id: comp, inputProps });
for (const s of secs.length ? secs : ["0"]) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(s) * composition.fps));
  const output = join(outDir, `t${s}.png`);
  await renderStill({ serveUrl, composition, inputProps, frame, output, imageFormat: "png", scale: Number(process.env.STILL_SCALE ?? 0.5), chromiumOptions: { gl: "swangle" } });
  console.log(output);
}
