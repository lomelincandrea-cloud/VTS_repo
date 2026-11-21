"""Crop the four system illustrations for Learn and save them as WebP in docs/img/learn/.
The "Purpose / Benefits" box baked into the bottom of each image is cut off (unreadable on the web, and one line claims
"Helps meet environmental regulations", which this site does not claim). Run with the conda env "vts":  python tools/site_data/crop_illustrations.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / "docs" / "img" / "manual", ROOT / "docs" / "img" / "learn"
# (file, crop box left, top, right, bottom, areas to paint white (a cut label))
CROPS = {"SB": ("FIG-03-p14.jpg", (0, 0, 617, 340), [(540, 318, 617, 340)]),
         "VD": ("FIG-02-p49.jpg", (0, 0, 922, 497), []),
         "WB": ("FIG-53-p67.jpg", (3, 38, 969, 412), []),
         "TW": ("FIG-TW-01.png", (0, 0, 663, 334), [(585, 322, 663, 334)])}
OUT.mkdir(parents=True, exist_ok=True)
for sy, (f, box, wipe) in CROPS.items():
    im = Image.open(SRC / f).convert("RGB")
    d = ImageDraw.Draw(im)
    for w in wipe:
        d.rectangle(w, fill="white")
    im = im.crop(box)
    if im.width > 1400: im = im.resize((1400, round(im.height * 1400 / im.width)))
    dst = OUT / f"{sy}.webp"
    im.save(dst, "WEBP", quality=82, method=6)
    print(dst.name, im.size, dst.stat().st_size // 1024, "KB")
