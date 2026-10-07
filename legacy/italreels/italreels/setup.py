"""Скачивает шрифт и итальянский голос Piper. Запуск: python -m italreels.setup"""
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
FILES = {
    "assets/fonts/Montserrat.ttf":
        "https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf",
    "assets/voices/it_IT-paola-medium.onnx":
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx",
    "assets/voices/it_IT-paola-medium.onnx.json":
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium.onnx.json",
    "assets/voices/it_IT-riccardo-x_low.onnx":
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx",
    "assets/voices/it_IT-riccardo-x_low.onnx.json":
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx.json",
}

for rel, url in FILES.items():
    p = ROOT / rel
    if p.exists() and p.stat().st_size > 1000:
        print("уже есть:", rel)
        continue
    p.parent.mkdir(parents=True, exist_ok=True)
    print("качаю:", rel)
    urllib.request.urlretrieve(url, p)
print("готово")
