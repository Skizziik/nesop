/**
 * Листы ассетов мультиков (AssetSheet) в png — визуальная проверка каталога после добавления ассета.
 *   tsx scripts/sheets.ts <outDir> [kind...] [--seed N] [--chars finn,molly]
 *   kind = locations | props | outfits | fx | actions | characters | faces | visemes (липсинк) | world:<location>[:season] (лист мира: все совместимые состояния)
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { bundleTemplates } from "../src/bundle";

const args = process.argv.slice(2);
const si = args.indexOf("--seed");
const seed = si >= 0 ? Number(args[si + 1]) : 0;
// --chars: герои для outfits (все в клетке) и actions/fx (первый)
const ci = args.indexOf("--chars");
const chars = ci >= 0 ? String(args[ci + 1] ?? "").split(",").filter(Boolean) : [];
const rest = args.filter((_, i) => !(si >= 0 && (i === si || i === si + 1)) && !(ci >= 0 && (i === ci || i === ci + 1)));
const [outDir = "sheets", ...kinds] = rest;
const all = ["locations", "props", "outfits", "fx", "actions", "characters"];
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundleTemplates();
for (const kind of kinds.length ? kinds : all) {
  const [k, loc, season] = kind.split(":");
  const world = k === "world";
  const inputProps = world ? { location: loc ?? "garden", season: season ?? "summer" } : { kind, seed, ...(chars.length ? { chars } : {}) };
  const composition = await selectComposition({ serveUrl, id: world ? "WorldSheet" : "AssetSheet", inputProps });
  const output = join(outDir, `sheet_${kind.replace(/:/g, "_")}${seed ? `_s${seed}` : ""}${chars.length ? `_${chars.join("-")}` : ""}.png`);
  await renderStill({ serveUrl, composition, inputProps, frame: 0, output, imageFormat: "png", scale: Number(process.env.STILL_SCALE ?? 1), chromiumOptions: { gl: "swangle" } });
  console.log(output);
}
