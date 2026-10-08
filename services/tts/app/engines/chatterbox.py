"""Chatterbox Multilingual (MIT, водяной знак Perth): клон голоса по образцу без транскрипта, language_id="it"."""
from __future__ import annotations

from typing import Any

import numpy as np

from . import time_stretch


def download() -> None:
    from huggingface_hub import snapshot_download

    snapshot_download("ResembleAI/chatterbox", allow_patterns=["ve.pt", "t3_mtl23ls_v2.safetensors", "s3gen.pt", "grapheme_mtl_merged_expanded_v1.json", "conds.pt",
                                                                "Cangjie5_TC.json", "tokenizer.json", "*.json"])


class Engine:
    def __init__(self, device: str) -> None:
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        self.torch = torch
        dev = "cuda" if device == "cuda" and torch.cuda.is_available() else "cpu"
        self.m = ChatterboxMultilingualTTS.from_pretrained(device=dev)
        self.ref: str | None = None

    def synth(self, req: dict[str, Any]) -> tuple[np.ndarray, int]:
        ref = req.get("ref_audio")
        if ref and ref != self.ref:
            self.m.prepare_conditionals(ref, exaggeration=0.5)  # кеш голоса между строками ролика
            self.ref = ref
        if req.get("seed"):
            self.torch.manual_seed(int(req["seed"]))
        wav = self.m.generate(req["text"], language_id="it", exaggeration=0.5, cfg_weight=0.4 if ref else 0.5)
        audio = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
        return time_stretch(audio, float(req.get("speed") or 1.0)), int(self.m.sr)


def load(device: str) -> Engine:
    return Engine(device)


def synth(engine: Engine, req: dict[str, Any]) -> tuple[np.ndarray, int]:
    return engine.synth(req)
