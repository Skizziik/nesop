"""SFX, атмосферы, авто-звуки по сценам и сведение эпизода (чистый numpy, без БД и сети)."""
from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np
import pytest

from app.pipeline import music as mu
from app.pipeline import sfx

SR = sfx.SR


def _read(p: Path) -> np.ndarray:
    with wave.open(str(p), "rb") as r:
        assert r.getframerate() == SR and r.getnchannels() == 1
        return np.frombuffer(r.readframes(r.getnframes()), dtype="<i2").astype(np.float64) / 32767


@pytest.mark.parametrize("name", sorted({*sfx.ONESHOTS, *sfx.GENERATORS, "step:mia:1", "step:ollie:3", "nom:2"}))
def test_oneshots_safe_and_deterministic(name: str) -> None:
    x = sfx.clip(name)
    assert x.dtype == np.float32 and len(x) > 0 and np.isfinite(x).all()
    assert float(np.abs(x).max()) <= 0.95
    assert abs(float(x[0])) < 1e-3 and abs(float(x[-1])) < 1e-3
    sfx.clip.cache_clear()
    assert np.array_equal(x, sfx.clip(name))


def test_footsteps_differ_per_character() -> None:
    assert not np.array_equal(sfx.footstep("ollie", 0), sfx.footstep("mia", 0))


@pytest.mark.parametrize("name", list(sfx.AMBIENCE))
def test_ambience_loops_seamless(name: str) -> None:
    x = sfx.AMBIENCE[name]().astype(np.float64)
    assert len(x) == sfx._amb_n()
    assert len(x) / SR == pytest.approx(sfx.AMB_SECONDS, abs=0.01)
    assert float(np.abs(x).max()) <= 0.8 and abs(float(np.mean(x))) < 1e-3
    d = np.abs(np.diff(x))
    assert abs(x[0] - x[-1]) <= float(np.percentile(d, 99.9)) + 1e-6  # стык как обычный сэмпл — без щелчка
    assert np.array_equal(x, sfx.AMBIENCE[name]().astype(np.float64))


def test_ambience_mapping() -> None:
    assert ("waves", 0.5) in sfx.ambience_for({"location": "beach"})
    assert any(n == "rain" for n, _ in sfx.ambience_for({"location": "garden", "world": {"weather": "rain"}}))
    assert any(n == "crickets" for n, _ in sfx.ambience_for({"location": "forest", "time": "night"}))
    assert sfx.ambience_for({"location": "kitchen"}) == []
    assert sfx.bg_variant({"location": "bedroom"}) == "lullaby" and sfx.bg_variant({"location": "playground"}) == "playful"


def _scenes() -> list[dict]:
    story = {
        "location": "garden", "kind": "story", "start": 12.0, "duration": 12.0, "lines": [{"char": "benny", "start": 2.0, "dur": 1.5}],
        "actors": [
            {"id": "benny", "keys": [{"t": 0, "action": "walk"}, {"t": 1.5, "action": "idle"}, {"t": 4.0, "action": "jump"}, {"t": 5.0, "action": "idle"},
                                     {"t": 6.0, "fx": "hearts"}]},
            {"id": "ollie", "keys": [{"t": 0, "action": "idle"}, {"t": 7.0, "action": "eat"}, {"t": 9.0, "action": "idle"}]},
        ],
        "items": [{"uid": "ball0", "prop": "ball",
                   "keys": [{"t": 0, "at": {"kind": "hand", "char": "benny"}}, {"t": 3.0, "at": {"kind": "hand", "char": "ollie"}, "anim": "throw"}]},
                  {"uid": "apple1", "prop": "apple", "keys": [{"t": 0, "at": {"kind": "hand", "char": "ollie"}}, {"t": 7.6, "state": "bitten"}]}],
        "overlays": [{"t": 2.0, "dur": 2.2, "kind": "word", "text": "ball"}, {"t": 4.0, "dur": 5.0, "kind": "question", "text": "?"}],
    }
    return [
        {"location": "garden", "kind": "intro", "start": 0.0, "duration": 7.0},
        {"location": "garden", "kind": "bumper", "start": 7.0, "duration": 2.5},
        {"location": "garden", "kind": "title", "start": 9.5, "duration": 2.5},
        story,
        {"location": "beach", "kind": "story", "start": 24.0, "duration": 4.0, "lines": []},
        {"location": "garden_evening", "kind": "outro", "start": 28.0, "duration": 3.5, "lines": [{"char": "narrator", "start": 0.6, "dur": 2.0}]},
    ]


