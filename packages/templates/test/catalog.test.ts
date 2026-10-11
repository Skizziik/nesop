import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_CATALOG, CHARACTERS, exportCatalog, FX_CATALOG, LOCATION_CATALOG, OUTFIT_CATALOG, PROP_CATALOG } from "../src/cartoon/catalog";
import { ACTION_IDS } from "../src/cartoon/actions";
import { CAST } from "../src/cartoon/cast";
import { LOCATIONS } from "../src/cartoon/locations";
import { PROP_IDS, PROP_STATES } from "../src/cartoon/props";
import { FX_IDS, WEAR_IDS } from "../src/cartoon/rig";

describe("каталог мультиков", () => {
  it("у каждой записи есть отрисовка", () => {
    for (const c of CHARACTERS) expect(CAST[c.id], c.id).toBeDefined();
    for (const l of LOCATION_CATALOG) expect(LOCATIONS[l.id], l.id).toBeDefined();
    for (const p of PROP_CATALOG) expect(PROP_IDS, p.id).toContain(p.id);
    for (const o of OUTFIT_CATALOG) expect(WEAR_IDS, o.id).toContain(o.id);
    for (const f of FX_CATALOG) expect(FX_IDS, f.id).toContain(f.id);
    for (const a of ACTION_CATALOG) expect(ACTION_IDS, a.id).toContain(a.id);
  });
  it("каждая отрисовка есть в каталоге (иначе LLM о ней не узнает)", () => {
    expect(PROP_IDS.filter((id) => !PROP_CATALOG.some((p) => p.id === id))).toEqual([]);
    expect(Object.keys(LOCATIONS).filter((id) => !LOCATION_CATALOG.some((l) => l.id === id))).toEqual([]);
  });
  it("состояния предметов в каталоге совпадают с отрисовкой", () => {
    for (const p of PROP_CATALOG) expect([...(p.states ?? [])].sort(), p.id).toEqual([...(PROP_STATES[p.id] ?? [])].sort());
  });
  it("id уникальны", () => {
    for (const list of [CHARACTERS, LOCATION_CATALOG, PROP_CATALOG, OUTFIT_CATALOG, FX_CATALOG, ACTION_CATALOG]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("JSON для Python актуален (pnpm --filter @ipt/templates catalog:export)", () => {
    const file = join(import.meta.dirname, "..", "..", "..", "services", "api", "app", "pipeline", "cartoon_catalog.json");
    expect(readFileSync(file, "utf-8")).toBe(JSON.stringify(exportCatalog(), null, 2) + "\n");
  });
});
