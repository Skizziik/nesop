import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../src/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("переводит ошибку сервера в понятный русский текст", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Серия не найдена" }), { status: 404 })));
    await expect(api.series()).rejects.toThrow("Серия не найдена");
  });
  it("сетевой сбой → подсказка про docker compose", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fail"))));
    await expect(api.health()).rejects.toBeInstanceOf(ApiError);
    await expect(api.health()).rejects.toThrow(/docker compose/);
  });
  it("собирает query для фильтров библиотеки", async () => {
    const f = vi.fn(async (_url: string) => new Response(JSON.stringify({ total: 0, items: [] })));
    vi.stubGlobal("fetch", f);
    await api.videos({ status: ["ready", "published"], series_id: "s1", limit: 5 });
    expect(f.mock.calls[0]![0]).toBe("/api/videos?status=ready&status=published&series_id=s1&limit=5&offset=0");
  });
});
