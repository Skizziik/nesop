"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, Library, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Video, type VideoStatus } from "@/lib/api";
import { Badge, Button, Card, Empty, Progress, cn } from "./ui";

type Action = "approve" | "to_review" | "reject" | "rerender";
const COLUMNS: { key: string; title: string; statuses: VideoStatus[]; drop?: Action }[] = [
  { key: "ideas", title: "Идеи", statuses: ["idea", "script"] },
  { key: "review", title: "На проверке", statuses: ["needs_review", "verified", "failed"], drop: "to_review" },
  { key: "approved", title: "Одобрено", statuses: ["approved"], drop: "approve" },
  { key: "render", title: "Рендер", statuses: ["rendering"] },
  { key: "ready", title: "Готово", statuses: ["ready"] },
];
const ALL: VideoStatus[] = COLUMNS.flatMap((c) => c.statuses);

export function Ideas() {
  const qc = useQueryClient();
  const [seriesId, setSeriesId] = useState("");
  const [level, setLevel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bankCount, setBankCount] = useState(5);
  const { data: series = [] } = useQuery({ queryKey: ["series"], queryFn: api.series });
  const { data } = useQuery({
    queryKey: ["videos", "kanban", seriesId],
    queryFn: () => api.videos({ status: ALL, series_id: seriesId || undefined, limit: 300 }),
    refetchInterval: 5000,
  });
  const names = Object.fromEntries(series.map((s) => [s.id, s]));
  const items = useMemo(
    () => (data?.items ?? []).filter((v) => !level || names[v.series_id ?? ""]?.level === level),
    [data, level, names],
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ["videos"] });

  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: Action }) => api.bulk(ids, action),
    onSuccess: (r, { action }) => {
      const verb = { approve: "одобрено и отправлено в рендер", to_review: "возвращено на проверку", reject: "удалено", rerender: "отправлено на перерендер" }[action];
      toast.success(`${r.processed} ${verb}`);
      if (r.skipped.length) toast.warning(`${r.skipped.length} пропущено: в рендере или есть ошибки в скрипте`);
      setSelected(new Set());
      void refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Ошибка"),
  });

  const fromBank = useMutation({
    mutationFn: () => api.createBatch({ series_id: seriesId, count: bankCount, auto_approve: false }),
    onSuccess: () => (toast.success(`Беру ${bankCount} уроков из банка — появятся в «На проверке»`), void refresh()),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Ошибка"),
  });

  const toggle = (id: string) => setSelected((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));
  const ids = [...selected];

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Идеи</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm font-semibold">
            <option value="">Все серии</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm font-semibold">
            <option value="">Все уровни</option>
            {["A1", "A2", "B1", "B2", "C1"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          {seriesId ? (
            <div className="flex items-center gap-1 rounded-xl border border-line px-2 py-1">
              <input type="number" min={1} max={50} value={bankCount} onChange={(e) => setBankCount(Number(e.target.value))} className="w-14 bg-transparent px-1 text-sm" />
              <Button variant="ghost" onClick={() => fromBank.mutate()} disabled={fromBank.isPending}>
                <Library size={16} /> Взять из банка
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {ids.length ? (
        <Card className="sticky top-2 z-10 flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm font-bold">Выбрано: {ids.length}</span>
          <Button onClick={() => bulk.mutate({ ids, action: "approve" })}>
            <CheckCheck size={16} /> Одобрить и в рендер
          </Button>
          <Button variant="outline" onClick={() => bulk.mutate({ ids, action: "to_review" })}>
            <Undo2 size={16} /> На проверку
          </Button>
          <Button variant="outline" onClick={() => bulk.mutate({ ids, action: "rerender" })}>
            Перерендер
          </Button>
          <Button variant="danger" onClick={() => confirm(`Удалить ${ids.length}?`) && bulk.mutate({ ids, action: "reject" })}>
            <Trash2 size={16} /> Удалить
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Снять выбор
          </Button>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const colItems = items.filter((v) => col.statuses.includes(v.status));
          return (
            <div
              key={col.key}
              className="flex min-h-64 flex-col rounded-2xl border border-line bg-panel/60 p-2"
              onDragOver={(e) => col.drop && e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (col.drop && id) bulk.mutate({ ids: selected.has(id) ? ids : [id], action: col.drop });
              }}
            >
              <div className="flex items-center justify-between px-2 py-1">
                <span className="font-display font-semibold">{col.title}</span>
                <div className="flex items-center gap-2">
                  {colItems.length ? (
                    <button className="text-xs text-mute hover:text-ink" onClick={() => setSelected(new Set([...selected, ...colItems.map((v) => v.id)]))}>
                      выбрать все
                    </button>
                  ) : null}
                  <Badge>{colItems.length}</Badge>
                </div>
              </div>
              <div className="mt-1 grid gap-2 overflow-auto">
                {colItems.length ? colItems.map((v) => <KanbanCard key={v.id} v={v} seriesName={names[v.series_id ?? ""]?.name ?? ""} selected={selected.has(v.id)} onToggle={() => toggle(v.id)} />) : <Empty>пусто</Empty>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ v, seriesName, selected, onToggle }: { v: Video; seriesName: string; selected: boolean; onToggle: () => void }) {
  const errors = v.issues?.filter((i) => i.severity === "error").length ?? 0;
  const warns = (v.issues?.length ?? 0) - errors;
  return (
    <div
      draggable={v.status !== "rendering"}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", v.id)}
      className={cn("rounded-xl border bg-panel-2 p-2.5 text-sm", selected ? "border-verde-2" : "border-line", v.status === "failed" && "border-rosso/60")}
    >
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 h-4 w-4 accent-[var(--color-verde-2)]" />
        <Link href={`/editor/${v.id}`} className="min-w-0 flex-1">
          <div className="truncate font-bold hover:underline">{v.title}</div>
          <div className="truncate text-xs text-mute">
            {seriesName}
            {v.episode_no ? ` · #${v.episode_no}` : ""}
          </div>
          {v.hook_text ? <div className="mt-1 truncate text-xs text-giallo">{v.hook_text}</div> : null}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {errors ? (
          <Badge tone="red">
            <AlertTriangle size={10} /> {errors}
          </Badge>
        ) : null}
        {warns ? <Badge tone="yellow">{warns}</Badge> : null}
        {v.status === "failed" ? <Badge tone="red">ошибка рендера</Badge> : null}
      </div>
      {v.status === "rendering" ? (
        <div className="mt-2">
          <Progress value={v.progress} />
        </div>
      ) : null}
      {v.status === "failed" && v.error ? <div className="mt-1 line-clamp-2 text-xs text-rosso">{v.error}</div> : null}
    </div>
  );
}
