"""Подпроцесс движка: `python -m app.runner <engine>`. Читает JSON-команды из stdin, пишет ответы в stdout (одна строка — один ответ).

Модуль движка app.engines.<engine> обязан иметь: download(), load(device), synth(model, req) -> (np.ndarray, sample_rate).
Всё, что движки печатают в stdout, перенаправляется в stderr, чтобы не ломать протокол.
"""
from __future__ import annotations

import importlib
import json
import os
import sys
import traceback
from typing import Any


def main() -> None:
    name = sys.argv[1]
    proto = sys.stdout
    sys.stdout = sys.stderr  # print() внутри библиотек не должен попадать в протокол
    eng = importlib.import_module(f"app.engines.{name}")
    device = os.environ.get("TTS_DEVICE", "cpu")
    model = None
    for line in sys.stdin:
        resp: dict[str, Any]
        try:
            req = json.loads(line)
            if req["cmd"] == "download":
                eng.download()
                resp = {"ok": True}
            elif req["cmd"] == "synth":
                if model is None:
                    model = eng.load(device)
                import soundfile as sf

                audio, sr = eng.synth(model, req)
                sf.write(req["out"], audio, sr, subtype="PCM_16")
                resp = {"ok": True, "sr": sr}
            else:
                resp = {"ok": False, "error": f"неизвестная команда {req['cmd']}"}
        except Exception as e:  # noqa: BLE001 — ошибку возвращаем менеджеру, процесс живёт
            traceback.print_exc(file=sys.stderr)
            resp = {"ok": False, "error": f"{type(e).__name__}: {e}"[:1500]}
        proto.write(json.dumps(resp) + "\n")
        proto.flush()


if __name__ == "__main__":
    main()
