@echo off
chcp 65001 >nul
cd /d %~dp0
where ffmpeg >nul 2>nul || (
  echo [!] Нет ffmpeg. Поставь одной командой:  winget install Gyan.FFmpeg   и перезапусти этот файл.
  pause & exit /b
)
if not exist .venv (
  echo Первый запуск: ставлю зависимости...
  python -m venv .venv
  call .venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements.txt
  python -m italreels.setup
) else (
  call .venv\Scripts\activate.bat
)
python app.py
pause
