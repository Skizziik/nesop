/**
 * Локальный рендер композиции в mp4 (проверки и демо без сервера).
 *   tsx scripts/render.ts <props.json> <CompositionId> <out.mp4>
 */
import { readFileSync } from "node:fs";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundleTemplates } from "../src/bundle";

const [propsPath, comp, out] = process.argv.slice(2);
if (!propsPath || !comp || !out) {
  console.error("usage: tsx scripts/render.ts <props.json> <CompositionId> <out.mp4>");
  process.exit(1);
}
const inputProps = JSON.parse(readFileSync(propsPath, "utf-8")) as Record<string, unknown>;
const serveUrl = await bundleTemplates();
const composition = await selectComposition({ serveUrl, id: comp, inputProps });
let last = -1;
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  codec: "h264",
  outputLocation: out,
  chromiumOptions: { gl: "swangle" },
  concurrency: 4,
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 10);
    if (p !== last) console.log(`${p * 10}%`), (last = p);
  },
});
console.log(out);
