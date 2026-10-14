# Official pokemon.com logos are trimmed to the artwork, the same crop as ME01.
# A set with no series logo gets a rounded Catch'em tile: the set name, not fan art.
# Ids are the catalogue set id when one exists. Otherwise the site slug with
# hyphens removed, which is the path /img/<id>/logo.png.

import hashlib
import json
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "research/assets/img"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_SM = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
ME06 = "https://www.pokemon.com/static-assets/content-assets/cms2/img/trading-card-game/series/me_series/me06/me06_logo_169_en.png"

# Slugs whose official series logo is already in the catalogue, or is ME06.
OFFICIAL = {
    "me-30th-celebration": "me55",
    "me-ascended-heroes": "me2pt5",
    "me03-perfect-order": "me3",
    "me04-chaos-rising": "me4",
    "me05-pitch-black": "me5",
    "me06-delta-reign": "me6",
}
FORCE_ID = {"mee-mega-evolution-energies": "mee"}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Catchem-data"})
    with urllib.request.urlopen(req, timeout=40) as res:
        return res.read()


def trim(raw):
    im = Image.open(BytesIO(raw)).convert("RGBA")
    box = im.getchannel("A").point(lambda p: 255 if p > 0 else 0).getbbox()
    if not box:
        raise RuntimeError("empty logo")
    crop = im.crop(box)
    out = BytesIO()
    crop.save(out, format="PNG", optimize=True)
    return crop, out.getvalue(), len(raw), im.size


def wrap(draw, text, font, width):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = word if not cur else cur + " " + word
        if draw.textlength(trial, font=font) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def tile_png(name):
    w, h = 640, 220
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((4, 4, w - 5, h - 5), radius=28, fill=(26, 24, 21, 255), outline=(212, 175, 55, 255), width=3)
    mark = ImageFont.truetype(FONT_SM, 18)
    mark_w = draw.textlength("Catch'em", font=mark)
    draw.text(((w - mark_w) / 2, 16), "Catch'em", font=mark, fill=(212, 175, 55, 255))
    font = None
    lines = []
    for size in range(40, 15, -1):
        font = ImageFont.truetype(FONT, size)
        lines = wrap(draw, name, font, w - 56)
        line_h = size + 6
        if len(lines) <= 3 and 18 + 28 + len(lines) * line_h <= h - 16:
            break
    line_h = font.size + 6
    block = len(lines) * line_h
    y = 18 + 28 + max(0, (h - 36 - block) // 2)
    for line in lines:
        tw = draw.textlength(line, font=font)
        draw.text(((w - tw) / 2, y), line, font=font, fill=(239, 233, 222, 255))
        y += line_h
    out = BytesIO()
    im.save(out, format="PNG", optimize=True)
    return im, out.getvalue()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    sets = json.loads((ROOT / "research/assets/public/sets.json").read_text())["sets"]
    by_slug = {row["slug"]: row["name"] for row in sets}
    report = json.loads((IMG / "set-logo-files.json").read_text())
    # Official pokemon.com crops only. Tile folders are not collisions.
    used = {row["id"] for row in report["present"]}
    tile_doc = json.loads((IMG / "set-logo-tiles.json").read_text())
    work = []
    seen = set()
    for row in tile_doc.get("tiles") or []:
        slug = row["slug"]
        if slug in seen or slug in OFFICIAL:
            continue
        seen.add(slug)
        work.append({"slug": slug, "name": by_slug.get(slug) or row["name"]})

    raw = fetch(ME06)
    crop, png, raw_bytes, raw_size = trim(raw)
    dest = IMG / "me6" / "logo.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(png)
    present = {
        "id": "me6",
        "file": "research/assets/img/me6/logo.png",
        "source": ME06,
        "rawBytes": raw_bytes,
        "rawWidth": raw_size[0],
        "rawHeight": raw_size[1],
        "bytes": len(png),
        "width": crop.size[0],
        "height": crop.size[1],
        "sha256": sha(png),
    }
    report["present"] = [row for row in report["present"] if row["id"] != "me6"] + [present]
    report["present"].sort(key=lambda row: row["id"])
    if "me6" not in report["listed"]:
        report["listed"].append("me6")
        report["listed"].sort()
    report["missing"] = [row for row in report["missing"] if row["id"] != "mee"]

    tiles = []
    for row in work:
        slug = row["slug"]
        tid = FORCE_ID.get(slug) or slug.replace("-", "")
        if not tid.isalnum():
            raise SystemExit(f"id not alphanumeric {tid} for {slug}")
        if tid in used and tid not in FORCE_ID.values():
            raise SystemExit(f"id collision {tid} for {slug}")
        used.add(tid)
        im, png = tile_png(row["name"])
        path = IMG / tid / "logo.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png)
        tiles.append({
            "slug": slug,
            "id": tid,
            "name": row["name"],
            "file": f"research/assets/img/{tid}/logo.png",
            "width": im.size[0],
            "height": im.size[1],
            "bytes": len(png),
            "sha256": sha(png),
        })
    tiles.sort(key=lambda row: row["slug"])
    tile_doc = {
        "rule": "A branded tile is the set name on a rounded Catch'em plate. It is used only when pokemon.com has no series logo for that set. It is not an official logo and not fan art.",
        "tiles": tiles,
    }
    (IMG / "set-logo-tiles.json").write_text(json.dumps(tile_doc, indent=2) + "\n")
    (IMG / "set-logo-files.json").write_text(json.dumps(report, indent=2) + "\n")
    removed = 0
    for path in IMG.iterdir():
        if path.is_dir() and path.name.startswith("tile"):
            for child in path.iterdir():
                child.unlink()
            path.rmdir()
            removed += 1
    print(f"me6 {crop.size[0]}x{crop.size[1]} {present['bytes']} tiles {len(tiles)} removed {removed}")
    for row in tiles:
        if row["id"].startswith("tile"):
            raise SystemExit(f"prefixed id left {row['id']}")


if __name__ == "__main__":
    main()
