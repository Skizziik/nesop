"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { clipsAt, docFrames, SLIDE_ELEMENT_LABEL, TimelineVideo, type Clip, type SlideElement, type SlideProps } from "@ipt/templates";
import { ChevronLeft, ChevronRight, Grid3x3, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "../ui";
import { fmtTime, useStudio } from "./store";

export interface StageHandle {
  seek: (t: number) => void;
  toggle: () => void;
}

const NO_BOX: Clip["type"][] = ["audio", "subtitle"];

export const Stage = forwardRef<StageHandle>(function Stage(_, ref) {
  const doc = useStudio((s) => s.doc)!;
  const { playhead, setPlayhead, setPlaying, playing, selected, select, updateClip, updateProps, commit } = useStudio();
  const player = useRef<PlayerRef>(null);
  const box = useRef<HTMLDivElement>(null);
  const [safe, setSafe] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const fps = doc.canvas.fps;

  useImperativeHandle(ref, () => ({
    seek: (t: number) => {
      player.current?.seekTo(Math.round(t * fps));
      setPlayhead(t);
    },
    toggle: () => player.current?.toggle(),
  }));

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setPlayhead(e.detail.frame / fps);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, [fps, setPlayhead, setPlaying]);

  // размер видимой области плеера — для перевода пикселей в доли холста
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // элементы внутри выделенного слайда и блок субтитров — меряем по DOM плеера (он рендерится в той же странице)
  const [els, setEls] = useState<{ name: string; x: number; y: number; w: number; h: number }[]>([]);
  const [subBox, setSubBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selSlide = selected.length === 1 ? doc.tracks.flatMap((t) => t.clips).find((c) => c.id === selected[0] && c.type === "slide") : undefined;
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const measure = () => {
      const R = root.getBoundingClientRect();
      const rel = (n: Element) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height };
      };
      setEls(selSlide ? Array.from(root.querySelectorAll(`[data-clip-id="${selSlide.id}"] [data-el]`)).map((n) => ({ name: (n as HTMLElement).dataset.el!, ...rel(n) })) : []);
      const sb = root.querySelector('[data-el="subtitles"]');
      setSubBox(sb ? rel(sb) : null);
    };
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [doc, playhead, selSlide, size]);

  const dragEl = (e: React.PointerEvent, clip: Clip, name: SlideElement, mode: "move" | "scale", elW: number) => {
    e.stopPropagation();
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const lay = ((clip.props as unknown as SlideProps).layout ?? {}) as NonNullable<SlideProps["layout"]>;
    const o = { dx: lay[name]?.dx ?? 0, dy: lay[name]?.dy ?? 0, s: lay[name]?.s ?? 1 };
    const bw = (clip.w ?? 1) * size.w;
    const bh = (clip.h ?? 1) * size.h;
    const r = (v: number) => Math.round(v * 10000) / 10000;
    const onMove = (ev: PointerEvent) => {
      const next =
        mode === "move"
          ? { ...o, dx: r(o.dx + (ev.clientX - sx) / bw), dy: r(o.dy + (ev.clientY - sy) / bh) }
          : { ...o, s: r(Math.max(0.3, Math.min(3, o.s * (1 + (ev.clientX - sx) / Math.max(40, elW))))) };
      const cur = ((useStudio.getState().doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.id)?.props as unknown as SlideProps)?.layout ?? {}) as Record<string, unknown>;
      updateProps(clip.id, { layout: { ...cur, [name]: next } }, `el-${clip.id}-${name}`);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // субтитры: перетаскивание меняет общий стиль (для всего ролика)
  const dragSubs = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const st = doc.subtitle_style ?? {};
    const o = { x: st.x ?? 0.5, y: st.y ?? 0.88 };
    const onMove = (ev: PointerEvent) => {
      const r = (v: number) => Math.round(Math.min(0.98, Math.max(0.02, v)) * 1000) / 1000;
      commit((d) => (d.subtitle_style = { ...(d.subtitle_style ?? {}), x: r(o.x + (ev.clientX - sx) / size.w), y: r(o.y + (ev.clientY - sy) / size.h) }), "subs-drag");
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const visible = useMemo(() => clipsAt(doc, playhead).filter(({ clip }) => !NO_BOX.includes(clip.type)), [doc, playhead]);
  const locked = useMemo(() => new Set(doc.tracks.filter((t) => t.locked).map((t) => t.id)), [doc]);
  const portrait = doc.canvas.h > doc.canvas.w;

  const startDrag = (e: React.PointerEvent, clip: Clip, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    select([clip.id]);
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { x: clip.x ?? 0, y: clip.y ?? 0, w: clip.w ?? 1, h: clip.h ?? 1 };
    const keep = o.w / o.h;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / size.w;
      const dy = (ev.clientY - sy) / size.h;
      const r = (v: number) => Math.round(v * 10000) / 10000;
      if (mode === "move") updateClip(clip.id, { x: r(o.x + dx), y: r(o.y + dy) }, "stage");
      else {
        const w = Math.max(0.02, o.w + dx);
        const h = ev.shiftKey ? w / keep : Math.max(0.02, o.h + dy);
        updateClip(clip.id, { w: r(w), h: r(h) }, "stage");
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const frames = docFrames(doc);
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-3">
      <div className="relative" style={{ aspectRatio: `${doc.canvas.w} / ${doc.canvas.h}`, height: portrait ? "100%" : undefined, width: portrait ? undefined : "100%", maxHeight: "100%", maxWidth: "100%" }}>
        <div ref={box} className="absolute inset-0 overflow-hidden rounded-lg bg-black shadow-2xl">
          <Player
            ref={player}
            component={TimelineVideo as unknown as React.FC<Record<string, unknown>>}
            inputProps={doc as unknown as Record<string, unknown>}
            durationInFrames={frames}
            fps={fps}
            compositionWidth={doc.canvas.w}
            compositionHeight={doc.canvas.h}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            clickToPlay={false}
            acknowledgeRemotionLicense
          />
        </div>
        {/* слой выделения: прямоугольники видимых клипов, перемещение и масштаб мышью */}
        <div className="pointer-events-none absolute inset-0">
          {visible.map(({ clip, trackId }) => {
            const sel = selected.includes(clip.id);
            const lock = locked.has(trackId);
            return (
              <div
                key={clip.id}
                className={cn("absolute", lock ? "" : "pointer-events-auto cursor-move", sel ? "outline outline-2 outline-giallo" : "hover:outline hover:outline-1 hover:outline-white/50")}
                style={{ left: (clip.x ?? 0) * size.w, top: (clip.y ?? 0) * size.h, width: (clip.w ?? 1) * size.w, height: (clip.h ?? 1) * size.h, transform: `rotate(${clip.rotation ?? 0}deg)` }}
                onPointerDown={(e) => !lock && startDrag(e, clip, "move")}
              >
                {sel && !lock ? (
                  <>
                    <div className="absolute -top-5 left-0 rounded bg-giallo px-1 text-[10px] font-bold text-black">{clip.label || clip.type}</div>
                    <div className="pointer-events-auto absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-black bg-giallo" onPointerDown={(e) => startDrag(e, clip, "resize")} title="Тяни — размер, Shift — пропорционально" />
                  </>
                ) : null}
              </div>
            );
          })}
          {selSlide
            ? els.map((b) => (
                <div
                  key={b.name}
                  className="pointer-events-auto absolute cursor-move border border-dashed border-sky-300/80 hover:bg-sky-300/10"
                  style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                  onPointerDown={(e) => dragEl(e, selSlide, b.name as SlideElement, "move", b.w)}
                  title={`${SLIDE_ELEMENT_LABEL[b.name as SlideElement] ?? b.name}: тяни, чтобы сдвинуть; уголок — масштаб`}
                >
                  <div className="absolute -top-4 left-0 rounded bg-sky-300 px-1 text-[9px] font-bold text-black">{SLIDE_ELEMENT_LABEL[b.name as SlideElement] ?? b.name}</div>
                  <div className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-black bg-sky-300" onPointerDown={(e) => dragEl(e, selSlide, b.name as SlideElement, "scale", b.w)} />
                </div>
              ))
            : null}
          {subBox ? (
            <div
              className="pointer-events-auto absolute cursor-move rounded hover:outline hover:outline-1 hover:outline-dashed hover:outline-emerald-300"
              style={{ left: subBox.x, top: subBox.y, width: subBox.w, height: subBox.h }}
              onPointerDown={dragSubs}
              title="Субтитры: тяни, чтобы сдвинуть для всего ролика"
            />
          ) : null}
          {safe ? <SafeArea portrait={portrait} /> : null}
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm">
        <Btn onClick={() => (player.current?.seekTo(0), setPlayhead(0))} title="В начало (Home)">
          <SkipBack size={16} />
        </Btn>
        <Btn onClick={() => player.current?.seekTo(Math.max(0, Math.round(playhead * fps) - 1))} title="Кадр назад (←)">
          <ChevronLeft size={16} />
        </Btn>
        <button onClick={() => player.current?.toggle()} className="flex h-9 w-9 items-center justify-center rounded-full bg-verde text-white hover:bg-verde-2" title="Пробел">
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <Btn onClick={() => player.current?.seekTo(Math.min(frames - 1, Math.round(playhead * fps) + 1))} title="Кадр вперёд (→)">
          <ChevronRight size={16} />
        </Btn>
        <Btn onClick={() => player.current?.seekTo(frames - 1)} title="В конец (End)">
          <SkipForward size={16} />
        </Btn>
        <span className="ml-2 font-mono text-xs text-mute">
          {fmtTime(playhead)} / {fmtTime(doc.duration_s)}
        </span>
        <Btn onClick={() => setSafe((v) => !v)} title="Безопасные зоны" active={safe}>
          <Grid3x3 size={16} />
        </Btn>
      </div>
    </div>
  );
});

function Btn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={cn("rounded-lg p-1.5 hover:bg-panel-2", active ? "text-verde-2" : "text-mute hover:text-ink")}>
      {children}
    </button>
  );
}

/** 9:16 — зоны кнопок YouTube Shorts; 16:9 — title-safe 90%. */
function SafeArea({ portrait }: { portrait: boolean }) {
  if (!portrait)
    return (
      <>
        <div className="absolute inset-[5%] border border-dashed border-giallo/70" />
        <div className="absolute inset-[10%] border border-dashed border-white/30" />
      </>
    );
  return (
    <>
      <div className="absolute inset-x-0 top-0 border-b border-dashed border-rosso/70 bg-rosso/10" style={{ height: `${(120 / 1920) * 100}%` }} />
      <div className="absolute inset-x-0 bottom-0 border-t border-dashed border-rosso/70 bg-black/30" style={{ height: `${(320 / 1920) * 100}%` }} />
      <div className="absolute right-0 border-l border-dashed border-rosso/70 bg-black/20" style={{ width: `${(150 / 1080) * 100}%`, top: "40%", bottom: `${(320 / 1920) * 100}%` }} />
    </>
  );
}
