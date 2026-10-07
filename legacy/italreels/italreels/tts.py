"""Локальная озвучка: Piper (по умолчанию), Kokoro, espeak-ng (тест).
Каждая фраза кешируется на диск, повторные слова не синтезируются заново."""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache" / "tts"


class TTS:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.engine = cfg.get("engine", "piper")
        self._piper = None
        self._kokoro = None
        CACHE.mkdir(parents=True, exist_ok=True)

    # ---------- public ----------
    def say(self, text: str) -> Path:
        """Вернёт путь к wav с озвученным текстом (из кеша, если уже было)."""
        key = f"{self.engine}|{self._voice_id()}|{text}".encode()
        out = CACHE / (hashlib.sha1(key).hexdigest()[:16] + ".wav")
        if out.exists() and out.stat().st_size > 1000:
            return out
        getattr(self, f"_say_{self.engine}")(text, out)
        return out

    # ---------- engines ----------
    def _voice_id(self) -> str:
        if self.engine == "piper":
            return f"{self.cfg.get('piper_voice')}@{self.cfg.get('piper_length_scale', 1.0)}"
        if self.engine == "kokoro":
            return f"{self.cfg.get('kokoro_voice')}@{self.cfg.get('kokoro_speed', 1.0)}"
        return "espeak-it"

    def _say_piper(self, text: str, out: Path):
        if self._piper is None:
            from piper import PiperVoice  # pip install piper-tts
            model = ROOT / self.cfg["piper_voice"]
            if not model.exists():
                raise FileNotFoundError(
                    f"Нет голоса Piper: {model}. Запусти setup (python -m italreels.setup)."
                )
            self._piper = PiperVoice.load(str(model))
        ls = float(self.cfg.get("piper_length_scale", 1.0))
        with wave.open(str(out), "wb") as wf:
            try:  # piper-tts >= 1.3
                from piper import SynthesisConfig
                self._piper.synthesize_wav(text, wf, syn_config=SynthesisConfig(length_scale=ls))
            except ImportError:  # старые версии
                self._piper.synthesize(text, wf, length_scale=ls)

    def _say_kokoro(self, text: str, out: Path):
        import numpy as np
        import soundfile as sf
        if self._kokoro is None:
            from kokoro import KPipeline  # pip install kokoro ; нужен espeak-ng в системе
            self._kokoro = KPipeline(lang_code="i")
        chunks = [
            audio for _, _, audio in self._kokoro(
                text, voice=self.cfg.get("kokoro_voice", "if_sara"),
                speed=float(self.cfg.get("kokoro_speed", 1.0)),
            )
        ]
        sf.write(str(out), np.concatenate(chunks), 24000)

    def _say_espeak(self, text: str, out: Path):
        exe = shutil.which("espeak-ng") or shutil.which("espeak")
        if not exe:
            raise RuntimeError("espeak-ng не установлен")
        subprocess.run([exe, "-v", "it", "-s", "140", "-w", str(out), text], check=True)
