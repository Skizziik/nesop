#!/usr/bin/env bash
cd "$(dirname "$0")"
command -v ffmpeg >/dev/null || { echo "Нет ffmpeg: brew install ffmpeg  /  sudo apt install ffmpeg"; exit 1; }
if [ ! -d .venv ]; then
  python3 -m venv .venv && source .venv/bin/activate
  pip install --upgrade pip && pip install -r requirements.txt && python -m italreels.setup
else
  source .venv/bin/activate
fi
python app.py
