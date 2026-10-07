"""Сборка ролика целиком: урок -> озвучка -> кадры -> ffmpeg -> mp4 + метаданные."""
from __future__ import annotations

import json
import random
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import yaml

from .render import Renderer
from .tts import TTS

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
STATE_FILE = ROOT / "output" / "done.json"


# ------------------------------------------------------------------ config / lessons
def load_config() -> dict:
    return yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))


def load_bank() -> list[dict]:
    lessons = []
    for p in sorted((ROOT / "lessons").glob("*.yaml")):
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or []
        lessons.extend(data)
    return lessons


def validate(lesson: dict) -> dict:
    if not lesson.get("title"):
        raise ValueError("У урока нет title")
    items = lesson.get("items") or []
    if not 3 <= len(items) <= 14:
        raise ValueError("Нужно от 3 до 14 строк в items")
    lesson["items"] = [[str(a).strip(), str(b).strip()] for a, b in items]
    lesson.setdefault("left_style", "dark")
    lesson.setdefault("speak", "right")
    lesson.setdefault("hide", "right")
    lesson.setdefault("id", slug(lesson["title"]))
    return lesson


def slug(s: str) -> str:
    s = re.sub(r"[^\w]+", "-", s.lower(), flags=re.U).strip("-")
    return s[:50] or "lesson"


def done_ids() -> set[str]:
    if STATE_FILE.exists():
        return set(json.loads(STATE_FILE.read_text(encoding="utf-8")))
    return set()


def mark_done(lesson_id: str):
    ids = done_ids() | {lesson_id}
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(sorted(ids), ensure_ascii=False, indent=1), encoding="utf-8")


def next_lessons(k: int) -> list[dict]:
    used = done_ids()
    return [l for l in load_bank() if l["id"] not in used][:k]


