"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, RotateCcw, Scissors, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, STATUS_LABEL, type Video, type VideoStatus } from "@/lib/api";
import { Badge, Button, Card, CopyButton, Empty, Progress } from "./ui";

const FILTERS: { key: string; label: string; statuses: VideoStatus[] }[] = [
  { key: "ready", label: "Готовые", statuses: ["ready"] },
  { key: "published", label: "Опубликованные", statuses: ["published"] },
  { key: "work", label: "В работе", statuses: ["approved", "rendering"] },
  { key: "problems", label: "Проблемы", statuses: ["failed", "needs_review"] },
];

const TONE: Partial<Record<VideoStatus, "green" | "red" | "yellow" | "blue" | "gray">> = {
  ready: "green",
  published: "blue",
  failed: "red",
  needs_review: "yellow",
  rendering: "yellow",
};

export function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const [filter, setFilter] = useState("ready");
  const [seriesId, setSeriesId] = useState("");
  const openId = params.get("open");
  const { data: series = [] } = useQuery({ queryKey: ["series"], queryFn: api.series });
  const statuses = FILTERS.find((f) => f.key === filter)?.statuses ?? ["ready"];
  const { data, isLoading } = useQuery({
    queryKey: ["videos", filter, seriesId],
    queryFn: () => api.videos({ status: statuses, series_id: seriesId || undefined, limit: 120 }),
    refetchInterval: filter === "work" ? 3000 : false,
  });
  const items = data?.items ?? [];
  const names = Object.fromEntries(series.map((s) => [s.id, s.name]));
  const open = items.find((v) => v.id === openId) ?? null;
  const { data: openFetched } = useQuery({
    queryKey: ["videos", "one", openId],
    queryFn: async () => (await api.videos({ limit: 200 })).items.find((v) => v.id === openId) ?? null,
    enabled: !!openId && !open,
  });

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Библиотека</h1>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button key={f.key} variant={filter === f.key ? "primary" : "outline"} onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
          <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm font-semibold">
            <option value="">Все серии</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isLoading ? null : items.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((v) => (
            <button key={v.id} onClick={() => router.push(`/library?open=${v.id}`)} className="group text-left">
              <div className="relative overflow-hidden rounded-xl border border-line bg-panel-2">
                {v.cover_url && v.status !== "rendering" ? (
                  <img src={v.cover_url} alt={v.title} className="aspect-[9/16] w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center p-4">
                    <Progress value={v.progress} />
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <Badge tone={TONE[v.status] ?? "gray"}>{STATUS_LABEL[v.status]}</Badge>
                </div>
              </div>
              <div className="mt-2 truncate text-sm font-bold">{v.title}</div>
              <div className="truncate text-xs text-mute">
                {v.series_id ? names[v.series_id] : ""} {v.episode_no ? `· #${v.episode_no}` : ""} {v.duration_s ? `· ${v.duration_s.toFixed(1)} c` : ""}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty>Здесь пока ничего нет.</Empty>
      )}
      {open || openFetched ? <VideoModal v={(open ?? openFetched)!} seriesName={names[(open ?? openFetched)!.series_id ?? ""] ?? ""} onClose={() => router.push("/library")} /> : null}
    </div>
  );
}

