import { describe, expect, it } from "vitest";
import { heldBy, itemAt, type HandOf, type SceneItem } from "../src/cartoon/items";

const hand: HandOf = (char) => ({ benny: { x: 600, y: 700, scale: 1 }, mia: { x: 1000, y: 700, scale: 1 } } as Record<string, { x: number; y: number; scale: number }>)[char] ?? null;
const apple: SceneItem = {
  uid: "a",
  prop: "apple",
  keys: [{ t: 0, at: { kind: "hand", char: "benny" } }, { t: 1, at: { kind: "hand", char: "mia" }, anim: "pass" }, { t: 2, state: "bitten" }],
};

describe("предметы сцены", () => {
  it("в руке у героя, потом передан и надкушен", () => {
    expect(itemAt(apple, 0.5, hand)).toMatchObject({ x: 600, holder: "benny", flying: false });
    const mid = itemAt(apple, 1.2, hand)!;
    expect(mid.flying).toBe(true);
    expect(mid.x).toBeGreaterThan(600);
    expect(mid.x).toBeLessThan(1000);
    expect(itemAt(apple, 3, hand)).toMatchObject({ x: 1000, holder: "mia", state: "bitten" });
    expect(heldBy([apple], 3, hand)).toEqual({ mia: "apple" });
  });
  it("бросок летит дугой выше обеих точек", () => {
    const ball: SceneItem = { uid: "b", prop: "ball", keys: [{ t: 0, at: { kind: "ground", x: 600 } }, { t: 1, at: { kind: "hand", char: "mia" }, anim: "throw" }] };
    const top = itemAt(ball, 1.37, hand)!;
    expect(top.y).toBeLessThan(700 - 100); // выше руки ловящего (старт с земли y≈911)
  });
  it("до первого ключа предмета нет, улетевший шарик исчезает", () => {
    const b: SceneItem = { uid: "c", prop: "balloon", keys: [{ t: 1, at: { kind: "hand", char: "benny" } }, { t: 2, at: { kind: "ground", x: 0 }, anim: "float_away" }] };
    expect(itemAt(b, 0.5, hand)).toBeNull();
    expect(itemAt(b, 9, hand)).toBeNull();
  });
});
