"""Интерфейс плагина TTS. Каждая модель = плагин; менеджер ставит/удаляет веса в /models."""
from __future__ import annotations

import abc
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

ProgressCb = Callable[[float, str], None]


@dataclass
class Voice:
    id: str
    name: str
    language: str
    gender: str
    installed: bool
    size_mb: float = 0.0
    license: str = ""
    commercial: str = "ok"  # ok | attribution | risk | no
    note: str = ""
    sample_rate: int = 22050


@dataclass
class Synthesis:
    audio: np.ndarray  # mono float32 [-1, 1]
    sample_rate: int


@dataclass
class PluginInfo:
    id: str
    name: str
    license: str
    commercial: str
    languages: list[str]
    requires_gpu: bool
    vram_gb: float
    supports_cloning: bool
    supports_voice_design: bool
    description: str
    extra: dict[str, object] = field(default_factory=dict)


class TTSPlugin(abc.ABC):
    info: PluginInfo

    def __init__(self, models_dir: Path) -> None:
        self.models_dir = models_dir / self.info.id
        self.models_dir.mkdir(parents=True, exist_ok=True)

    @abc.abstractmethod
    def is_installed(self) -> bool: ...

    @abc.abstractmethod
    def install(self, progress_cb: ProgressCb, voice_id: str | None = None) -> None:
        """Скачивает веса (по умолчанию — голос по умолчанию плагина)."""

    @abc.abstractmethod
    def uninstall(self, voice_id: str | None = None) -> None: ...

    @abc.abstractmethod
    def list_voices(self) -> list[Voice]: ...

    @abc.abstractmethod
    def synthesize(self, text: str, voice: str, speed: float = 1.0, emotion: str | None = None, ref_audio: Path | None = None) -> Synthesis: ...

    def default_voice(self) -> str | None:
        return None
