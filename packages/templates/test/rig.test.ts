import { describe, expect, it } from "vitest";
import { CAST } from "../src/cartoon/cast";
import { handPositions, REST } from "../src/cartoon/rig";
import { pick, resolvePalette, PALETTE_LOCATIONS } from "../src/cartoon/palette";
import { LOCATION_IDS } from "../src/cartoon/locations";

describe("скелет: handPositions", () => {
  const benny = CAST.benny!;
  it("руки опущены — кисти ниже плеч, по разные стороны", () => {
    const h = handPositions(benny, REST, 0);
    expect(h.L[0]).toBeLessThan(0);
    expect(h.R[0]).toBeGreaterThan(0);
    expect(h.R[1]).toBeGreaterThan(h.head[1]);
  });
  it("прыжок поднимает все точки на lift", () => {
    const a = handPositions(benny, REST, 0);
    const b = handPositions(benny, { ...REST, lift: 90 }, 0);
    expect(b.R[1]).toBeCloseTo(a.R[1] - 90, 5);
    expect(b.head[1]).toBeCloseTo(a.head[1] - 90, 5);
  });
  it("поднятая рука — кисть на уровне головы и намного выше опущенной", () => {
    const h = handPositions(benny, { ...REST, armR: [170, 5] }, 0);
    const rest = handPositions(benny, REST, 0);
    expect(h.R[1]).toBeLessThan(h.head[1] + 20);
    expect(rest.R[1] - h.R[1]).toBeGreaterThan(120);
  });
});

describe("палитры и сид", () => {
  it("у каждой локации есть своя палитра", () => {
    for (const id of LOCATION_IDS) expect(PALETTE_LOCATIONS).toContain(id);
  });
  it("палитра — только hex-цвета без чёрного", () => {
    for (const id of LOCATION_IDS)
      for (const [k, v] of Object.entries(resolvePalette(id))) {
        expect(v, `${id}.${k}`).toMatch(/^#[0-9A-F]{6}$/i);
        expect(v.toUpperCase(), `${id}.${k}`).not.toBe("#000000");
      }
  });
  it("сид 0 — каноническая раскладка, ненулевой сид детерминирован", () => {
    expect(pick(0, "x", ["a", "b", "c"], "z")).toBe("z");
    expect(pick(42, "x", ["a", "b", "c"], "z")).toBe(pick(42, "x", ["a", "b", "c"], "z"));
  });
});
