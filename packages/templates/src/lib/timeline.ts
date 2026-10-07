import type { TimelineEvent } from "../generated";

export type Action = TimelineEvent["action"];

export const secToFrame = (s: number, fps: number): number => Math.round(s * fps);

/** Событие действия `action`, активное в момент `t` (секунды). Если несколько — последнее начавшееся. */
export function activeEvent(timeline: TimelineEvent[], t: number, action: Action): TimelineEvent | null {
  let found: TimelineEvent | null = null;
  for (const ev of timeline) {
    if (ev.action !== action) continue;
    if (t >= ev.t_start && t < ev.t_end && (!found || ev.t_start >= found.t_start)) found = ev;
  }
  return found;
}

/** Все события действия, отсортированные по старту. */
export function eventsOf(timeline: TimelineEvent[], action: Action): TimelineEvent[] {
  return timeline.filter((e) => e.action === action).sort((a, b) => a.t_start - b.t_start);
}

/** Индекс подсвеченной строки в момент `t` или -1. */
export function highlightedIndex(timeline: TimelineEvent[], t: number): number {
  const ev = activeEvent(timeline, t, "highlight");
  return ev && typeof ev.target === "number" ? ev.target : -1;
}

/** Секунды с начала события (для пружин/анимаций), null если событие не активно. */
export function sinceStart(ev: TimelineEvent | null, t: number): number | null {
  return ev ? t - ev.t_start : null;
}
