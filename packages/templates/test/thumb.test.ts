import { describe, expect, it } from "vitest";
import { autoWear, colorOf, linesFontSize, pickLayout, resolveProp, splitLines, thumbPose, THUMB_LAYOUTS } from "../src/cartoon/Thumb";
import { PROP_CATALOG } from "../src/cartoon/catalog";

describe("обложка мультика", () => {
  it("макет: явный или по варианту, мусор → по варианту", () => {
    expect(pickLayout("song", 0)).toBe("song");
    expect(pickLayout(undefined, 1)).toBe(THUMB_LAYOUTS[1]);
    expect(pickLayout("nope", THUMB_LAYOUTS.length + 2)).toBe(THUMB_LAYOUTS[2]);
  });
  it("строки: максимум 3 слова, короткое слово не остаётся одно, выбирается самый крупный кегль", () => {
    expect(splitLines("a surprise!", 680, 200)).toEqual(["A SURPRISE!"]);
    expect(splitLines("snow day", 300, 260)).toEqual(["SNOW", "DAY"]);
    expect(splitLines("one two three four").join(" ").split(" ")).toHaveLength(3);
    const lines = splitLines("Learn colors", 730, 244);
    expect(linesFontSize(lines, 730, 244)).toBeGreaterThanOrEqual(linesFontSize(["LEARN COLORS"], 730, 244));
  });
  it("предмет: id каталога, эмодзи как запасной вариант", () => {
    expect(resolveProp("kite")).toBe("kite");
    expect(resolveProp("nope", "🍎")).toBe("apple");
    expect(resolveProp(undefined, "☂️")).toBe("umbrella");
    expect(resolveProp(undefined, "🦄")).toBeNull();
    for (const p of PROP_CATALOG) expect(resolveProp(p.id)).toBe(p.id);
  });
  it("цвета и костюмы по миру", () => {
    expect(colorOf("red")).toBe("#FF4D5A");
    expect(colorOf("#123456")).toBe("#123456");
    expect(autoWear("garden", { time: "day", weather: "snow", season: "winter" })).toEqual(expect.arrayContaining(["winter_hat", "scarf"]));
    expect(autoWear("playground", { time: "day", weather: "rain", season: "spring" })).toContain("raincoat");
    expect(autoWear("kitchen", { time: "day", weather: "rain", season: "spring" })).toEqual([]);
    expect(autoWear("bedroom", { time: "night", weather: "clear", season: "summer" }, true)).not.toContain("pajamas");
  });
  it("«ура» на обложке — руки за головой (лицо не закрыто)", () => {
    const p = thumbPose("cheer", 0.3);
    expect(p.armL[0]).toBeLessThan(120);
    expect(p.armR[0]).toBeLessThan(120);
  });
});
