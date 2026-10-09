"""Плагины с тяжёлыми зависимостями (torch, transformers) живут в отдельном подпроцессе со своим site-packages в /models/site/<id>.

Зачем: у моделей несовместимые версии torch, а базовый образ должен оставаться лёгким. Установка из UI = pip install --target
(+ загрузка весов), без терминала. Обмен с подпроцессом — JSON-строки через stdin/stdout, аудио — через wav-файл в /data/tmp.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

from .base import ProgressCb, Synthesis, TTSPlugin, Voice

log = logging.getLogger("tts.subproc")
TORCH_CPU = "https://download.pytorch.org/whl/cpu"
TORCH_CUDA = "https://download.pytorch.org/whl/cu126"


class EngineError(RuntimeError):
    pass


class SubprocessPlugin(TTSPlugin):
    """Наследник задаёт info, ENGINE (модуль app.engines.<ENGINE>), packages(), torch_spec, voices_static."""

    ENGINE: str = ""
    torch_spec: str | None = "torch"  # None = torch не нужен
    voices_static: list[Voice] = []

    def __init__(self, models_dir: Path) -> None:
        super().__init__(models_dir)
        self.site = models_dir / "site" / self.info.id
        self.hf_home = models_dir / "hf"
        self._proc: subprocess.Popen[str] | None = None
        self._lock = threading.Lock()
        self.cuda = False  # выставляет менеджер по железу
        self._last_used = 0.0
        self._reaper: threading.Thread | None = None

    # ---------- установка ----------
    def packages(self) -> list[str]:
        raise NotImplementedError

    def _marker(self) -> Path:
        return self.site / ".installed"

    def is_installed(self) -> bool:
        return self._marker().exists()

    def _pip(self, args: list[str], progress: ProgressCb, label: str, share: tuple[float, float]) -> None:
        cmd = [sys.executable, "-m", "pip", "install", "--no-cache-dir", "--disable-pip-version-check", "--target", str(self.site), "--upgrade", *args]
        log.info("pip %s", " ".join(args))
        progress(share[0], label)
        p = subprocess.run(cmd, capture_output=True, text=True)
        if p.returncode != 0:
            raise EngineError(f"pip install не удался: {p.stderr[-1200:]}")
        progress(share[1], label)

    def install(self, progress_cb: ProgressCb, voice_id: str | None = None) -> None:
        self.site.mkdir(parents=True, exist_ok=True)
        # Одним вызовом pip: с --target второй вызов не видит уже поставленный torch и качает/ставит его заново
        # (~6 GB на HDD), да ещё другой версии, несовместимой с torchaudio. Индекс PyTorch — главный (CUDA/CPU-сборки), PyPI — для остального.
        index = TORCH_CUDA if self.cuda else TORCH_CPU
        self._pip([*(self.torch_spec.split() if self.torch_spec else []), *self.packages(), "--index-url", index, "--extra-index-url", "https://pypi.org/simple"],
                  progress_cb, "torch и пакеты модели", (0.02, 0.7))
        progress_cb(0.72, "веса модели")
        self.call({"cmd": "download"}, timeout=3600)
        self._marker().write_text("ok")
        progress_cb(1.0, "готово")

    def transcribe(self, path: Path, language: str = "it") -> str:
        resp = self.call({"cmd": "asr", "path": str(path), "language": language}, timeout=600)
        return str(resp.get("text", ""))

    def uninstall(self, voice_id: str | None = None) -> None:
        self.stop()
        import shutil

        shutil.rmtree(self.site, ignore_errors=True)

    def list_voices(self) -> list[Voice]:
        inst = self.is_installed()
        return [Voice(**{**v.__dict__, "installed": inst}) for v in self.voices_static]

    def default_voice(self) -> str | None:
        return self.voices_static[0].id if self.voices_static and self.is_installed() else None

    # ---------- подпроцесс ----------
    def _start(self) -> subprocess.Popen[str]:
        env = {**os.environ, "PYTHONPATH": f"{self.site}{os.pathsep}{Path(__file__).resolve().parents[2]}", "HF_HOME": str(self.hf_home),
               "TTS_DEVICE": "cuda" if self.cuda else "cpu", "PYTHONUNBUFFERED": "1"}
        return subprocess.Popen([sys.executable, "-m", "app.runner", self.ENGINE], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None, text=True, env=env)

    def _reap_idle(self) -> None:
        """Выгружает движок (и VRAM), если им не пользовались TTS_IDLE_UNLOAD_S секунд (по умолчанию 10 минут)."""
        limit = float(os.environ.get("TTS_IDLE_UNLOAD_S", "600"))
        while True:
            time.sleep(30)
            with self._lock:
                if self._proc is not None and self._proc.poll() is None and limit > 0 and time.time() - self._last_used > limit:
                    log.info("выгружаю простаивающий движок %s", self.info.id)
                    self.stop()

    def call(self, msg: dict[str, Any], timeout: float = 600) -> dict[str, Any]:
        with self._lock:
            self._last_used = time.time()
            if self._reaper is None:
                self._reaper = threading.Thread(target=self._reap_idle, daemon=True)
                self._reaper.start()
            if self._proc is None or self._proc.poll() is not None:
                self._proc = self._start()
            assert self._proc.stdin and self._proc.stdout
            self._proc.stdin.write(json.dumps(msg) + "\n")
            self._proc.stdin.flush()
            line = self._proc.stdout.readline()
            self._last_used = time.time()
        if not line:
            self.stop()
            raise EngineError(f"Движок {self.info.id} завершился (смотри логи tts)")
        resp: dict[str, Any] = json.loads(line)
        if not resp.get("ok"):
            raise EngineError(resp.get("error", "ошибка движка"))
        return resp

    def stop(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._proc.kill()
        self._proc = None

    def synthesize(self, text: str, voice: str, speed: float = 1.0, emotion: str | None = None, ref_audio: Path | None = None, seed: int = 0,
                   ref_text: str | None = None, design: str | None = None, language: str = "it") -> Synthesis:
        out = Path(os.environ.get("DATA_DIR", "/data")) / "tmp" / f"{uuid.uuid4().hex}.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        self.call({"cmd": "synth", "text": text, "voice": voice, "speed": speed, "seed": seed, "out": str(out),
                   "ref_audio": str(ref_audio) if ref_audio else None, "ref_text": ref_text, "design": design, "emotion": emotion, "language": language})
        audio, sr = sf.read(str(out), dtype="float32", always_2d=True)
        out.unlink(missing_ok=True)
        return Synthesis(audio=np.asarray(audio.mean(axis=1), dtype=np.float32), sample_rate=int(sr))
