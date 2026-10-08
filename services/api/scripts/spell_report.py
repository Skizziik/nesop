"""Отчёт по орфографии готовых роликов пачки (LanguageTool + Hunspell). `python -m scripts.spell_report <batch_id>`.
Пишет markdown в /data/reports/spell_<batch>.md и печатает сводку."""
from __future__ import annotations

import asyncio
import sys
from typing import Any

from sqlalchemy import select

from app.checks import hunspell_check, languagetool_check
from app.config import get_settings
from app.db import SessionLocal
from app.formats import get_format
from app.models import Video, VideoStatus


async def build(batch_id: str) -> dict[str, Any]:
    async with SessionLocal() as s:
        vids = list((await s.scalars(select(Video).where(Video.batch_id == batch_id, Video.status.in_([VideoStatus.ready, VideoStatus.published])))).all())
    rows = []
    total_err = 0
    for v in vids:
        if not v.script:
            continue
        pairs = get_format(v.format).italian_words(v.script)
        lt = await languagetool_check(pairs)
        hs = hunspell_check(pairs)
        errs = [i for i in lt + hs if i["severity"] == "error"]
        total_err += len(errs)
        rows.append({"title": v.title, "words": len(pairs), "errors": errs, "warnings": [i for i in lt + hs if i["severity"] != "error"]})
    lines = [f"# Орфография: пачка {batch_id}", "", f"Роликов: {len(rows)}, итальянских фрагментов: {sum(r['words'] for r in rows)}, ошибок: **{total_err}**", "",
             "| Ролик | Фрагментов | Ошибок | Замечания |", "|---|---|---|---|"]
    for r in rows:
        notes = "; ".join(f"{i['field']}: {i['message']}" for i in r["errors"] + r["warnings"])[:300] or "—"
        lines.append(f"| {r['title']} | {r['words']} | {len(r['errors'])} | {notes} |")
    md = "\n".join(lines) + "\n"
    out = get_settings().data_dir / "reports" / f"spell_{batch_id}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    return {"videos": len(rows), "errors": total_err, "report": "/media/reports/" + out.name, "markdown": md}


def main() -> None:
    r = asyncio.run(build(sys.argv[1]))
    print(r["markdown"])
    print(f"Отчёт: {r['report']}")


if __name__ == "__main__":
    main()
