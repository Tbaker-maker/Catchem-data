# Crop Post Office catalogue scans to the card edge.
# Source order: the image URL on the catalogue card record (pokemon-tcg-data),
# then images.pokemontcg.io when that record points there. TCGplayer is not used.
# A name is not a key. The file is research/assets/img/{setId}/{number}.png,
# the same path stem the catalogue already publishes as /img/{setId}/{number}.

import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SETS = ("me2pt5", "me3", "me4", "me5")
DATA = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en"
ALLOWED = {"images.pokemontcg.io", "images.scrydex.com"}
CARDBACK = "fd7c3800f9b8ebadf4b31a735f569a180e66201741b00fafa17879967884ad2c"
# 733x1024 hires scans become 716x1004. That is the seed crop in
# research/assets/cards/seed (left 8, top 10, right 9, bottom 10).
INSET = (8 / 733, 10 / 1024, 9 / 733, 10 / 1024)


def load_urls():
    urls = {}
    for set_id in SETS:
        req = urllib.request.Request(f"{DATA}/{set_id}.json", headers={"User-Agent": "Catchem-data"})
        with urllib.request.urlopen(req, timeout=60) as res:
            cards = json.load(res)
        for card in cards:
            images = card.get("images") or {}
            url = images.get("large") or images.get("small") or ""
            host = urlparse(url).hostname or ""
            if host not in ALLOWED:
                continue
            urls[card["id"]] = url
    return urls


def crop(raw):
    im = Image.open(BytesIO(raw)).convert("RGBA")
    w, h = im.size
    left = round(INSET[0] * w)
    top = round(INSET[1] * h)
    right = w - round(INSET[2] * w)
    bottom = h - round(INSET[3] * h)
    if right - left < 200 or bottom - top < 280:
        raise RuntimeError(f"crop too small {w}x{h}")
    crop_im = im.crop((left, top, right, bottom))
    px = list(crop_im.getdata())
    cw, ch = crop_im.size
    edge = []
    edge.extend(px[:cw])
    edge.extend(px[(ch - 1) * cw:])
    edge.extend(px[i * cw] for i in range(ch))
    edge.extend(px[i * cw + cw - 1] for i in range(ch))
    solid = [p[:3] for p in edge if p[3] > 200 and max(p[:3]) - min(p[:3]) < 20]
    sample = solid or [p[:3] for p in edge if p[3] > 200] or [(151, 154, 156)]
    sample.sort()
    fill = sample[len(sample) // 2]
    flat = Image.new("RGB", crop_im.size, fill)
    flat.paste(crop_im, mask=crop_im.getchannel("A"))
    out = BytesIO()
    flat.save(out, format="PNG", optimize=True)
    return out.getvalue()


def fetch_one(cid, url):
    req = urllib.request.Request(url, headers={"User-Agent": "Catchem-data"})
    with urllib.request.urlopen(req, timeout=40) as res:
        raw = res.read()
    if hashlib.sha256(raw).hexdigest() == CARDBACK:
        raise RuntimeError("cardback")
    return crop(raw)


def file_for(cid):
    for set_id in SETS:
        prefix = set_id + "-"
        if cid.startswith(prefix):
            return set_id, cid[len(prefix):]
    raise RuntimeError(f"set id not in {cid}")


def main():
    catalogue = json.loads((ROOT / "data/card-catalogue.json").read_text())
    wanted = [cid for cid, card in catalogue["cards"].items() if card.get("setId") in SETS]
    urls = load_urls()
    jobs = [(cid, urls[cid]) for cid in sorted(wanted) if cid in urls]
    missing = [cid for cid in sorted(wanted) if cid not in urls]
    ok = 0
    failed = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(fetch_one, cid, url): cid for cid, url in jobs}
        for fut in as_completed(futures):
            cid = futures[fut]
            try:
                png = fut.result()
            except Exception as exc:
                failed.append((cid, str(exc)))
                continue
            set_id, number = file_for(cid)
            dest = ROOT / "research/assets/img" / set_id / f"{number}.png"
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(png)
            ok += 1
            if ok % 50 == 0:
                print(f"wrote {ok}", flush=True)
    print(f"wanted {len(wanted)} urls {len(jobs)} wrote {ok} missing-url {len(missing)} failed {len(failed)}")
    for cid, err in failed[:30]:
        print("fail", cid, err)
    for cid in missing[:30]:
        print("no-url", cid)


if __name__ == "__main__":
    main()
