"""CLI без интерфейса.
  python make.py                 -> следующий урок из банка
  python make.py -n 5            -> 5 следующих
  python make.py --id colori     -> конкретный урок
  python make.py --llm "verbi riflessivi" -n 3   -> сгенерировать через LLM и отрендерить
  python make.py --upload        -> ещё и залить на YouTube
"""
import argparse

from italreels.pipeline import load_bank, load_config, make_video, next_lessons, validate, done_ids
from italreels.tts import TTS

ap = argparse.ArgumentParser()
ap.add_argument("-n", type=int, default=1)
ap.add_argument("--id")
ap.add_argument("--llm", nargs="?", const="", default=None, help="тема для LLM (пусто = сама выберет)")
ap.add_argument("--upload", action="store_true")
args = ap.parse_args()

cfg = load_config()
tts = TTS(cfg["tts"])

if args.id:
    lessons = [l for l in load_bank() if l["id"] == args.id]
elif args.llm is not None:
    from italreels.llm import generate_lesson, save_generated
    lessons = []
    for _ in range(args.n):
        ids = [l["id"] for l in load_bank()] + [l["id"] for l in lessons]
        l = validate(generate_lesson(args.llm, cfg, ids))
        save_generated(l)
        lessons.append(l)
else:
    lessons = next_lessons(args.n)

if not lessons:
    print("Нечего рендерить: банк уроков закончился. Добавь уроки в lessons/ или используй --llm")

for l in lessons:
    v = make_video(l, cfg, tts)
    print("✓", v)
    if args.upload or cfg["youtube"].get("enabled"):
        from italreels.upload import upload
        print("  ↑", upload(v.parent, cfg))
