import { describe, expect, it } from "vitest";
import { highlightedIndex, activeEvent } from "../src/lib/timeline";
import { resolveAsset } from "../src/lib/assets";
import { fitFontSize } from "../src/lib/text";
import { layoutList, LIST_BOTTOM, LIST_TOP } from "../src/formats/ListMystery";
import { SAFE_RECT } from "../src/lib/safe";
import { SAMPLE_PROPS } from "../src/sample";
import type { ListMysteryBody } from "../src/generated";

describe("timeline", () => {
  const tl = SAMPLE_PROPS.timeline;
  it("подсветка идёт по порядку и детерминирована", () => {
    expect(highlightedIndex(tl, 0.5)).toBe(-1);
    expect(highlightedIndex(tl, 1.6)).toBe(0);
    expect(highlightedIndex(tl, 2.71)).toBe(1);
    expect(highlightedIndex(tl, 11.55)).toBe(9);
  });
  it("hook активен в первые 1.5 сек", () => {
    expect(activeEvent(tl, 0, "hook")).not.toBeNull();
    expect(activeEvent(tl, 1.5, "hook")).toBeNull();
  });
});

describe("assets", () => {
  it("относительные пути резолвятся через asset_base", () => {
    expect(resolveAsset("/media/a.wav", "http://api:8000/")).toBe("http://api:8000/media/a.wav");
    expect(resolveAsset("/media/a.wav", "")).toBe("/media/a.wav");
    expect(resolveAsset("https://x/y.wav", "http://api:8000")).toBe("https://x/y.wav");
    expect(resolveAsset(null, "x")).toBeNull();
  });
});

describe("layout list_mystery", () => {
  const body = SAMPLE_PROPS.body as unknown as ListMysteryBody;
  for (const layout of ["center", "left"] as const) {
    for (const n of [4, 8, 12]) {
      it(`${layout}, ${n} строк: внутри безопасных зон`, () => {
        const b: ListMysteryBody = { ...body, items: Array.from({ length: n }, (_, i) => ({ left: "lui/lei", right: `diciassette${i}` })) };
        const L = layoutList(b, layout, false);
        expect(L.x).toBeGreaterThanOrEqual(SAFE_RECT.x0);
        expect(L.x + L.leftW + L.gap + L.rightW).toBeLessThanOrEqual(SAFE_RECT.x1);
        expect(L.y).toBeGreaterThanOrEqual(LIST_TOP);
        expect(L.y + L.rowH * n).toBeLessThanOrEqual(LIST_BOTTOM);
        expect(SAFE_RECT.y1).toBeGreaterThanOrEqual(LIST_BOTTOM);
      });
    }
  }
  it("самое длинное слово схемы (20 символов) влезает не меньше чем 30px", () => {
    const L = layoutList({ ...body, items: Array.from({ length: 12 }, () => ({ left: "x".repeat(18), right: "x".repeat(20) })) }, "center", false);
    expect(fitFontSize("X".repeat(20), L.rightW - 36, L.pillH * 0.56, "Montserrat")).toBeGreaterThanOrEqual(22);
  });
});
