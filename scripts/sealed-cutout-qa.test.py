#!/usr/bin/env python3
"""Pixel gate for sealed cutouts. A white mat, a black mat, a tiny stamp, or a shaved side fails."""
import importlib.util
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("cut", ROOT / "scripts" / "sealed-cutout-cut.py")
cut = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut)

fail = 0


def check(name, cond):
    global fail
    if cond:
        print(f"  ok  {name}")
    else:
        fail += 1
        print(f"  FAIL {name}")


def textured(size, bg, box, color):
    w, h = size
    arr = np.empty((h, w, 3), dtype=np.uint8)
    arr[:] = bg
    x0, y0, x1, y1 = box
    yy, xx = np.mgrid[y0:y1, x0:x1]
    odd = ((xx // 5) + (yy // 5)) % 2 == 0
    block = np.empty((y1 - y0, x1 - x0, 3), dtype=np.uint8)
    dark = tuple(max(0, c - 40) for c in color)
    block[:] = dark
    block[odd] = color
    arr[y0:y1, x0:x1] = block
    buf = io.BytesIO()
    Image.fromarray(arr, "RGB").save(buf, format="PNG")
    return buf.getvalue()


def test_synth():
    white = textured((800, 800), (255, 255, 255), (60, 40, 740, 760), (220, 40, 40))
    im, flags = cut.cut_one(white, 480)
    check("white studio yields a cutout", im is not None and not cut.failing(flags))
    if im is not None:
        check("white studio corners are clear", cut.halo_ring(im) == "")

    black = textured((800, 800), (8, 8, 8), (50, 30, 750, 770), (40, 180, 70))
    im, flags = cut.cut_one(black, 480)
    check("black studio yields a cutout", im is not None and not cut.failing(flags))

    tiny = textured((240, 240), (255, 255, 255), (20, 20, 220, 200), (20, 80, 200))
    im, flags = cut.cut_one(tiny, 480)
    check("a tiny source is not shipped", im is None and flags.get("tiny") is True)

    shaved = np.zeros((400, 400), dtype=bool)
    shaved[30:370, :] = True
    check("a side-shaved mask is clipped", cut.clipped_source(shaved) is True)
    clear = np.zeros((400, 400), dtype=bool)
    clear[40:360, 40:360] = True
    check("a centered product is not clipped", cut.clipped_source(clear) is False)

    # Full-bleed package with a small hang hole. Corners are the package, not a studio field.
    full = np.empty((700, 700, 3), dtype=np.uint8)
    yy, xx = np.mgrid[0:700, 0:700]
    full[:] = (180, 30, 50)
    full[((xx // 7) + (yy // 7)) % 2 == 0] = (160, 40, 90)
    full[40:90, 300:400] = (255, 255, 255)
    buf = io.BytesIO()
    Image.fromarray(full, "RGB").save(buf, format="PNG")
    im, flags = cut.cut_one(buf.getvalue(), 500)
    check("a full-bleed package ships", im is not None and not cut.failing(flags))
    if im is not None:
        alpha = np.array(im.convert("RGBA"))[:, :, 3]
        check("the hang hole is transparent", int((alpha < 16).sum()) > 20)


def test_shipped():
    doc_path = ROOT / "data" / "sealed-cutouts.json"
    if not doc_path.exists():
        check("cutout catalog exists", False)
        return
    doc = json.loads(doc_path.read_text())
    rows = [r for r in doc.get("products") or [] if r.get("pass") is True]
    check("at least one cutout passed", len(rows) > 0)
    bad = []
    for row in rows:
        rel = str(row.get("png") or "")
        path = ROOT / "research" / "assets" / "public" / rel
        if not path.exists():
            bad.append(row.get("id") + " missing")
            continue
        im = Image.open(path).convert("RGBA")
        w, h = im.size
        reasons = []
        if h < 120 or w < 70:
            reasons.append("tiny")
        kind = cut.halo_ring(im)
        if kind:
            reasons.append(kind)
        alpha = np.array(im)[:, :, 3]
        if float(alpha.mean()) < 6:
            reasons.append("empty")
        if reasons:
            bad.append(str(row.get("id")) + " " + ",".join(reasons))
    check("every passed cutout is clean", not bad, )
    if bad:
        print("   " + "; ".join(bad[:12]))


def main():
    test_synth()
    test_shipped()
    if fail:
        print(f"{fail} failed")
        sys.exit(1)
    print("sealed cutout pixels ok")


if __name__ == "__main__":
    main()