def test_scene_events_inferred() -> None:
    evs, beds = sfx.scene_events(_scenes())
    at = {}
    for e in evs:
        at.setdefault(e.name, []).append(round(e.t, 3))
    assert at["theme"] == [0.0]
    assert any(n.startswith("sting:story") for n in at)  # бампер
    steps = [t for n, ts in at.items() if n.startswith("step:benny") for t in ts if t < 12 + 1.5]
    assert len(steps) == int((1.5 - 0.03) // (math.pi / 8))  # шаги по фазе походки: каждые π/8 с
    assert steps[0] == pytest.approx(12 + math.pi / 8, abs=1e-3)
    assert at["boing"][0] == pytest.approx(12 + 4.12, abs=1e-3)
    assert 12 + 6.0 in at["heart"] and 12 + 2.0 in at["ding"]
    assert 12 + 4.0 in at["sting:question:0"] and at["chime"] == [pytest.approx(12 + 4.0 + 5.0 - 0.1)]
    assert 12 + 3.75 in at["pop"]  # бросок: ловля в конце полёта 0.75 с
    assert 12 + 7.6 in at["crunch"] and "nom:0" in at
    assert len(at["whoosh"]) >= 3  # переходы star / wipe / iris + бросок
    names = {b.name for b in beds}
    assert {"bg:sunny", "amb:birds", "amb:waves"} <= names
    assert not any(b.start < 9.5 for b in beds)  # под заставкой и бампером — только их музыка


def test_transition_for_matches_ts_rules() -> None:
    sc = _scenes()
    assert [sfx.transition_for(sc, i) for i in range(len(sc))] == ["cut", "star", "wipe", "fade", "wipe", "iris"]
    assert sfx.transition_for([{"kind": "story", "location": "a"}, {"kind": "story", "location": "b", "transitionIn": "bubble"}], 1) == "bubble"


def test_merge_beds_joins_neighbours() -> None:
    b = sfx.merge_beds([sfx.Bed(0, 5, "bg:sunny", 0.2, "music", 0.3), sfx.Bed(5, 5, "bg:sunny", 0.2, "music", 0.3), sfx.Bed(12, 2, "bg:sunny", 0.2, "music", 0.3)])
    assert [(x.start, x.dur) for x in b] == [(0, 10), (12, 2)]


def test_loudness_meter_calibration() -> None:
    t = np.arange(SR * 4) / SR
    assert sfx.integrated_lufs(sfx._k_block_powers(np.sin(2 * np.pi * 997 * t))) == pytest.approx(-3.01, abs=0.1)
    assert sfx.integrated_lufs([]) == -70.0


def test_master_gain_never_overshoots() -> None:
    rng = np.random.default_rng(1)
    x = rng.standard_normal(SR * 2) * 0.6
    g = sfx.master_gain(x, 0.87)
    assert float(np.abs(x * g).max()) <= 0.87 + 1e-6 and float(g.max()) <= 1.0


def _voice(dur: float, seed: int) -> np.ndarray:
    """Речеподобная заглушка: гармоники с «слоговой» огибающей."""
    t = np.arange(int(dur * SR)) / SR
    rng = np.random.default_rng(seed)
    x = sum(np.sin(2 * np.pi * 220 * k * t) / k for k in range(1, 12))
    am = np.abs(np.sin(np.pi * 4.5 * t)) * np.minimum(t / 0.03, 1) * np.minimum((dur - t) / 0.05, 1)
    return (np.asarray(x) * am * rng.uniform(0.1, 0.5) / 3).astype(np.float32)


def test_mix_cartoon_end_to_end(tmp_path: Path) -> None:
    scenes = _scenes()
    clips = [(12 + 2.0, _voice(1.5, 1)), (28 + 0.6, _voice(2.0, 2))]
    plan = mu.song_plan(5, 116, [mu.Section("intro", 2), mu.Section("chorus", 2, 4.0), mu.Section("outro", 2)])
    songs: list[dict] = []
    audio, total, stats = sfx.mix_cartoon(scenes, clips, songs, 31.5, tmp_path, "/media/x")
    assert [a["src"] for a in audio] == ["/media/x/voices.wav", "/media/x/music.wav", "/media/x/sfx.wav"]
    # прощание: сцена outro продлена под прощальную тему
    assert scenes[-1]["duration"] == pytest.approx(0.3 + mu.theme_length("goodbye") + 1.4, abs=1e-3)
    assert total == pytest.approx(28 + scenes[-1]["duration"], abs=1e-3)
    st = {n: _read(tmp_path / f"{n}.wav") for n in ("voices", "music", "sfx")}
    assert len({len(x) for x in st.values()}) == 1
    assert len(st["voices"]) / SR == pytest.approx(total + 0.5, abs=0.01)
    mix = st["voices"] + st["music"] + st["sfx"]
    assert float(np.abs(mix).max()) <= sfx.CEILING + 0.002  # ≈ −1 dBTP, без перегруза
    assert abs(float(np.mean(mix))) < 1e-3
    assert stats["mix"]["lufs"] == pytest.approx(sfx.TARGET_LUFS, abs=1.0)
    # дакинг: под репликой фон-музыка тише, чем в паузе той же сцены
    a, b = int((12 + 2.3) * SR), int((12 + 3.3) * SR)
    c, d = int((12 + 10.0) * SR), int((12 + 11.5) * SR)
    rms = lambda x: float(np.sqrt(np.mean(x**2)))  # noqa: E731
    assert rms(st["music"][a:b]) < rms(st["music"][c:d])
    # с песней тоже сводится
    songs = [{"plan": plan, "start": 24.0, "dur": plan.duration}]
    audio2, _, stats2 = sfx.mix_cartoon(_scenes(), clips, songs, 31.5, tmp_path / "s", "/media/y")
    assert stats2["mix"]["peak"] <= sfx.CEILING + 0.002
