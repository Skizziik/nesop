"""Субтитры для YouTube из документа таймлайна."""
from app.routers.projects import _srt


def test_srt_italian_and_english() -> None:
    doc = {"tracks": [{"kind": "subtitle", "clips": [
        {"start": 61.5, "duration": 2.25, "props": {"text": "Ciao a tutti!", "tr": "Hello everyone!"}},
        {"start": 0.6, "duration": 1.0, "props": {"text": "Today we learn.", "tr": ""}},
    ]}]}
    it, en = _srt(doc)
    assert it.startswith("1\n00:00:00,600 --> 00:00:01,600\nToday we learn.\n")
    assert "2\n00:01:01,500 --> 00:01:03,750\nCiao a tutti!\n" in it
    assert "Hello everyone!" in en and "Today we learn." in en  # английская фраза без перевода остаётся как есть


def test_srt_empty() -> None:
    assert _srt({}) == ("", "")
