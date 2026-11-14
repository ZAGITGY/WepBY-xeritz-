#!/usr/bin/env python3
"""Make pack icons and zip each pack into dist/*.mcpack.

Run build_textures.py first. Usage: python3 package.py
"""
import io
import os
import urllib.request
import zipfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
PACKS = os.path.join(ROOT, "packs")
DIST = os.path.join(ROOT, "dist")
RP, BP = "OreGlow_RP", "TreeVein_BP"
SAMPLES = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/blocks/"


def tile(path, size):
    return Image.open(path).convert("RGBA").resize((size, size), Image.NEAREST)


def make_icons():
    blocks = os.path.join(PACKS, RP, "textures", "blocks")
    # Ore Glow: 2x2 of glowing diamond, gold, emerald, redstone
    icon = Image.new("RGBA", (128, 128))
    for i, name in enumerate(["diamond_ore", "gold_ore", "emerald_ore", "redstone_ore"]):
        icon.paste(tile(os.path.join(blocks, name + ".png"), 64), ((i % 2) * 64, (i // 2) * 64))
    icon.save(os.path.join(PACKS, RP, "pack_icon.png"))

    # TreeVein: log on the left, glowing iron ore on the right
    with urllib.request.urlopen(SAMPLES + "log_oak.png", timeout=30) as r:
        log = Image.open(io.BytesIO(r.read())).convert("RGBA").resize((128, 128), Image.NEAREST)
    ore = tile(os.path.join(blocks, "iron_ore.png"), 128)
    icon = log.copy()
    icon.paste(ore.crop((64, 0, 128, 128)), (64, 0))
    icon.save(os.path.join(PACKS, BP, "pack_icon.png"))


def zip_dir(src, dst, prefix=""):
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(src):
            for f in sorted(files):
                full = os.path.join(base, f)
                z.write(full, os.path.join(prefix, os.path.relpath(full, src)))


def main():
    make_icons()
    os.makedirs(DIST, exist_ok=True)
    for name in (RP, BP):
        zip_dir(os.path.join(PACKS, name), os.path.join(DIST, name + ".mcpack"))
    for f in sorted(os.listdir(DIST)):
        print(f"{f:32s} {os.path.getsize(os.path.join(DIST, f)):>8,d} bytes")


if __name__ == "__main__":
    main()
