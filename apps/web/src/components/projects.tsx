"use client";

import { docFrames, MASCOT_IDS, MASCOTS, Mascot, TimelineVideo, type TimelineDoc } from "@ipt/templates";
import { Thumbnail } from "@remotion/player";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Film, GraduationCap, Loader2, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type LectureInput, type Project } from "@/lib/api";
import { inputCls } from "./SchemaForm";
import { Badge, Button, Card, CardTitle, Empty, Progress, cn } from "./ui";

const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Что-то пошло не так");

const STATUS: Record<Project["status"], { label: string; tone: "green" | "red" | "yellow" | "gray" | "blue" }> = {
  generating: { label: "генерация", tone: "blue" },
  draft: { label: "черновик", tone: "gray" },
  rendering: { label: "рендер", tone: "yellow" },
  ready: { label: "готово", tone: "green" },
  failed: { label: "ошибка", tone: "red" },
};
const KIND = { lecture: "лекция", short_edit: "из шортса", custom: "свой" } as const;

const IDEAS = [
  "Il passato prossimo: essere o avere?",
  "Gli articoli determinativi e indeterminativi",
  "I verbi riflessivi nella vita quotidiana",
  "Al ristorante: come ordinare in italiano",
  "Le preposizioni articolate senza paura",
  "Il congiuntivo presente: quando e perché",
];

