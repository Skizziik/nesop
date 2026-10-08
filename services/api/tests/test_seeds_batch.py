from __future__ import annotations

import yaml
from sqlalchemy import func, select

from app.config import get_settings
from app.formats import get_format
from app.models import Batch, HookPattern, Lesson, Series, Video, VideoStatus
from app.pipeline.produce import plan_batch, validate_script
from app.seeds import lesson_to_script, seed_all


def test_every_bank_lesson_passes_schema_and_rules() -> None:
    root = get_settings().content_dir
    series = {s["slug"]: s for s in yaml.safe_load((root / "series.yaml").read_text(encoding="utf-8"))}
    n = 0
    for f in sorted((root / "bank").glob("*.yaml")):
        sd = series[f.stem]
        for raw in yaml.safe_load(f.read_text(encoding="utf-8")):
            script = lesson_to_script(raw, sd["format"], sd.get("level", "A1"))
            errors = [i for i in validate_script(script) if i["severity"] == "error"]
            assert not errors, (raw["slug"], errors)
            get_format(sd["format"]).body_model.model_validate(script["body"])
            n += 1
    assert n >= 100


async def test_seed_idempotent(session) -> None:  # type: ignore[no-untyped-def]
    await seed_all(session)  # первый прогон мог уже случиться в другом тесте — проверяем итог, а не счётчик
    second = await seed_all(session)
    assert second["lessons"] == 0 and second["series"] == 0 and second["hooks"] == 0
    assert (await session.execute(select(func.count()).select_from(Lesson))).scalar_one() >= 200
    assert (await session.execute(select(func.count()).select_from(Series))).scalar_one() >= 17
    assert (await session.execute(select(func.count()).select_from(HookPattern).where(HookPattern.kind == "cta"))).scalar_one() >= 20


async def test_plan_batch_variety(session) -> None:  # type: ignore[no-untyped-def]
    await seed_all(session)
    ser = (await session.scalars(select(Series).where(Series.slug == "vocabolario"))).one()
    b = Batch(series_id=ser.id, requested=10, auto_approve=True)
    session.add(b)
    await session.commit()
    approved = await plan_batch(b.id)
    assert len(approved) == 10
    vids = list((await session.scalars(select(Video).where(Video.batch_id == b.id).order_by(Video.created_at).execution_options(populate_existing=True))).all())
    assert all(v.status == VideoStatus.approved for v in vids)
    palettes = [v.palette_name for v in vids]
    assert all(a != b_ for a, b_ in zip(palettes, palettes[1:], strict=False)), palettes
    hooks = [v.script["hook_text"] for v in vids]
    assert len(set(hooks)) == len(hooks), hooks
    ctas = [v.script["comment_hook"]["text"] for v in vids]
    assert len(set(ctas)) == len(ctas)
    assert len({v.lesson_id for v in vids}) == 10
    eps = [v.episode_no for v in vids]
    assert eps == sorted(eps) and len(set(eps)) == 10
    b = (await session.scalars(select(Batch).where(Batch.id == b.id).execution_options(populate_existing=True))).one()
    assert b.similarity_index is not None and b.similarity_index < 0.3
    used = (await session.execute(select(func.sum(Lesson.used_count)).where(Lesson.series_id == ser.id))).scalar_one()
    assert used >= 10
