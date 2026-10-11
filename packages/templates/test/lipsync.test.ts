import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { textPhrases, VISEMES, visemeAt, visemeFor, visemeTrack, wordVisemes, type Viseme } from "../src/cartoon/lipsync";
import { CAST } from "../src/cartoon/cast";
import { Character, REST, type CharState } from "../src/cartoon/rig";

const vs = (w: string) => wordVisemes(w).map((t) => t.v).join("");

/** Огибающая: тишина, звук (с пиками слогов), тишина. */
function env(lead: number, voiced: number, tail: number, peak = 0.9): number[] {
  return [...Array(lead).fill(0.01), ...Array.from({ length: voiced }, (_, i) => 0.35 + (peak - 0.35) * Math.abs(Math.sin((i / 30) * Math.PI * 4.5))), ...Array(tail).fill(0.01)];
}

describe("липсинк: слова → виземы", () => {
  it("губные M/B/P — сомкнуты (A), F/V — зубы на губе (G), L — язычок (H)", () => {
    expect(vs("mama")[0]).toBe("A");
    expect(vs("ball")).toBe("ACH");
    expect(vs("puppy")[0]).toBe("A");
    expect(vs("fun")[0]).toBe("G");
    expect(vs("very")[0]).toBe("G");
    expect(vs("lily")[0]).toBe("H");
  });
  it("диграфы: oo — трубочка, ee — зубы, th — язычок, sh — согласная, ou/ow — открыт и в трубочку", () => {
    expect(vs("moon")).toBe("AFB");
    expect(vs("see")).toBe("B");
    expect(vs("the")).toBe("HC");
    expect(vs("think")[0]).toBe("H");
    expect(vs("shoe")[0]).toBe("B");
    expect(vs("cow")).toBe("BDF");
    expect(vs("house")).toBe("DFB");
  });
  it("волшебное e: долгая гласная, немое e не звучит", () => {
    expect(vs("cake")).toBe("BCB"); // C + B + немое e
    expect(vs("like")).toBe("HDB");
    expect(vs("home")).toBe("EFA");
  });
  it("w — трубочка, o на конце — округлый + трубочка", () => {
    expect(vs("we")[0]).toBe("F");
    expect(vs("go")).toBe("BEF");
  });
  it("фразы делятся по пунктуации, пустой текст — без фраз", () => {
    expect(textPhrases("Hi, Mia! Let's play.").length).toBe(3);
    expect(textPhrases("...").length).toBe(0);
    expect(textPhrases("")).toEqual([]);
  });
});

describe("липсинк: дорожка по огибающей", () => {
  const line = { char: "benny", start: 2, dur: 1.4, text: "Hi, Mia! Let's play in the garden!", envelope: env(4, 34, 4) };
  it("длина дорожки — по огибающей/длительности, только известные виземы", () => {
    const tr = visemeTrack(line);
    expect(tr.length).toBe(Math.max(42, Math.round(1.4 * 30)));
    for (const v of tr) expect(VISEMES).toContain(v);
  });
  it("в тишине — покой X, в звуке — рот работает (несколько разных форм)", () => {
    const tr = visemeTrack(line);
    expect(tr.slice(0, 4).every((v) => v === "X")).toBe(true);
    expect(tr.slice(-4).every((v) => v === "X")).toBe(true);
    const voiced = tr.slice(4, 38);
    expect(voiced.filter((v) => v === "X").length).toBe(0);
    expect(new Set(voiced).size).toBeGreaterThanOrEqual(4);
  });
  it("«Mama» начинается с сомкнутых губ, громкий слог «a» — широко открыт", () => {
    const tr = visemeTrack({ dur: 1, text: "Mama", envelope: [0, 0, 0.5, 0.6, 0.95, 0.95, 0.95, 0.5, 0.6, 0.9, 0.9, 0.9, 0, 0] });
    expect(tr[2]).toBe("A");
    expect(tr.slice(3, 7)).toContain("D");
    expect(tr.slice(7, 12)).toContain("A");
  });
  it("пауза в огибающей совпадает с запятой: вторая фраза начинается после паузы", () => {
    const e = [...env(0, 15, 0), ...Array(10).fill(0), ...env(0, 15, 0)];
    const tr = visemeTrack({ dur: e.length / 30, text: "Hello, bunny", envelope: e });
    expect(tr.slice(15, 25).every((v) => v === "X")).toBe(true);
    expect(tr[25]).toBe("A"); // b
  });
  it("короткие провалы (смычки) не закрывают рот в X", () => {
    const e = [0.6, 0.7, 0.05, 0.7, 0.8, 0.7, 0.05, 0.05, 0.7, 0.6];
    const tr = visemeTrack({ dur: e.length / 30, text: "Tick tock", envelope: e });
    expect(tr.filter((v) => v === "X").length).toBe(0);
  });
  it("без огибающей — по длительности, последние 0.15 с рот закрыт", () => {
    const tr = visemeTrack({ dur: 1, text: "Wait for me!" });
    expect(tr.length).toBe(30);
    expect(tr.slice(-4).every((v) => v === "X")).toBe(true);
    expect(tr.slice(2, 20).some((v) => v !== "X")).toBe(true);
  });
  it("тишина или пустой текст — всё X", () => {
    expect(visemeTrack({ dur: 0.5, text: "Hello", envelope: Array(15).fill(0) }).every((v) => v === "X")).toBe(true);
    expect(visemeTrack({ dur: 0.5, text: "", envelope: env(0, 15, 0) }).every((v) => v === "X")).toBe(true);
  });
  it("детерминированно", () => {
    expect(visemeTrack(line)).toEqual(visemeTrack({ ...line }));
  });
});

