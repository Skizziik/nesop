"use client";

import type { Clip, TimelineDoc } from "@ipt/templates";
import { create } from "zustand";

export type Track = TimelineDoc["tracks"][number];
export type TrackKind = Track["kind"];

/** Какие типы клипов живут на какой дорожке. */
export const KIND_OF: Record<Clip["type"], TrackKind> = {
  slide: "scene",
  short: "scene",
  image: "overlay",
  video: "overlay",
  text: "overlay",
  sticker: "overlay",
  shape: "overlay",
  subtitle: "subtitle",
  mascot: "mascot",
  audio: "audio",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const HISTORY = 100;
const round = (x: number) => Math.round(x * 1000) / 1000;

interface State {
  projectId: string | null;
  doc: TimelineDoc | null;
  revision: number;
  dirty: boolean;
  saving: boolean;
  past: TimelineDoc[];
  future: TimelineDoc[];
  selected: string[]; // id клипов
  playhead: number; // сек
  playing: boolean;
  zoom: number; // px на секунду
  snap: boolean;

  load: (id: string, doc: TimelineDoc, revision: number) => void;
  /** Любая правка документа идёт через commit: история, флаг dirty. coalesce — склеивать с предыдущей (перетаскивание). */
  commit: (fn: (d: TimelineDoc) => void, coalesce?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[], additive?: boolean) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setZoom: (z: number) => void;
  toggleSnap: () => void;
  markSaved: (revision: number) => void;
  setSaving: (s: boolean) => void;

  // операции
  addClip: (c: Omit<Clip, "id"> & { id?: string }, trackId?: string) => string;
  updateClip: (id: string, patch: Partial<Clip>, coalesce?: string) => void;
  updateProps: (id: string, patch: Record<string, unknown>, coalesce?: string) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  splitAtPlayhead: () => void;
  moveClipToTrack: (id: string, trackId: string) => void;
  addTrack: (kind: TrackKind, name: string) => string;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  moveTrack: (id: string, dir: -1 | 1) => void;
  fitDuration: () => void;
}

let lastCoalesce: { key: string; at: number } | null = null;

export function findClip(doc: TimelineDoc, id: string): { track: Track; clip: Clip; index: number } | null {
  for (const track of doc.tracks) {
    const index = track.clips.findIndex((c) => c.id === id);
    if (index >= 0) return { track, clip: track.clips[index]!, index };
  }
  return null;
}

export const contentEnd = (doc: TimelineDoc) => Math.max(1, ...doc.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)));

