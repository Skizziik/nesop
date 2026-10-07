"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Rocket } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, STAGE_LABEL, STATUS_LABEL, type Batch, type Series } from "@/lib/api";
import { Badge, Button, Card, CardTitle, Empty, Progress, cn } from "./ui";

const SERVICE_LABEL: Record<string, string> = {
  api: "API",
  postgres: "База",
  redis: "Очередь",
  worker: "Воркер",
  tts: "Озвучка",
  renderer: "Рендер",
};

export function ServiceStatus() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 10_000 });
  const ttsDetail = data?.services.tts?.detail as { ready?: boolean; installing?: { progress: number }[] } | undefined;
  return (
    <Card>
      <CardTitle extra={data ? <Badge tone={data.ok ? "green" : "yellow"}>{data.ok ? "всё работает" : "есть проблемы"}</Badge> : null}>Сервисы</CardTitle>
      {isError ? (
        <p className="text-sm text-rosso">API недоступен. Запусти `docker compose up`.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.keys(SERVICE_LABEL).map((k) => {
            const s = data?.services[k];
            const ok = s?.ok;
            return (
              <div key={k} className="flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-2 text-sm">
                <span className={cn("h-2.5 w-2.5 rounded-full", ok === undefined ? "bg-mute" : ok ? "bg-verde-2" : "bg-rosso")} />
                <span className="font-semibold">{SERVICE_LABEL[k]}</span>
              </div>
            );
          })}
        </div>
      )}
      {ttsDetail?.installing?.length ? (
        <div className="mt-3 text-xs text-mute">
          Скачивается голос по умолчанию… {Math.round((ttsDetail.installing[0]?.progress ?? 0) * 100)}%
        </div>
      ) : null}
    </Card>
  );
}