describe("липсинк: visemeAt / visemeFor", () => {
  const line = { char: "mia", start: 1, dur: 1, text: "Mama, look!", envelope: env(2, 26, 2) };
  it("visemeAt совпадает с дорожкой, вне реплики — X", () => {
    const tr = visemeTrack(line);
    for (let i = 0; i < tr.length; i++) expect(visemeAt(line, i)).toBe(tr[i]);
    expect(visemeAt(line, -1)).toBe("X");
    expect(visemeAt(line, 999)).toBe("X");
    expect(visemeAt(line, 3.7)).toBe(tr[3]);
  });
  it("visemeFor: виземa говорящего, undefined у молчащего и вне реплики", () => {
    expect(visemeFor([line], "mia", 1 + 3 / 30)).toBe(visemeAt(line, 3));
    expect(visemeFor([line], "benny", 1.5)).toBeUndefined();
    expect(visemeFor([line], "mia", 0.5)).toBeUndefined();
    expect(visemeFor([line], "mia", 2.5)).toBeUndefined();
  });
});

describe("липсинк: отрисовка рта", () => {
  const st = (over: Partial<CharState>): CharState => ({ pose: REST, emotion: "neutral", mouth: 0.6, blink: false, look: [0, 0], facing: 1, autoBlink: false, ...over });
  it("каждая визема у каждого героя рисуется (анфас, 3/4, профиль, с эмоциями) и отличается от покоя", () => {
    for (const spec of Object.values(CAST))
      for (const turn of [0, 0.55, 1])
        for (const emotion of ["neutral", "happy", "sad", "surprised"] as const) {
          const rest = renderToStaticMarkup(createElement(Character, { spec, st: st({ emotion, viseme: "X", turn }), t: 1 }));
          for (const v of VISEMES.filter((x): x is Exclude<Viseme, "X"> => x !== "X")) {
            const svg = renderToStaticMarkup(createElement(Character, { spec, st: st({ emotion, viseme: v, turn }), t: 1 }));
            expect(svg, `${spec.id} ${v} ${emotion} ${turn}`).not.toContain("NaN");
            expect(svg, `${spec.id} ${v} ${emotion} ${turn}`).not.toBe(rest);
          }
        }
  });
  it("X у говорящего — рот по эмоции, без открытия от шума в огибающей", () => {
    const spec = CAST.ollie!;
    const silent = renderToStaticMarkup(createElement(Character, { spec, st: st({ viseme: "X", mouth: 0.2 }), t: 1 }));
    const closed = renderToStaticMarkup(createElement(Character, { spec, st: st({ mouth: 0 }), t: 1 }));
    expect(silent).toBe(closed);
  });
  it("зевок/смех действия (pose.mouth) важнее виземы", () => {
    const spec = CAST.benny!;
    const yawn = renderToStaticMarkup(createElement(Character, { spec, st: st({ viseme: "A", pose: { ...REST, mouth: 0.9 } }), t: 1 }));
    const plain = renderToStaticMarkup(createElement(Character, { spec, st: st({ pose: { ...REST, mouth: 0.9 }, mouth: 0 }), t: 1 }));
    expect(yawn).toBe(plain);
  });
});
