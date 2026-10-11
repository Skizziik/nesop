/**
 * Листы ассетов мультиков (AssetSheet) в png — визуальная проверка каталога после добавления ассета.
 *   tsx scripts/sheets.ts <outDir> [kind...] [--seed N]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { bundleTemplates } from "../src/bundle";

const args = process.argv.slice(2);
const si = args.indexOf("--seed");
const seed = si >= 0 ? Number(args[si + 1]) : 0;
const rest = si >= 0 ? args.filter((_, i) => i !== si && i !== si + 1) : args;
const [outDir = "sheets", ...kinds] = rest;
const all = ["locations", "props", "outfits", "fx", "actions", "characters"];
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundleTemplates();
for (const kind of kinds.length ? kinds : all) {
  const inputProps = { kind, seed };
  const composition = await selectComposition({ serveUrl, id: "AssetSheet", inputProps });
  const output = join(outDir, `sheet_${kind}${seed ? `_s${seed}` : ""}.png`);
  await renderStill({ serveUrl, composition, inputProps, frame: 0, output, imageFormat: "png", scale: Number(process.env.STILL_SCALE ?? 1), chromiumOptions: { gl: "swangle" } });
  console.log(output);
}
