/**
 * Golden-кадры: рендерим ключевые кадры каждого формата и сравниваем с эталоном по SSIM.
 * Player в дашборде и renderer используют один и тот же компонент (@ipt/templates), поэтому эталон фиксирует
 * и превью, и рендер. Нужен браузер → запускается в контейнере renderer: `make test-golden`.
 * Обновить эталоны после намеренного изменения шаблона: UPDATE_GOLDEN=1 make test-golden.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderStill, selectComposition } from "@remotion/renderer";
import { SAMPLE_PROPS } from "@ipt/templates";
import { bundleTemplates } from "../src/bundle";
import { ssim } from "../src/ssim";

const RUN = process.env.GOLDEN === "1";
const UPDATE = process.env.UPDATE_GOLDEN === "1";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "golden");
const THRESHOLD = 0.985;

// кадр 0 (весь список + хук), середина (подсветка), конец (CTA + пульсирующий ???)
const CASES = [
  { format: "list_mystery", props: SAMPLE_PROPS, frames: [0, 75, 400] },
];

describe.runIf(RUN)("golden frames", () => {
  let serveUrl = "";
  it("бандл собирается", async () => {
    serveUrl = await bundleTemplates();
    expect(serveUrl).toBeTruthy();
  }, 300_000);

  for (const c of CASES) {
    for (const frame of c.frames) {
      it(`${c.format} кадр ${frame} совпадает с эталоном (SSIM ≥ ${THRESHOLD})`, async () => {
        const inputProps = c.props as unknown as Record<string, unknown>;
        const composition = await selectComposition({ serveUrl, id: "Short", inputProps });
        const out = join(tmpdir(), `golden-${c.format}-${frame}.png`);
        await renderStill({ serveUrl, composition, inputProps, frame, output: out, imageFormat: "png", scale: 0.25, chromiumOptions: { gl: "swangle" } });
        const ref = join(DIR, `${c.format}-${frame}.png`);
        const got = readFileSync(out);
        if (UPDATE || !existsSync(ref)) {
          mkdirSync(DIR, { recursive: true });
          writeFileSync(ref, got);
          return;
        }
        const score = ssim(readFileSync(ref), got);
        expect(score).toBeGreaterThanOrEqual(THRESHOLD);
      }, 120_000);
    }
  }
});

describe("ssim", () => {
  it("одинаковые картинки = 1", async () => {
    const { PNG } = await import("pngjs");
    const png = new PNG({ width: 16, height: 16 });
    for (let i = 0; i < png.data.length; i++) png.data[i] = (i * 37) % 255;
    const buf = PNG.sync.write(png);
    expect(ssim(buf, buf)).toBeCloseTo(1, 6);
    const png2 = new PNG({ width: 16, height: 16 });
    png2.data.fill(0);
    expect(ssim(buf, PNG.sync.write(png2))).toBeLessThan(0.5);
  });
});
