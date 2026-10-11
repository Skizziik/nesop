"""Мир сцены мультика (этап 1): время суток, погода, сезон — совместимость по каталогу и авто-костюмы по погоде.

Таблица совместимости живёт в каталоге (packages/templates/src/cartoon/catalog → cartoon_catalog.json): у локации
times / weather / seasons, плюс общие правила: снег только зимой, дождь не зимой. Сценарист может попросить что угодно —
здесь просьба приводится к ближайшему допустимому миру, чтобы на пляже не шёл снег, а в детской не было «вечного дня».
"""
from __future__ import annotations

from typing import Any

TIMES = ["morning", "day", "evening", "night"]
WEATHERS = ["clear", "cloudy", "rain", "snow", "windy"]
SEASONS = ["spring", "summer", "autumn", "winter"]


def _loc(catalog: dict[str, Any], location: str) -> dict[str, Any]:
    for loc in catalog["locations"]:
        if loc["id"] == location:
            return dict(loc)
    return {"id": location, "outdoor": True, "times": TIMES, "weather": WEATHERS, "seasons": SEASONS}


def allowed(loc: dict[str, Any], w: dict[str, str]) -> bool:
    if w["time"] not in loc.get("times", TIMES) or w["weather"] not in loc.get("weather", WEATHERS) or w["season"] not in loc.get("seasons", SEASONS):
        return False
    if w["weather"] == "snow" and w["season"] != "winter":
        return False
    return not (w["weather"] == "rain" and w["season"] == "winter")


def resolve_world(catalog: dict[str, Any], location: str, look: dict[str, Any] | None, season: str | None = None) -> dict[str, str]:
    """Мир сцены из просьбы сценариста (time / weather / season, старые weather=leaves) → ближайший допустимый для локации."""
    lk = look or {}
    raw_weather = str(lk.get("weather") or "clear")
    want = {
        "time": str(lk.get("time") or ("night" if location == "bedroom" else "evening" if location == "garden_evening" else "day")),
        "weather": "windy" if raw_weather == "leaves" else raw_weather,
        "season": str(lk.get("season") or season or ("autumn" if raw_weather == "leaves" else "winter" if raw_weather == "snow" else "summer")),
    }
    for k, opts in (("time", TIMES), ("weather", WEATHERS), ("season", SEASONS)):
        if want[k] not in opts:
            want[k] = opts[1] if k != "weather" else "clear"
    loc = _loc(catalog, location)
    if allowed(loc, want):
        return want
    # снег просили не зимой — значит, зима; дождь зимой — снег
    if want["weather"] == "snow" and "winter" in loc.get("seasons", SEASONS):
        cand = {**want, "season": "winter"}
        if allowed(loc, cand):
            return cand
    if want["weather"] == "rain" and want["season"] == "winter":
        cand = {**want, "weather": "snow"}
        if allowed(loc, cand):
            return cand
    # иначе меняем по одному: погоду → сезон → время, сохраняя остальное
    for key, order in (("weather", ["clear", "cloudy", "windy"]), ("season", ["summer", "spring", "autumn", "winter"]), ("time", ["day", "evening", "morning", "night"])):
        for v in order:
            cand = {**want, key: v}
            if allowed(loc, cand):
                return cand
    return {"time": loc.get("times", TIMES)[0], "weather": "clear", "season": loc.get("seasons", SEASONS)[0]}


def auto_wear(catalog: dict[str, Any], location: str, world: dict[str, str], dressing: str | None = None) -> list[str]:
    """Костюмы, которые надеваются сами по правилам каталога (дождевик в дождь на улице, шапка и шарф зимой, пижама ночью в детской…)."""
    loc = _loc(catalog, location)
    out: list[str] = []
    slots: set[str] = set()
    for o in catalog.get("outfits", []):
        a = o.get("auto") or {}
        if not a:
            continue
        if a.get("outdoor") and not loc.get("outdoor", True):
            continue
        if "weather" in a and world["weather"] not in a["weather"]:
            continue
        if "seasons" in a and world["season"] not in a["seasons"]:
            continue
        if "times" in a and world["time"] not in a["times"]:
            continue
        if "locations" in a and location not in a["locations"]:
            continue
        if "dressing" in a and (dressing or "") not in a["dressing"]:
            continue
        key = f"{o.get('slot')}:{o['id']}" if o.get("slot") == "body" and o["id"] == "scarf" else o.get("slot", o["id"])
        if key in slots:  # одна вещь на слот (две шапки сразу не надеваем)
            continue
        slots.add(key)
        out.append(o["id"])
    return out


def merge_wear(auto: list[str], explicit: list[str], catalog: dict[str, Any]) -> list[str]:
    """Явный выбор сценариста главнее: его вещь вытесняет авто-вещь того же слота."""
    slot = {o["id"]: o.get("slot") for o in catalog.get("outfits", [])}
    taken = {slot.get(x) for x in explicit if slot.get(x) not in (None, "body")}
    body_explicit = any(slot.get(x) == "body" and x != "scarf" for x in explicit)
    keep = [x for x in auto if slot.get(x) not in taken and not (body_explicit and slot.get(x) == "body" and x != "scarf")]
    return list(dict.fromkeys([*keep, *explicit]))
