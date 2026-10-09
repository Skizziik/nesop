"""Сравнение текста фразы с тем, что распознал Whisper (проверка произношения в лекциях)."""
from app.pipeline.clients import speech_match
from app.pipeline.lecture import ASR_OK


def test_same_text_ignores_case_punctuation_accents() -> None:
    assert speech_match("Ciao a tutti! Oggi è lunedì.", "ciao a tutti oggi e lunedi") == 1.0


def test_apostrophes_split_like_whisper() -> None:
    assert speech_match("L'acqua è fresca.", "l acqua è fresca") == 1.0


def test_swallowed_words_fail() -> None:
    assert speech_match("Ho mangiato una pizza con i miei amici ieri sera.", "ho mangiato una") < ASR_OK


def test_garbage_fails() -> None:
    assert speech_match("Sono andata al mare.", "blah blah") < 0.3


def test_minor_slip_passes() -> None:
    assert speech_match("Abbiamo visto un film molto bello al cinema ieri.", "abbiamo visto un film molto bello al cinema ieri") >= ASR_OK
    assert speech_match("Abbiamo visto un film molto bello al cinema ieri.", "abbiamo visto il film molto bello al cinema ieri") >= ASR_OK


def test_empty_expected_is_ok() -> None:
    assert speech_match("", "anything") == 1.0