function VideoModal({ v, seriesName, onClose }: { v: Video; seriesName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState(v.published_url ?? "");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["videos"] });
  const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Ошибка");
  const publish = useMutation({
    mutationFn: (published: boolean) => api.patchVideo(v.id, { published_manually: published, published_url: url || null }),
    onSuccess: (_, published) => {
      toast.success(published ? "Отмечено как опубликованное" : "Отметка снята");
      void refresh();
    },
    onError: onErr,
  });
  const router = useRouter();
  const toEditor = useMutation({ mutationFn: () => api.videoToProject(v.id), onSuccess: (p) => router.push(`/studio/${p.id}`), onError: onErr });
  const rerender = useMutation({ mutationFn: () => api.rerender(v.id), onSuccess: () => (toast.success("Перерендер поставлен в очередь"), void refresh(), onClose()), onError: onErr });
  const del = useMutation({ mutationFn: () => api.deleteVideo(v.id), onSuccess: () => (toast.success("Удалено"), void refresh(), onClose()), onError: onErr });
  const m = v.meta;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <Card className="grid max-h-[92vh] w-full max-w-5xl gap-6 overflow-auto md:grid-cols-[360px_1fr]" onClick={(e) => e.stopPropagation()}>
        <div>
          {v.video_url ? (
            <video src={v.video_url} poster={v.cover_url ?? undefined} controls autoPlay loop className="aspect-[9/16] w-full rounded-xl bg-black" />
          ) : v.cover_url ? (
            <img src={v.cover_url} alt="" className="aspect-[9/16] w-full rounded-xl" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-mute">
                {seriesName} {v.episode_no ? `· эпизод ${v.episode_no}` : ""} · палитра {v.palette}
              </div>
              <h2 className="font-display text-2xl font-semibold">{v.title}</h2>
              <div className="mt-1 text-sm text-giallo">Хук: {v.hook_text || "—"}</div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-mute hover:bg-panel-2" aria-label="Закрыть">
              <X />
            </button>
          </div>
          {v.error ? <div className="rounded-xl border border-rosso/40 bg-rosso/10 p-3 text-sm text-rosso">{v.error}</div> : null}
          {v.issues?.length ? (
            <div className="rounded-xl border border-giallo/40 bg-giallo/10 p-3 text-sm">
              {v.issues.map((i, k) => (
                <div key={k}>
                  <b>{i.field}</b>: {i.message}
                </div>
              ))}
            </div>
          ) : null}
          {m?.title ? (
            <div className="grid gap-3 text-sm">
              {Object.entries(m.title_variants ?? { A: m.title }).map(([k, t]) => (
                <Field key={k} label={`Название ${k}`} value={t} />
              ))}
              <Field label="Описание" value={m.description ?? ""} multiline />
              <Field label="Хештеги" value={(m.hashtags ?? []).join(" ")} />
              <Field label="Теги" value={(m.tags ?? []).join(", ")} />
              <Field label="Закреплённый коммент" value={m.pinned_comment ?? ""} />
            </div>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {v.video_url ? (
              <a href={v.video_url} download={`${v.title}.mp4`}>
                <Button>
                  <Download size={16} /> Скачать mp4
                </Button>
              </a>
            ) : null}
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка на YouTube (необязательно)" className="min-w-56 flex-1 rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm" />
            {v.published_manually ? (
              <Button variant="outline" onClick={() => publish.mutate(false)}>
                Снять «опубликовано»
              </Button>
            ) : (
              <Button variant="outline" onClick={() => publish.mutate(true)} disabled={v.status !== "ready"}>
                Опубликовано вручную
              </Button>
            )}
            {v.published_url ? (
              <a href={v.published_url} target="_blank" rel="noreferrer" className="text-verde-2">
                <ExternalLink size={18} />
              </a>
            ) : null}
            <Button variant="outline" onClick={() => toEditor.mutate()} disabled={toEditor.isPending} title="Открыть в видеоредакторе: добавить текст, маскотов, субтитры, музыку">
              <Scissors size={16} /> В редактор
            </Button>
            <Button variant="ghost" onClick={() => rerender.mutate()} title="Перерендерить с тем же сидом">
              <RotateCcw size={16} />
            </Button>
            <Button variant="ghost" onClick={() => confirm("Удалить ролик?") && del.mutate()} title="Удалить">
              <Trash2 size={16} className="text-rosso" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-xl bg-panel-2 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-mute">{label}</span>
        <CopyButton text={value} label="копировать" />
      </div>
      <div className={multiline ? "whitespace-pre-wrap" : "truncate"}>{value}</div>
    </div>
  );
}
