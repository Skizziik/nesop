"""Smoke e2e: создаёт пачку через API, ждёт рендера, проверяет mp4/cover/meta. `python -m scripts.smoke --count 3`."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

API = "http://localhost:8000/api"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--series", default="numeri")
    ap.add_argument("--timeout", type=int, default=1800)
    args = ap.parse_args()
    data_dir = Path("/data")
    with httpx.Client(timeout=30) as c:
        series = {s["slug"]: s for s in c.get(f"{API}/series").json()}
        sid = series[args.series]["id"]
        batch = c.post(f"{API}/batches", json={"series_id": sid, "count": args.count, "auto_approve": True}).json()
        print(f"пачка {batch['id']}: {args.count} роликов серии «{series[args.series]['name']}»", flush=True)
        t0 = time.time()
        while True:
            b = c.get(f"{API}/batches/{batch['id']}").json()
            vids = b.get("videos", [])
            line = ", ".join(f"{v['status']}:{v['stage']}:{int(v['progress'] * 100)}%" for v in vids)
            print(f"[{int(time.time() - t0):4d}s] {b['status']} | {line}", flush=True)
            if vids and len(vids) == args.count and all(v["status"] in ("ready", "failed", "needs_review") for v in vids):
                break
            if time.time() - t0 > args.timeout:
                sys.exit("таймаут")
            time.sleep(5)
    failed = [v for v in vids if v["status"] != "ready"]
    for v in vids:
        base = data_dir / v["video_url"].removeprefix("/media/").rsplit("/", 1)[0] if v["video_url"] else None
        if base is None:
            continue
        mp4 = base / "video.mp4"
        head = mp4.read_bytes()[:12]
        assert b"ftyp" in head, f"{mp4} не mp4"
        assert (base / "cover.png").stat().st_size > 10_000
        meta = json.loads((base / "meta.json").read_text(encoding="utf-8"))
        print(f"✔ {v['title']} — {v['duration_s']:.1f} c, {mp4.stat().st_size // 1024} KB — {meta['title']}")
    print(f"готово за {int(time.time() - t0)} сек, ошибок: {len(failed)}")
    if failed:
        for v in failed:
            print(f"✘ {v['title']}: {v['status']} {v['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
