"use client";

import { CartoonEpisode } from "@ipt/templates";
import { Player } from "@remotion/player";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Film, Layers, LayoutGrid, Loader2, Rabbit, Smartphone, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Project } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { YoutubePanel } from "./studio/Studio";
import { Badge, Button, Card, CardTitle, Empty, Progress, cn } from "./ui";

const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Что-то пошло не так");

const THEMES = [
  "Sharing toys with friends",
  "Colours of the rainbow",
  "Brushing teeth is fun",
  "Bedtime routine",
  "Counting to five",
  "Being brave at the doctor",
  "Happy, sad and angry feelings",
  "Animals on the farm",
  "Sunny, rainy and snowy days",
  "Saying please and thank you",
  "Bath time bubbles",
  "First day at kindergarten",
  "A day on the farm",
  "Camping under the stars",
  "Pretend rocket trip to the moon",
  "Under the sea adventure",
  "Snow day sledding",
  "Feeding the ducks at the pond",
];
const STATUS: Record<Project["status"], { label: string; tone: "green" | "red" | "yellow" | "gray" | "blue" }> = {
  generating: { label: "создаётся", tone: "blue" },
  draft: { label: "готов к просмотру", tone: "gray" },
  rendering: { label: "рендер", tone: "yellow" },
  ready: { label: "mp4 готов", tone: "green" },
  failed: { label: "ошибка", tone: "red" },
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function Cartoons() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data = [], isLoading } = useQuery({
    queryKey: ["cartoons"],
    queryFn: () => api.projects("cartoon"),
    refetchInterval: (q) => (q.state.data?.some((p) => p.status === "generating" || p.status === "rendering") ? 3000 : false),
  });
  const [f, setF] = useState({ theme: "", minutes: 22, stories: 3, auto_render: false });
  const create = useMutation({
    mutationFn: () => api.createCartoon(f),
    onSuccess: (p) => (toast.success("Мультик создаётся — сценарий, голоса и сцены займут 30-60 минут"), void qc.invalidateQueries({ queryKey: ["cartoons"] }), router.push(`/cartoons/${p.id}`)),
    onError: onErr,
  });
  const del = useMutation({ mutationFn: api.deleteProject, onSuccess: () => void qc.invalidateQueries({ queryKey: ["cartoons"] }), onError: onErr });
  const [pick, setPick] = useState<string[]>([]);
  const togglePick = (id: string) => setPick((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const compile = useMutation({
    mutationFn: () => api.createCompilation({ ids: pick, auto_render: true }),
    onSuccess: (p) => (toast.success("Сборник собирается: обложки, описание, потом рендер"), setPick([]), void qc.invalidateQueries({ queryKey: ["cartoons"] }), router.push(`/cartoons/${p.id}`)),
    onError: onErr,
  });

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6">
      <div className="relative">
        <Link href="/cartoons/catalog" className="absolute right-0 top-1 inline-flex items-center gap-1 rounded-full bg-panel-2 px-3 py-1 text-sm font-bold text-mute hover:text-ink">
          <LayoutGrid size={15} /> Каталог ассетов
        </Link>
        <h1 className="font-display text-3xl font-bold">Мультики</h1>
        <p className="text-sm text-mute">Мультфильмы для детей 2–5 лет на английском: 3–4 истории с Бенни, Мией, Олли и Дот, песенки, вопросы зрителю, слова урока.</p>
      </div>
      <Card>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Rabbit size={20} className="text-verde-2" /> Новый эпизод
          </span>
        </CardTitle>
        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-bold text-mute">Тема эпизода (чему учим)</span>
            <input className={inputCls()} placeholder="например: Sharing toys with friends" value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })} />
            <div className="flex flex-wrap gap-1">
              {THEMES.map((t) => (
                <button key={t} onClick={() => setF({ ...f, theme: t })} className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-mute hover:text-ink">
                  {t}
                </button>
              ))}
            </div>
          </label>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs font-bold text-mute">Длина: {f.minutes} мин</span>
              <input type="range" min={4} max={25} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} className="mt-2 accent-[var(--color-verde-2)]" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-bold text-mute">Историй в эпизоде</span>
              <select className={inputCls()} value={f.stories} onChange={(e) => setF({ ...f, stories: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs">
              <input type="checkbox" checked={f.auto_render} onChange={(e) => setF({ ...f, auto_render: e.target.checked })} className="accent-[var(--color-verde-2)]" />
              Сразу отрендерить mp4
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button className="shrink-0 whitespace-nowrap" onClick={() => create.mutate()} disabled={f.theme.trim().length < 3 || create.isPending}>
              {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Сделать мультик
            </Button>
            <span className="text-xs text-mute">план → сценарии историй → проверка редактором детского ТВ → голоса героев → сцены, камера, песенки → обложки и описание</span>
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle
          extra={
            pick.length >= 2 ? (
              <Button onClick={() => compile.mutate()} disabled={compile.isPending}>
                <Layers size={15} /> Собрать сборник из {pick.length}
              </Button>
            ) : (
              <span className="text-xs text-mute">отметь 2+ готовых эпизода — получится сборник на 30-60 минут</span>
            )
          }
        >
          Эпизоды
        </CardTitle>
        {isLoading ? (
          <div className="text-sm text-mute">Загрузка…</div>
        ) : !data.length ? (
          <Empty>Пока нет мультиков — выбери тему и нажми «Сделать мультик».</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-panel-2">
                <Link href={`/cartoons/${p.id}`} className="block">
                  <div className="relative flex aspect-video items-center justify-center bg-black/40">
                    <CartoonCover id={p.id} status={p.status} />
                    <span className="absolute top-2 left-2">
                      <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                    </span>
                    {p.duration_s ? <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 text-xs font-bold">{fmt(p.duration_s)}</span> : null}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 font-bold">{p.title}</div>
                    {p.status === "generating" || p.status === "rendering" ? (
                      <div className="mt-2">
                        <Progress value={p.progress} />
                        <div className="mt-1 truncate text-[11px] text-mute">{p.stage}</div>
                      </div>
                    ) : p.status === "failed" ? (
                      <div className="mt-1 line-clamp-2 text-[11px] text-rosso">{p.error}</div>
                    ) : null}
                  </div>
                </Link>
                <div className="flex items-center gap-1 border-t border-line px-2 py-1">
                  {p.status === "draft" || p.status === "ready" ? (
                    <label className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-mute hover:bg-panel" title="В сборник">
                      <input type="checkbox" checked={pick.includes(p.id)} onChange={() => togglePick(p.id)} />
                      {pick.includes(p.id) ? `№${pick.indexOf(p.id) + 1}` : "в сборник"}
                    </label>
                  ) : null}
                  {p.video_url ? (
                    <a href={p.video_url} download className="rounded px-2 py-1 text-xs font-bold text-verde-2 hover:bg-panel">
                      скачать mp4
                    </a>
                  ) : null}
                  <button onClick={() => confirm(`Удалить «${p.title}»?`) && del.mutate(p.id)} className="ml-auto rounded p-1.5 text-mute hover:bg-panel hover:text-rosso" title="Удалить">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CartoonCover({ id, status }: { id: string; status: Project["status"] }) {
  const { data } = useQuery({ queryKey: ["project", id], queryFn: () => api.project(id), enabled: status !== "generating", staleTime: 30_000 });
  const cover = data?.meta?.youtube?.thumbnails?.[0];
  if (status === "generating") return <Loader2 className="animate-spin text-verde-2" />;
  // eslint-disable-next-line @next/next/no-img-element
  return cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Film className="text-mute" />;
}

/** Страница эпизода: плеер, рендер, YouTube-пакет, сценарий. */
export function CartoonView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: p } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.project(id),
    refetchInterval: (q) => (q.state.data && ["generating", "rendering"].includes(q.state.data.status) ? 3000 : false),
  });
  const [tab, setTab] = useState<"youtube" | "script">("youtube");
  const render = useMutation({ mutationFn: () => api.renderProject(id), onSuccess: () => (toast.success("Рендер запущен"), void qc.invalidateQueries({ queryKey: ["project", id] })), onError: onErr });
  if (!p) return <div className="p-8 text-mute">Загрузка…</div>;
  const doc = p.doc as unknown as { duration?: number; scenes?: unknown[] };
  const ready = !!doc?.scenes?.length;
  const meta = p.meta as { plan?: { stories?: { title?: string; lesson?: string; key_words?: string[] }[] }; scripts?: { scenes?: { location?: string; beats?: { speaker?: string; text?: string }[] }[] }[] };
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex items-center gap-3">
        <Link href="/cartoons" className="rounded-lg p-1.5 text-mute hover:bg-panel-2 hover:text-ink">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold">{p.title}</h1>
        {p.video_url ? (
          <a href={p.video_url} download className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-sm font-bold hover:bg-panel-2">
            <Download size={15} /> mp4{p.video_stale ? " (до правок)" : ""}
          </a>
        ) : null}
        <Button onClick={() => render.mutate()} disabled={!ready || p.status === "rendering" || render.isPending}>
          {p.status === "rendering" ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {p.status === "rendering" ? `Рендер ${Math.round(p.progress * 100)}%` : "Рендер mp4"}
        </Button>
      </div>
      {p.status === "generating" ? (
        <Card>
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-verde-2" />
            <div className="flex-1">
              <div className="font-bold">Мультик создаётся: {p.stage || "в очереди"}</div>
              <div className="mt-2">
                <Progress value={p.progress} />
              </div>
              <div className="mt-1 text-xs text-mute">Сценарии, голоса героев и сцены — обычно 30–60 минут. Можно закрыть страницу.</div>
            </div>
          </div>
        </Card>
      ) : p.status === "failed" ? (
        <Card className="border-rosso/50 text-sm text-rosso">Ошибка: {p.error}</Card>
      ) : null}
      {ready ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-2xl border border-line bg-black">
            <Player
              component={CartoonEpisode as unknown as React.FC<Record<string, unknown>>}
              inputProps={p.doc as unknown as Record<string, unknown>}
              durationInFrames={Math.max(1, Math.round((doc.duration ?? 10) * 30))}
              fps={30}
              compositionWidth={1920}
              compositionHeight={1080}
              style={{ width: "100%", aspectRatio: "16 / 9" }}
              controls
              acknowledgeRemotionLicense
            />
            {p.video_url && !p.video_stale ? <ContactSheet src={p.video_url.replace(/video\.mp4$/, "contact.png")} /> : null}
          </div>
          <div className="min-h-0 rounded-2xl border border-line bg-panel">
            <div className="grid grid-cols-2 border-b border-line text-xs font-bold">
              {(["youtube", "script"] as const).map((k) => (
                <button key={k} onClick={() => setTab(k)} className={cn("py-2", tab === k ? "bg-panel-2 text-ink" : "text-mute")}>
                  {k === "youtube" ? "YouTube" : "Сценарий"}
                </button>
              ))}
            </div>
            <div className="h-[70vh]">
              {tab === "youtube" ? (
                <YoutubePanel project={p} onClose={() => setTab("script")} />
              ) : (
                <div className="h-full overflow-auto p-3 text-xs">
                  {(meta.plan?.stories ?? []).map((s, i) => (
                    <div key={i} className="mb-4">
                      <div className="font-display text-sm font-semibold">
                        {i + 1}. {s.title}
                      </div>
                      <div className="text-mute">Урок: {s.lesson} · слова: {(s.key_words ?? []).join(", ")}</div>
                      {(meta.scripts?.[i]?.scenes ?? []).map((sc, j) => (
                        <div key={j} className="mt-2">
                          <div className="text-[10px] font-bold uppercase text-mute">{sc.location}</div>
                          {(sc.beats ?? []).map((b, k) => (
                            <div key={k}>
                              <b>{b.speaker}:</b> {b.text}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {ready ? <ShortsCard id={id} /> : null}
    </div>
  );
}

interface ShortItem {
  n: number;
  kind: "song" | "funny" | "question";
  from: number;
  to: number;
  title: string;
  status: "queued" | "rendering" | "ready" | "failed";
  progress?: number;
  error?: string | null;
  video_url?: string;
  cover_url?: string;
  youtube?: { title?: string; description?: string };
}
interface ShortsMeta {
  status: "queued" | "rendering" | "ready" | "failed";
  revision?: number;
  items: ShortItem[];
}
const SHORT_KIND: Record<ShortItem["kind"], string> = { song: "Припев песни", funny: "Смешной момент", question: "Вопрос зрителю" };
const SHORT_STATUS: Record<ShortItem["status"], { label: string; tone: "green" | "red" | "yellow" | "gray" }> = {
  queued: { label: "в очереди", tone: "gray" },
  rendering: { label: "рендер", tone: "yellow" },
  ready: { label: "готов", tone: "green" },
  failed: { label: "ошибка", tone: "red" },
};

/** Шортсы эпизода: 2-3 вертикальных ролика 20-45 с, перерисованных из сцен (не кроп): превью, статус, скачивание. */
function ShortsCard({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: p } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.project(id),
    refetchInterval: (q) => {
      const st = (q.state.data?.meta?.shorts as ShortsMeta | undefined)?.status;
      return st === "queued" || st === "rendering" ? 3000 : false;
    },
  });
  const make = useMutation({
    mutationFn: () => api.makeShorts(id),
    onSuccess: () => (toast.success("Шортсы рендерятся — по паре минут на каждый"), void qc.invalidateQueries({ queryKey: ["project", id] })),
    onError: onErr,
  });
  const sh = p?.meta?.shorts as ShortsMeta | undefined;
  const busy = sh?.status === "queued" || sh?.status === "rendering";
  const stale = !!sh && sh.revision !== undefined && p !== undefined && sh.revision !== p.revision;
  return (
    <Card>
      <CardTitle
        extra={
          <Button onClick={() => make.mutate()} disabled={busy || make.isPending}>
            {busy || make.isPending ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />} {sh?.items?.length ? "Переделать шортсы" : "Сделать 3 шортса"}
          </Button>
        }
      >
        <span className="flex items-center gap-2">
          <Smartphone size={18} className="text-verde-2" /> Шортсы 9:16
        </span>
      </CardTitle>
      {!sh?.items?.length ? (
        <div className="text-xs text-mute">
          Припев песни (караоке), самый смешной или милый момент и вопрос зрителю — по 20–45 секунд, герои крупно, камера следит за тем, кто говорит. Для детей: без призывов подписаться.
        </div>
      ) : (
        <>
          {stale ? <div className="mb-2 text-xs text-mute">Эпизод правили после нарезки — шортсы можно переделать.</div> : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sh.items.map((it) => (
              <div key={it.n} className="overflow-hidden rounded-2xl border border-line bg-panel-2">
                <div className="relative mx-auto flex aspect-[9/16] max-h-[420px] items-center justify-center bg-black/50">
                  {it.status === "ready" && it.video_url ? (
                    <video src={it.video_url} poster={it.cover_url} controls preload="metadata" className="h-full w-full object-contain" />
                  ) : it.status === "failed" ? (
                    <div className="p-3 text-center text-[11px] text-rosso">{it.error || "Рендер не удался"}</div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-xs text-mute">
                      <Loader2 className={cn("text-verde-2", it.status === "rendering" && "animate-spin")} />
                      {it.status === "rendering" ? `${Math.round((it.progress ?? 0) * 100)}%` : "ждёт очереди"}
                    </div>
                  )}
                  <span className="absolute top-2 left-2">
                    <Badge tone={SHORT_STATUS[it.status].tone}>{SHORT_STATUS[it.status].label}</Badge>
                  </span>
                </div>
                <div className="grid gap-1 p-3 text-xs">
                  <div className="font-bold text-ink">
                    {it.n}. {SHORT_KIND[it.kind] ?? it.kind} · {fmt(it.from)}–{fmt(it.to)} ({Math.round(it.to - it.from)} с)
                  </div>
                  <div className="text-mute">Хук: «{it.title}»</div>
                  {it.youtube?.title ? <div className="truncate text-mute" title={it.youtube.title}>YouTube: {it.youtube.title}</div> : null}
                  {it.status === "rendering" ? <Progress value={it.progress ?? 0} /> : null}
                  {it.status === "ready" && it.video_url ? (
                    <a href={it.video_url} download={`short-${it.n}-${it.kind}.mp4`} className="inline-flex items-center gap-1 font-bold text-verde-2 hover:underline">
                      <Download size={13} /> скачать mp4
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/** Контактный лист отрендеренного мультика: кадр каждые 15 с — весь эпизод одним взглядом (проверка перед загрузкой). */
function ContactSheet({ src }: { src: string }) {
  const base = src.replace(/contact\.png$/, "contact/");
  const { data } = useQuery({
    queryKey: ["contact", base],
    queryFn: async () => {
      const r = await fetch(`${base}index.json`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as { every: number; frames: string[] }) : null;
    },
    staleTime: 60_000,
  });
  if (!data?.frames.length) return null;
  return (
    <details className="border-t border-line bg-panel p-2 text-xs text-mute">
      <summary className="cursor-pointer font-bold">Контактный лист — кадр каждые {data.every} с ({data.frames.length})</summary>
      <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-5">
        {data.frames.map((f, i) => (
          <figure key={f} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}${f}`} alt="" loading="lazy" className="w-full rounded" />
            <figcaption className="absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[10px] text-white">{fmt(2 + i * data.every)}</figcaption>
          </figure>
        ))}
      </div>
    </details>
  );
}
