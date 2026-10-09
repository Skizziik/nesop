"use client";

import type { Clip } from "@ipt/templates";
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Magnet, Trash2, Unlock, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../ui";
import { fmtTime, snapPoints, snapTo, useStudio, type Track } from "./store";

const HEAD_W = 170;
const ROW_H: Record<Track["kind"], number> = { scene: 54, overlay: 42, subtitle: 34, mascot: 42, audio: 38 };
const COLOR: Record<Clip["type"], string> = {
  slide: "bg-indigo-500/80 border-indigo-300",
  short: "bg-fuchsia-600/80 border-fuchsia-300",
  text: "bg-amber-500/80 border-amber-200",
  subtitle: "bg-slate-500/80 border-slate-300",
  mascot: "bg-orange-500/80 border-orange-200",
  sticker: "bg-pink-500/80 border-pink-200",
  image: "bg-teal-600/80 border-teal-300",
  video: "bg-cyan-700/80 border-cyan-300",
  audio: "bg-emerald-700/80 border-emerald-300",
  shape: "bg-zinc-600/80 border-zinc-300",
};

type Drag =
  | { mode: "move"; ids: string[]; startX: number; orig: Record<string, number>; trackId: string; dy: number }
  | { mode: "left" | "right"; id: string; startX: number; start: number; duration: number; trim: number }
  | { mode: "playhead" };