export const useStudio = create<State>((set, get) => ({
  projectId: null,
  doc: null,
  revision: 0,
  dirty: false,
  saving: false,
  past: [],
  future: [],
  selected: [],
  playhead: 0,
  playing: false,
  zoom: 60,
  snap: true,

  load: (id, doc, revision) => set({ projectId: id, doc, revision, dirty: false, past: [], future: [], selected: [], playhead: 0 }),

  commit: (fn, coalesce) => {
    const { doc, past } = get();
    if (!doc) return;
    const next = structuredClone(doc);
    fn(next);
    const now = Date.now();
    const merge = coalesce && lastCoalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < 800;
    lastCoalesce = coalesce ? { key: coalesce, at: now } : null;
    set({ doc: next, dirty: true, future: [], past: merge ? past : [...past.slice(-HISTORY + 1), doc] });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length || !doc) return;
    set({ doc: past[past.length - 1]!, past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY), dirty: true });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!future.length || !doc) return;
    set({ doc: future[0]!, future: future.slice(1), past: [...past, doc].slice(-HISTORY), dirty: true });
  },
  select: (ids, additive) => set((s) => ({ selected: additive ? Array.from(new Set([...s.selected, ...ids])) : ids })),
  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (p) => set({ playing: p }),
  setZoom: (z) => set({ zoom: Math.min(400, Math.max(4, z)) }),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  markSaved: (revision) => set({ revision, dirty: false, saving: false }),
  setSaving: (saving) => set({ saving }),

  addClip: (c, trackId) => {
    const id = c.id ?? uid();
    get().commit((d) => {
      const kind = KIND_OF[c.type];
      let tr = trackId ? d.tracks.find((t) => t.id === trackId) : undefined;
      if (!tr) tr = [...d.tracks].reverse().find((t) => t.kind === kind && !t.locked);
      if (!tr) {
        tr = { id: uid(), kind, name: { scene: "Сцены", overlay: "Оверлей", subtitle: "Субтитры", mascot: "Маскоты", audio: "Звук" }[kind], clips: [] };
        d.tracks.push(tr);
      }
      tr.clips.push({ x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, anim_in: "none", anim_out: "none", trim: 0, label: "", props: {}, ...c, id } as Clip);
      tr.clips.sort((a, b) => a.start - b.start);
      d.duration_s = Math.max(d.duration_s, round(c.start + c.duration));
    });
    set({ selected: [id] });
    return id;
  },
  updateClip: (id, patch, coalesce) =>
    get().commit((d) => {
      const f = findClip(d, id);
      if (!f) return;
      Object.assign(f.clip, patch);
      if (patch.start !== undefined) f.track.clips.sort((a, b) => a.start - b.start);
      d.duration_s = Math.max(d.duration_s, round(f.clip.start + f.clip.duration));
    }, coalesce),
  updateProps: (id, patch, coalesce) =>
    get().commit((d) => {
      const f = findClip(d, id);
      if (f) f.clip.props = { ...(f.clip.props ?? {}), ...patch };
    }, coalesce),
  removeSelected: () => {
    const ids = new Set(get().selected);
    if (!ids.size) return;
    get().commit((d) => {
      for (const t of d.tracks) if (!t.locked) t.clips = t.clips.filter((c) => !ids.has(c.id));
    });
    set({ selected: [] });
  },
  duplicateSelected: () => {
    const ids = get().selected;
    const fresh: string[] = [];
    get().commit((d) => {
      for (const id of ids) {
        const f = findClip(d, id);
        if (!f) continue;
        const copy = { ...structuredClone(f.clip), id: uid(), start: round(f.clip.start + f.clip.duration) };
        f.track.clips.push(copy);
        f.track.clips.sort((a, b) => a.start - b.start);
        d.duration_s = Math.max(d.duration_s, round(copy.start + copy.duration));
        fresh.push(copy.id);
      }
    });
    set({ selected: fresh });
  },
  splitAtPlayhead: () => {
    const { selected, playhead } = get();
    get().commit((d) => {
      const targets = selected.length ? selected : d.tracks.flatMap((t) => (t.locked ? [] : t.clips.filter((c) => playhead > c.start && playhead < c.start + c.duration).map((c) => c.id)));
      for (const id of targets) {
        const f = findClip(d, id);
        if (!f || playhead <= f.clip.start + 0.05 || playhead >= f.clip.start + f.clip.duration - 0.05) continue;
        const left = round(playhead - f.clip.start);
        const right: Clip = { ...structuredClone(f.clip), id: uid(), start: round(playhead), duration: round(f.clip.duration - left) };
        // у медиа правая половина продолжает с того же места
        if (f.clip.type === "audio" || f.clip.type === "video") right.trim = round((f.clip.trim ?? 0) + left);
        f.clip.duration = left;
        f.track.clips.splice(f.index + 1, 0, right);
      }
    });
  },
  moveClipToTrack: (id, trackId) =>
    get().commit((d) => {
      const f = findClip(d, id);
      const to = d.tracks.find((t) => t.id === trackId);
      if (!f || !to || to.locked || f.track.id === to.id || to.kind !== f.track.kind) return;
      f.track.clips.splice(f.index, 1);
      to.clips.push(f.clip);
      to.clips.sort((a, b) => a.start - b.start);
    }),
  addTrack: (kind, name) => {
    const id = uid();
    get().commit((d) => {
      d.tracks.push({ id, kind, name, clips: [] });
    });
    return id;
  },
  updateTrack: (id, patch) =>
    get().commit((d) => {
      const t = d.tracks.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }),
  removeTrack: (id) =>
    get().commit((d) => {
      d.tracks = d.tracks.filter((t) => t.id !== id);
    }),
  moveTrack: (id, dir) =>
    get().commit((d) => {
      const i = d.tracks.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.tracks.length) return;
      [d.tracks[i], d.tracks[j]] = [d.tracks[j]!, d.tracks[i]!];
    }),
  fitDuration: () =>
    get().commit((d) => {
      d.duration_s = round(contentEnd(d));
    }),
}));

/** Точки привязки при перетаскивании: края всех клипов, плейхед, ноль. */
export function snapPoints(doc: TimelineDoc, exclude: Set<string>, playhead: number): number[] {
  const pts = [0, playhead, doc.duration_s];
  for (const t of doc.tracks) for (const c of t.clips) if (!exclude.has(c.id)) pts.push(c.start, c.start + c.duration);
  return pts;
}

export function snapTo(t: number, points: number[], tolerance: number): number {
  let best = t;
  let dist = tolerance;
  for (const p of points) {
    const dd = Math.abs(p - t);
    if (dd < dist) {
      dist = dd;
      best = p;
    }
  }
  return best;
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};
