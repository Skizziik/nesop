"""Заливка на YouTube через официальный Data API v3.
Первый запуск откроет браузер для входа в Google-аккаунт канала, дальше токен хранится в token.json.
Лимит API по умолчанию: ~6 загрузок в сутки (10 000 юнитов, загрузка стоит 1 600)."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TOKEN = ROOT / "token.json"
SCHEDULE_FILE = ROOT / "output" / "last_publish.txt"


def _service(cfg: dict):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES) if TOKEN.exists() else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            secrets = ROOT / cfg["youtube"]["client_secrets"]
            if not secrets.exists():
                raise FileNotFoundError(f"Нет {secrets}: скачай OAuth client (Desktop app) из Google Cloud Console")
            creds = InstalledAppFlow.from_client_secrets_file(str(secrets), SCOPES).run_local_server(port=0)
        TOKEN.write_text(creds.to_json(), encoding="utf-8")
    return build("youtube", "v3", credentials=creds)


def _next_publish_at(hours: float) -> str | None:
    if not hours:
        return None
    now = dt.datetime.now(dt.timezone.utc)
    last = None
    if SCHEDULE_FILE.exists():
        last = dt.datetime.fromisoformat(SCHEDULE_FILE.read_text().strip())
    t = max(now + dt.timedelta(minutes=30), (last + dt.timedelta(hours=hours)) if last else now + dt.timedelta(hours=1))
    SCHEDULE_FILE.write_text(t.isoformat())
    return t.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def upload(video_dir: Path, cfg: dict) -> str:
    from googleapiclient.http import MediaFileUpload

    yt = _service(cfg)
    meta = json.loads((video_dir / "meta.json").read_text(encoding="utf-8"))
    ycfg = cfg["youtube"]
    publish_at = _next_publish_at(float(ycfg.get("schedule_every_hours", 0)))
    status = {"privacyStatus": "private" if publish_at else ycfg.get("privacy", "private"),
              "selfDeclaredMadeForKids": False}
    if publish_at:
        status["publishAt"] = publish_at
    body = {
        "snippet": {"title": meta["title"], "description": meta["description"], "tags": meta["tags"],
                    "categoryId": ycfg.get("category_id", "27"), "defaultLanguage": "it"},
        "status": status,
    }
    req = yt.videos().insert(part="snippet,status", body=body,
                             media_body=MediaFileUpload(str(video_dir / "video.mp4"), chunksize=-1, resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    vid = resp["id"]
    (video_dir / "youtube_id.txt").write_text(vid)
    return f"https://youtube.com/shorts/{vid}"