export function TimelinePanel({ onSeek }: { onSeek: (t: number) => void }) {
  const doc = useStudio((s) => s.doc)!;
  const { zoom, setZoom, playhead, selected, select, updateClip, moveClipToTrack, updateTrack, removeTrack, moveTrack, snap, toggleSnap } = useStudio();
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const width = Math.max(doc.duration_s, 10) * zoom + 200;

  // автоскролл за плейхедом во время воспроизведения
  const playing = useStudio((s) => s.playing);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing) return;
    const x = playhead * zoom;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - HEAD_W - 40) el.scrollLeft = Math.max(0, x - 80);
  }, [playhead, playing, zoom]);

  // Ctrl+колесо — зум таймлайна вокруг курсора. Нативный слушатель с passive:false: у React onWheel пассивный,
  // preventDefault не срабатывает и браузер масштабирует всю страницу.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const st = useStudio.getState();
      const r = el.getBoundingClientRect();
      const px = Math.max(0, e.clientX - r.left - HEAD_W);
      const t = (px + el.scrollLeft) / st.zoom;
      const next = Math.min(400, Math.max(4, st.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      st.setZoom(next);
      requestAnimationFrame(() => (el.scrollLeft = Math.max(0, t * next - px)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const timeAt = (clientX: number) => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return Math.max(0, (clientX - r.left - HEAD_W + el.scrollLeft) / zoom);
  };

  const points = useMemo(() => (drag && drag.mode !== "playhead" ? snapPoints(doc, new Set(drag.mode === "move" ? drag.ids : [drag.id]), playhead) : []), [drag, doc, playhead]);
  const tol = 8 / zoom;
  const sn = (t: number, free = false) => (snap && !free ? snapTo(t, points, tol) : Math.round(t * 10) / 10);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      if (drag.mode === "playhead") {
        onSeek(timeAt(e.clientX));
        return;
      }
      const dt = (e.clientX - drag.startX) / zoom;
      if (drag.mode === "move") {
        // привязываем по началу первого клипа выделения
        const lead = drag.ids[0]!;
        const want = Math.max(0, drag.orig[lead]! + dt);
        const off = sn(want, e.altKey) - drag.orig[lead]!;
        for (const id of drag.ids) updateClip(id, { start: Math.max(0, Math.round((drag.orig[id]! + off) * 1000) / 1000) }, "drag");
        // вертикально — на другую дорожку того же типа
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-track]") as HTMLElement | null;
        const to = el?.dataset.track;
        if (to && to !== drag.trackId && drag.ids.length === 1) {
          moveClipToTrack(lead, to);
          setDrag({ ...drag, trackId: to });
        }
      } else if (drag.mode === "left") {
        const end = drag.start + drag.duration;
        const ns = Math.min(Math.max(0, sn(drag.start + dt, e.altKey)), end - 0.1);
        updateClip(drag.id, { start: Math.round(ns * 1000) / 1000, duration: Math.round((end - ns) * 1000) / 1000, trim: Math.max(0, Math.round((drag.trim + (ns - drag.start)) * 1000) / 1000) }, "drag");
      } else {
        const ne = Math.max(drag.start + 0.1, sn(drag.start + drag.duration + dt, e.altKey));
        updateClip(drag.id, { duration: Math.round((ne - drag.start) * 1000) / 1000 }, "drag");
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });

  const step = zoom > 120 ? 1 : zoom > 40 ? 5 : zoom > 15 ? 15 : 60;
  const ticks = Array.from({ length: Math.ceil(Math.max(doc.duration_s, 10) / step) + 1 }, (_, i) => i * step);

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs">
        <span className="font-mono text-ink">{fmtTime(playhead)}</span>
        <span className="text-mute">/ {fmtTime(doc.duration_s)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggleSnap} title="Привязка к краям клипов и плейхеду" className={cn("rounded p-1", snap ? "text-verde-2" : "text-mute")}>
            <Magnet size={14} />
          </button>
          <button onClick={() => setZoom(zoom / 1.4)} className="rounded p-1 text-mute hover:text-ink" title="Отдалить (Ctrl+колесо)">
            <ZoomOut size={14} />
          </button>
          <input type="range" min={4} max={400} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-28 accent-[var(--color-verde-2)]" />
          <button onClick={() => setZoom(zoom * 1.4)} className="rounded p-1 text-mute hover:text-ink" title="Приблизить">
            <ZoomIn size={14} />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        data-scroller
        className="relative min-h-0 flex-1 overflow-auto"
      >
        <div style={{ width: width + HEAD_W }} className="relative">
          {/* линейка */}
          <div className="sticky top-0 z-30 flex h-7 border-b border-line bg-panel-2">
            <div className="sticky left-0 z-40 shrink-0 border-r border-line bg-panel-2" style={{ width: HEAD_W }} />
            <div data-ruler data-zoom={zoom} className="relative flex-1 cursor-pointer" onPointerDown={(e) => (onSeek(timeAt(e.clientX)), setDrag({ mode: "playhead" }))}>
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 h-full border-l border-line/70 pl-1 text-[10px] text-mute" style={{ left: t * zoom }}>
                  {fmtTime(t).replace(/\.\d$/, "")}
                </div>
              ))}
            </div>
          </div>
          {/* дорожки: в документе первая — нижняя, на экране показываем верхнюю сверху */}
          {[...doc.tracks].reverse().map((tr) => (
            <div key={tr.id} data-track={tr.id} className={cn("flex border-b border-line/60", tr.hidden && "opacity-50")} style={{ height: ROW_H[tr.kind] }}>
              <div className="sticky left-0 z-20 flex shrink-0 items-center gap-1 border-r border-line bg-panel px-2 text-xs" style={{ width: HEAD_W }}>
                <input
                  value={tr.name}
                  onChange={(e) => updateTrack(tr.id, { name: e.target.value })}
                  className="w-16 min-w-0 flex-1 truncate bg-transparent font-semibold outline-none"
                  title={tr.kind}
                />
                {tr.kind === "audio" ? (
                  <button onClick={() => updateTrack(tr.id, { muted: !tr.muted })} className="text-mute hover:text-ink" title="Заглушить">
                    {tr.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                ) : (
                  <button onClick={() => updateTrack(tr.id, { hidden: !tr.hidden })} className="text-mute hover:text-ink" title="Скрыть">
                    {tr.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
                <button onClick={() => updateTrack(tr.id, { locked: !tr.locked })} className="text-mute hover:text-ink" title="Заблокировать">
                  {tr.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
                <button onClick={() => moveTrack(tr.id, 1)} className="text-mute hover:text-ink" title="Выше (поверх)">
                  <ArrowUp size={12} />
                </button>
                <button onClick={() => moveTrack(tr.id, -1)} className="text-mute hover:text-ink" title="Ниже">
                  <ArrowDown size={12} />
                </button>
                <button onClick={() => (tr.clips.length === 0 || confirm(`Удалить дорожку «${tr.name}» с ${tr.clips.length} клипами?`)) && removeTrack(tr.id)} className="text-mute hover:text-rosso" title="Удалить дорожку">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="relative flex-1" onPointerDown={(e) => e.target === e.currentTarget && (select([]), onSeek(timeAt(e.clientX)))}>
                {tr.clips.map((c) => {
                  const sel = selected.includes(c.id);
                  const label = c.label || (c.type === "subtitle" || c.type === "text" ? String((c.props as { text?: string }).text ?? "") : c.type);
                  return (
                    <div
                      key={c.id}
                      data-clip={c.id}
                      data-clip-type={c.type}
                      className={cn("absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-md border text-[11px] text-white select-none", COLOR[c.type], sel && "ring-2 ring-giallo z-10", tr.locked && "cursor-not-allowed")}
                      style={{ left: c.start * zoom, width: Math.max(4, c.duration * zoom) }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (tr.locked) return;
                        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
                        const ids = sel && !additive ? selected : additive ? Array.from(new Set([...selected, c.id])) : [c.id];
                        select(ids);
                        const orig: Record<string, number> = {};
                        for (const id of ids) {
                          const f = doc.tracks.flatMap((t) => t.clips).find((x) => x.id === id);
                          if (f) orig[id] = f.start;
                        }
                        setDrag({ mode: "move", ids: [c.id, ...ids.filter((i) => i !== c.id)], startX: e.clientX, orig, trackId: tr.id, dy: e.clientY });
                      }}
                      title={`${label} · ${fmtTime(c.start)} → ${fmtTime(c.start + c.duration)}`}
                    >
                      <div className="truncate px-2 pt-0.5 font-semibold">{label}</div>
                      {!tr.locked ? (
                        <>
                          <div className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/70" onPointerDown={(e) => (e.stopPropagation(), select([c.id]), setDrag({ mode: "left", id: c.id, startX: e.clientX, start: c.start, duration: c.duration, trim: c.trim ?? 0 }))} />
                          <div className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/30 hover:bg-white/70" onPointerDown={(e) => (e.stopPropagation(), select([c.id]), setDrag({ mode: "right", id: c.id, startX: e.clientX, start: c.start, duration: c.duration, trim: c.trim ?? 0 }))} />
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {/* плейхед */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-[15] w-px bg-rosso" style={{ left: HEAD_W + playhead * zoom }}>
            <div className="pointer-events-auto absolute -top-0 -left-1.5 h-3 w-3 cursor-ew-resize rounded-sm bg-rosso" onPointerDown={() => setDrag({ mode: "playhead" })} />
          </div>
          {/* конец ролика */}
          <div className="pointer-events-none absolute top-7 bottom-0 z-0 border-l-2 border-dashed border-giallo/50" style={{ left: HEAD_W + doc.duration_s * zoom }} />
        </div>
      </div>
    </div>
  );
}
