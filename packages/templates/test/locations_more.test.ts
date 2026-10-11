import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LOCATION_CATALOG, worldAllowed, type Season, type TimeOfDay, type Weather } from "../src/cartoon/catalog";
import { locationDef, locationProps } from "../src/cartoon/locations";
import { IMAGINARY, resolvePalette } from "../src/cartoon/palette";

const NEW = ["bathroom", "classroom", "farm", "park_pond", "snowy_hill", "campsite", "space", "underwater"];
const TIMES: TimeOfDay[] = ["morning", "day", "evening", "night"];
const WEATHERS: Weather[] = ["clear", "cloudy", "rain", "snow", "windy"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

describe("новые локации (этап 5)", () => {
  it("у всех уличных локаций есть токены неба", () => {
    for (const l of LOCATION_CATALOG.filter((x) => x.outdoor))
      for (const k of ["sky1", "sky2", "skySun", "skySunRim", "skySunGlow", "skyCloud", "skyCloudShade"]) expect(resolvePalette(l.id)[k], `${l.id}.${k}`).toBeTruthy();
  });
  it("воображаемые миры не меняются от времени суток, погоды и сезона", () => {
    for (const id of IMAGINARY) expect(resolvePalette(id, { time: "night", weather: "rain", season: "winter" })).toEqual(resolvePalette(id));
  });
  it("источники света (glow*) не темнеют ночью", () => {
    expect(resolvePalette("campsite", { time: "night", weather: "clear", season: "summer" }).glowFire2).toBe(resolvePalette("campsite").glowFire2);
  });
  it("каждое допустимое состояние мира рисуется без NaN/undefined", () => {
    for (const id of NEW) {
      const loc = LOCATION_CATALOG.find((l) => l.id === id)!;
      const def = locationDef(id);
      for (const time of TIMES)
        for (const weather of WEATHERS)
          for (const season of SEASONS) {
            const world = { time, weather, season };
            if (!worldAllowed(loc, world)) continue;
            for (const seed of [0, 7]) {
              const lp = locationProps(id, { x: 960, y: 670, zoom: 1 }, 3.3, { world, seed, uid: `t-${id}` });
              const svg = renderToStaticMarkup(createElement("svg", null, createElement(def.Back, lp), def.Front ? createElement(def.Front, lp) : null));
              expect(svg, `${id} ${time} ${weather} ${season}`).not.toMatch(/NaN|undefined/);
            }
          }
    }
  });
});