# ------------------------------------------------------------------ audio
def _load_wav(path: Path) -> np.ndarray:
    """Любой wav -> mono float32 44.1k (через ffmpeg, чтобы не тащить resampler)."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        check=True, capture_output=True,
    ).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    # срезаем тишину по краям, чтобы тайминг был плотный
    thr = 0.01 * (np.abs(a).max() or 1)
    nz = np.where(np.abs(a) > thr)[0]
    if len(nz):
        a = a[max(nz[0] - int(0.03 * SR), 0): nz[-1] + int(0.06 * SR)]
    return a


def _join(left: str, right: str) -> str:
    return f"{left}{right}" if left.endswith("'") else f"{left} {right}"


def speech_plan(lesson: dict, acfg: dict) -> list[str | None]:
    """Текст для каждого состояния: [title, item1, ..., itemN]."""
    items, speak, hide = lesson["items"], lesson["speak"], lesson["hide"]
    plan: list[str | None] = [lesson["title"] if acfg.get("speak_title", True) else None]
    for i, (l, r) in enumerate(items):
        last = i == len(items) - 1
        if not last:
            plan.append(_join(l, r) if speak == "both" else r)
        else:
            visible = ""
            if speak == "both":
                visible = l if hide == "right" else r
            hook = acfg.get("hook_phrase", "")
            plan.append(", ".join(x for x in [visible, hook] if x) or None)
    return plan


def build_timeline(lesson, cfg, tts: TTS) -> tuple[np.ndarray, list[float]]:
    t, a = cfg["timing"], cfg["audio"]
    plan = speech_plan(lesson, a)
    chunks = [np.zeros(int(t["lead_in"] * SR), np.float32)]
    durs = []
    for idx, text in enumerate(plan):
        clip = _load_wav(tts.say(text)) if text else np.zeros(0, np.float32)
        is_last = idx == len(plan) - 1
        if idx == 0:
            pad = t["gap_after_title"]
            min_len = 0.6
        elif is_last:
            pad = t["end_hold"]
            min_len = t["min_item"]
        else:
            pad = t["gap_between_items"]
            min_len = t["min_item"]
        seg = max(len(clip) / SR + pad, min_len)
        seg_samples = int(seg * SR)
        buf = np.zeros(seg_samples, np.float32)
        buf[: len(clip)] = clip[:seg_samples]
        chunks.append(buf)
        durs.append(seg)
    durs[0] += t["lead_in"]
    audio = np.concatenate(chunks)
    peak = np.abs(audio).max() or 1
    return (audio / peak * 0.89).astype(np.float32), durs


# ------------------------------------------------------------------ video
def _ffmpeg_concat_list(frames: list[Path], durs: list[float], path: Path):
    lines = []
    for f, d in zip(frames, durs):
        lines += [f"file '{f.as_posix()}'", f"duration {d:.3f}"]
    lines.append(f"file '{frames[len(durs) - 1].as_posix()}'")  # особенность concat demuxer
    path.write_text("\n".join(lines), encoding="utf-8")


def assemble(frames, durs, wav: Path, out: Path, cfg: dict):
    v, av, au = cfg["video"], cfg["avatar"], cfg["audio"]
    total = sum(durs)
    tmp = out.parent
    lst = tmp / "frames.txt"
    _ffmpeg_concat_list(frames, durs, lst)

    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(wav)]
    fc = [f"[0:v]fps={v['fps']},format=rgba[base]"]
    last_v = "base"
    idx = 2

    apath = ROOT / av.get("path", "")
    if av.get("mode", "none") != "none" and apath.is_file():
        if apath.suffix.lower() == ".png":
            cmd += ["-loop", "1", "-i", str(apath)]
        else:
            if apath.suffix.lower() == ".webm":
                cmd += ["-c:v", "libvpx-vp9"]  # чтобы прочитать альфа-канал
            cmd += ["-stream_loop", "-1", "-i", str(apath)]
        chain = f"[{idx}:v]scale=-2:{av['height']},format=rgba"
        if av["mode"] == "chromakey":
            chain += f",colorkey={av.get('chroma_color', '0x00FF00')}:0.30:0.08,despill=type=green"
        fc.append(chain + "[av]")
        fc.append(
            f"[base][av]overlay=x=W-w-{av.get('margin_right', 0)}:y=H-h-{av.get('margin_bottom', 0)}"
            f":shortest=0[withav]"
        )
        last_v = "withav"
        idx += 1
    fc.append(f"[{last_v}]format=yuv420p[vout]")

    music = sorted((ROOT / "assets" / "music").glob("*.mp3")) + sorted((ROOT / "assets" / "music").glob("*.wav"))
    fc.append("[1:a]apad[voice]")
    a_chain = "[voice]"
    if music:
        cmd += ["-stream_loop", "-1", "-i", str(random.choice(music))]
        fc.append(f"[{idx}:a]volume={au.get('music_volume', 0.1)}[mus]")
        fc.append("[voice][mus]amix=inputs=2:duration=first:normalize=0[amix]")
        a_chain = "[amix]"
    if au.get("loudnorm", True):
        fc.append(f"{a_chain}loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    else:
        fc.append(f"{a_chain}anull[aout]")

    cmd += [
        "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
        "-t", f"{total:.3f}", "-r", str(v["fps"]),
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), "-movflags", "+faststart", str(out),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg упал:\n" + r.stderr[-2000:])


# ------------------------------------------------------------------ metadata
def metadata(lesson: dict, cfg: dict) -> dict:
    l, r = lesson["items"][-1]
    answer = l if lesson["hide"] == "left" else r
    title = f"{lesson['title']} 🇮🇹 #shorts"
    desc = (
        f"{lesson['title']}: impara l'italiano in 30 secondi!\n"
        f"Qual è la risposta? Scrivila nei commenti 👇\n\n"
        "#italiano #imparareitaliano #learnitalian #italianlesson #shorts"
    )
    tags = list(cfg["youtube"].get("base_tags", [])) + [lesson["title"]]
    return {"title": title[:100], "description": desc, "tags": tags, "answer": answer,
            "pinned_comment": f"Risposta: {answer.upper()} ✅"}


# ------------------------------------------------------------------ main entry
def make_video(lesson: dict, cfg: dict | None = None, tts: TTS | None = None, seed: int | None = None) -> Path:
    cfg = cfg or load_config()
    lesson = validate(dict(lesson))
    tts = tts or TTS(cfg["tts"])
    stamp = time.strftime("%Y%m%d-%H%M%S")
    out_dir = ROOT / "output" / f"{stamp}_{lesson['id']}"
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(dir=ROOT / "cache") as td:
        td = Path(td)
        audio, durs = build_timeline(lesson, cfg, tts)
        wav = td / "voice.wav"
        sf.write(str(wav), audio, SR)
        vcfg = dict(cfg["video"])
        av = cfg["avatar"]
        vcfg["_has_avatar"] = av.get("mode", "none") != "none" and (ROOT / av.get("path", "")).is_file()
        if vcfg["_has_avatar"]:
            vcfg["center_x"] = vcfg.get("center_x_with_avatar", vcfg["center_x"])
        frames = Renderer(vcfg, seed=seed).render_states(lesson, td / "frames")
        if cfg["video"].get("reveal_answer"):
            durs = durs + [1.5]
        frames = frames[: len(durs)]
        video = out_dir / "video.mp4"
        assemble(frames, durs, wav, video, cfg)
        shutil.copy(frames[-1], out_dir / "thumb.png")

    meta = metadata(lesson, cfg)
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "lesson.yaml").write_text(yaml.safe_dump(lesson, allow_unicode=True, sort_keys=False), encoding="utf-8")
    mark_done(lesson["id"])
    return video
