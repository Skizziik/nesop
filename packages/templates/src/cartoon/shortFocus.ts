/**
 * Чистая геометрия вертикального шортса (CartoonShort): сцена 1920×1080 масштабируется по высоте 1920 (×1.78)
 * и сдвигается так, чтобы в кадре 1080 был говорящий герой / действие. Без React и Remotion — проверяется vitest.
 */
export const SHORT_W = 1080;
export const SHORT_H = 1920;
export const SRC_W = 1920;
export const SRC_H = 1080;
/** Масштаб сцены в шортсе: высота 1080 → 1920 (ширина 1920 → 3413). */
export const SHORT_SCALE = SHORT_H / SRC_H;
/** Сколько пикселей кадра сцены (1920-шкала) видно по ширине шортса. */
export const VISIBLE_SRC_W = SHORT_W / SHORT_SCALE;

export interface FocusPerson {
  id: string;
  /** Положение героя в пикселях кадра сцены (0..1920), уже с учётом камеры сцены. */
  px: number;
}

/**
 * Куда смотреть (x в пикселях кадра сцены): на говорящего; если собеседник рядом и оба помещаются — между ними;
 * без говорящего — на центр группы, если она влезает, иначе на героя ближе к центру.
 */
export function focusTarget(people: FocusPerson[], speaker: string | null, scale = SHORT_SCALE, frameW = SHORT_W): number {
  const vis = people.filter((p) => p.px > -150 && p.px < SRC_W + 150);
  if (!vis.length) return SRC_W / 2;
  const fit = (frameW * 0.5) / scale; // оба героя целиком, с запасом по краям
  const sp = speaker ? vis.find((p) => p.id === speaker) : undefined;
  if (sp) {
    const others = vis.filter((p) => p !== sp).sort((a, b) => Math.abs(a.px - sp.px) - Math.abs(b.px - sp.px));
    const near = others[0];
    return near && Math.abs(near.px - sp.px) <= fit ? (near.px + sp.px) / 2 : sp.px;
  }
  const xs = vis.map((p) => p.px);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  if (hi - lo <= (frameW * 0.55) / scale) return (lo + hi) / 2;
  return vis.reduce((b, p) => (Math.abs(p.px - SRC_W / 2) < Math.abs(b.px - SRC_W / 2) ? p : b)).px;
}

/** Сдвиг (px шортса) слоя сцены, масштабированного в `scale`, чтобы точка fx оказалась в центре; края сцены не уходят внутрь кадра. */
export function panFor(fx: number, scale = SHORT_SCALE, frameW = SHORT_W, srcW = SRC_W): number {
  const tx = frameW / 2 - fx * scale;
  return Math.max(frameW - srcW * scale, Math.min(0, tx));
}

/** Сглаживание камеры: взвешенное среднее целей в моменты t+d (треугольные веса) — переезд к новому говорящему ~1 с, без рывков. */
export function smoothFocus(target: (t: number) => number, t: number, lo: number, hi: number, back = 0.8, ahead = 0.4, step = 0.1): number {
  let sum = 0;
  let wsum = 0;
  for (let d = -back; d <= ahead + 1e-9; d += step) {
    const tt = Math.max(lo, Math.min(hi, t + d));
    const w = 1 - Math.abs(d) / (Math.max(back, ahead) + step);
    sum += target(tt) * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : target(t);
}

/**
 * Кусок звуковой дорожки эпизода (начало start, длина dur) в окне [from, to]: с какого кадра шортса играет,
 * сколько кадров обрезать в начале файла и сколько кадров звучит. null — дорожка в окно не попадает.
 */
export function audioWindow(track: { start: number; dur?: number }, from: number, to: number, fps: number): { from: number; trimBefore: number; durationInFrames: number } | null {
  const end = track.dur !== undefined ? track.start + track.dur : Infinity;
  const a = Math.max(track.start, from);
  const b = Math.min(end, to);
  if (b - a <= 1 / fps) return null;
  return {
    from: Math.round((a - from) * fps),
    trimBefore: Math.max(0, Math.round((from - track.start) * fps)),
    durationInFrames: Math.max(1, Math.round((b - a) * fps)),
  };
}

/** Индекс сцены в момент t (как в эпизоде: до первой — первая, после последней — последняя). */
export function sceneIndexAt(scenes: { start: number; duration: number }[], t: number): number {
  const i = scenes.findIndex((s) => t >= s.start && t < s.start + s.duration);
  if (i >= 0) return i;
  return t < (scenes[0]?.start ?? 0) ? 0 : scenes.length - 1;
}

/** Говорящий в момент t: реплика идёт (с небольшим упреждением) или только что закончилась (≤ 1.5 с). */
export function speakerAt(lines: { char: string; start: number; dur: number }[], t: number): string | null {
  const now = lines.find((l) => t >= l.start - 0.3 && t <= l.start + l.dur + 0.2);
  if (now) return now.char;
  const past = lines.filter((l) => l.start + l.dur <= t && t - (l.start + l.dur) <= 1.5).sort((a, b) => b.start - a.start)[0];
  return past ? past.char : null;
}

/** Перенос строк для вертикального кадра: слова по строкам не длиннее maxChars (слово длиннее — отдельной строкой). */
export function wrapWords(words: string[], maxChars: number): number[][] {
  const rows: number[][] = [];
  let cur: number[] = [];
  let len = 0;
  words.forEach((w, i) => {
    const add = (cur.length ? 1 : 0) + w.length;
    if (cur.length && len + add > maxChars) {
      rows.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(i);
    len += (cur.length > 1 ? 1 : 0) + w.length;
  });
  if (cur.length) rows.push(cur);
  return rows;
}
