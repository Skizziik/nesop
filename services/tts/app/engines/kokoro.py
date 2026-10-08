"""Kokoro-82M (Apache-2.0): итальянские голоса if_sara / im_nicola, 24 kHz, быстрый на CPU."""
from __future__ import annotations

from typing import Any

import numpy as np

REPO = "hexgrad/Kokoro-82M"


def download() -> None:
    from huggingface_hub import hf_hub_download, snapshot_download

    snapshot_download(REPO, allow_patterns=["config.json", "kokoro-v1_0.pth", "voices/if_sara.pt", "voices/im_nicola.pt"])
    hf_hub_download(REPO, "config.json")


def load(device: str) -> Any:
    from kokoro import KPipeline

    return KPipeline(lang_code="i", repo_id=REPO, device=device)


def synth(pipe: Any, req: dict[str, Any]) -> tuple[np.ndarray, int]:
    voice = req.get("voice") or "if_sara"
    chunks = [r.audio.numpy() for r in pipe(req["text"], voice=voice, speed=float(req.get("speed") or 1.0), split_pattern=r"\n+") if r.audio is not None]
    if not chunks:
        raise RuntimeError("Kokoro вернул пустое аудио")
    return np.concatenate(chunks).astype(np.float32), 24000
