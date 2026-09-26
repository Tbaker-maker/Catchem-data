#!/usr/bin/env python3
"""Draw one PNG per index. Missing days are not connected through invented prices."""
import json
from datetime import date
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "indexes"
OUT = SRC / "charts"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1100, 640
BG = (18, 16, 14)
INK = (239, 233, 222)
GOLD = (216, 184, 120)
MUTED = (154, 145, 132)
LINE = (47, 43, 38)


def font(size):
    for name in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",):
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def draw_one(doc):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f_title = font(28)
    f_body = font(16)
    d.text((36, 28), doc["name"], fill=INK, font=f_title)
    live = doc["series"]["live"]
    back = doc["series"]["backfill"]
    d.text((36, 70), "eBay asking prices. TCGplayer market price is a separate series and is not joined to this line.", fill=MUTED, font=f_body)
    pts = [p for p in live.get("points") or [] if p.get("equal") is not None]
    if live.get("withheld"):
        d.text((36, 110), live["withheld"], fill=GOLD, font=f_body)
    if not pts:
        note = "No eBay line. " + ((back.get("gaps") or [{}])[0].get("note") or "The TCGplayer series is empty.")
        d.text((36, 160), note[:180], fill=MUTED, font=f_body)
    else:
        xs = list(range(len(pts)))
        ys = [p["equal"] for p in pts]
        lo, hi = min(ys), max(ys)
        if lo == hi:
            lo, hi = lo - 1, hi + 1
        pad = (hi - lo) * 0.12
        lo, hi = lo - pad, hi + pad
        left, right, top, bot = 70, W - 40, 130, H - 70
        def xy(i, y):
            x = left + (right - left) * (i / max(len(xs) - 1, 1))
            yy = bot - (bot - top) * ((y - lo) / (hi - lo))
            return x, yy
        d.line([(left, top), (left, bot), (right, bot)], fill=LINE, width=1)
        # break the line where a point spans a gap
        pen = []
        for i, p in enumerate(pts):
            x, y = xy(i, p["equal"])
            gap = False
            if i:
                gap = (date.fromisoformat(p["date"]) - date.fromisoformat(pts[i - 1]["date"])).days > 1
            if gap:
                if len(pen) > 1:
                    d.line(pen, fill=GOLD, width=2)
                pen = [(x, y)]
            else:
                pen.append((x, y))
        if len(pen) > 1:
            d.line(pen, fill=GOLD, width=2)
        d.text((left, H - 48), pts[0]["date"], fill=MUTED, font=f_body)
        end = pts[-1]["date"] + f"   {pts[-1]['equal']}"
        d.text((right - 220, H - 48), end, fill=INK, font=f_body)
        if not back.get("available"):
            d.text((36, 100), "TCGplayer history: gap. Not drawn.", fill=MUTED, font=f_body)
    img.save(OUT / f"{doc['id']}.png")


for path in sorted(SRC.glob("*.json")):
    if path.name == "manifest.json":
        continue
    draw_one(json.loads(path.read_text()))
print("charts", len(list(OUT.glob('*.png'))))
