import express from "express";
import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ensureBrowser, openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { bundleTemplates } from "./bundle";
import { ffmpeg } from "./ffmpeg";
import { JobQueue, type RenderJob } from "./jobs";

const PORT = Number(process.env.RENDERER_PORT ?? 3100);
const DATA_DIR = resolve(process.env.DATA_DIR ?? "/data");
const ASSET_BASE = process.env.RENDER_ASSET_BASE ?? "http://api:8000";
const CONCURRENCY = Math.max(1, Number(process.env.RENDER_CONCURRENCY ?? 1));
const CHROME_THREADS = process.env.RENDER_THREADS ? Number(process.env.RENDER_THREADS) : null;
const COMPOSITION_ID = "Short";

const log = (level: string, msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: "renderer", msg, ...extra }));

let serveUrl: string | null = null;
let bundleError: string | null = null;

async function prepare(): Promise<void> {
  log("info", "browser ensure");
  await ensureBrowser();
  log("info", "bundling templates");
  const t0 = Date.now();
  serveUrl = await bundleTemplates(join(DATA_DIR, ".remotion-bundle"));
  log("info", "bundle ready", { ms: Date.now() - t0 });
}

/** Внутри /data только: защищает от записи куда попало по пути из запроса. */
function safeOutDir(rel: string): string {
  const abs = resolve(DATA_DIR, rel.replace(/^\/+/, ""));
  if (!abs.startsWith(DATA_DIR)) throw new Error("out_dir вне /data");
  return abs;
}

// Один браузер на все задачи: не тратим время и не ловим таймаут запуска Chromium на каждом ролике.
type Browser = Awaited<ReturnType<typeof openBrowser>>;
let browser: Browser | null = null;
const TIMEOUT_MS = 120_000;

async function getBrowser(): Promise<Browser> {
  if (!browser) browser = await openBrowser("chrome", { chromiumOptions: { gl: "swangle" } });
  return browser;
}

async function resetBrowser(): Promise<void> {
  const b = browser;
  browser = null;
  await b?.close({ silent: true }).catch(() => undefined);
}

