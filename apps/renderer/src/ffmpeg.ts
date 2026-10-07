import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const COMPOSITOR: Record<string, string> = {
  "linux-x64": "@remotion/compositor-linux-x64-gnu",
  "linux-arm64": "@remotion/compositor-linux-arm64-gnu",
  "darwin-x64": "@remotion/compositor-darwin-x64",
  "darwin-arm64": "@remotion/compositor-darwin-arm64",
  "win32-x64": "@remotion/compositor-win32-x64-msvc",
};

/** ffmpeg из пакета @remotion/compositor (в нём есть avfilter → loudnorm). Fallback — ffmpeg из PATH. */
export function ffmpegBinary(): { bin: string; libDir: string | null } {
  const pkg = COMPOSITOR[`${process.platform}-${process.arch}`];
  if (pkg) {
    try {
      const fromRenderer = createRequire(createRequire(import.meta.url).resolve("@remotion/renderer"));
      const dir = dirname(fromRenderer.resolve(`${pkg}/package.json`));
      const bin = join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
      if (existsSync(bin)) return { bin, libDir: dir };
    } catch {
      /* пакет для платформы не установлен */
    }
  }
  return { bin: "ffmpeg", libDir: null };
}

export function ffmpeg(args: string[]): Promise<void> {
  const { bin, libDir } = ffmpegBinary();
  const env = { ...process.env };
  if (libDir && process.platform === "linux") env.LD_LIBRARY_PATH = [libDir, env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  return new Promise((res, rej) => {
    const p = spawn(bin, ["-hide_banner", "-loglevel", "error", "-y", ...args], { env });
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("error", (e) => rej(new Error(`ffmpeg не запустился (${bin}): ${e.message}`)));
    p.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exit ${code}: ${err.slice(-1500)}`))));
  });
}
