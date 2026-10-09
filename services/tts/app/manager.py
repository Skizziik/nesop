"""Менеджер моделей: реестр плагинов, фоновые установки с прогрессом, кеш синтеза, определение железа."""
from __future__ import annotations

import hashlib
import logging
import shutil
import subprocess
import threading
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

from .plugins.base import TTSPlugin
from .plugins.heavy import HEAVY
from .plugins.piper_plugin import PiperPlugin
from .plugins.subproc import SubprocessPlugin

log = logging.getLogger("tts.manager")


@dataclass
class InstallState:
    key: str
    status: str  # downloading | done | error
    progress: float
    message: str = ""


@dataclass
class Hardware:
    cuda: bool
    gpu_name: str | None
    vram_gb: float


def detect_hardware() -> Hardware:
    exe = shutil.which("nvidia-smi")
    if not exe:
        return Hardware(cuda=False, gpu_name=None, vram_gb=0.0)
    try:
        out = subprocess.run([exe, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10, check=True).stdout
        name, mem = out.strip().splitlines()[0].split(",")
        return Hardware(cuda=True, gpu_name=name.strip(), vram_gb=round(float(mem) / 1024, 1))
    except (subprocess.SubprocessError, ValueError, IndexError):
        return Hardware(cuda=False, gpu_name=None, vram_gb=0.0)


def cache_key(model: str, voice: str, speed: float, text: str, variant: int = 0, extra: str = "") -> str:
    """variant > 0 — другой дубль той же фразы («перегенерировать строку»); extra — профиль клона/дизайна."""
    base = f"{model}|{voice}|{speed:.3f}|{text}" + (f"|{extra}" if extra else "")
    return hashlib.sha1((base if variant == 0 else f"{base}|v{variant}").encode()).hexdigest()


class Manager:
    def __init__(self, models_dir: Path, data_dir: Path) -> None:
        self.models_dir = models_dir
        self.cache_dir = data_dir / "tts-cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir = data_dir
        self.plugins: dict[str, TTSPlugin] = {p.info.id: p for p in [PiperPlugin(models_dir), *(cls(models_dir) for cls in HEAVY)]}
        self.installs: dict[str, InstallState] = {}
        self.hardware = detect_hardware()
        for p in self.plugins.values():
            if isinstance(p, SubprocessPlugin):
                p.cuda = self.hardware.cuda
        self._lock = threading.Lock()

    def plugin(self, pid: str) -> TTSPlugin:
        if pid not in self.plugins:
            raise KeyError(f"Нет модели {pid}")
        return self.plugins[pid]

    # ---------- установка ----------
    def start_install(self, pid: str, voice: str | None = None) -> InstallState:
        plugin = self.plugin(pid)
        key = f"{pid}:{voice or 'default'}"
        with self._lock:
            cur = self.installs.get(key)
            if cur and cur.status == "downloading":
                return cur
            state = InstallState(key=key, status="downloading", progress=0.0)
            self.installs[key] = state

        def cb(p: float, msg: str) -> None:
            state.progress = round(p, 4)
            state.message = msg

        def run() -> None:
            try:
                plugin.install(cb, voice)
                state.status, state.progress = "done", 1.0
                log.info("installed", extra={"key": key})
            except Exception as e:  # noqa: BLE001 — показываем любую ошибку в UI
                state.status, state.message = "error", str(e)
                log.exception("install failed")

        threading.Thread(target=run, daemon=True, name=f"install-{key}").start()
        return state

    def ensure_default(self) -> None:
        """Piper + голос по умолчанию ставятся автоматически: CPU-профиль обязан работать без кликов."""
        piper = self.plugins["piper"]
        if not piper.is_installed():
            self.start_install("piper")

    # ---------- распознавание (проверка произношения) ----------
    def transcribe(self, path: str, language: str = "it") -> str:
        plugin = self.plugin("qwen3")
        if not plugin.is_installed() or not hasattr(plugin, "transcribe"):
            raise FileNotFoundError("Проверка произношения работает через движок Qwen3 — установи его на странице «Голоса»")
        full = self.data_dir / path.lstrip("/")
        if not full.exists():
            raise FileNotFoundError(f"Нет файла {path}")
        return str(plugin.transcribe(full, language))

    # ---------- синтез ----------
    def synthesize(self, model: str, voice: str | None, text: str, speed: float = 1.0, variant: int = 0,
                   ref_audio: str | None = None, ref_text: str | None = None, design: str | None = None, language: str = "it") -> dict[str, object]:
        plugin = self.plugin(model)
        vid = voice or plugin.default_voice()
        if not vid:
            raise FileNotFoundError(f"У модели {model} нет установленных голосов")
        ref = self.data_dir / ref_audio.lstrip("/") if ref_audio else None
        if ref is not None and not ref.exists():
            raise FileNotFoundError(f"Нет референса {ref_audio}")
        extra = f"{ref_audio}:{ref.stat().st_mtime_ns}|{ref_text}" if ref else (f"design:{design}" if design else "")
        if language != "it":
            extra += f"|lang:{language}"
        key = cache_key(model, vid, speed, text, variant, extra)
        path = self.cache_dir / f"{key}.wav"
        cached = path.exists()
        if not cached:
            res = plugin.synthesize(text, vid, speed=speed, seed=variant, ref_audio=ref, ref_text=ref_text, design=design, language=language)
            tmp = path.with_suffix(".tmp.wav")
            sf.write(str(tmp), np.clip(res.audio, -1, 1), res.sample_rate, subtype="PCM_16")
            tmp.replace(path)
        info = sf.info(str(path))
        return {
            "path": "/" + str(path.relative_to(self.data_dir)).replace("\\", "/"),
            "duration": round(info.frames / info.samplerate, 4),
            "sample_rate": info.samplerate,
            "cached": cached,
            "model": model,
            "voice": vid,
            "key": key,
        }

    # ---------- описание ----------
    def describe(self) -> list[dict[str, object]]:
        out = []
        for pid, p in self.plugins.items():
            fits = (not p.info.requires_gpu) or (self.hardware.cuda and self.hardware.vram_gb >= p.info.vram_gb)
            reason = None if fits else ("Нужна NVIDIA GPU" if not self.hardware.cuda else f"Нужно {p.info.vram_gb} GB VRAM, есть {self.hardware.vram_gb}")
            installs = {k: asdict(v) for k, v in self.installs.items() if k.startswith(pid + ":")}
            out.append({
                **asdict(p.info),
                "installed": p.is_installed(),
                "default_voice": p.default_voice(),
                "voices": [asdict(v) for v in p.list_voices()],
                "fits_hardware": fits,
                "unfit_reason": reason,
                "installs": installs,
            })
        return out
