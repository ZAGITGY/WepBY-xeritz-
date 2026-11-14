#!/usr/bin/env python3
"""Build the glowing-ore textures for OreGlow_RP.

Downloads the vanilla ore textures from Mojang's official bedrock-samples
repository, then for every ore:
  * makes the ore pixels more vivid and brighter,
  * paints a soft halo of the ore's colour around each ore speck,
  * draws a bright 1px frame around the block edge so it stands out from afar,
  * writes a matching *_mers.tga with the emissive channel turned up, so the
    ore really glows when Vibrant Visuals is enabled.

Usage:  python3 build_textures.py [--preview out.png]
Needs:  Pillow, numpy, network access to raw.githubusercontent.com
"""
import argparse
import colorsys
import io
import json
import os
import urllib.request

import numpy as np
from PIL import Image

SAMPLES = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/blocks/"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "packs", "OreGlow_RP", "textures", "blocks")

# texture path (relative to textures/blocks)  ->  (glow colour, mask rule)
ORES = {
    "coal_ore":                       ("#f2f2f2", "coal"),
    "iron_ore":                       ("#ffb27a", "colour"),
    "copper_ore":                     ("#ff7a2e", "colour"),
    "gold_ore":                       ("#ffe02e", "colour"),
    "redstone_ore":                   ("#ff2a2a", "colour"),
    "lapis_ore":                      ("#3d6bff", "colour"),
    "diamond_ore":                    ("#3dfff0", "colour"),
    "emerald_ore":                    ("#2eff6a", "colour"),
    "deepslate/deepslate_coal_ore":     ("#f2f2f2", "coal"),
    "deepslate/deepslate_iron_ore":     ("#ffb27a", "colour"),
    "deepslate/deepslate_copper_ore":   ("#ff7a2e", "colour"),
    "deepslate/deepslate_gold_ore":     ("#ffe02e", "colour"),
    "deepslate/deepslate_redstone_ore": ("#ff2a2a", "colour"),
    "deepslate/deepslate_lapis_ore":    ("#3d6bff", "colour"),
    "deepslate/deepslate_diamond_ore":  ("#3dfff0", "colour"),
    "deepslate/deepslate_emerald_ore":  ("#2eff6a", "colour"),
    "quartz_ore":                     ("#ffffff", "quartz"),
    "nether_gold_ore":                ("#ffe02e", "nether_gold"),
    "ancient_debris_side":            ("#d65cff", "frame_only"),
    "ancient_debris_top":             ("#d65cff", "frame_only"),
}

# How strongly the halo / frame are mixed toward the glow colour (0..1).
HALO_EDGE = 0.28      # pixels touching an ore pixel on a side
HALO_CORNER = 0.0     # pixels touching an ore pixel only diagonally
FRAME = 0.75          # 1px frame around the block

# Emissive strength (0..255) written into the MERS green channel.
EMISSIVE_ORE = 235
EMISSIVE_FRAME = 200
EMISSIVE_HALO = 120


