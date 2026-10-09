"""Модели этапа 5 (лицензии проверены 2026-10-07, см. DECISIONS.md). Ставятся из UI: pip в /models/site/<id> + веса в /models/hf."""
from __future__ import annotations

from .base import PluginInfo, Voice
from .subproc import SubprocessPlugin


def _v(id: str, name: str, gender: str, note: str = "", commercial: str = "ok", license: str = "") -> Voice:
    return Voice(id=id, name=name, language="it", gender=gender, installed=False, note=note, commercial=commercial, license=license, sample_rate=24000)


class KokoroPlugin(SubprocessPlugin):
    ENGINE = "kokoro"
    torch_spec = "torch"
    info = PluginInfo(id="kokoro", name="Kokoro 82M", license="Apache-2.0", commercial="ok", languages=["it"], requires_gpu=False, vram_gb=0,
                      supports_cloning=False, supports_voice_design=False,
                      description="Маленькая модель, звучит живее Piper. Быстро на CPU. ~1 GB вместе с torch.")
    voices_static = [_v("if_sara", "Sara", "female"), _v("im_nicola", "Nicola", "male")]

    def packages(self) -> list[str]:
        return ["kokoro==0.9.4", "soundfile", "huggingface_hub"]


class Qwen3Plugin(SubprocessPlugin):
    ENGINE = "qwen3"
    cache_tag = "xv2"  # 2026-10-10: x-vector (выбор владельца), детерминированный сид, без time-stretch на ±10% — меняй при изменении синтеза
    torch_spec = "torch torchaudio"
    info = PluginInfo(id="qwen3", name="Qwen3-TTS", license="Apache-2.0", commercial="ok", languages=["it", "en"], requires_gpu=True, vram_gb=6,
                      supports_cloning=True, supports_voice_design=True,
                      description="Лучший кандидат для фирменного голоса: клон по образцу и voice design по описанию. ~8 GB загрузки.")
    voices_static = [_v(s, s, g, "не носитель итальянского, но говорит по-итальянски") for s, g in
                     [("Serena", "female"), ("Vivian", "female"), ("Ryan", "male"), ("Aiden", "male"), ("Ono_Anna", "female"), ("Sohee", "female")]]

    def packages(self) -> list[str]:
        return ["qwen-tts==0.1.1", "soundfile"]


class ChatterboxPlugin(SubprocessPlugin):
    ENGINE = "chatterbox"
    torch_spec = "torch==2.6.0 torchaudio==2.6.0"
    info = PluginInfo(id="chatterbox", name="Chatterbox Multilingual", license="MIT (в аудио водяной знак Perth)", commercial="ok", languages=["it"],
                      requires_gpu=True, vram_gb=4, supports_cloning=True, supports_voice_design=False,
                      description="Клон голоса по образцу 10 сек без транскрипта, параметр эмоциональности. ~3.2 GB весов.")
    voices_static = [_v("default", "Голос по умолчанию", "female", "без образца — стандартный голос модели")]

    def packages(self) -> list[str]:
        return ["chatterbox-tts==0.1.7"]


class PocketPlugin(SubprocessPlugin):
    ENGINE = "pocket"
    torch_spec = "torch"
    info = PluginInfo(id="pocket", name="Kyutai Pocket TTS", license="код MIT, веса CC-BY-4.0", commercial="attribution", languages=["it"],
                      requires_gpu=False, vram_gb=0, supports_cloning=False, supports_voice_design=False,
                      description="Лёгкая итальянская модель для CPU (~220 MB). Клон требует доступа к закрытому репозиторию Kyutai.")
    voices_static = [_v("giovanni", "Giovanni", "male", "единственный голос из итальянской речи", "attribution", "CC-BY-4.0"),
                     _v("anna", "Anna", "female", "", "attribution", "CC-BY-4.0"), _v("vera", "Vera", "female", "", "attribution", "CC-BY-4.0")]

    def packages(self) -> list[str]:
        return ["pocket-tts==3.3.0", "soundfile"]


HEAVY = [KokoroPlugin, Qwen3Plugin, ChatterboxPlugin, PocketPlugin]
