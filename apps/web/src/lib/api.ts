import type { TimelineDoc } from "@ipt/templates";
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
  fonts: string[];
  voice: { model?: string; voice?: string; speed?: number };
  avatar: { mode: string };
  hook_type: string;
  answer_delay_h: number;
  second_lang: string | null;
  youtube_playlist_id: string | null;
  archived: boolean;
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

export interface Palette {
  name: string;
  enabled: boolean;
  [k: string]: unknown;
}

export interface VideoFull extends Video {
  script: Record<string, unknown> & { title: string; format: string; body: unknown; hook_text?: string; comment_hook?: { type: string; text: string; spoken?: string } };
  render_props: (RenderPropsLike & { theme?: Record<string, unknown> }) | null;
  seed: number;
  voice: { model?: string; voice?: string; speed?: number; variants?: Record<string, number> };
  events: { id: string; stage: string; status: string; message: string; duration_ms: number | null; created_at: string }[];
}

// RenderProps описан в @ipt/templates; здесь — минимальный контракт, чтобы не тянуть типы в клиент API.
export type RenderPropsLike = Record<string, unknown>;

export interface PreviewResult {
  props: RenderPropsLike | null;
  issues: { field: string; message: string; severity: string; source: string }[];
  segments: { key: string; text: string }[];
  voice: Record<string, unknown>;
}

export interface Lesson {
  id: string;
  series_id: string;
  slug: string;
  title: string;
  script: Record<string, unknown>;
  source: string;
  used_count: number;
}

export type SeriesInput = Partial<Omit<Series, "id" | "slug" | "counts" | "implemented">> & { name: string; format: string };