def fetch(path):
    with urllib.request.urlopen(SAMPLES + path, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGBA")


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def hsv(img):
    rgb = img[..., :3] / 255.0
    out = np.zeros_like(rgb)
    for y in range(rgb.shape[0]):
        for x in range(rgb.shape[1]):
            out[y, x] = colorsys.rgb_to_hsv(*rgb[y, x])
    return out


def ore_mask(rule, img, mers):
    h, s, v = np.moveaxis(hsv(img), -1, 0)
    if rule == "colour":          # coloured specks on grey stone / deepslate
        return s > 0.2
    if rule == "coal":            # black specks: vanilla marks them as metallic
        return (mers[..., 0] > 0) | (v < 0.16)
    if rule == "quartz":          # white streaks on red netherrack
        return (v > 0.55) & (s < 0.35)
    if rule == "nether_gold":     # yellow/orange specks on red netherrack
        hue = h * 360
        return (v > 0.5) & (hue > 18) & (hue < 70)
    return np.zeros(img.shape[:2], bool)


def vivid(rgb, rule):
    r, g, b = rgb / 255.0
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if rule == "coal":
        v = v * 0.55                       # deeper black, the halo does the work
    else:
        s = min(1.0, s * 1.3 + 0.08)
        v = min(1.0, max(v * 1.25, 0.72))
    return np.array(colorsys.hsv_to_rgb(h, s, v)) * 255.0


def neighbours(mask):
    m = np.pad(mask, 1)
    side = m[:-2, 1:-1] | m[2:, 1:-1] | m[1:-1, :-2] | m[1:-1, 2:]
    diag = m[:-2, :-2] | m[:-2, 2:] | m[2:, :-2] | m[2:, 2:]
    return side & ~mask, diag & ~side & ~mask


def build(path, glow_hex, rule):
    base = fetch(path + ".png")
    mers_name = os.path.join(os.path.dirname(path), os.path.basename(path) + "_mers")
    try:
        mers = np.array(fetch(mers_name + ".tga")).astype(float)
    except Exception:
        mers = np.zeros((base.height, base.width, 4))
        mers[..., 2] = 220

    img = np.array(base).astype(float)
    glow = hex_rgb(glow_hex)
    mask = ore_mask(rule, img, mers)
    side, diag = neighbours(mask)
    n = img.shape[0]
    frame = np.zeros(mask.shape, bool)
    frame[0, :] = frame[-1, :] = frame[:, 0] = frame[:, -1] = True

    out = img.copy()
    emissive = np.zeros(mask.shape)
    for y in range(n):
        for x in range(n):
            px = img[y, x, :3]
            if mask[y, x]:
                px = vivid(px, rule)
                emissive[y, x] = EMISSIVE_ORE
            elif side[y, x]:
                px = px * (1 - HALO_EDGE) + glow * HALO_EDGE
                emissive[y, x] = EMISSIVE_HALO
            elif diag[y, x]:
                px = px * (1 - HALO_CORNER) + glow * HALO_CORNER
                emissive[y, x] = EMISSIVE_HALO * 0.6
            if frame[y, x]:
                px = px * (1 - FRAME) + glow * FRAME
                emissive[y, x] = max(emissive[y, x], EMISSIVE_FRAME)
            out[y, x, :3] = px
    if rule == "frame_only":            # ancient debris: lift it a little
        out[..., :3] = np.clip(out[..., :3] * 1.15, 0, 255)

    mers_out = mers.copy()
    mers_out[..., 1] = np.maximum(mers_out[..., 1], emissive)
    mers_out[..., 3] = np.where(mers_out[..., 3] == 0, 0, mers_out[..., 3])

    dst = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    Image.fromarray(np.clip(out, 0, 255).astype("uint8"), "RGBA").save(dst + ".png")
    Image.fromarray(np.clip(mers_out, 0, 255).astype("uint8"), "RGBA").save(
        os.path.join(OUT, mers_name) + ".tga")
    with open(dst + ".texture_set.json", "w") as f:
        json.dump({
            "format_version": "1.21.30",
            "minecraft:texture_set": {
                "color": os.path.basename(path),
                "metalness_emissive_roughness_subsurface": os.path.basename(mers_name),
            },
        }, f, indent=4)
        f.write("\n")
    return base, Image.fromarray(np.clip(out, 0, 255).astype("uint8"), "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", help="write a before/after sheet to this PNG")
    args = ap.parse_args()

    pairs = [(p, *build(p, *ORES[p])) for p in ORES]
    print(f"built {len(pairs)} textures into {os.path.normpath(OUT)}")

    if args.preview:
        sc, gap, cols = 8, 6, 10
        tile = 16 * sc + gap
        rows = (len(pairs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tile, rows * 2 * tile), (18, 18, 22))
        for i, (_, before, after) in enumerate(pairs):
            x, r = (i % cols) * tile, (i // cols) * 2
            sheet.paste(before.convert("RGB").resize((16 * sc,) * 2, Image.NEAREST), (x, r * tile))
            sheet.paste(after.convert("RGB").resize((16 * sc,) * 2, Image.NEAREST), (x, (r + 1) * tile))
        sheet.save(args.preview)
        print("preview:", args.preview)


if __name__ == "__main__":
    main()
