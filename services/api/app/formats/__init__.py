from __future__ import annotations

from .base import FormatSpec
from .list_mystery import ListMystery

FORMATS: dict[str, FormatSpec] = {f.id: f for f in [ListMystery()]}


def get_format(fid: str) -> FormatSpec:
    if fid not in FORMATS:
        raise KeyError(f"Формат {fid} пока не реализован")
    return FORMATS[fid]