async function runJob(job: RenderJob): Promise<void> {
  try {
    await renderOnce(job);
  } catch (e) {
    // сбой браузера (таймаут запуска, упавшая вкладка) — перезапускаем Chromium и пробуем ещё раз
    log("warn", "render retry", { job: job.id, error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
    await resetBrowser();
    await renderOnce(job);
  }
}

interface AudioTrack {
  file: string;
  start: number;
  volume: number;
  loop: boolean;
  dur?: number;
}

/** Дорожки мультика как локальные файлы /data/... (src = "/media/..."); null — есть внешние/непонятные источники. */
function mixableAudio(props: Record<string, unknown>): AudioTrack[] | null {
  const list = (props.audio as { src?: string; start?: number; volume?: number; loop?: boolean; dur?: number }[] | undefined) ?? [];
  if (!list.length) return null;
  const out: AudioTrack[] = [];
  for (const a of list) {
    if (!a.src?.startsWith("/media/")) return null;
    const file = resolve(DATA_DIR, a.src.slice("/media/".length).split("?")[0]!);
    if (!file.startsWith(DATA_DIR) || !existsSync(file)) return null;
    out.push({ file, start: Math.max(0, a.start ?? 0), volume: a.volume ?? 1, loop: !!a.loop, dur: a.dur });
  }
  return out;
}

/** Сведение дорожек как в Episode (<Sequence from=start durationInFrames=dur><Audio volume loop/>): adelay + volume + amix без нормализации. */
async function mixAudio(tracks: AudioTrack[], seconds: number, out: string): Promise<void> {
  const args: string[] = [];
  const chains: string[] = [];
  tracks.forEach((t, i) => {
    if (t.loop) args.push("-stream_loop", "-1");
    args.push("-i", t.file);
    const trim = t.dur !== undefined ? `atrim=0:${t.dur.toFixed(3)},` : t.loop ? `atrim=0:${Math.max(0.1, seconds - t.start).toFixed(3)},` : "";
    const ms = Math.round(t.start * 1000);
    chains.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono,${trim}volume=${t.volume},adelay=${ms}|${ms}[a${i}]`);
  });
  const mix = `${tracks.map((_, i) => `[a${i}]`).join("")}amix=inputs=${tracks.length}:normalize=0:dropout_transition=0,pan=stereo|c0=c0|c1=c0[m]`; // моно → оба канала без -3 дБ (как Remotion)
  await ffmpeg([...args, "-filter_complex", [...chains, mix].join(";"), "-map", "[m]", "-t", seconds.toFixed(3), "-c:a", "pcm_s16le", out]);
}

/** Кусок длинного мультика: ~4 минуты видео за проход. */
const CHUNK_FRAMES = Number(process.env.RENDER_CHUNK_FRAMES ?? 30 * 240);

/**
 * Длинный мультик частями (docs/cartoon-visual-variety.md: «рендер эпизода частями»): Node-рендерер копит данные по кадрам,
 * и 22-минутный эпизод упирался в лимит памяти. Видео — кусками без звука, звук — отдельным проходом целиком (без стыков),
 * потом склейка concat без перекодирования. Сбой куска не теряет уже готовые: куски с прошлой попытки переиспользуются.
 */
async function renderChunked(job: RenderJob, composition: Awaited<ReturnType<typeof selectComposition>>, inputProps: Record<string, unknown>,
  puppeteerInstance: Browser, raw: string): Promise<void> {
  if (!serveUrl) throw new Error("бандл шаблонов ещё не готов");
  const total = composition.durationInFrames;
  const dir = join(job.outDir, "chunks");
  await mkdir(dir, { recursive: true });
  const parts: string[] = [];
  const n = Math.ceil(total / CHUNK_FRAMES);
  for (let i = 0; i < n; i++) {
    const a = i * CHUNK_FRAMES;
    const b = Math.min(total - 1, a + CHUNK_FRAMES - 1);
    const out = join(dir, `part${String(i).padStart(3, "0")}.mp4`);
    parts.push(out);
    if (existsSync(join(dir, `part${String(i).padStart(3, "0")}.done`))) continue;
    await renderMedia({
      serveUrl, composition, inputProps, codec: "h264", crf: 18, pixelFormat: "yuv420p", muted: true, frameRange: [a, b],
      outputLocation: out, concurrency: CHROME_THREADS, chromiumOptions: { gl: "swangle" }, puppeteerInstance, timeoutInMilliseconds: TIMEOUT_MS,
      onProgress: ({ progress }) => {
        job.progress = ((a + progress * (b - a + 1)) / total) * 0.82;
      },
    });
    await writeFile(join(dir, `part${String(i).padStart(3, "0")}.done`), "");
    log("info", "chunk done", { job: job.id, chunk: i + 1, of: n });
  }
  // звук целиком, без стыков: дорожки эпизода (doc.audio) сводит ffmpeg — секунды вместо прохода Remotion по всем кадрам
  const audio = join(dir, "audio.wav");
  const tracks = mixableAudio(inputProps);
  if (tracks) {
    await mixAudio(tracks, total / composition.fps, audio);
  } else {
    await renderMedia({
      serveUrl, composition, inputProps, codec: "wav", outputLocation: audio, concurrency: CHROME_THREADS, chromiumOptions: { gl: "swangle" },
      puppeteerInstance, timeoutInMilliseconds: TIMEOUT_MS,
      onProgress: ({ progress }) => {
        job.progress = 0.82 + progress * 0.07;
      },
    });
  }
  const list = join(dir, "list.txt");
  await writeFile(list, parts.map((x) => `file '${x.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", raw]);
  await rm(dir, { recursive: true, force: true });
  job.progress = 0.9;
}

async function renderOnce(job: RenderJob): Promise<void> {
  // задача пришла сразу после перезапуска — ждём сборки бандла (до 3 минут), а не падаем
  for (let i = 0; i < 180 && !serveUrl && !bundleError; i++) await new Promise((r) => setTimeout(r, 1000));
  if (!serveUrl) throw new Error(bundleError ?? "бандл шаблонов ещё не готов");
  const { __composition, ...rest } = job.props as Record<string, unknown> & { __composition?: string };
  const compId = __composition ?? COMPOSITION_ID;
  const inputProps = { ...rest, asset_base: ASSET_BASE, show_yt_overlay: false, show_safe_area: false };
  await mkdir(job.outDir, { recursive: true });
  job.status = "rendering";
  const t0 = Date.now();
  const puppeteerInstance = await getBrowser();
  const composition = await selectComposition({ serveUrl, id: compId, inputProps, puppeteerInstance, timeoutInMilliseconds: TIMEOUT_MS });
  const raw = join(job.outDir, "raw.mp4");
  if (compId === "Cartoon" && composition.durationInFrames > CHUNK_FRAMES * 1.5) {
    await renderChunked(job, composition, inputProps, puppeteerInstance, raw);
  } else {
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      crf: 18,
      pixelFormat: "yuv420p",
      audioCodec: "aac",
      audioBitrate: "192k",
      outputLocation: raw,
      concurrency: CHROME_THREADS,
      chromiumOptions: { gl: "swangle" },
      puppeteerInstance,
      timeoutInMilliseconds: TIMEOUT_MS,
      onProgress: ({ progress }) => {
        job.progress = progress * 0.9;
      },
    });
  }
  job.status = "postprocess";
  // Громкость -14 LUFS и faststart. Видео копируется без перекодирования.
  const tmp = join(job.outDir, "video.tmp.mp4");
  // мультик уже сведён в -14 LUFS / -1 dBTP (services/api/app/pipeline/sfx.py) — повторный loudnorm в динамическом режиме сжал бы микс
  const norm = compId === "Cartoon" ? [] : ["-af", "loudnorm=I=-14:TP=-1.5:LRA=11"];
  await ffmpeg(["-i", raw, "-c:v", "copy", ...norm, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", tmp]);
  const video = join(job.outDir, "video.mp4");
  await rename(tmp, video);
  await rm(raw, { force: true });
  const cover = join(job.outDir, "cover.png");
  // обложка: у таймлайна кадр 0 часто пустой (анимации появления) — берём ~2.5 с; сбой обложки не роняет готовое видео
  const coverFrame = compId === "Timeline" ? Math.min(composition.durationInFrames - 1, Math.round(composition.fps * 2.5)) : 0;
  try {
    await renderStill({ serveUrl, composition, inputProps, frame: coverFrame, output: cover, imageFormat: "png", puppeteerInstance, timeoutInMilliseconds: 60_000 });
    job.outputs = { video, cover };
  } catch (e) {
    log("warn", "cover failed", { job: job.id, error: String(e).slice(0, 300) });
    job.outputs = { video };
  }
  if (compId === "Cartoon") {
    // контактный лист для проверки глазами: кадр каждые 15 с (ffmpeg из Remotion без tile/fps — режем по одному кадру)
    const secs = composition.durationInFrames / composition.fps;
    const dir = join(job.outDir, "contact");
    const frames: string[] = [];
    try {
      await mkdir(dir, { recursive: true });
      for (let s = 2; s < secs; s += 15) {
        const name = `${String(frames.length).padStart(3, "0")}.jpg`;
        await ffmpeg(["-y", "-ss", s.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=384:-2", "-q:v", "4", join(dir, name)]);
        frames.push(name);
      }
      await writeFile(join(dir, "index.json"), JSON.stringify({ every: 15, frames }));
    } catch (e) {
      log("warn", "contact sheet failed", { job: job.id, error: String(e).slice(0, 300) });
    }
  }
  log("info", "render done", { job: job.id, ms: Date.now() - t0, frames: composition.durationInFrames });
}

const queue = new JobQueue(CONCURRENCY, runJob);
const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.status(serveUrl ? 200 : 503).json({ ok: !!serveUrl, bundle: serveUrl ? "ready" : bundleError ? "error" : "building", error: bundleError, ...queue.stats() });
});

app.post("/render", (req, res) => {
  const { props, out_dir, composition } = req.body as { props?: Record<string, unknown>; out_dir?: string; composition?: string };
  if (!props || !out_dir) {
    res.status(400).json({ error: "нужны props и out_dir" });
    return;
  }
  try {
    const comp = composition === "Timeline" || composition === "Cartoon" || composition === "CartoonShort" ? composition : COMPOSITION_ID;
    const job = queue.add({ ...props, __composition: comp }, safeOutDir(out_dir));
    res.status(202).json({ job_id: job.id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

/** Один кадр в png (обложки YouTube): синхронно, без очереди видео — рендер кадра занимает секунды. */
const STILLS = new Set(["Thumbnail", "Timeline", "Cartoon", "CartoonShort", "CartoonThumb", "AssetSheet", COMPOSITION_ID]);
app.post("/still", async (req, res) => {
  const { props, out, composition, frame } = req.body as { props?: Record<string, unknown>; out?: string; composition?: string; frame?: number };
  if (!props || !out || !composition || !STILLS.has(composition)) {
    res.status(400).json({ error: "нужны props, out и composition (Thumbnail | Timeline | Short)" });
    return;
  }
  if (!serveUrl) {
    res.status(503).json({ error: bundleError ?? "бандл шаблонов ещё не готов" });
    return;
  }
  try {
    const output = safeOutDir(out);
    await mkdir(join(output, ".."), { recursive: true });
    const inputProps = { ...props, asset_base: ASSET_BASE };
    const puppeteerInstance = await getBrowser();
    const comp = await selectComposition({ serveUrl, id: composition, inputProps, puppeteerInstance, timeoutInMilliseconds: TIMEOUT_MS });
    await renderStill({ serveUrl, composition: comp, inputProps, frame: Math.min(comp.durationInFrames - 1, Math.max(0, frame ?? 0)), output, imageFormat: "png", puppeteerInstance, timeoutInMilliseconds: 60_000 });
    res.json({ ok: true, out });
  } catch (e) {
    log("warn", "still failed", { error: String(e).slice(0, 300) });
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

/** Видео ведущей на зелёном фоне → webm VP9 с альфа-каналом (Chromium в Remotion умеет прозрачный webm). */
app.post("/avatar/convert", async (req, res) => {
  const { src, out, color } = req.body as { src?: string; out?: string; color?: string };
  if (!src || !out) {
    res.status(400).json({ error: "нужны src и out" });
    return;
  }
  try {
    const key = /^#?[0-9a-f]{6}$/i.test(color ?? "") ? `0x${color!.replace("#", "")}` : "0x00FF00";
    await ffmpeg(["-i", safeOutDir(src), "-vf", `chromakey=${key}:0.18:0.08,despill=type=green,scale=-2:720,format=yuva420p`, "-an",
      "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "1.5M", "-auto-alt-ref", "0", safeOutDir(out)]);
    res.json({ ok: true, out });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/render/:id", (req, res) => {
  const job = queue.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "нет такой задачи" });
    return;
  }
  const rel = (p?: string) => (p ? p.slice(DATA_DIR.length) : null);
  res.json({ id: job.id, status: job.status, progress: job.progress, error: job.error, video: rel(job.outputs.video), cover: rel(job.outputs.cover) });
});

app.listen(PORT, () => log("info", "listening", { port: PORT, concurrency: CONCURRENCY }));
prepare().catch((e: unknown) => {
  bundleError = e instanceof Error ? e.message : String(e);
  log("error", "prepare failed", { error: bundleError });
});
