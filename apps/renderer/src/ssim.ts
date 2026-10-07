import { PNG } from "pngjs";

/** Яркость (Rec.601) из RGBA. */
function luma(png: PNG): Float64Array {
  const out = new Float64Array(png.width * png.height);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = 0.299 * png.data[o]! + 0.587 * png.data[o + 1]! + 0.114 * png.data[o + 2]!;
  }
  return out;
}

/** Средний SSIM по окнам 8×8 (без гауссова сглаживания — для регрессии кадров этого достаточно). */
export function ssim(aBuf: Buffer, bBuf: Buffer, win = 8): number {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  if (a.width !== b.width || a.height !== b.height) return 0;
  const la = luma(a);
  const lb = luma(b);
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let total = 0;
  let n = 0;
  for (let y = 0; y + win <= a.height; y += win) {
    for (let x = 0; x + win <= a.width; x += win) {
      let ma = 0;
      let mb = 0;
      for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
        const k = (y + j) * a.width + x + i;
        ma += la[k]!;
        mb += lb[k]!;
      }
      const N = win * win;
      ma /= N;
      mb /= N;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
        const k = (y + j) * a.width + x + i;
        const da = la[k]! - ma;
        const db = lb[k]! - mb;
        va += da * da;
        vb += db * db;
        cov += da * db;
      }
      va /= N - 1;
      vb /= N - 1;
      cov /= N - 1;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      n++;
    }
  }
  return n ? total / n : 0;
}
