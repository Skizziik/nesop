"""Скачивание файлов с прогрессом и атомарной заменой (частично скачанное не считается установленным)."""
from __future__ import annotations

from pathlib import Path

import httpx

from .plugins.base import ProgressCb


def download(url: str, dest: Path, progress: ProgressCb, label: str, share: tuple[float, float] = (0.0, 1.0)) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    lo, hi = share
    with httpx.stream("GET", url, follow_redirects=True, timeout=httpx.Timeout(30.0, read=120.0)) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length") or 0)
        done = 0
        with tmp.open("wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
                done += len(chunk)
                if total:
                    progress(lo + (hi - lo) * done / total, label)
    tmp.replace(dest)
    progress(hi, label)
