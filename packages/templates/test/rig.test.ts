import { describe, expect, it } from "vitest";
import { CAST } from "../src/cartoon/cast";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { actionPose, ACTION_IDS, type ActionKind } from "../src/cartoon/actions";
import { blinkAt, Character, handPositions, REST, type CharState, type Pose } from "../src/cartoon/rig";
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
  it("у уличных локаций есть все токены неба (иначе солнце/облака рисуются чёрными)", () => {
    for (const id of ["garden", "garden_evening", "playground", "beach", "forest"])
      for (const k of ["sky1", "sky2", "skySun", "skySunRim", "skySunGlow", "skyCloud", "skyCloudShade"]) expect(resolvePalette(id)[k], `${id}.${k}`).toBeTruthy();
  });
  it("сид 0 — каноническая раскладка, ненулевой сид детерминирован", () => {
    expect(pick(0, "x", ["a", "b", "c"], "z")).toBe("z");
    expect(pick(42, "x", ["a", "b", "c"], "z")).toBe(pick(42, "x", ["a", "b", "c"], "z"));
  });
});

/** Где нарисован предмет в руке: translate(hx hy) группы предмета + transform корня персонажа. */
function drawnHand(id: string, pose: Pose, t: number, facing: 1 | -1): [number, number] {
  const spec = CAST[id]!;
  const st: CharState = { pose, emotion: "happy", mouth: 0, blink: false, look: [0, 0], facing, hold: { id: "ball" }, autoBlink: false };
  const svg = renderToStaticMarkup(createElement("svg", null, createElement(Character, { spec, st, t })));
  const root = /<g transform="translate\(0 (-?[\d.e-]+)\) rotate\((-?[\d.e-]+) 0 (-?[\d.e-]+)\) scale\((-?[\d.e-]+) (-?[\d.e-]+)\)">/.exec(svg);
  const hold = /<g transform="translate\((-?[\d.e-]+) (-?[\d.e-]+)\) scale\(0\.(?:85|95)\)">/.exec(svg);
  expect(root, "root transform").not.toBeNull();
  expect(hold, "hold transform").not.toBeNull();
  const [ty, rot, piv, sx, sy] = root!.slice(1).map(Number) as [number, number, number, number, number];
  const [hx, hy] = hold!.slice(1).map(Number) as [number, number];
  const x = hx * sx;
  const y = hy * sy - piv;
  const a = (rot * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a) + piv + ty];
}

describe("скелет: кисть совпадает с отрисовкой", () => {
  const cases: [string, ActionKind, number][] = [
    ["benny", "walk", 0.7],
    ["mia", "run", 1.1],
    ["ollie", "give", 0.8],
    ["dot", "pick_up", 0.3],
    ["mama", "throw", 0.35],
    ["benny", "eat", 0.5],
    ["mia", "cover_eyes", 0.5],
    ["ollie", "jump", 0.5],
    ["benny", "point", 1],
    ["dot", "spin", 0.3],
  ];
  for (const [id, kind, tl] of cases)
    for (const facing of [1, -1] as const)
      it(`${id} ${kind} facing ${facing}`, () => {
        const pose = actionPose(kind, tl, 3);
        const [x, y] = drawnHand(id, pose, 3, facing);
        const h = handPositions(CAST[id]!, pose, 3, facing);
        expect(x).toBeCloseTo(h.R[0], 1);
        expect(y).toBeCloseTo(h.R[1], 1);
      });
});

describe("профиль при ходьбе", () => {
  const benny = CAST.benny!;
  it("ходьба влево — зеркало ходьбы вправо", () => {
    const pose = actionPose("walk", 0.9, 2);
    const r = handPositions(benny, pose, 2, 1);
    const l = handPositions(benny, pose, 2, -1);
    expect(l.R[0]).toBeCloseTo(-r.R[0], 5);
    expect(l.R[1]).toBeCloseTo(r.R[1], 5);
  });
  it("разворот в профиль за ~0.2 с и обратно после ходьбы", () => {
    expect(actionPose("walk", 0, 0).turn).toBe(0);
    expect(actionPose("walk", 0.25, 0).turn).toBe(1);
    expect(actionPose("idle", 0, 0, 2, "walk").turn).toBe(1);
    expect(actionPose("idle", 0.25, 0, 2, "walk").turn ?? 0).toBe(0);
  });
  it("руки машут навстречу: правая вперёд, когда левая назад", () => {
    const p = actionPose("walk", 0, 0);
    const h = handPositions(benny, p, 0, 1);
    expect(h.R[0]).toBeGreaterThan(h.L[0] + 20);
  });
});

describe("действия", () => {
  it("все действия дают конечные числа и детерминированы", () => {
    for (const k of ACTION_IDS)
      for (const tl of [0, 0.13, 0.5, 1.7, 4.2]) {
        const a = actionPose(k, tl, 7);
        expect(a).toEqual(actionPose(k, tl, 7));
        const h = handPositions(CAST.mama!, a, 7, -1);
        for (const v of [...h.L, ...h.R, ...h.head]) expect(Number.isFinite(v), `${k}@${tl}`).toBe(true);
      }
  });
  it("pick_up: кисть у земли, cover_eyes: кисти у глаз", () => {
    const pk = handPositions(CAST.benny!, actionPose("pick_up", 0.3, 0), 0, 1);
    expect(pk.R[1]).toBeGreaterThan(-35);
    const ce = handPositions(CAST.benny!, actionPose("cover_eyes", 0.5, 0), 0, 1);
    expect(Math.abs(ce.R[1] - ce.head[1])).toBeLessThan(30);
    expect(Math.abs(ce.L[1] - ce.head[1])).toBeLessThan(30);
  });
});

describe("моргание", () => {
  it("неровные интервалы 2-6 с, детерминированно", () => {
    const starts: number[] = [];
    let prev = 0;
    for (let f = 0; f < 30 * 120; f++) {
      const v = blinkAt("benny", f / 30);
      if (v > 0 && prev === 0) starts.push(f / 30);
      prev = v;
    }
    const gaps = starts.slice(1).map((s, i) => s - starts[i]!);
    expect(gaps.length).toBeGreaterThan(20);
    expect(Math.min(...gaps)).toBeGreaterThan(1.9);
    expect(Math.max(...gaps)).toBeLessThan(6.1);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(1.5);
    expect(blinkAt("mia", 12.34)).toBe(blinkAt("mia", 12.34));
  });
});
