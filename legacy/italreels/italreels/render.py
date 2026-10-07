"""Рисует кадры-состояния ролика (Pillow): фон, заголовок, список пар,
подсветка текущей строки, ??? в последней строке, наклейка-закладка."""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent

BADGE_BG = {"badge": "#A8475A", "dark": "#111111"}


def _hex_lum(h: str) -> float:
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


class Renderer:
    def __init__(self, vcfg: dict, seed: int | None = None):
        self.c = vcfg
        self.W, self.H = vcfg["width"], vcfg["height"]
        self.rng = random.Random(seed)
        self.font_path = str(ROOT / vcfg["font"])
        self._fonts: dict[int, ImageFont.FreeTypeFont] = {}

    def font(self, size: int) -> ImageFont.FreeTypeFont:
        if size not in self._fonts:
            f = ImageFont.truetype(self.font_path, size)
            try:  # вариативный шрифт (Montserrat[wght])
                f.set_variation_by_axes([self.c.get("font_weight", 700)])
            except Exception:
                pass
            self._fonts[size] = f
        return self._fonts[size]

    def _tw(self, text: str, f) -> int:
        l, t, r, b = f.getbbox(text)
        return r - l

    # ---------------------------------------------------------------
    def render_states(self, lesson: dict, out_dir: Path, bg: str | None = None) -> list[Path]:
        """Состояние 0: без подсветки; состояние i (1..n): подсвечена строка i;
        опционально n+1: раскрыт ответ. Возвращает пути к PNG."""
        out_dir.mkdir(parents=True, exist_ok=True)
        bg = bg or self.rng.choice(self.c["backgrounds"])
        items = lesson["items"]
        n = len(items)
        up = self.c.get("uppercase", True)
        disp = [(str(l).upper() if up else str(l), str(r).upper() if up else str(r)) for l, r in items]
        hide = lesson.get("hide", "right")
        hidden = list(disp)
        hl, hr = hidden[-1]
        hidden[-1] = ("??", hr) if hide == "left" else (hl, "???")

        # --- раскладка ---
        top, bottom = self.c["list_top"], self.c["list_bottom"]
        row_h = int(min(125, (bottom - top) / n))
        pill_h = int(row_h * 0.84)
        fsize = int(pill_h * 0.58)
        f = self.font(fsize)
        pad = int(pill_h * 0.32)
        gap = 10
        min_w = pill_h  # квадратная плашка для одной цифры
        lw = max(max(self._tw(l, f) for l, _ in disp + [("??", "")]) + 2 * pad, min_w)
        rw = max(self._tw(r, f) for _, r in disp + [("", "???")]) + 2 * pad
        # если не влезает по ширине, уменьшаем шрифт
        max_block = self.W - 120
        while lw + gap + rw > max_block and fsize > 28:
            fsize -= 2
            f = self.font(fsize)
            pad = int(fsize * 0.55)
            lw = max(max(self._tw(l, f) for l, _ in disp + [("??", "")]) + 2 * pad, min_w)
            rw = max(self._tw(r, f) for _, r in disp + [("", "???")]) + 2 * pad
        axis = int(self.c.get("center_x", self.W // 2) - (lw + gap + rw) / 2 + lw)
        axis = max(axis, 60 + lw)
        center_v = n < 8 or not self.c.get("_has_avatar", False)
        y0 = top + ((bottom - top) - row_h * n) // 2 if center_v else top

        # закладка справа от списка, если там есть место; иначе под списком слева
        if axis + gap + rw + 50 + 150 <= self.W - 20:
            sticker_pos = (axis + gap + rw + 50, y0 + int(row_h * 1.2))
        elif y0 + row_h * n + 220 <= self.H - 260:
            sticker_pos = (70, y0 + row_h * n + 30)
        else:
            sticker_pos = None

        sticker = self._pick_sticker()
        paths = []
        states = list(range(0, n + 1))
        if self.c.get("reveal_answer"):
            states.append(n + 1)
        for s in states:
            img = Image.new("RGB", (self.W, self.H), bg)
            d = ImageDraw.Draw(img)
            self._title(d, lesson["title"], bg)
            rows = disp if s == n + 1 else hidden
            for i, (l, r) in enumerate(rows):
                active = (i + 1 == s) or (s == n + 1 and i == n - 1)
                y = y0 + i * row_h
                self._row(d, f, l, r, axis, gap, y, pill_h, pad, lesson.get("left_style", "dark"), active,
                          is_hidden=(i == n - 1 and s != n + 1), hide=hide)
            if self.c.get("bookmark_sticker", True) and sticker_pos:
                self._bookmark(img, *sticker_pos)
            if sticker:
                img.paste(sticker[0], sticker[1], sticker[0])
            p = out_dir / f"state_{s:02d}.png"
            img.save(p)
            paths.append(p)
        return paths

    # ---------------------------------------------------------------
    def _title(self, d: ImageDraw.ImageDraw, text: str, bg: str):
        size = 66
        f = self.font(size)
        while self._tw(text, f) > self.W - 200 and size > 36:
            size -= 2
            f = self.font(size)
        tw = self._tw(text, f)
        h = int(size * 1.5)
        cx, cy = self.c.get("center_x", self.W // 2), 190
        x0, x1 = cx - tw // 2 - 34, cx + tw // 2 + 34
        d.rounded_rectangle((x0, cy - h // 2, x1, cy + h // 2), radius=h // 2, fill=self.c["title_bg"])
        d.text((cx, cy), text, font=f, fill="#111111", anchor="mm")

    def _row(self, d, f, l, r, axis, gap, y, h, pad, left_style, active, is_hidden, hide):
        rad = int(h * 0.28)
        # левая плашка: выравнивание по правому краю к оси
        lw = max(self._tw(l, f) + 2 * pad, h)
        lx0 = axis - lw
        badge_bg = BADGE_BG.get(left_style, "#111111")
        badge_txt = self.c["highlight_badge_text"] if active else "#FFFFFF"
        if is_hidden and hide == "left" and active:
            badge_bg = self.c["highlight_bg"]
            badge_txt = "#111111"
        d.rounded_rectangle((lx0, y, axis, y + h), radius=rad, fill=badge_bg)
        d.text(((lx0 + axis) // 2, y + h // 2), l, font=f, fill=badge_txt, anchor="mm")
        # правая плашка
        rx0 = axis + gap
        rw = self._tw(r, f) + 2 * pad
        fill = self.c["highlight_bg"] if (active and not (is_hidden and hide == "right")) else "#FFFFFF"
        d.rounded_rectangle((rx0, y, rx0 + rw, y + h), radius=rad, fill=fill)
        d.text((rx0 + pad, y + h // 2), r, font=f, fill="#111111", anchor="lm")

    def _bookmark(self, img: Image.Image, x: int, y: int):
        """Простая красная закладка с плюсом: призыв «сохрани»."""
        s = 1.0
        w, h = int(110 * s), int(150 * s)
        layer = Image.new("RGBA", (w + 60, h + 60), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        ox, oy = 10, 30
        d.polygon([(ox, oy), (ox + w, oy), (ox + w, oy + h), (ox + w // 2, oy + int(h * 0.72)), (ox, oy + h)],
                  fill="#E8213B")
        d.polygon([(ox + int(w * 0.72), oy), (ox + w, oy), (ox + w, oy + h), (ox + int(w * 0.86), oy + int(h * 0.86))],
                  fill="#B3122A")
        # плюс
        px, py, pl, pt = ox + w + 8, oy - 8, 30, 10
        d.rectangle((px - pl, py - pt // 2, px + pl, py + pt // 2), fill="#1EA7FF", outline="#0B4F8A", width=2)
        d.rectangle((px - pt // 2, py - pl, px + pt // 2, py + pl), fill="#1EA7FF", outline="#0B4F8A", width=2)
        d.rectangle((px - pl + 2, py - pt // 2 + 2, px + pl - 2, py + pt // 2 - 2), fill="#1EA7FF")
        img.paste(layer, (x, y), layer)

    def _pick_sticker(self):
        """Случайная наклейка из assets/stickers (*.png с прозрачностью), одна на весь ролик."""
        files = sorted((ROOT / "assets" / "stickers").glob("*.png"))
        if not files:
            return None
        st = Image.open(self.rng.choice(files)).convert("RGBA")
        target = 230
        st.thumbnail((target, target))
        x = self.rng.choice([40, self.W - target - 60])
        y = self.rng.randint(self.c["list_bottom"] - 260, self.c["list_bottom"] - 60)
        return st, (x, y)