export function GenerateCard() {
  const qc = useQueryClient();
  const { data: series = [] } = useQuery({ queryKey: ["series"], queryFn: api.series });
  const usable = useMemo(() => series.filter((s) => s.implemented), [series]);
  const [seriesId, setSeriesId] = useState<string>("mix");
  const [count, setCount] = useState(3);
  const [autoApprove, setAutoApprove] = useState(true);
  const chosen: Series | undefined = usable.find((s) => s.id === seriesId);

  const m = useMutation({
    mutationFn: () => api.createBatch({ series_id: seriesId === "mix" ? null : seriesId, count, auto_approve: autoApprove }),
    onSuccess: () => {
      toast.success(`Пачка из ${count} ${count === 1 ? "ролика" : "роликов"} поставлена в очередь`);
      void qc.invalidateQueries({ queryKey: ["batches"] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Не удалось запустить генерацию"),
  });

  return (
    <Card className="relative overflow-hidden">
      <div className="tricolore absolute inset-x-0 top-0 h-1" />
      <CardTitle>Сгенерировать пачку</CardTitle>
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-mute">Серия</span>
          <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="rounded-xl border border-line bg-panel-2 px-3 py-2.5 font-semibold">
            <option value="mix">🎲 Микс серий</option>
            {usable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.level} · {s.counts.lessons} в банке
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-mute">Количество: {count}</span>
          <input type="range" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-3 accent-[var(--color-verde-2)]" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="h-4 w-4 accent-[var(--color-verde-2)]" />
          Авто-аппрув (всё, что прошло проверки, сразу в рендер)
        </label>
        <Button className="px-8 py-3 text-base" disabled={m.isPending || !usable.length} onClick={() => m.mutate()}>
          {m.isPending ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />} Сгенерировать {count}
        </Button>
      </div>
      {chosen ? <p className="mt-3 text-xs text-mute">{chosen.description}</p> : null}
    </Card>
  );
}

function BatchRow({ b, seriesName }: { b: Batch; seriesName: string }) {
  const active = b.status === "queued" || b.status === "running";
  const { data } = useQuery({ queryKey: ["batches", b.id], queryFn: () => api.batch(b.id), refetchInterval: active ? 3000 : false });
  const vids = data?.videos ?? [];
  const ready = b.counts.ready ?? 0;
  const failed = b.counts.failed ?? 0;
  const review = b.counts.needs_review ?? 0;
  return (
    <div className="rounded-xl bg-panel-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="font-semibold">
          {seriesName} · {b.requested} шт.
          <span className="ml-2 text-xs text-mute">{new Date(b.created_at).toLocaleString("ru-RU")}</span>
        </div>
        <div className="flex items-center gap-2">
          {b.similarity_index !== null ? (
            <Badge tone={b.similarity_index < 0.2 ? "green" : b.similarity_index < 0.4 ? "yellow" : "red"}>похожесть {Math.round(b.similarity_index * 100)}%</Badge>
          ) : null}
          <Badge tone="green">готово {ready}</Badge>
          {failed ? <Badge tone="red">ошибок {failed}</Badge> : null}
          {review ? <Badge tone="yellow">на проверке {review}</Badge> : null}
          {ready ? (
            <a href={`/api/batches/${b.id}/zip`} className="text-xs font-bold text-verde-2 hover:underline">
              zip
            </a>
          ) : null}
        </div>
      </div>
      {active || vids.some((v) => v.status === "rendering" || v.status === "approved") ? (
        <div className="grid gap-1.5">
          {vids.map((v) => (
            <div key={v.id} className="grid grid-cols-[1fr_120px_160px] items-center gap-3 text-xs">
              <span className="truncate">{v.title}</span>
              <span className="text-mute">{v.status === "rendering" ? STAGE_LABEL[v.stage] ?? v.stage : STATUS_LABEL[v.status]}</span>
              <Progress value={v.status === "ready" ? 1 : v.progress} />
            </div>
          ))}
          {!vids.length ? <span className="text-xs text-mute">Планирую…</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Queue() {
  const { data: batches = [] } = useQuery({ queryKey: ["batches"], queryFn: () => api.batches(8), refetchInterval: 5000 });
  const { data: series = [] } = useQuery({ queryKey: ["series"], queryFn: api.series });
  const names = Object.fromEntries(series.map((s) => [s.id, s.name]));
  return (
    <Card>
      <CardTitle>Очередь</CardTitle>
      <div className="grid gap-2">
        {batches.length ? batches.map((b) => <BatchRow key={b.id} b={b} seriesName={b.series_id ? names[b.series_id] ?? "Серия" : "Микс серий"} />) : <Empty>Пока пусто. Нажми «Сгенерировать».</Empty>}
      </div>
    </Card>
  );
}

export function Spend() {
  const { data } = useQuery({ queryKey: ["stats"], queryFn: api.stats, refetchInterval: 30_000 });
  const v = data?.videos ?? {};
  return (
    <Card>
      <CardTitle>Статистика</CardTitle>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Готово роликов" value={v.ready ?? 0} />
        <Stat label="Опубликовано" value={v.published ?? 0} />
        <Stat label="Уроков в банке" value={data?.lessons ?? 0} />
        <Stat label="Ошибок" value={v.failed ?? 0} />
        <Stat label="LLM за сутки" value={`$${(data?.llm.day.usd ?? 0).toFixed(2)}`} />
        <Stat label="LLM за месяц" value={`$${(data?.llm.month.usd ?? 0).toFixed(2)}`} />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-panel-2 px-3 py-2">
      <div className="text-xs text-mute">{label}</div>
      <div className="font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

export function RecentReady() {
  const { data } = useQuery({ queryKey: ["videos", "recent"], queryFn: () => api.videos({ status: ["ready"], limit: 8 }) });
  const items = data?.items ?? [];
  return (
    <Card>
      <CardTitle
        extra={
          <Link href="/library" className="text-sm font-bold text-verde-2 hover:underline">
            вся библиотека →
          </Link>
        }
      >
        Последние готовые
      </CardTitle>
      {items.length ? (
        <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
          {items.map((v) => (
            <Link key={v.id} href={`/library?open=${v.id}`} className="group overflow-hidden rounded-xl border border-line">
              {v.cover_url ? <img src={v.cover_url} alt={v.title} className="aspect-[9/16] w-full object-cover transition-transform group-hover:scale-105" /> : null}
            </Link>
          ))}
        </div>
      ) : (
        <Empty>Готовых роликов пока нет.</Empty>
      )}
    </Card>
  );
}
