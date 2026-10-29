#!/usr/bin/env python3
"""Turn catalog photos into trimmed transparent cutouts. Local only."""
import io
import json
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = 20_000_000
NOTCH_FAIL = 0.045
BLUR_FAIL = 18.0
SHADOW_PAD = 36


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Catch'em cutout"})
    with urllib.request.urlopen(req, timeout=25) as res:
        data = res.read(8_000_000)
        kind = res.headers.get("Content-Type", "")
    if not data or data[:2] not in (b"\xff\xd8", b"\x89P") and data[:4] != b"RIFF":
        if "image" not in kind and data[:2] not in (b"\xff\xd8", b"\x89P"):
            raise ValueError("not an image")
    return data


def flood_mask(rgb, floor=250, spread=8, edge=22):
    h, w, _ = rgb.shape
    gray = rgb.astype(np.int16).mean(axis=2)
    gy = np.abs(np.diff(gray, axis=0, append=gray[-1:]))
    gx = np.abs(np.diff(gray, axis=1, append=gray[:, -1:]))
    grad = gx + gy
    mn = rgb.min(axis=2)
    visited = np.zeros((h, w), np.uint8)
    ys = []
    xs = []
    for x in range(w):
        for y in (0, h - 1):
            if mn[y, x] >= floor and not visited[y, x]:
                visited[y, x] = 1
                ys.append(y)
                xs.append(x)
    for y in range(h):
        for x in (0, w - 1):
            if mn[y, x] >= floor and not visited[y, x]:
                visited[y, x] = 1
                ys.append(y)
                xs.append(x)
    i = 0
    while i < len(ys):
        y = ys[i]
        x = xs[i]
        i += 1
        base = int(rgb[y, x].mean())
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny = y + dy
            nx = x + dx
            if ny < 0 or nx < 0 or ny >= h or nx >= w or visited[ny, nx]:
                continue
            if mn[ny, nx] < floor - spread:
                continue
            if grad[ny, nx] > edge and mn[ny, nx] < 250:
                continue
            if abs(int(rgb[ny, nx].mean()) - base) > spread + 8:
                continue
            visited[ny, nx] = 1
            ys.append(ny)
            xs.append(nx)
    return visited


def center_mean(mask):
    h, w = mask.shape
    c = mask[int(h * 0.32):int(h * 0.68), int(w * 0.32):int(w * 0.68)]
    return float(c.mean()) if c.size else 1.0


def rembg_mask(raw):
    from rembg import remove, new_session
    if not hasattr(rembg_mask, "session"):
        rembg_mask.session = new_session("u2net")
    im = Image.open(io.BytesIO(remove(raw, session=rembg_mask.session))).convert("RGBA")
    a = np.array(im.split()[-1])
    hard = np.where(a < 70, 0, np.where(a > 180, 255, a)).astype(np.uint8)
    return hard > 40


def close_mask(fg):
    return ndimage.binary_closing(fg, structure=np.ones((11, 11)))


def bbox_of(fg):
    ys, xs = np.where(fg)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def notch_ratio(fg):
    # High frequency wobble along the top edge. A real header or crimp is smooth
    # at this window, a torn edge is not.
    h, w = fg.shape
    top = np.full(w, np.nan)
    for x in range(w):
        ys = np.where(fg[:, x])[0]
        if len(ys):
            top[x] = ys[0]
    idx = np.where(~np.isnan(top))[0]
    if len(idx) < 10:
        return 1.0
    filled = np.interp(np.arange(w), idx, top[idx])
    win = 41
    smooth = np.convolve(filled, np.ones(win) / win, mode="same")
    resid = np.abs(filled - smooth)[win:-win]
    if resid.size == 0:
        return 1.0
    return float(np.percentile(resid, 95)) / h


def leftover_white(rgba):
    a = np.array(rgba)
    h, w, _ = a.shape
    if h < 8 or w < 8:
        return True
    ring = np.zeros((h, w), bool)
    ring[:2, :] = True
    ring[-2:, :] = True
    ring[:, :2] = True
    ring[:, -2:] = True
    pix = a[ring]
    bad = (pix[:, 3] > 200) & (pix[:, :3].min(axis=1) > 236)
    return float(bad.mean()) > 0.12


def clipped(box, w, h):
    x0, y0, x1, y1 = box
    touch = [x0 <= 1, x1 >= w - 1, y0 <= 1, y1 >= h - 1]
    sides = sum(touch)
    corner = (touch[0] and touch[2]) or (touch[1] and touch[2]) or (touch[0] and touch[3]) or (touch[1] and touch[3])
    return corner or sides >= 3