export interface Project {
  id: string;
  title: string;
  kind: "lecture" | "short_edit" | "custom" | "cartoon";
  aspect: "16:9" | "9:16";
  status: "generating" | "draft" | "rendering" | "ready" | "failed";
  progress: number;
  stage: string;
  error: string | null;
  series_id: string | null;
  video_id: string | null;
  params: Record<string, unknown>;
  revision: number;
  duration_s: number | null;
  video_url: string | null;
  video_stale?: boolean; // есть правки после последнего рендера
  cover_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFull extends Project {
  doc: TimelineDoc | Record<string, never>;
  meta: { title?: string; description?: string; tags?: string[]; spell?: unknown; youtube?: Partial<YoutubePack> } & Record<string, unknown>;
}

export interface YoutubePack {
  title: string;
  titles: string[];
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: string[];
  thumbnails: string[];
}

export interface ProjectVersion {
  id: string;
  revision: number;
  note: string;
  created_at: string;
  duration_s: number | null;
}

export interface LectureInput {
  topic: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1";
  minutes: number;
  mascot: string;
  lang: "en";
  aspect: "16:9" | "9:16";
  series_id?: string | null;
  voice_profile_id?: string | null;
  auto_render?: boolean;
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
  createBatch: (body: { series_id: string | null; count: number; auto_approve: boolean | null }) =>
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
  video: (id: string) => request<VideoFull>(`/api/videos/${id}`),
  saveVideo: (id: string, body: { script?: unknown; theme?: unknown; voice?: unknown }) => request<VideoFull>(`/api/videos/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  preview: (id: string, body: { script?: unknown; theme?: unknown; voice?: unknown }) => request<PreviewResult>(`/api/videos/${id}/preview`, { method: "POST", body: JSON.stringify(body) }),
  regenLine: (id: string, key: string) => request<{ variants: Record<string, number> }>(`/api/videos/${id}/regen-line`, { method: "POST", body: JSON.stringify({ key }) }),
  rerollTheme: (id: string) => request<{ theme: Record<string, unknown> }>(`/api/videos/${id}/reroll-theme`, { method: "POST" }),
  bulk: (ids: string[], action: "approve" | "to_review" | "reject" | "rerender") =>
    request<{ processed: number; skipped: string[] }>("/api/videos/bulk", { method: "POST", body: JSON.stringify({ ids, action }) }),
  schemas: () => request<{ script: unknown; formats: Record<string, unknown>; implemented: string[] }>("/api/meta/schemas"),
  palettes: () => request<Palette[]>("/api/palettes"),
  seriesOne: (id: string) => request<Series>(`/api/series/${id}`),
  createSeries: (body: SeriesInput) => request<Series>("/api/series", { method: "POST", body: JSON.stringify(body) }),
  patchSeries: (id: string, body: Partial<SeriesInput> & { archived?: boolean }) => request<Series>(`/api/series/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveSeries: (id: string) => request<{ ok: boolean }>(`/api/series/${id}`, { method: "DELETE" }),
  lessons: (seriesId: string) => request<Lesson[]>(`/api/series/${seriesId}/lessons`),
  deleteLesson: (id: string) => request<{ ok: boolean }>(`/api/lessons/${id}`, { method: "DELETE" }),
  llmIdeas: (seriesId: string, count: number, topic = "") => request<Batch>(`/api/series/${seriesId}/ideas`, { method: "POST", body: JSON.stringify({ count, topic }) }),
  similar: (videoId: string, count = 5) => request<Batch>(`/api/videos/${videoId}/similar`, { method: "POST", body: JSON.stringify({ count }) }),
  fillBank: (seriesId: string, count: number) => request<{ ok: boolean }>(`/api/series/${seriesId}/fill-bank`, { method: "POST", body: JSON.stringify({ count }) }),
  recheck: (videoId: string) => request<VideoFull>(`/api/videos/${videoId}/check`, { method: "POST" }),
  llmSettings: () => request<LlmSettings>("/api/settings/llm"),
  saveLlmSettings: (body: Omit<LlmSettings, "anthropic_key_set" | "openai_key_set">) => request<LlmSettings>("/api/settings/llm", { method: "PUT", body: JSON.stringify(body) }),
  testLlm: () => request<{ ok: boolean; answer: unknown; model: string; cost_usd: number }>("/api/settings/llm/test", { method: "POST" }),
  hooks: (kind?: "hook" | "cta") => request<Hook[]>(`/api/hooks${kind ? `?kind=${kind}` : ""}`),
  createHook: (body: Partial<Hook> & { text: string; kind: "hook" | "cta" }) => request<Hook>("/api/hooks", { method: "POST", body: JSON.stringify(body) }),
  patchHook: (id: string, body: Partial<Hook>) => request<Hook>(`/api/hooks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteHook: (id: string) => request<{ ok: boolean }>(`/api/hooks/${id}`, { method: "DELETE" }),
  generateHooks: (count: number, formats: string[]) => request<{ added: Hook[] }>("/api/hooks/generate", { method: "POST", body: JSON.stringify({ count, formats }) }),
  assets: (kind?: string) => request<AssetItem[]>(`/api/assets${kind ? `?kind=${kind}` : ""}`),
  uploadAsset: async (form: FormData) => {
    const r = await fetch("/api/assets", { method: "POST", body: form });
    if (!r.ok) {
      const b = (await r.json().catch(() => ({}))) as { detail?: unknown };
      throw new ApiError(typeof b.detail === "string" ? b.detail : "Не удалось загрузить файл");
    }
    return (await r.json()) as AssetItem;
  },
  patchAsset: (id: string, body: Partial<AssetItem>) => request<AssetItem>(`/api/assets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAsset: (id: string) => request<{ ok: boolean }>(`/api/assets/${id}`, { method: "DELETE" }),
  ttsModels: () => request<TtsModel[]>("/api/tts/models"),
  ttsHardware: () => request<{ cuda: boolean; gpu_name: string | null; vram_gb: number }>("/api/tts/hardware"),
  ttsInstall: (id: string, voice?: string) => request<unknown>(`/api/tts/models/${id}/install`, { method: "POST", body: JSON.stringify({ voice: voice ?? null }) }),
  ttsUninstall: (id: string, voice?: string) => request<unknown>(`/api/tts/models/${id}${voice ? `?voice=${voice}` : ""}`, { method: "DELETE" }),
  voiceProfiles: () => request<VoiceProfile[]>("/api/voices"),
  createVoice: (body: { name: string; kind: "builtin" | "design"; model: string; voice?: string; speed?: number; description?: string }) =>
    request<VoiceProfile>("/api/voices", { method: "POST", body: JSON.stringify(body) }),
  cloneVoice: async (form: FormData) => {
    const r = await fetch("/api/voices/clone", { method: "POST", body: form });
    if (!r.ok) {
      const b = (await r.json().catch(() => ({}))) as { detail?: unknown };
      throw new ApiError(typeof b.detail === "string" ? b.detail : "Не удалось создать клон");
    }
    return (await r.json()) as VoiceProfile;
  },
  defaultVoice: (id: string) => request<VoiceProfile>(`/api/voices/${id}/default`, { method: "POST" }),
  deleteVoice: (id: string) => request<{ ok: boolean }>(`/api/voices/${id}`, { method: "DELETE" }),
  testVoice: (body: { text?: string; profile_id?: string; model?: string; voice?: string; speed?: number; language?: "it" | "en" }) =>
    request<{ url: string; duration: number }>("/api/voices/test", { method: "POST", body: JSON.stringify(body) }),
  abVoices: (a: string, b: string, text?: string) =>
    request<{ left: { profile_id: string; url: string }; right: { profile_id: string; url: string } }>("/api/voices/ab", { method: "POST", body: JSON.stringify({ a, b, ...(text ? { text } : {}) }) }),
  voteVoice: (winner: string, loser: string) => request<unknown>("/api/voices/vote", { method: "POST", body: JSON.stringify({ winner, loser }) }),
  applyVoice: (id: string, series_ids: string[]) => request<{ updated: number }>(`/api/voices/${id}/apply`, { method: "POST", body: JSON.stringify({ series_ids }) }),
  projects: (kind?: string) => request<Project[]>(`/api/projects${kind ? `?kind=${kind}` : ""}`),
  project: (id: string) => request<ProjectFull>(`/api/projects/${id}`),
  createProject: (body: { title: string; aspect: "16:9" | "9:16" }) => request<ProjectFull>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  cartoonCatalog: () => request<CartoonCatalog>("/api/cartoon/catalog"),
  createCompilation: (body: { ids: string[]; title?: string; auto_render: boolean }) =>
    request<Project>("/api/projects/cartoon/compilation", { method: "POST", body: JSON.stringify(body) }),
  createCartoon: (body: { theme: string; minutes: number; stories: number; auto_render: boolean }) =>
    request<Project>("/api/projects/cartoon", { method: "POST", body: JSON.stringify(body) }),
  createLecture: (body: LectureInput) => request<Project>("/api/projects/lecture", { method: "POST", body: JSON.stringify(body) }),
  saveProject: (id: string, body: { doc: TimelineDoc; title?: string; note?: string; base_revision?: number }) =>
    request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  revoiceSentence: (id: string, clip_id: string, base_revision: number) =>
    request<ProjectFull & { revoice: { score: number; heard: string; take: number; duration: number } }>(`/api/projects/${id}/revoice`, {
      method: "POST",
      body: JSON.stringify({ clip_id, base_revision }),
    }),
  regenYoutube: (id: string) => request<{ youtube: YoutubePack }>(`/api/projects/${id}/youtube`, { method: "POST" }),
  projectVersions: (id: string) => request<ProjectVersion[]>(`/api/projects/${id}/versions`),
  restoreVersion: (id: string, vid: string) => request<Project>(`/api/projects/${id}/versions/${vid}/restore`, { method: "POST" }),
  renderProject: (id: string) => request<Project>(`/api/projects/${id}/render`, { method: "POST" }),
  /** Вертикальные шортсы мультика: 2-3 момента (припев, смешное, вопрос), рендер в фоне, статусы — meta.shorts. */
  makeShorts: (id: string) => request<ProjectFull>(`/api/projects/${id}/shorts`, { method: "POST" }),
  deleteProject: (id: string) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
  duplicateProject: (id: string) => request<Project>(`/api/projects/${id}/duplicate`, { method: "POST" }),
  videoToProject: (videoId: string) => request<ProjectFull>(`/api/videos/${videoId}/to-project`, { method: "POST" }),
  llmUsage: (days = 30) => request<{ rows: { purpose: string; model: string; calls: number; input_tokens: number; output_tokens: number; usd: number }[] }>(`/api/llm/usage?days=${days}`),
};

export interface Hook {
  id: string;
  kind: "hook" | "cta";
  text: string;
  spoken: string;
  type: string;
  formats: string[];
  answer_mode: string | null;
  use_count: number;
  used_in_videos: number;
  last_used_at: string | null;
  enabled: boolean;
  source: string;
}

export interface AssetItem {
  id: string;
  kind: string;
  name: string;
  url: string | null;
  license: string;
  source: string;
  attribution: string;
  data: Record<string, unknown>;
  enabled: boolean;
}

export interface TtsVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
  installed: boolean;
  size_mb: number;
  license: string;
  commercial: string;
  note: string;
}

export interface TtsModel {
  id: string;
  name: string;
  license: string;
  commercial: string;
  languages: string[];
  requires_gpu: boolean;
  vram_gb: number;
  supports_cloning: boolean;
  supports_voice_design: boolean;
  description: string;
  installed: boolean;
  default_voice: string | null;
  voices: TtsVoice[];
  fits_hardware: boolean;
  unfit_reason: string | null;
  installs: Record<string, { key: string; status: string; progress: number; message: string }>;
}

export interface VoiceProfile {
  id: string;
  name: string;
  kind: "builtin" | "design" | "clone";
  model: string;
  voice: string;
  speed: number;
  description: string;
  ref_audio: string | null;
  consent: boolean;
  wins: number;
  losses: number;
  is_default?: boolean;
}

export interface LlmSettings {
  provider: "anthropic" | "openai" | "ollama";
  anthropic_model: string;
  openai_base_url: string;
  openai_model: string;
  ollama_url: string;
  ollama_model: string;
  anthropic_key_set: boolean;
  openai_key_set: boolean;
}

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

export type CatalogKind = "locations" | "props" | "outfits" | "fx" | "actions" | "characters";
export interface CatalogEntry {
  id: string;
  label: string;
  llm: string;
  name?: string;
  tags?: string[];
  group?: string;
  slot?: string;
  outdoor?: boolean;
  ground?: boolean;
  colors?: string[];
  adult_only?: boolean;
  times?: string[];
  weather?: string[];
  compat?: Record<string, unknown>;
}
export interface CartoonCatalog {
  version: string;
  catalog: Record<CatalogKind, CatalogEntry[]>;
  episodes_total: number;
  usage: Record<CatalogKind, Record<string, number>>;
  episodes: Record<CatalogKind, Record<string, number>>;
}
