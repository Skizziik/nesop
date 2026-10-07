from pathlib import Path

import numpy as np

from app.manager import Manager, cache_key
from app.plugins.base import PluginInfo, Synthesis, TTSPlugin, Voice


class FakePlugin(TTSPlugin):
    info = PluginInfo(id="fake", name="Fake", license="MIT", commercial="ok", languages=["it"], requires_gpu=True, vram_gb=6,
                      supports_cloning=False, supports_voice_design=False, description="")
    calls = 0

    def is_installed(self) -> bool:
        return True

    def install(self, progress_cb, voice_id=None) -> None:  # type: ignore[no-untyped-def]
        progress_cb(1.0, "ok")

    def uninstall(self, voice_id=None) -> None:  # type: ignore[no-untyped-def]
        pass

    def list_voices(self) -> list[Voice]:
        return [Voice(id="v", name="V", language="it", gender="female", installed=True)]

    def default_voice(self) -> str | None:
        return "v"

    def synthesize(self, text, voice, speed=1.0, emotion=None, ref_audio=None, seed=0) -> Synthesis:  # type: ignore[no-untyped-def]
        FakePlugin.calls += 1
        t = np.linspace(0, 0.5, 12000, endpoint=False)
        return Synthesis(audio=(0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32), sample_rate=24000)


def test_cache_key_stable_and_distinct() -> None:
    assert cache_key("piper", "a", 1.0, "ciao") == cache_key("piper", "a", 1.0, "ciao")
    assert cache_key("piper", "a", 1.0, "ciao") != cache_key("piper", "a", 0.9, "ciao")
    assert cache_key("piper", "a", 1.0, "ciao", 1) != cache_key("piper", "a", 1.0, "ciao")


def test_synthesize_caches(tmp_path: Path) -> None:
    m = Manager(tmp_path / "models", tmp_path / "data")
    m.plugins["fake"] = FakePlugin(tmp_path / "models")
    a = m.synthesize("fake", None, "ciao", 1.0)
    b = m.synthesize("fake", None, "ciao", 1.0)
    assert a["path"] == b["path"] and str(a["path"]).startswith("/tts-cache/")
    assert a["cached"] is False and b["cached"] is True
    assert FakePlugin.calls == 1
    assert abs(float(a["duration"]) - 0.5) < 0.01  # type: ignore[arg-type]


def test_hardware_gate(tmp_path: Path) -> None:
    m = Manager(tmp_path / "models", tmp_path / "data")
    m.plugins["fake"] = FakePlugin(tmp_path / "models")
    m.hardware.cuda, m.hardware.vram_gb = False, 0.0
    fake = next(d for d in m.describe() if d["id"] == "fake")
    assert fake["fits_hardware"] is False and "GPU" in str(fake["unfit_reason"])
    piper = next(d for d in m.describe() if d["id"] == "piper")
    assert piper["fits_hardware"] is True
