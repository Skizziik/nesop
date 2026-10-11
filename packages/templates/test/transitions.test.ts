import { describe, expect, it } from "vitest";
import { bubbleLayout, inDuration, irisCloseR, irisOpenR, transitionFor } from "../src/cartoon/transitions";

const sc = (kind: string, location = "garden", extra: Record<string, unknown> = {}) => ({ kind, location, duration: 5, ...extra });

describe("cartoon transitions", () => {
  it("picks a deterministic default by scene kind and index", () => {
    const scenes = [sc("intro"), sc("title"), sc("story", "garden"), sc("story", "kitchen"), sc("story", "forest"), sc("song"), sc("outro")];
    const got = scenes.map((_, i) => transitionFor(scenes, i));
    expect(got).toEqual(["cut", "star", "fade", "iris", "wipe", "bubble", "iris"]);
    expect(scenes.map((_, i) => transitionFor(scenes, i))).toEqual(got);
  });

  it("bumper enters with a star, the story title after it with a wipe", () => {
    const scenes = [sc("intro"), sc("bumper"), sc("title"), sc("story", "garden")];
    expect(scenes.map((_, i) => transitionFor(scenes, i))).toEqual(["cut", "star", "wipe", "fade"]);
  });

  it("first scene without an intro fades in; explicit transitionIn wins", () => {
    const scenes = [sc("title"), sc("story", "beach", { transitionIn: "bubble" })];
    expect(transitionFor(scenes, 0)).toBe("fade");
    expect(transitionFor(scenes, 1)).toBe("bubble");
  });

  it("transition never takes more than half of a short scene", () => {
    expect(inDuration("star", 0.6)).toBeCloseTo(0.3);
    expect(inDuration("cut", 5)).toBe(0);
  });

  it("iris closes to a point and opens to cover the frame", () => {
    expect(irisCloseR(1, 960, 540)).toBeCloseTo(0);
    expect(irisCloseR(0, 960, 540)).toBeGreaterThan(1100);
    expect(irisOpenR(1, 200, 200)).toBeGreaterThan(Math.hypot(1720, 880));
  });

  it("bubbles at full size cover every point of the frame", () => {
    for (const idx of [0, 1, 7]) {
      const b = bubbleLayout(idx);
      for (let x = 0; x <= 1920; x += 80)
        for (let y = 0; y <= 1080; y += 60) expect(b.some((c) => Math.hypot(c.x - x, c.y - y) <= c.max)).toBe(true);
    }
  });
});
