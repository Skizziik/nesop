import { describe, expect, it } from "vitest";
import { audioWindow, focusTarget, panFor, sceneIndexAt, SHORT_SCALE, SHORT_W, smoothFocus, speakerAt, SRC_W, wrapWords } from "../src/cartoon/shortFocus";

describe("short focus", () => {
  it("frames the speaker, or both when the partner is close", () => {
    const far = [{ id: "benny", px: 500 }, { id: "mia", px: 1400 }];
    expect(focusTarget(far, "mia")).toBe(1400);
    expect(focusTarget(far, "benny")).toBe(500);
    const close = [{ id: "benny", px: 800 }, { id: "mia", px: 1000 }];
    expect(focusTarget(close, "benny")).toBe(900);
  });

  it("without a speaker looks at the group if it fits, else the hero nearest the centre", () => {
    expect(focusTarget([{ id: "a", px: 900 }, { id: "b", px: 1100 }], null)).toBe(1000);
    expect(focusTarget([{ id: "a", px: 200 }, { id: "b", px: 1000 }, { id: "c", px: 1700 }], null)).toBe(1000);
    expect(focusTarget([], null)).toBe(SRC_W / 2);
    expect(focusTarget([{ id: "a", px: -900 }], "a")).toBe(SRC_W / 2); // off-screen heroes are ignored
  });

  it("pan centres the focus and never shows past the scene edges", () => {
    expect(panFor(960)).toBeCloseTo(SHORT_W / 2 - 960 * SHORT_SCALE);
    expect(panFor(0)).toBe(0);
    expect(panFor(SRC_W)).toBeCloseTo(SHORT_W - SRC_W * SHORT_SCALE);
  });

  it("smoothing eases between targets instead of jumping", () => {
    const step = (t: number) => (t < 5 ? 400 : 1400);
    const before = smoothFocus(step, 4.0, 0, 10);
    const mid = smoothFocus(step, 5.0, 0, 10);
    const after = smoothFocus(step, 6.0, 0, 10);
    expect(before).toBe(400);
    expect(after).toBe(1400);
    expect(mid).toBeGreaterThan(400);
    expect(mid).toBeLessThan(1400);
  });

  it("speaker: during a line (with a little lead) and shortly after it", () => {
    const lines = [{ char: "benny", start: 1, dur: 2 }, { char: "mia", start: 4, dur: 1 }];
    expect(speakerAt(lines, 0.8)).toBe("benny");
    expect(speakerAt(lines, 3.5)).toBe("benny");
    expect(speakerAt(lines, 4.5)).toBe("mia");
    expect(speakerAt(lines, 9)).toBeNull();
  });
});

describe("short audio and scenes", () => {
  it("stems that started before the window are trimmed, later ones are delayed", () => {
    expect(audioWindow({ start: 0 }, 60, 90, 30)).toEqual({ from: 0, trimBefore: 1800, durationInFrames: 900 });
    expect(audioWindow({ start: 70, dur: 5 }, 60, 90, 30)).toEqual({ from: 300, trimBefore: 0, durationInFrames: 150 });
    expect(audioWindow({ start: 58, dur: 4 }, 60, 90, 30)).toEqual({ from: 0, trimBefore: 60, durationInFrames: 60 });
    expect(audioWindow({ start: 10, dur: 5 }, 60, 90, 30)).toBeNull();
    expect(audioWindow({ start: 95 }, 60, 90, 30)).toBeNull();
  });

  it("scene index matches the episode rule", () => {
    const scenes = [{ start: 0, duration: 5 }, { start: 5, duration: 5 }];
    expect(sceneIndexAt(scenes, 5)).toBe(1);
    expect(sceneIndexAt(scenes, 12)).toBe(1);
    expect(sceneIndexAt(scenes, -1)).toBe(0);
  });

  it("wraps karaoke words into short rows", () => {
    const words = "I have a ball and you have none".split(" ");
    const rows = wrapWords(words, 12);
    expect(rows.flat()).toEqual(words.map((_, i) => i));
    for (const r of rows) expect(r.map((i) => words[i]).join(" ").length).toBeLessThanOrEqual(12);
    expect(wrapWords(["Supercalifragilistic", "yes"], 8)).toEqual([[0], [1]]);
  });
});