export function Projects() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects(),
    refetchInterval: (q) => (q.state.data?.some((p) => p.status === "generating" || p.status === "rendering") ? 2500 : false),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["projects"] });
  const blank = useMutation({ mutationFn: (aspect: "16:9" | "9:16") => api.createProject({ title: "Новый проект", aspect }), onSuccess: (p) => router.push(`/studio/${p.id}`), onError: onErr });
  const dup = useMutation({ mutationFn: api.duplicateProject, onSuccess: () => (toast.success("Копия создана"), void refresh()), onError: onErr });
  const del = useMutation({ mutationFn: api.deleteProject, onSuccess: () => void refresh(), onError: onErr });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Длинные видео</h1>
        <p className="text-sm text-mute">Уроки-лекции на 5–25 минут от LLM и монтаж в редакторе с дорожками: слайды, маскоты, субтитры, музыка.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <LectureForm onCreated={(p) => (void refresh(), router.push(`/studio/${p.id}`))} />
        <Card>
          <CardTitle>Пустой проект</CardTitle>
          <p className="mb-4 text-sm text-mute">Чистый таймлайн — собери ролик сам из слайдов, текста, маскотов и своих файлов.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => blank.mutate("16:9")} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel-2 p-5 hover:ring-1 hover:ring-verde-2">
              <Monitor size={28} className="text-verde-2" />
              <span className="font-bold">16:9</span>
              <span className="text-xs text-mute">YouTube, 1920×1080</span>
            </button>
            <button onClick={() => blank.mutate("9:16")} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel-2 p-5 hover:ring-1 hover:ring-verde-2">
              <Smartphone size={28} className="text-verde-2" />
              <span className="font-bold">9:16</span>
              <span className="text-xs text-mute">Shorts, 1080×1920</span>
            </button>
          </div>
          <p className="mt-4 text-xs text-mute">
            Готовый шортс тоже можно доработать: в «Библиотеке» открой ролик → «В редактор».
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Проекты</CardTitle>
        {isLoading ? (
          <div className="text-sm text-mute">Загрузка…</div>
        ) : !data.length ? (
          <Empty>Пока нет проектов — создай лекцию или пустой проект.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-2xl border border-line bg-panel-2">
                <Link href={`/studio/${p.id}`} className="block">
                  <div className={cn("relative flex items-center justify-center bg-black/40", "aspect-video")}>
                    {p.status !== "generating" ? (
                      <ProjectThumb id={p.id} />
                    ) : p.status === "generating" ? (
                      <Loader2 className="animate-spin text-verde-2" />
                    ) : (
                      <Film className="text-mute" />
                    )}
                    <span className="absolute top-2 left-2">
                      <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                    </span>
                    {p.duration_s ? <span className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 text-xs font-bold">{fmtDur(p.duration_s)}</span> : null}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-2 font-bold">{p.title}</div>
                    <div className="mt-1 text-xs text-mute">
                      {KIND[p.kind]} · {p.aspect} · {new Date(p.updated_at).toLocaleDateString("ru-RU")}
                    </div>
                    {p.status === "generating" || p.status === "rendering" ? (
                      <div className="mt-2">
                        <Progress value={p.progress} />
                        <div className="mt-1 truncate text-[11px] text-mute">{p.stage}</div>
                      </div>
                    ) : p.status === "failed" && p.error ? (
                      <div className="mt-2 line-clamp-2 text-[11px] text-rosso">{p.error}</div>
                    ) : null}
                  </div>
                </Link>
                <div className="flex items-center gap-1 border-t border-line px-2 py-1">
                  {p.video_url ? (
                    <a href={p.video_url} download className="rounded px-2 py-1 text-xs font-bold text-verde-2 hover:bg-panel">
                      скачать mp4
                    </a>
                  ) : null}
                  <button onClick={() => dup.mutate(p.id)} className="ml-auto rounded p-1.5 text-mute hover:bg-panel hover:text-ink" title="Дублировать">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => confirm(`Удалить «${p.title}»?`) && del.mutate(p.id)} className="rounded p-1.5 text-mute hover:bg-panel hover:text-rosso" title="Удалить">
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

function LectureForm({ onCreated }: { onCreated: (p: Project) => void }) {
  const { data: series = [] } = useQuery({ queryKey: ["series"], queryFn: api.series });
  const [f, setF] = useState<LectureInput>({ topic: "", level: "A2", minutes: 15, mascot: "espresso", lang: "en", aspect: "16:9", series_id: null });
  const set = (patch: Partial<LectureInput>) => setF((x) => ({ ...x, ...patch }));
  const create = useMutation({ mutationFn: () => api.createLecture(f), onSuccess: (p) => (toast.success("Лекция генерируется — обычно 3–8 минут"), onCreated(p)), onError: onErr });
  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-2">
          <GraduationCap size={20} className="text-verde-2" /> Урок-лекция от LLM
        </span>
      </CardTitle>
      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-xs font-bold text-mute">Тема урока</span>
          <input className={inputCls()} placeholder="например: Il passato prossimo: essere o avere?" value={f.topic} onChange={(e) => set({ topic: e.target.value })} />
          <div className="flex flex-wrap gap-1">
            {IDEAS.map((t) => (
              <button key={t} onClick={() => set({ topic: t })} className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-mute hover:text-ink">
                {t}
              </button>
            ))}
          </div>
        </label>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-xs font-bold text-mute">Уровень</span>
            <select className={inputCls()} value={f.level} onChange={(e) => set({ level: e.target.value as LectureInput["level"] })}>
              {["A1", "A2", "B1", "B2", "C1"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold text-mute">Длина: {f.minutes} мин</span>
            <input type="range" min={3} max={25} value={f.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })} className="mt-2 accent-[var(--color-verde-2)]" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold text-mute">Перевод в субтитрах</span>
            <div className={cn(inputCls(), "flex items-center text-mute")}>English</div>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold text-mute">Формат</span>
            <select className={inputCls()} value={f.aspect} onChange={(e) => set({ aspect: e.target.value as LectureInput["aspect"] })}>
              <option value="16:9">16:9 · YouTube</option>
              <option value="9:16">9:16 · вертикальное</option>
            </select>
          </label>
        </div>
        <div>
          <span className="text-xs font-bold text-mute">Ведущий-маскот</span>
          <div className="mt-1 grid grid-cols-4 gap-2 md:grid-cols-7">
            {MASCOT_IDS.map((m) => (
              <button key={m} onClick={() => set({ mascot: m })} className={cn("flex flex-col items-center rounded-xl bg-panel-2 p-2", f.mascot === m ? "ring-2 ring-verde-2" : "hover:ring-1 hover:ring-line")}>
                <Mascot character={m} height={56} s={{ mouth: f.mascot === m ? 1 : 0, blink: false, emotion: f.mascot === m ? "happy" : "neutral", t: 0 }} />
                <span className="mt-1 text-[10px] font-semibold">{MASCOTS[m]!.name}</span>
              </button>
            ))}
          </div>
        </div>
        {series.length ? (
          <label className="grid gap-1">
            <span className="text-xs font-bold text-mute">Серия (голос и палитра берутся из неё)</span>
            <select className={inputCls()} value={f.series_id ?? ""} onChange={(e) => set({ series_id: e.target.value || null })}>
              <option value="">— без серии, голос по умолчанию —</option>
              {series
                .filter((s) => !s.archived)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-3">
          <Button className="shrink-0 whitespace-nowrap" onClick={() => create.mutate()} disabled={f.topic.trim().length < 3 || create.isPending}>
            {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Сгенерировать лекцию
          </Button>
          <span className="text-xs text-mute">план → главы → проверка → озвучка → таймлайн. Потом правишь в редакторе и жмёшь «Рендер».</span>
        </div>
      </div>
    </Card>
  );
}

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Живая обложка из документа проекта: кадр через ~2.5 с (после анимаций появления). */
function ProjectThumb({ id }: { id: string }) {
  const { data } = useQuery({ queryKey: ["project", id], queryFn: () => api.project(id), staleTime: 30_000 });
  const doc = data?.doc && "tracks" in data.doc ? (data.doc as TimelineDoc) : null;
  if (!doc) return <Film className="text-mute" />;
  const frames = docFrames(doc);
  return (
    <Thumbnail
      component={TimelineVideo as unknown as React.FC<Record<string, unknown>>}
      inputProps={doc as unknown as Record<string, unknown>}
      compositionWidth={doc.canvas.w}
      compositionHeight={doc.canvas.h}
      durationInFrames={frames}
      fps={doc.canvas.fps}
      frameToDisplay={Math.min(frames - 1, Math.round(doc.canvas.fps * 2.5))}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
