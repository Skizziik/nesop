import express from "express";
import { mkdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { renderMedia, renderStill, selectComposition, ensureBrowser } from "@remotion/renderer";
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

async function runJob(job: RenderJob): Promise<void> {
  if (!serveUrl) throw new Error(bundleError ?? "бандл шаблонов ещё не готов");
  const inputProps = { ...job.props, asset_base: ASSET_BASE, show_yt_overlay: false };
  await mkdir(job.outDir, { recursive: true });
  job.status = "rendering";
  const t0 = Date.now();
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  const raw = join(job.outDir, "raw.mp4");
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
    onProgress: ({ progress }) => {
      job.progress = progress * 0.9;
    },
  });
  job.status = "postprocess";
  // Громкость -14 LUFS и faststart. Видео копируется без перекодирования.
  const tmp = join(job.outDir, "video.tmp.mp4");
  await ffmpeg(["-i", raw, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", tmp]);
  const video = join(job.outDir, "video.mp4");
  await rename(tmp, video);
  await rm(raw, { force: true });
  const cover = join(job.outDir, "cover.png");
  await renderStill({ serveUrl, composition, inputProps, frame: 0, output: cover, imageFormat: "png", chromiumOptions: { gl: "swangle" } });
  job.outputs = { video, cover };
  log("info", "render done", { job: job.id, ms: Date.now() - t0, frames: composition.durationInFrames });
}

const queue = new JobQueue(CONCURRENCY, runJob);
const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.status(serveUrl ? 200 : 503).json({ ok: !!serveUrl, bundle: serveUrl ? "ready" : bundleError ? "error" : "building", error: bundleError, ...queue.stats() });
});

app.post("/render", (req, res) => {
  const { props, out_dir } = req.body as { props?: Record<string, unknown>; out_dir?: string };
  if (!props || !out_dir) {
    res.status(400).json({ error: "нужны props и out_dir" });
    return;
  }
  try {
    const job = queue.add(props, safeOutDir(out_dir));
    res.status(202).json({ job_id: job.id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
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
