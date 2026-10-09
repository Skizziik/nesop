"use client";

import type { TimelineDoc } from "@ipt/templates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download, History, Loader2, Plus, Redo2, Scissors, Trash2, Undo2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type ProjectFull } from "@/lib/api";
import { Badge, Button, Progress, cn } from "../ui";
import { AddPanel } from "./AddPanel";
import { Inspector } from "./Inspector";
import { Stage, type StageHandle } from "./Stage";
import { useStudio, type TrackKind } from "./store";
import { TimelinePanel } from "./TimelinePanel";

const AUTOSAVE_MS = 1500;
const onErr = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Что-то пошло не так");

export function Studio({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: project, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.project(id),
    // пока идёт генерация или рендер — опрашиваем статус
    refetchInterval: (q) => (q.state.data && ["generating", "rendering"].includes(q.state.data.status) ? 2000 : false),
  });
  const loadedId = useStudio((s) => s.projectId);
  const doc = useStudio((s) => s.doc);
  const load = useStudio((s) => s.load);

  // документ грузим в стор один раз (и после генерации/восстановления версии)
  const loadedRev = useRef<number | null>(null);
  useEffect(() => {
    if (!project || project.status === "generating" || !project.doc || !("tracks" in project.doc)) return;
    if (loadedId === id && loadedRev.current !== null) return;
    load(id, project.doc as TimelineDoc, project.revision);
    loadedRev.current = project.revision;
  }, [project, id, loadedId, load]);

  if (error) return <div className="p-8 text-rosso">{error instanceof ApiError ? error.message : "Не удалось открыть проект"}</div>;
  if (!project) return <Centered>Загрузка проекта…</Centered>;
  if (project.status === "generating") return <Generating p={project} />;
  if (!doc || loadedId !== id) return <Centered>Готовлю редактор…</Centered>;
  return (
    <Editor
      project={project}
      onReload={async () => {
        const fresh = await qc.fetchQuery({ queryKey: ["project", id], queryFn: () => api.project(id) });
        load(id, fresh.doc as TimelineDoc, fresh.revision);
      }}
    />
  );
}

