"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api, type CatalogEntry, type CatalogKind } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { Badge, Card, Empty, cn } from "./ui";

const TABS: { kind: CatalogKind; label: string }[] = [
  { kind: "locations", label: "Локации" },
  { kind: "props", label: "Предметы" },
  { kind: "outfits", label: "Костюмы" },
  { kind: "fx", label: "Эффекты" },
  { kind: "actions", label: "Действия" },
  { kind: "characters", label: "Герои" },
];

const NONE: CatalogEntry = { id: "none", label: "Без костюма", llm: "everyday clothes" };

/** Теги записи для фильтра: теги локаций, группа и «на земле» у предметов, слот у костюмов. */
function tagsOf(kind: CatalogKind, e: CatalogEntry): string[] {
  const t = [...(e.tags ?? [])];
  if (kind === "locations") t.push(e.outdoor ? "улица" : "дом");
  if (e.group) t.push(e.group);
  if (e.ground) t.push("на земле");
  if (e.slot) t.push(e.slot);
  if (e.adult_only) t.push("только взрослым");
  return t;
}

/** Страница «Каталог»: все ассеты мультиков с превью (лист ассетов), фильтр по типу и тегам, сколько раз встречались в эпизодах. */
export function CartoonCatalogPage() {
  const { data, isLoading } = useQuery({ queryKey: ["cartoon-catalog"], queryFn: api.cartoonCatalog });
  const [kind, setKind] = useState<CatalogKind>("locations");
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const entries = useMemo(() => {
    const list = data?.catalog[kind] ?? [];
    return kind === "outfits" ? [NONE, ...list] : list;
  }, [data, kind]);
  const allTags = useMemo(() => [...new Set(entries.flatMap((e) => tagsOf(kind, e)))].sort(), [entries, kind]);
  const needle = q.trim().toLowerCase();
  const shown = entries.filter((e) => (!tag || tagsOf(kind, e).includes(tag)) && (!needle || `${e.id} ${e.label} ${e.llm} ${e.name ?? ""}`.toLowerCase().includes(needle)));
  const count = (k: CatalogKind) => (data?.catalog[k]?.length ?? 0) + (k === "outfits" ? 1 : 0);

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/cartoons" className="mb-1 inline-flex items-center gap-1 text-xs text-mute hover:text-ink">
            <ArrowLeft size={14} /> Мультики
          </Link>
          <h1 className="font-display text-3xl font-bold">Каталог ассетов</h1>
          <p className="text-sm text-mute">
            Всё, из чего режиссёр собирает сцены. Превью рисует тот же движок, что и эпизоды
            {data ? ` · эпизодов в статистике: ${data.episodes_total}` : ""}.
          </p>
        </div>
        <label className="relative w-full max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input className={cn(inputCls(), "pl-9")} placeholder="поиск: ball, зонтик…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.kind}
            onClick={() => (setKind(t.kind), setTag(null))}
            className={cn("rounded-full px-3 py-1 text-sm font-bold", kind === t.kind ? "bg-verde-2 text-white" : "bg-panel-2 text-mute hover:text-ink")}
          >
            {t.label}
            {data ? <span className="ml-1 opacity-70">{count(t.kind)}</span> : null}
          </button>
        ))}
      </div>
      {allTags.length ? (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setTag(null)} className={cn("rounded-full px-2 py-0.5 text-[11px]", !tag ? "bg-ink text-white" : "bg-panel-2 text-mute hover:text-ink")}>
            все
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)} className={cn("rounded-full px-2 py-0.5 text-[11px]", tag === t ? "bg-ink text-white" : "bg-panel-2 text-mute hover:text-ink")}>
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <Empty>Загружаю каталог…</Empty>
      ) : !shown.length ? (
        <Empty>Ничего не нашлось</Empty>
      ) : (
        <div className={cn("grid gap-3", kind === "locations" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
          {shown.map((e) => {
            const times = data?.usage[kind]?.[e.id] ?? 0;
            const eps = data?.episodes[kind]?.[e.id] ?? 0;
            return (
              <Card key={e.id} className="grid gap-2 p-3">
                <div className={cn("overflow-hidden rounded-xl bg-panel-2", kind === "locations" ? "aspect-video" : "aspect-[4/3]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/cartoon/catalog/preview/${kind}/${e.id}.png?v=${data?.version ?? ""}`}
                    alt={e.label}
                    loading="lazy"
                    className={cn("h-full w-full", kind === "locations" ? "object-cover" : "object-contain")}
                  />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{e.name ?? e.label}</div>
                    <div className="truncate font-mono text-[11px] text-mute">{e.id}</div>
                  </div>
                  <Badge tone={eps ? "green" : "gray"}>{eps ? `${eps} эп.` : "не было"}</Badge>
                </div>
                <div className="line-clamp-2 text-xs text-mute" title={e.llm}>
                  {e.llm}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {tagsOf(kind, e).map((t) => (
                    <span key={t} className="rounded-full bg-panel-2 px-1.5 py-0.5 text-[10px] text-mute">
                      {t}
                    </span>
                  ))}
                  {e.colors?.length ? <span className="text-[10px] text-mute">цвета: {e.colors.join(", ")}</span> : null}
                  {times ? <span className="ml-auto text-[10px] text-mute">{times} раз</span> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
