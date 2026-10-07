"""Piper (OHF-Voice/piper1-gpl): CPU, мгновенно. Базовый fallback, голос serena ставится автоматически."""
from __future__ import annotations

import io
import threading
import wave
from pathlib import Path

import numpy as np

from ..download import download
from .base import PluginInfo, ProgressCb, Synthesis, TTSPlugin, Voice

HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT"

# Лицензии проверены 2026-10-07, см. DECISIONS.md
CATALOG: dict[str, dict[str, object]] = {
    "it_IT-serena-medium": {
        "name": "Serena (medium)", "gender": "female", "size_mb": 63.5, "sr": 22050,
        "license": "CC-BY-4.0", "commercial": "attribution",
        "note": "Датасет синтезирован Qwen3-TTS, нужна атрибуция. Рекомендуемый CPU-голос.",
    },
    "it_IT-serena-high": {
        "name": "Serena (high)", "gender": "female", "size_mb": 114.2, "sr": 22050,
        "license": "CC-BY-4.0", "commercial": "attribution", "note": "Качественнее, медленнее.",
    },
    "it_IT-paola-medium": {
        "name": "Paola (medium)", "gender": "female", "size_mb": 63.2, "sr": 22050,
        "license": "CC0 датасет, fine-tune с lessac (research-only)", "commercial": "risk",
        "note": "Голос старого прототипа. Базовая модель lessac запрещает коммерческое использование.",
    },
    "it_IT-riccardo-x_low": {
        "name": "Riccardo (x_low)", "gender": "male", "size_mb": 28.0, "sr": 16000,
        "license": "M-AILABS (LibriVox), не подтверждена", "commercial": "risk",
        "note": "Мужской, низкое качество 16 kHz.",
    },
}
DEFAULT_VOICE = "it_IT-serena-medium"


def _url(voice_id: str, ext: str) -> str:
    _, name, quality = voice_id.split("-", 2)
    return f"{HF}/{name}/{quality}/{voice_id}.{ext}"


class PiperPlugin(TTSPlugin):
    info = PluginInfo(
        id="piper",
        name="Piper",
        license="GPL-3.0 (код), голоса — см. каждый голос",
        commercial="attribution",
        languages=["it"],
        requires_gpu=False,
        vram_gb=0,
        supports_cloning=False,
        supports_voice_design=False,
        description="Мгновенный CPU-синтез. Качество среднее, зато работает везде.",
    )

    def __init__(self, models_dir: Path) -> None:
        super().__init__(models_dir)
        self._loaded: dict[str, object] = {}
        self._lock = threading.Lock()

    def _path(self, voice_id: str) -> Path:
        return self.models_dir / f"{voice_id}.onnx"

    def _voice_installed(self, voice_id: str) -> bool:
        p = self._path(voice_id)
        return p.exists() and p.with_suffix(".onnx.json").exists()

    def is_installed(self) -> bool:
        return any(self._voice_installed(v) for v in CATALOG)

    def default_voice(self) -> str | None:
        if self._voice_installed(DEFAULT_VOICE):
            return DEFAULT_VOICE
        return next((v for v in CATALOG if self._voice_installed(v)), None)

    def install(self, progress_cb: ProgressCb, voice_id: str | None = None) -> None:
        vid = voice_id or DEFAULT_VOICE
        if vid not in CATALOG:
            raise ValueError(f"Неизвестный голос Piper: {vid}")
        download(_url(vid, "onnx.json"), self._path(vid).with_suffix(".onnx.json"), progress_cb, vid, (0.0, 0.02))
        download(_url(vid, "onnx"), self._path(vid), progress_cb, vid, (0.02, 1.0))

    def uninstall(self, voice_id: str | None = None) -> None:
        targets = [voice_id] if voice_id else list(CATALOG)
        for vid in targets:
            self._loaded.pop(vid, None)
            for p in (self._path(vid), self._path(vid).with_suffix(".onnx.json")):
                p.unlink(missing_ok=True)

    def list_voices(self) -> list[Voice]:
        return [
            Voice(
                id=vid, name=str(m["name"]), language="it", gender=str(m["gender"]),
                installed=self._voice_installed(vid), size_mb=float(m["size_mb"]),  # type: ignore[arg-type]
                license=str(m["license"]), commercial=str(m["commercial"]), note=str(m["note"]),
                sample_rate=int(m["sr"]),  # type: ignore[call-overload]
            )
            for vid, m in CATALOG.items()
        ]

    def _voice(self, voice_id: str):  # type: ignore[no-untyped-def]
        from piper import PiperVoice

        with self._lock:
            if voice_id not in self._loaded:
                if not self._voice_installed(voice_id):
                    raise FileNotFoundError(f"Голос {voice_id} не установлен")
                self._loaded[voice_id] = PiperVoice.load(str(self._path(voice_id)))
            return self._loaded[voice_id]

    def synthesize(self, text: str, voice: str, speed: float = 1.0, emotion: str | None = None, ref_audio: Path | None = None, seed: int = 0,
                   ref_text: str | None = None, design: str | None = None) -> Synthesis:
        from piper import SynthesisConfig

        pv = self._voice(voice)
        # дубль: слегка другой шум VITS → другая интонация при том же тексте
        cfg = SynthesisConfig(length_scale=1.0 / max(speed, 0.3), noise_scale=0.667 + 0.06 * ((seed % 5) - 2) if seed else None)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            pv.synthesize_wav(text, wf, syn_config=cfg)  # type: ignore[attr-defined]
        buf.seek(0)
        with wave.open(buf, "rb") as rf:
            sr = rf.getframerate()
            pcm = np.frombuffer(rf.readframes(rf.getnframes()), dtype=np.int16)
        return Synthesis(audio=(pcm.astype(np.float32) / 32768.0), sample_rate=sr)
