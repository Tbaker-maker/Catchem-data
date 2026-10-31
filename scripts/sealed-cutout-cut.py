#!/usr/bin/env python3
"""Turn an allowed catalog photo into a transparent cutout. Local only.

White studio, black studio, and a pale blister card are handled by a border
flood. A busy photo falls through to rembg. A result with a leftover box,
a shaved edge, or a tiny source is a fail. Nothing here writes a scale factor.
"""
import io
import json
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = 20_000_000
NOTCH_FAIL = 0.068
BLUR_FAIL = 12.0
MIN_SOURCE_H = 360


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Catch'em cutout"})
    with urllib.request.urlopen(req, timeout=25) as res:
        data = res.read(8_000_000)
        kind = res.headers.get("Content-Type", "")
    if not data or (data[:2] not in (b"\xff\xd8", b"\x89P") and data[:4] != b"RIFF"):
        if "image" not in kind and data[:2] not in (b"\xff\xd8", b"\x89P"):
            raise ValueError("not an image")
    return data


def studio_bg(rgb):
    """White or black studio when that color owns the frame edge. Two dark corners are not enough."""
    h, w, _ = rgb.shape
    b = max(4, min(8, h // 10, w // 10))
    sample = np.concatenate([
        rgb[:b].reshape(-1, 3),
        rgb[-b:].reshape(-1, 3),
        rgb[:, :b].reshape(-1, 3),
        rgb[:, -b:].reshape(-1, 3),
    ], axis=0)
    white = float((sample.min(axis=1) > 242).mean())
    black = float((sample.max(axis=1) < 22).mean())
    if white >= 0.42:
        return np.array([255, 255, 255], dtype=np.float32)
    if black >= 0.42:
        return np.array([0, 0, 0], dtype=np.float32)
    return None


def flood_fg(rgb):
    """Foreground is whatever is not the studio color and not connected to a studio corner."""
    h, w, _ = rgb.shape
    bg = studio_bg(rgb)
    if bg is None:
        return punch_holes(rgb)
    lum = float(bg.mean())
    tol = 28 if lum >= 248 else 32
    dist = np.abs(rgb.astype(np.int16) - bg.astype(np.int16)).sum(axis=2)
    near = dist <= tol
    seeds = np.zeros((h, w), dtype=bool)
    seeds[:2, :] = near[:2, :]
    seeds[-2:, :] = near[-2:, :]
    seeds[:, :2] |= near[:, :2]
    seeds[:, -2:] |= near[:, -2:]
    if not seeds.any():
        return punch_holes(rgb)
    bgmask = ndimage.binary_propagation(seeds, mask=near)
    fg = ~bgmask
    fg = ndimage.binary_fill_holes(fg)
    fg = largest(fg)
    if fg is None:
        return None
    fg = ndimage.binary_closing(fg, structure=np.ones((3, 3)))
    fg = detach_slivers(fg)
    return fg


def largest(fg):
    labeled, n = ndimage.label(fg)
    if n == 0:
        return None
    counts = np.bincount(labeled.ravel())
    counts[0] = 0
    return labeled == int(counts.argmax())


def detach_slivers(fg):
    """Drop a second product that only touches through a thin bridge. The main silhouette grows back."""
    opened = ndimage.binary_opening(fg, structure=np.ones((7, 7)))
    keep = largest(opened)
    if keep is None:
        return fg
    return ndimage.binary_propagation(keep, mask=fg)


def punch_holes(rgb):
    """The package fills the photo. Remove small pure-white hang holes. Do not eat the printed package."""
    white = (rgb[:, :, 0] > 246) & (rgb[:, :, 1] > 246) & (rgb[:, :, 2] > 246)
    labeled, n = ndimage.label(white)
    fg = np.ones(white.shape, dtype=bool)
    if n == 0:
        return fg
    counts = np.bincount(labeled.ravel())
    limit = max(500, int(white.size * 0.015))
    for i in range(1, n + 1):
        if counts[i] < limit:
            fg[labeled == i] = False
    return fg


def rembg_fg(raw):
    from rembg import new_session, remove
    if not hasattr(rembg_fg, "session"):
        rembg_fg.session = new_session("u2net")
    im = Image.open(io.BytesIO(remove(raw, session=rembg_fg.session))).convert("RGBA")
    a = np.array(im.split()[-1])
    return a > 40


def center_mean(mask):
    h, w = mask.shape
    c = mask[int(h * 0.32):int(h * 0.68), int(w * 0.32):int(w * 0.68)]
    return float(c.mean()) if c.size else 1.0


def bbox_of(fg):
    ys, xs = np.where(fg)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def edge_contact(fg):
    """Share of each source edge that the product touches. A long touch is a shaved photo."""
    h, w = fg.shape
    top = float(fg[0].mean()) if h else 1
    bot = float(fg[-1].mean()) if h else 1
    left = float(fg[:, 0].mean()) if w else 1
    right = float(fg[:, -1].mean()) if w else 1
    return top, bot, left, right


def clipped_source(fg):
    top, bot, left, right = edge_contact(fg)
    sides = [top > 0.04, bot > 0.04, left > 0.04, right > 0.04]
    # One full side means the photo cut the product off. Two opposite sides too.
    if left > 0.08 or right > 0.08 or top > 0.08 or bot > 0.08:
        return True
    return sum(sides) >= 3


def notch_ratio(fg):
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
    if w <= win * 2 + 4:
        return 0.0
    smooth = np.convolve(filled, np.ones(win) / win, mode="same")
    resid = np.abs(filled - smooth)[win:-win]
    if resid.size == 0:
        return 1.0
    return float(np.percentile(resid, 95)) / h


def blur_var(rgb, fg):
    g = rgb.astype(np.float32).mean(axis=2)
    lap = -4 * g + np.roll(g, 1, 0) + np.roll(g, -1, 0) + np.roll(g, 1, 1) + np.roll(g, -1, 1)
    if int(fg.sum()) < 80:
        return 0.0
    return float(lap[fg].var())


def studio_corners_left(rgb, fg):
    """Studio color still covering two corners means the backdrop was not removed."""
    bg = studio_bg(rgb)
    if bg is None:
        return False
    h, w = fg.shape
    k = 5 if h > 12 and w > 12 else 2
    spots = [(fg[:k, :k], rgb[:k, :k]), (fg[:k, -k:], rgb[:k, -k:]), (fg[-k:, :k], rgb[-k:, :k]), (fg[-k:, -k:], rgb[-k:, -k:])]
    hits = 0
    for mask, pix in spots:
        if float(mask.mean()) < 0.6:
            continue
        dist = np.abs(pix.astype(np.int16) - np.asarray(bg, dtype=np.int16)).sum(axis=2)
        if float(dist.mean()) < 36:
            hits += 1
    return hits >= 2


def blank_flags():
    return {
        "download": True,
        "centerEaten": False,
        "leftover": False,
        "jagged": False,
        "clipped": False,
        "blur": False,
        "empty": False,
        "tiny": False,
    }


def halo_ring(im):
    """Opaque white corners are a studio mat. A dark product edge is not a black box."""
    a = np.array(im.convert("RGBA"))
    h, w, _ = a.shape
    if h < 120 or w < 70:
        return "tiny"
    alpha = a[:, :, 3]
    if float(alpha.mean()) < 8:
        return "empty"
    k = max(3, min(h, w) // 28)
    spots = [a[:k, :k], a[:k, -k:], a[-k:, :k], a[-k:, -k:]]

    def white(c):
        return float(c[:, :, 3].mean()) > 200 and float(c[:, :, :3].min(axis=2).mean()) > 235

    def black(c):
        return float(c[:, :, 3].mean()) > 200 and float(c[:, :, :3].max(axis=2).mean()) < 18

    whites = sum(1 for c in spots if white(c))
    blacks = sum(1 for c in spots if black(c))
    if whites >= 3:
        return "white"
    # A black mat is flat black in every corner and along the mid-edge, not a dark printed panel.
    if blacks >= 4:
        mid = a[h // 2, :k]
        if float(mid[:, 3].mean()) > 200 and float(mid[:, :3].max()) < 18:
            return "black"
    return ""


def qa_rgba(im):
    """True alpha. A white or black box, a tiny canvas, or an empty mask fails."""
    flags = blank_flags()
    a = np.array(im.convert("RGBA"))
    h, w, _ = a.shape
    if h < 120 or w < 70:
        flags["tiny"] = True
    alpha = a[:, :, 3]
    mean_a = float(alpha.mean())
    if mean_a < 6:
        flags["empty"] = True
    kind = halo_ring(im)
    if kind in ("white", "black"):
        flags["leftover"] = True
    if kind == "empty":
        flags["empty"] = True
    if kind == "tiny":
        flags["tiny"] = True
    return flags


def feather(fg):
    m = Image.fromarray((fg.astype(np.uint8) * 255), "L")
    soft = np.array(m.filter(ImageFilter.GaussianBlur(0.35)))
    soft = np.where(soft < 16, 0, soft).astype(np.uint8)
    return Image.fromarray(soft, "L")


def compose(rgb, fg, target_h):
    flags = blank_flags()
    if fg is None or center_mean(fg) < 0.35:
        flags["centerEaten"] = True
        flags["empty"] = True
        return None, flags
    if float(fg.mean()) < 0.04:
        flags["empty"] = True
        return None, flags
    if studio_corners_left(rgb, fg):
        flags["leftover"] = True
        return None, flags
    box = bbox_of(fg)
    if box is None:
        flags["empty"] = True
        return None, flags
    x0, y0, x1, y1 = box
    if (y1 - y0) < MIN_SOURCE_H:
        flags["tiny"] = True
    full = studio_bg(rgb) is None
    if clipped_source(fg) and not full:
        flags["clipped"] = True
    if notch_ratio(fg) > NOTCH_FAIL:
        flags["jagged"] = True
    if blur_var(rgb, fg) < BLUR_FAIL:
        flags["blur"] = True
    crop = Image.fromarray(rgb[y0:y1, x0:x1]).convert("RGBA")
    crop.putalpha(feather(fg[y0:y1, x0:x1]))
    scale = target_h / crop.size[1]
    resized = crop.resize((max(1, int(round(crop.size[0] * scale))), int(target_h)), Image.Resampling.LANCZOS)
    # No drop shadow. A shadow reads as a black box on the shelf.
    q = qa_rgba(resized)
    for key in ("leftover", "empty", "tiny"):
        if q[key]:
            flags[key] = True
    if any(flags[k] for k in ("centerEaten", "leftover", "jagged", "clipped", "blur", "empty", "tiny")):
        return None, flags
    return resized, flags


def cut_one(raw, target_h):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    # Reject a stamp before the flood. A 200px source must not depend on which
    # mask wins, and rembg must not be asked to invent a larger product.
    if im.size[1] < MIN_SOURCE_H:
        flags = blank_flags()
        flags["tiny"] = True
        return None, flags
    rgb = np.asarray(im)
    tried = []
    fg = flood_fg(rgb)
    tried.append(fg)
    flood_clipped = fg is not None and clipped_source(fg)
    weak = fg is None or center_mean(fg) < 0.45 or (bbox_of(fg) is not None and (bbox_of(fg)[3] - bbox_of(fg)[1]) < MIN_SOURCE_H)
    # A shaved source stays a fail. rembg must not invent the missing wings.
    if weak and not flood_clipped:
        try:
            tried.append(rembg_fg(raw))
        except Exception:
            tried.append(None)
    best = None
    best_flags = blank_flags()
    best_flags["empty"] = True
    for fg in tried:
        out, flags = compose(rgb, fg, int(target_h))
        if out is not None:
            return out, flags
        # Keep the most specific failure.
        best = None
        best_flags = flags
    return best, best_flags


def failing(flags):
    return any(flags.get(k) for k in ("centerEaten", "leftover", "jagged", "clipped", "blur", "empty", "tiny")) or not flags.get("download")


def main():
    job = json.load(open(sys.argv[1], "r"))
    out_dir = job["outDir"]
    report = {}
    items = job.get("items") or []
    for n, item in enumerate(items, 1):
        pid = item["id"]
        flags = blank_flags()
        flags["download"] = False
        try:
            raw = download(item["url"])
            flags["download"] = True
            im, flags = cut_one(raw, int(item["height"]))
        except Exception as err:
            im = None
            flags["download"] = False
            flags["error"] = str(err)[:160]
        ok = im is not None and not failing(flags)
        if ok:
            im.save(f"{out_dir}/{pid}.png", "PNG", optimize=True)
            im.save(f"{out_dir}/{pid}.webp", "WEBP", quality=82, method=4)
            report[pid] = {"pass": True, "width": im.size[0], "height": im.size[1], "productType": item["productType"], "flags": flags}
        else:
            report[pid] = {"pass": False, "productType": item.get("productType") or "", "flags": flags}
        if n % 10 == 0 or n == len(items):
            print(f"cut {n}/{len(items)} {pid} {'pass' if ok else 'review'}", flush=True)
    json.dump(report, open(sys.argv[2], "w"))


if __name__ == "__main__":
    main()
