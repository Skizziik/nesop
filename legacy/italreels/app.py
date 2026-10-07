"""Веб-интерфейс «одна кнопка». Запуск: python app.py -> откроется http://127.0.0.1:7860"""
import json
import traceback
from pathlib import Path

import gradio as gr
import yaml

from italreels.pipeline import (ROOT, STATE_FILE, done_ids, load_bank, load_config, make_video,
                                next_lessons, validate)
from italreels.render import Renderer
from italreels.tts import TTS

EXAMPLE = """title: "Bere: presente"
left_style: dark      # badge = бордовые плашки для цифр, dark = чёрные
speak: both           # right = читать только правое, both = «io bevo»
hide: right           # что спрятать в последней строке: right / left
items:
  - [io, bevo]
  - [tu, bevi]
  - [lui/lei, beve]
  - [noi, beviamo]
  - [voi, bevete]
  - [loro, bevono]
"""

_tts = {}


def tts_for(cfg):
    key = json.dumps(cfg["tts"], sort_keys=True)
    if key not in _tts:
        _tts[key] = TTS(cfg["tts"])
    return _tts[key]


def _upload(video, cfg, log):
    from italreels.upload import upload
    url = upload(video.parent, cfg)
    log.append(f"   ↑ залито: {url}")


def run_batch(n, source, topic, do_upload):
    cfg = load_config()
    log, videos = [], []
    try:
        if source == "Банк уроков":
            lessons = next_lessons(int(n))
            if not lessons:
                yield "Банк закончился: переключись на «LLM придумает» или добавь уроки в lessons/", None, None
                return
        else:
            from italreels.llm import generate_lesson, save_generated
            lessons = []
            for i in range(int(n)):
                log.append(f"🧠 LLM придумывает урок {i + 1}/{int(n)}...")
                yield "\n".join(log), None, videos or None
                ids = [l["id"] for l in load_bank()] + [l["id"] for l in lessons]
                l = validate(generate_lesson(topic, cfg, ids))
                save_generated(l)
                lessons.append(l)
                log.append(f"   ✓ «{l['title']}»: " + ", ".join(r for _, r in l["items"]))

        for i, lesson in enumerate(lessons, 1):
            log.append(f"🎬 [{i}/{len(lessons)}] {lesson['title']}: озвучка + монтаж...")
            yield "\n".join(log), None, videos or None
            v = make_video(lesson, cfg, tts_for(cfg))
            videos.append(str(v))
            log.append(f"   ✓ {v.parent.name}")
            if do_upload:
                _upload(v, cfg, log)
            yield "\n".join(log), str(v), videos
        log.append("\nГотово 🎉  Всё лежит в папке output/")
        yield "\n".join(log), videos[-1] if videos else None, videos or None
    except Exception as e:
        log.append(f"\n❌ {e}\n{traceback.format_exc(limit=3)}")
        yield "\n".join(log), videos[-1] if videos else None, videos or None


def preview(text):
    try:
        cfg = load_config()
        lesson = validate(yaml.safe_load(text))
        frames = Renderer(cfg["video"]).render_states(lesson, ROOT / "cache" / "preview")
        return str(frames[min(2, len(frames) - 1)]), ""
    except Exception as e:
        return None, f"❌ {e}"


def custom_video(text, do_upload):
    cfg = load_config()
    try:
        lesson = validate(yaml.safe_load(text))
        v = make_video(lesson, cfg, tts_for(cfg))
        log = [f"✓ {v}"]
        if do_upload:
            _upload(v, cfg, log)
        return str(v), "\n".join(log)
    except Exception as e:
        return None, f"❌ {e}"


def bank_table():
    used = done_ids()
    rows = [[("✅" if l["id"] in used else "⏳"), l["id"], l["title"], len(l["items"])] for l in load_bank()]
    left = sum(1 for r in rows if r[0] == "⏳")
    return rows, f"Осталось несделанных: **{left}** из {len(rows)}"


def reset_progress():
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    return bank_table()


with gr.Blocks(title="ItalianoPerTe Reels Factory") as demo:
    gr.Markdown("# 🇮🇹 ItalianoPerTe: фабрика шортсов")
    with gr.Tab("🎬 Одна кнопка"):
        with gr.Row():
            with gr.Column(scale=1):
                n = gr.Slider(1, 20, value=3, step=1, label="Сколько роликов")
                source = gr.Radio(["Банк уроков", "LLM придумает"], value="Банк уроков", label="Откуда брать уроки")
                topic = gr.Textbox(label="Тема для LLM (можно пусто)", placeholder="например: verbi riflessivi, frutta, al ristorante")
                up = gr.Checkbox(label="Сразу залить на YouTube", value=False)
                go = gr.Button("🚀 СДЕЛАТЬ", variant="primary", size="lg")
                log = gr.Textbox(label="Лог", lines=14)
            with gr.Column(scale=1):
                last = gr.Video(label="Последний ролик", height=640)
                files = gr.Files(label="Все ролики этого запуска")
        go.click(run_batch, [n, source, topic, up], [log, last, files])

    with gr.Tab("✍️ Свой урок"):
        with gr.Row():
            with gr.Column():
                text = gr.Code(EXAMPLE, language="yaml", label="Урок (YAML)", lines=18)
                with gr.Row():
                    pv = gr.Button("👀 Превью кадра")
                    mk = gr.Button("🎬 Сделать ролик", variant="primary")
                up2 = gr.Checkbox(label="Сразу залить на YouTube", value=False)
                msg = gr.Textbox(label="Статус")
            with gr.Column():
                img = gr.Image(label="Кадр", height=640)
                vid = gr.Video(label="Ролик", height=640)
        pv.click(preview, text, [img, msg])
        mk.click(custom_video, [text, up2], [vid, msg])

    with gr.Tab("📚 Банк уроков"):
        info = gr.Markdown()
        table = gr.Dataframe(headers=["", "id", "Заголовок", "Строк"], interactive=False)
        with gr.Row():
            gr.Button("🔄 Обновить").click(bank_table, None, [table, info])
            gr.Button("♻️ Сбросить прогресс (сделать всё заново)").click(reset_progress, None, [table, info])
        demo.load(bank_table, None, [table, info])

if __name__ == "__main__":
    demo.queue().launch(inbrowser=True, allowed_paths=[str(ROOT / "output"), str(ROOT / "cache")])