def blur_var(rgb, fg):
    g = rgb.astype(np.float32).mean(axis=2)
    lap = -4 * g + np.roll(g, 1, 0) + np.roll(g, -1, 0) + np.roll(g, 1, 1) + np.roll(g, -1, 1)
    m = fg
    if int(m.sum()) < 80:
        return 0.0
    return float(lap[m].var())


def feather(fg):
    m = Image.fromarray((fg.astype(np.uint8) * 255), "L")
    return m.filter(ImageFilter.GaussianBlur(0.6))


def add_shadow(im):
    w, h = im.size
    canvas = Image.new("RGBA", (w + SHADOW_PAD, h + SHADOW_PAD), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    cx = (w + SHADOW_PAD) // 2
    draw.ellipse([cx - int(w * 0.32), h - 6, cx + int(w * 0.32), h + 16], fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(im, (SHADOW_PAD // 2, 0))
    return canvas


def cut_one(raw, target_h):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    rgb = np.asarray(im)
    h, w, _ = rgb.shape
    mask = None
    for floor, edge in ((250, 22), (246, 26), (240, 30)):
        bg = flood_mask(rgb, floor=floor, spread=8, edge=edge)
        if center_mean(bg) < 0.008 and 0.012 < float(bg.mean()) < 0.72:
            mask = ~bg.astype(bool)
            break
    if mask is None:
        try:
            mask = rembg_mask(raw)
        except Exception:
            mask = None
    flags = {
        "download": True,
        "centerEaten": False,
        "leftover": False,
        "jagged": False,
        "clipped": False,
        "blur": False,
        "empty": False,
    }
    if mask is None or center_mean(mask) < 0.45:
        flags["centerEaten"] = True
        flags["empty"] = True
        return None, flags
    fg = close_mask(mask)
    if float(fg.mean()) < 0.08 or float(fg.mean()) > 0.96:
        flags["empty"] = True
    box = bbox_of(fg)
    if box is None:
        flags["empty"] = True
        return None, flags
    if clipped(box, w, h):
        flags["clipped"] = True
    if notch_ratio(fg) > NOTCH_FAIL:
        flags["jagged"] = True
    if blur_var(rgb, fg) < BLUR_FAIL:
        flags["blur"] = True
    x0, y0, x1, y1 = box
    crop_fg = fg[y0:y1, x0:x1]
    crop = im.crop((x0, y0, x1, y1)).convert("RGBA")
    crop.putalpha(feather(crop_fg))
    if leftover_white(crop):
        flags["leftover"] = True
    if any(flags[k] for k in ("centerEaten", "leftover", "jagged", "clipped", "blur", "empty")):
        return None, flags
    scale = target_h / crop.size[1]
    resized = crop.resize((max(1, int(round(crop.size[0] * scale))), target_h), Image.Resampling.LANCZOS)
    out = add_shadow(resized)
    return out, flags


def main():
    job = json.load(open(sys.argv[1], "r"))
    out_dir = job["outDir"]
    report = {}
    items = job.get("items") or []
    for n, item in enumerate(items, 1):
        pid = item["id"]
        flags = {"download": False, "centerEaten": False, "leftover": False, "jagged": False, "clipped": False, "blur": False, "empty": False}
        try:
            raw = download(item["url"])
            flags["download"] = True
            im, flags = cut_one(raw, int(item["height"]))
        except Exception as err:
            im = None
            flags["download"] = False
            flags["error"] = str(err)[:160]
        ok = im is not None and not any(flags.get(k) for k in ("centerEaten", "leftover", "jagged", "clipped", "blur", "empty")) and flags.get("download")
        if ok:
            im.save(f"{out_dir}/{pid}.png", "PNG", optimize=True)
            im.save(f"{out_dir}/{pid}.webp", "WEBP", quality=82, method=4)
            report[pid] = {"pass": True, "width": im.size[0], "height": im.size[1], "productType": item["productType"], "flags": flags}
        else:
            report[pid] = {"pass": False, "productType": item.get("productType") or "", "flags": flags}
        if n % 15 == 0 or n == len(items):
            print(f"cut {n}/{len(items)} {pid} {'pass' if ok else 'review'}", flush=True)
    json.dump(report, open(sys.argv[2], "w"))


if __name__ == "__main__":
    main()