function Editor({ project, onReload }: { project: ProjectFull; onReload: () => Promise<void> }) {
  const qc = useQueryClient();
  const stage = useRef<StageHandle>(null);
  const s = useStudio();
  const { doc, dirty, saving, revision, past, future } = s;
  const [showVersions, setShowVersions] = useState(false);
  const busy = project.status === "rendering";

  // ---------- автосохранение
  const save = useCallback(
    async (note = "") => {
      const st = useStudio.getState();
      if (!st.doc || !st.projectId || st.saving) return;
      st.setSaving(true);
      try {
        const r = await api.saveProject(st.projectId, { doc: st.doc, title: st.doc.title, note, base_revision: st.revision });
        // за время запроса могли появиться новые правки — тогда dirty остаётся
        const changed = useStudio.getState().doc !== st.doc;
        useStudio.setState({ revision: r.revision, saving: false, dirty: changed });
        void qc.invalidateQueries({ queryKey: ["projects"] });
      } catch (e) {
        useStudio.setState({ saving: false });
        onErr(e);
      }
    },
    [qc],
  );
  useEffect(() => {
    if (!dirty || saving || busy) return;
    const t = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, saving, doc, save, busy]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (useStudio.getState().dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ---------- горячие клавиши
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      const st = useStudio.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      const fps = st.doc?.canvas.fps ?? 30;
      const k = e.key.toLowerCase();
      if (e.code === "Space") (e.preventDefault(), stage.current?.toggle());
      else if (ctrl && k === "z" && !e.shiftKey) (e.preventDefault(), st.undo());
      else if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) (e.preventDefault(), st.redo());
      else if (ctrl && k === "d") (e.preventDefault(), st.duplicateSelected());
      else if (ctrl && k === "s") (e.preventDefault(), void save("сохранено вручную"));
      else if (e.key === "Delete" || e.key === "Backspace") st.removeSelected();
      else if (k === "s" && !ctrl) st.splitAtPlayhead();
      else if (e.key === "Escape") st.select([]);
      else if (e.key === "ArrowLeft") (e.preventDefault(), stage.current?.seek(Math.max(0, st.playhead - (e.shiftKey ? 1 : 1 / fps))));
      else if (e.key === "ArrowRight") (e.preventDefault(), stage.current?.seek(Math.min(st.doc?.duration_s ?? 0, st.playhead + (e.shiftKey ? 1 : 1 / fps))));
      else if (e.key === "Home") stage.current?.seek(0);
      else if (e.key === "End") stage.current?.seek(Math.max(0, (st.doc?.duration_s ?? 0) - 1 / fps));
      else if (k === "+" || k === "=") st.setZoom(st.zoom * 1.25);
      else if (k === "-") st.setZoom(st.zoom / 1.25);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // ---------- рендер
  const render = useMutation({
    mutationFn: async () => {
      if (useStudio.getState().dirty) await save("перед рендером");
      return api.renderProject(project.id);
    },
    onSuccess: () => (toast.success("Рендер запущен — длинное видео рендерится несколько минут"), void qc.invalidateQueries({ queryKey: ["project", project.id] })),
    onError: onErr,
  });

  if (!doc) return null;

  return (
    <div className="-mx-8 -my-6 flex h-screen min-h-0 flex-col bg-bg">
      {/* верхняя панель */}
      <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2">
        <Link href="/projects" className="rounded-lg p-1.5 text-mute hover:bg-panel-2 hover:text-ink" title="К проектам">
          <ArrowLeft size={18} />
        </Link>
        <input
          className="min-w-0 max-w-md flex-1 rounded-md bg-transparent px-2 py-1 font-display text-base font-semibold outline-none hover:bg-panel-2 focus:bg-panel-2"
          value={doc.title}
          onChange={(e) => s.commit((d) => (d.title = e.target.value), "title")}
        />
        <Badge tone="gray">
          {doc.canvas.w}×{doc.canvas.h}
        </Badge>
        <span className="text-[11px] text-mute">{saving ? "сохраняю…" : dirty ? "есть несохранённые правки" : `сохранено · ревизия ${revision}`}</span>
        <div className="ml-auto flex items-center gap-1">
          <Tool onClick={s.undo} disabled={!past.length} title="Отменить (Ctrl+Z)">
            <Undo2 size={16} />
          </Tool>
          <Tool onClick={s.redo} disabled={!future.length} title="Повторить (Ctrl+Y)">
            <Redo2 size={16} />
          </Tool>
          <Tool onClick={s.splitAtPlayhead} title="Разрезать на плейхеде (S)">
            <Scissors size={16} />
          </Tool>
          <Tool onClick={s.duplicateSelected} disabled={!s.selected.length} title="Дублировать (Ctrl+D)">
            <Copy size={16} />
          </Tool>
          <Tool onClick={s.removeSelected} disabled={!s.selected.length} title="Удалить (Del)">
            <Trash2 size={16} />
          </Tool>
          <Tool onClick={() => setShowVersions((v) => !v)} title="Версии" active={showVersions}>
            <History size={16} />
          </Tool>
          {project.video_url && project.status !== "rendering" ? (
            <a
              href={project.video_url}
              download
              title={project.video_stale ? "Последний рендер — без правок, сделанных после него. Нажми «Рендер», чтобы обновить" : "Скачать готовое видео"}
              className="ml-1 inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-sm font-bold hover:bg-panel-2"
            >
              <Download size={15} /> mp4{project.video_stale ? " (до правок)" : ""}
            </a>
          ) : null}
          <Button className="ml-1 py-1.5" onClick={() => render.mutate()} disabled={busy || render.isPending}>
            {busy || render.isPending ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {busy ? `Рендер ${Math.round(project.progress * 100)}%` : "Рендер"}
          </Button>
        </div>
      </div>
      {busy ? (
        <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-1.5 text-xs text-mute">
          <span className="shrink-0">{project.stage || "рендер"}</span>
          <Progress value={project.progress} />
        </div>
      ) : project.status === "failed" && project.error ? (
        <div className="border-b border-rosso/40 bg-rosso/10 px-4 py-1.5 text-xs text-rosso">Ошибка: {project.error}</div>
      ) : null}

      {/* середина: добавление · превью · свойства */}
      <div className="flex min-h-0 flex-1">
        <div className="w-64 shrink-0 border-r border-line bg-panel">
          <AddPanel />
        </div>
        <div className="min-w-0 flex-1 bg-black/30">
          <Stage ref={stage} />
        </div>
        <div className="w-72 shrink-0 border-l border-line bg-panel">
          {showVersions ? <Versions projectId={project.id} onRestored={onReload} onClose={() => setShowVersions(false)} /> : <Inspector />}
        </div>
      </div>

      {/* низ: таймлайн */}
      <div className="flex h-[34vh] min-h-[220px] flex-col border-t border-line bg-panel">
        <TrackBar />
        <div className="min-h-0 flex-1">
          <TimelinePanel onSeek={(t) => stage.current?.seek(t)} />
        </div>
      </div>
    </div>
  );
}

const NEW_TRACKS: [TrackKind, string][] = [
  ["scene", "Сцены"],
  ["overlay", "Оверлей"],
  ["mascot", "Маскоты"],
  ["subtitle", "Субтитры"],
  ["audio", "Звук"],
];

function TrackBar() {
  const addTrack = useStudio((s) => s.addTrack);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-3 border-b border-line px-3 py-1 text-[11px] text-mute">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 font-bold text-verde-2 hover:underline">
        <Plus size={12} /> дорожка
      </button>
      {open ? (
        <div className="absolute top-6 left-2 z-30 grid rounded-lg border border-line bg-panel-2 p-1 shadow-xl">
          {NEW_TRACKS.map(([k, n]) => (
            <button key={k} onClick={() => (addTrack(k, n), setOpen(false))} className="rounded px-3 py-1 text-left text-xs text-ink hover:bg-panel">
              {n}
            </button>
          ))}
        </div>
      ) : null}
      <span>Пробел — play · S — разрезать · Del — удалить · Ctrl+D — копия · Ctrl+Z/Y · ←/→ кадр (Shift — секунда) · Ctrl+колесо — масштаб · Alt — без привязки</span>
    </div>
  );
}

function Versions({ projectId, onRestored, onClose }: { projectId: string; onRestored: () => Promise<void>; onClose: () => void }) {
  const { data = [] } = useQuery({ queryKey: ["project-versions", projectId], queryFn: () => api.projectVersions(projectId) });
  const restore = useMutation({
    mutationFn: async (vid: string) => {
      if (useStudio.getState().dirty && !confirm("Несохранённые правки пропадут. Восстановить?")) throw new Error("cancel");
      await api.restoreVersion(projectId, vid);
      await onRestored();
    },
    onSuccess: () => (toast.success("Версия восстановлена"), onClose()),
    onError: (e) => (e instanceof Error && e.message === "cancel" ? undefined : onErr(e)),
  });
  return (
    <div className="h-full overflow-auto p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-semibold">Версии</span>
        <button onClick={onClose} className="text-xs text-mute hover:text-ink">
          закрыть
        </button>
      </div>
      <div className="grid gap-1">
        {data.map((v) => (
          <button key={v.id} onClick={() => restore.mutate(v.id)} className="rounded-lg bg-panel-2 px-2 py-1.5 text-left text-xs hover:ring-1 hover:ring-verde-2">
            <div className="font-bold">
              ревизия {v.revision} · {v.duration_s ? `${Math.round(v.duration_s)} с` : ""}
            </div>
            <div className="text-mute">
              {new Date(v.created_at).toLocaleString("ru-RU")} {v.note ? `· ${v.note}` : ""}
            </div>
          </button>
        ))}
        {!data.length ? <div className="text-xs text-mute">Версии появятся после первого сохранения.</div> : null}
      </div>
    </div>
  );
}

function Generating({ p }: { p: ProjectFull }) {
  return (
    <div className="mx-auto mt-20 max-w-xl rounded-2xl border border-line bg-panel p-8 text-center">
      <Loader2 className="mx-auto mb-4 animate-spin text-verde-2" size={36} />
      <div className="font-display text-xl font-semibold">{p.title}</div>
      <div className="mt-1 text-sm text-mute">LLM пишет лекцию и озвучивает её. Обычно 3–8 минут — можно уйти, генерация идёт в фоне.</div>
      <div className="mt-6">
        <Progress value={p.progress} />
      </div>
      <div className="mt-2 text-xs text-mute">{p.stage || "в очереди"}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[70vh] items-center justify-center text-mute">{children}</div>;
}

function Tool({ children, onClick, title, disabled, active }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} className={cn("rounded-lg p-1.5 hover:bg-panel-2 disabled:opacity-30", active ? "text-verde-2" : "text-mute hover:text-ink")}>
      {children}
    </button>
  );
}
