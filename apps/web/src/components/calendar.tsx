"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, type Video } from "@/lib/api";
import { Badge, Button, Card, CardTitle, Empty, cn } from "./ui";

interface CalItem {
  id: string;
  date: string;
  status: string;
  video: Video;
}
interface CalData {
  limit_per_day: number;
  upload_enabled: boolean;
  items: CalItem[];
  unplanned: Video[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAYS = 14;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { "Content-Type": "application/json" } });
  if (!r.ok) {
    const b = (await r.json().catch(() => ({}))) as { detail?: unknown };
    throw new ApiError(typeof b.detail === "string" ? b.detail : `Ошибка ${r.status}`);
  }
  return (await r.json()) as T;
}

export function CalendarPage() {
  const qc = useQueryClient();
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // с понедельника
    return d;
  });
  const startIso = iso(start);
  const { data } = useQuery({ queryKey: ["calendar", startIso], queryFn: () => req<CalData>(`/api/calendar?start=${startIso}&days=${DAYS}`) });
  const refresh = () => (void qc.invalidateQueries({ queryKey: ["calendar"] }), void qc.invalidateQueries({ queryKey: ["videos"] }));
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const plan = useMutation({ mutationFn: (b: { video_id: string; date: string }) => req("/api/calendar", { method: "POST", body: JSON.stringify(b) }), onSuccess: refresh, onError: onErr });
  const unplan = useMutation({ mutationFn: (id: string) => req(`/api/calendar/${id}`, { method: "DELETE" }), onSuccess: refresh, onError: onErr });

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  }), [start]);
  const byDay = useMemo(() => {
    const m: Record<string, CalItem[]> = {};
    for (const it of data?.items ?? []) (m[it.date] ??= []).push(it);
    return m;
  }, [data]);
  const shift = (n: number) => setStart((s) => new Date(s.getTime() + n * 86400_000));
  const limit = data?.limit_per_day ?? 3;

  return (
    <div className="mx-auto grid max-w-[1500px] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Календарь</h1>
        <div className="flex items-center gap-2">
          <Badge tone={data?.upload_enabled ? "green" : "gray"}>{data?.upload_enabled ? "автозагрузка включена" : "автозагрузка: скоро (этап 7) — публикуешь вручную"}</Badge>
          <Badge>лимит {limit} в день</Badge>
          <Button variant="outline" onClick={() => shift(-7)}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" onClick={() => shift(7)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <p className="text-sm text-mute">Перетащи готовый ролик на день. Не больше {limit} в день — частые однотипные публикации YouTube считает массовым контентом.</p>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const k = iso(d);
          const items = byDay[k] ?? [];
          const full = items.length >= limit;
          const today = k === iso(new Date());
          return (
            <div
              key={k}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (id) plan.mutate({ video_id: id, date: k });
              }}
              className={cn("min-h-40 rounded-xl border bg-panel p-2", today ? "border-verde-2" : "border-line", full && "bg-panel-2")}
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={cn("font-bold", today && "text-verde-2")}>{d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className={cn(full ? "text-giallo" : "text-mute")}>
                  {items.length}/{limit}
                </span>
              </div>
              <div className="grid gap-1">
                {items.map((it) => (
                  <div key={it.id} className="group flex items-center gap-1 rounded-lg bg-panel-2 p-1 text-xs">
                    {it.video.cover_url ? <img src={it.video.cover_url} alt="" className="h-10 w-6 rounded object-cover" /> : null}
                    <span className="min-w-0 flex-1 truncate">{it.video.title}</span>
                    <button className="opacity-0 group-hover:opacity-100" onClick={() => unplan.mutate(it.id)} aria-label="Убрать">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Card>
        <CardTitle extra={<Badge>{data?.unplanned.length ?? 0}</Badge>}>Готовые, не запланированы</CardTitle>
        {data?.unplanned.length ? (
          <div className="grid grid-cols-4 gap-2 md:grid-cols-8 xl:grid-cols-12">
            {data.unplanned.map((v) => (
              <div key={v.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", v.id)} className="cursor-grab overflow-hidden rounded-lg border border-line" title={v.title}>
                {v.cover_url ? <img src={v.cover_url} alt={v.title} className="aspect-[9/16] w-full object-cover" /> : <div className="aspect-[9/16] p-1 text-xs">{v.title}</div>}
              </div>
            ))}
          </div>
        ) : (
          <Empty>Нет готовых роликов без даты.</Empty>
        )}
      </Card>
    </div>
  );
}
