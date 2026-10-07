// Клиент FastAPI. Все запросы идут на тот же origin (/api проксируется Next rewrites).

export type VideoStatus =
  | "idea"
  | "script"
  | "needs_review"
  | "verified"
  | "approved"
  | "rendering"
  | "ready"
  | "failed"
  | "scheduled"
  | "published";

export interface Series {
  id: string;
  slug: string;
  name: string;
  format: string;
  level: string;
  topic: string;
  description: string;
  palettes: string[];
  auto_approve: boolean;
  episode_counter: number;
  answer_mode: string;
  implemented: boolean;
  counts: { lessons: number; ready: number };
}

export interface VideoMeta {
  title: string;
  title_variants: Record<string, string>;
  description: string;
  tags: string[];
  hashtags: string[];
  pinned_comment: string;
  answer: string;
  playlist: string;
  episode_no: number | null;
}

export interface Video {
  id: string;
  series_id: string | null;
  batch_id: string | null;
  status: VideoStatus;
  format: string;
  title: string;
  episode_no: number | null;
  palette: string | null;
  progress: number;
  stage: string;
  error: string | null;
  duration_s: number | null;
  issues: { field: string; message: string; severity: string }[];
  meta: Partial<VideoMeta>;
  hook_text: string;
  video_url: string | null;
  cover_url: string | null;
  published_manually: boolean;
  published_url: string | null;
  answer_comment_status: string;
  created_at: string;
}

export interface Batch {
  id: string;
  series_id: string | null;
  requested: number;
  auto_approve: boolean;
  status: string;
  similarity_index: number | null;
  created_at: string;
  counts: Record<string, number>;
  videos?: Video[];
}

export interface Health {
  ok: boolean;
  services: Record<string, { ok: boolean; error?: string; detail?: Record<string, unknown> }>;
}

export interface Stats {
  videos: Record<string, number>;
  llm: { day: { usd: number; calls: number }; month: { usd: number; calls: number } };
  lessons: number;
}

export class ApiError extends Error {}

const HUMAN: Record<number, string> = {
  400: "Некорректный запрос",
  404: "Не найдено",
  409: "Конфликт: операция уже выполняется",
  500: "Ошибка на сервере",
  502: "Сервис API недоступен",
  503: "Сервис ещё запускается",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверь, что docker compose запущен.");
  }
  if (!r.ok) {
    let detail = "";
    try {
      const body = (await r.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : Array.isArray(body.detail) ? "Проверь заполнение полей" : "";
    } catch {
      /* тело не JSON */
    }
    throw new ApiError(detail || HUMAN[r.status] || `Ошибка ${r.status}`);
  }
  return (await r.json()) as T;
}

export const api = {
  health: () => request<Health>("/api/health"),
  stats: () => request<Stats>("/api/stats"),
  series: () => request<Series[]>("/api/series"),
  batches: (limit = 10) => request<Batch[]>(`/api/batches?limit=${limit}`),
  batch: (id: string) => request<Batch>(`/api/batches/${id}`),
  createBatch: (body: { series_id: string | null; count: number; auto_approve: boolean }) =>
    request<Batch>("/api/batches", { method: "POST", body: JSON.stringify(body) }),
  videos: (params: { status?: VideoStatus[]; series_id?: string; batch_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    params.status?.forEach((s) => q.append("status", s));
    if (params.series_id) q.set("series_id", params.series_id);
    if (params.batch_id) q.set("batch_id", params.batch_id);
    q.set("limit", String(params.limit ?? 60));
    q.set("offset", String(params.offset ?? 0));
    return request<{ total: number; items: Video[] }>(`/api/videos?${q}`);
  },
  patchVideo: (id: string, body: Partial<Pick<Video, "published_manually" | "published_url" | "answer_comment_status">>) =>
    request<Video>(`/api/videos/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  rerender: (id: string) => request<Video>(`/api/videos/${id}/render`, { method: "POST" }),
  deleteVideo: (id: string) => request<{ ok: boolean }>(`/api/videos/${id}`, { method: "DELETE" }),
};

export const STATUS_LABEL: Record<VideoStatus, string> = {
  idea: "Идея",
  script: "Скрипт",
  needs_review: "На проверке",
  verified: "Проверено",
  approved: "Одобрено",
  rendering: "Рендер",
  ready: "Готово",
  failed: "Ошибка",
  scheduled: "Запланировано",
  published: "Опубликовано",
};

export const STAGE_LABEL: Record<string, string> = {
  tts: "озвучка",
  timeline: "таймлайн",
  render: "рендер",
  metadata: "метаданные",
  done: "готово",
  "": "в очереди",
};
