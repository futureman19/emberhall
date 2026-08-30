#!/usr/bin/env python3
"""Emberhall intro art — five story panels (960x540) in the vale's palette.

Blocky, flat shapes in the same vocabulary as the in-game box-mesh figures,
with glows blended via overlay compositing (never ImageDraw alpha writes —
those replace pixels and punch holes).

Run: python scripts/make_intro_art.py
Out: public/art/intro_{vale,hall,folk,land,arrival}.png
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 960, 540
OUT = Path(__file__).resolve().parent.parent / "public" / "art"

# --- the vale's palette (lifted from people-meshes.tsx / catalog.ts) ---
SKIN = (201, 195, 182)
HAIR = (58, 50, 44)
RUST = (168, 90, 66)
RANGER = (106, 122, 72)
WHEAT = (201, 163, 106)
STEEL = (138, 134, 128)
MAGE = (106, 90, 120)
ROGUE = (90, 90, 82)
MERCHANT = (168, 136, 72)
GHOST = (236, 230, 216)
WOOD = (74, 68, 60)
DARKWOOD = (46, 36, 28)
LEGS = (58, 52, 46)
EMBER = (232, 185, 106)


def hexmix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(im, stops):
    """Vertical gradient; stops = [(y0..1, color), ...]"""
    d = ImageDraw.Draw(im)
    n = len(stops)
    for y in range(H):
        t = y / (H - 1)
        for i in range(n - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                f = (t - t0) / (t1 - t0) if t1 > t0 else 0
                d.line([(0, y), (W, y)], fill=hexmix(c0, c1, f))
                break
        else:
            d.line([(0, y), (W, y)], fill=stops[-1][1])


def blend(im, draw_fn):
    """Draw on a transparent overlay and alpha-composite it down."""
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(overlay))
    im.alpha_composite(overlay)


def glow(im, cx, cy, r, color, peak=90):
    """Soft radial light, blended (not replaced)."""
    def paint(d):
        steps = 14
        for i in range(steps, 0, -1):
            rr = r * i / steps
            a = round(peak * (1 - i / steps) ** 1.6)
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color + (a,))
    blend(im, paint)


def stars(im, rng, n, ymax, alpha=200):
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = rng.randrange(W), rng.randrange(ymax)
        s = rng.choice([1, 1, 1, 2])
        a = rng.randrange(alpha // 2, alpha)
        d.rectangle([x, y, x + s, y + s], fill=GHOST + (a,))


def hills(d, bands, rng):
    """bands = [(y_base, color, jag)] farthest first; organic ridge walk."""
    for y_base, color, jag in bands:
        pts = [(0, H)]
        x = 0
        y = y_base
        while x < W:
            pts.append((x, round(y)))
            x += rng.randrange(36, 76)
            y = max(y_base - jag, min(y_base + jag, y + rng.randrange(-jag, jag + 1)))
        pts += [(W, round(y)), (W, H)]
        d.polygon(pts, fill=color)


def figure(d, x, y, s, chest, hood=None, hair=True):
    """Blocky person in the Figure's proportions. (x,y)=foot center, s=scale."""
    u = s / 10.0
    legw, legh = 3 * u, 9 * u
    d.rectangle([x - 4 * u, y - legh, x - 1 * u, y], fill=LEGS)
    d.rectangle([x + 1 * u, y - legh, x + 4 * u, y], fill=LEGS)
    ch, cw = 11 * u, 9 * u
    d.rectangle([x - cw / 2, y - legh - ch, x + cw / 2, y - legh], fill=chest)
    hs = 6 * u
    hy = y - legh - ch - hs
    d.rectangle([x - hs / 2, hy, x + hs / 2, y - legh - ch], fill=SKIN)
    if hood:
        d.rectangle([x - hs / 2 - u, hy - u, x + hs / 2 + u, hy + 3 * u], fill=hood)
    elif hair:
        d.rectangle([x - hs / 2 - u, hy - 2 * u, x + hs / 2 + u, hy], fill=HAIR)


def tree(d, x, y, s=1.0):
    tw, th = 8 * s, 34 * s
    d.rectangle([x - tw / 2, y - th, x + tw / 2, y], fill=WOOD)
    for dx, dy, r, c in [
        (0, -58, 26, RANGER), (-18, -44, 18, (93, 107, 62)),
        (18, -46, 20, RANGER), (0, -38, 16, (93, 107, 62)),
    ]:
        r *= s
        d.rectangle([x + dx * s - r, y + dy * s - r * 0.7, x + dx * s + r, y + dy * s + r * 0.7], fill=c)


def rocks(d, x, y, s=1.0):
    for dx, dy, w, h, c in [
        (0, -10, 34, 20, STEEL), (-20, -6, 18, 12, (106, 104, 98)),
        (22, -7, 16, 14, (118, 114, 108)),
    ]:
        d.rectangle([x + (dx - w / 2) * s, y + (dy - h) * s, x + (dx + w / 2) * s, y + dy * s], fill=c)


def hall(d, cx, base, s=1.0, lit=True):
    """The Emberhall — stone block, crenellated towers, ember windows."""
    stone = (86, 80, 73)
    stone_dark = (66, 61, 56)
    roof = (51, 41, 31)
    win = EMBER if lit else (40, 36, 32)
    w, h = 150 * s, 74 * s
    d.rectangle([cx - w / 2, base - h, cx + w / 2, base], fill=stone)
    for side in (-1, 1):
        tw = 26 * s
        tx = cx + side * (w / 2 + tw / 2 - 4 * s)
        d.rectangle([tx - tw / 2, base - h - 30 * s, tx + tw / 2, base], fill=stone_dark)
        for i in range(3):
            bx = tx - tw / 2 + i * (tw / 3)
            d.rectangle([bx, base - h - 38 * s, bx + tw / 3 - 3 * s, base - h - 30 * s], fill=stone_dark)
        d.rectangle([tx - 4 * s, base - h - 18 * s, tx + 4 * s, base - h - 8 * s], fill=win)
    d.polygon([(cx - w / 2 - 8 * s, base - h), (cx + w / 2 + 8 * s, base - h), (cx, base - h - 26 * s)], fill=roof)
    for i in range(4):
        wx = cx - w / 2 + (i + 0.5) * (w / 4) - 5 * s
        d.rectangle([wx, base - h + 16 * s, wx + 10 * s, base - h + 30 * s], fill=win)
    d.rectangle([cx - 9 * s, base - 22 * s, cx + 9 * s, base], fill=DARKWOOD)


def panel_vale(rng):
    im = Image.new("RGBA", (W, H))
    vgrad(im, [(0.0, (35, 32, 43)), (0.55, (58, 49, 69)), (0.8, (106, 90, 120)), (1.0, (140, 84, 66))])
    stars(im, rng, 60, 300)
    glow(im, 760, 90, 60, GHOST, peak=70)
    d = ImageDraw.Draw(im)
    d.rectangle([744, 74, 776, 106], fill=GHOST)
    d.rectangle([752, 66, 768, 74], fill=GHOST)
    d.rectangle([752, 106, 768, 114], fill=GHOST)
    hills(d, [(330, (74, 68, 80), 14), (390, (58, 52, 46), 20), (450, (46, 40, 36), 26), (510, (36, 31, 28), 22)], rng)
    blend(im, lambda dd: dd.polygon(
        [(420, H), (500, 390), (540, 390), (620, H)], fill=WHEAT + (26,)))
    return im


def panel_hall(rng):
    im = Image.new("RGBA", (W, H))
    vgrad(im, [(0.0, (28, 26, 34)), (0.7, (43, 39, 51)), (1.0, (52, 46, 54))])
    stars(im, rng, 80, 260)
    glow(im, 180, 100, 52, GHOST, peak=60)
    d = ImageDraw.Draw(im)
    d.rectangle([165, 86, 195, 114], fill=GHOST)
    hills(d, [(420, (44, 40, 44), 18)], rng)
    d.rectangle([0, 420, W, H], fill=(36, 32, 25))
    hall(d, W // 2, 500, s=1.7)
    # chimney on the right roof slope, smoke anchored to it
    d.rectangle([548, 340, 566, 392], fill=(66, 61, 56))
    d.rectangle([544, 332, 570, 344], fill=(51, 41, 31))
    glow(im, W // 2 - 62, 430, 46, EMBER, peak=80)
    glow(im, W // 2 + 62, 430, 46, EMBER, peak=80)
    glow(im, W // 2, 500, 52, EMBER, peak=55)
    def smoke(dd):
        for i in range(7):
            y = 316 - i * 26
            dd.rectangle([549 + (i % 3) * 8, y, 563 + (i % 3) * 8, y + 14], fill=(138, 134, 128, 30 - i * 3))
    blend(im, smoke)
    return im


def panel_folk(rng):
    im = Image.new("RGBA", (W, H))
    vgrad(im, [(0.0, (24, 21, 18)), (1.0, (38, 33, 27))])
    stars(im, rng, 40, 220, alpha=140)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 380, W, H], fill=(38, 33, 27))
    fx, fy = W // 2, 430
    glow(im, fx, fy - 10, 190, EMBER, peak=70)
    d = ImageDraw.Draw(im)
    # one figure behind the fire (drawn first, fire laps at their knees)
    figure(d, fx + 10, fy - 24, 20, MAGE, hood=MAGE)
    # fire
    d.rectangle([fx - 30, fy + 16, fx + 30, fy + 26], fill=WOOD)
    d.rectangle([fx - 24, fy + 26, fx + 24, fy + 34], fill=DARKWOOD)
    for wdt, hgt, lean, c in [(30, 40, -8, RUST), (18, 54, 6, WHEAT), (9, 38, -3, GHOST)]:
        d.polygon([(fx - wdt, fy + 18), (fx + wdt, fy + 18), (fx + lean, fy + 18 - hgt)], fill=c)
    # ring around the fire: flanks at fire depth, two closer to the viewer
    ring = [(fx - 190, fy + 30, 22, RANGER, None), (fx + 190, fy + 30, 22, (138, 106, 74), STEEL),
            (fx - 95, fy + 75, 26, MERCHANT, None), (fx + 95, fy + 75, 26, ROGUE, None)]
    for x, y, s, chest, hood in ring:
        figure(d, x, y, s, chest, hood=hood)
    def sparks(dd):
        for _ in range(14):
            x = fx + rng.randrange(-30, 30)
            y = fy - rng.randrange(20, 130)
            dd.rectangle([x, y, x + 2, y + 2], fill=EMBER + (rng.randrange(90, 200),))
    blend(im, sparks)
    return im


def panel_land(rng):
    im = Image.new("RGBA", (W, H))
    vgrad(im, [(0.0, (232, 217, 184)), (0.6, (217, 185, 138)), (1.0, (184, 144, 106))])
    glow(im, 700, 210, 150, WHEAT, peak=120)
    d = ImageDraw.Draw(im)
    d.rectangle([676, 186, 724, 234], fill=hexmix(GHOST, WHEAT, 0.35))
    hills(d, [(300, (138, 122, 98), 16), (360, (111, 98, 80), 20)], rng)
    d.rectangle([0, 360, W, H], fill=(96, 88, 62))
    tree(d, 200, 430, s=1.4)
    rocks(d, 720, 430, s=1.5)
    for i in range(7):
        y = 460 + i * 12
        for x in range(80 + (i % 2) * 30, 900, 60):
            d.line([(x, y), (x, y - 9)], fill=WHEAT, width=3)
    figure(d, 460, 505, 24, RANGER)
    for bx, by in [(300, 150), (340, 130)]:
        d.line([(bx - 6, by), (bx, by - 4)], fill=DARKWOOD, width=2)
        d.line([(bx, by - 4), (bx + 6, by)], fill=DARKWOOD, width=2)
    return im


def panel_arrival(rng):
    im = Image.new("RGBA", (W, H))
    vgrad(im, [(0.0, (239, 227, 196)), (0.55, (222, 192, 148)), (1.0, (190, 148, 110))])
    glow(im, 300, 190, 160, WHEAT, peak=120)
    d = ImageDraw.Draw(im)
    d.rectangle([272, 162, 328, 218], fill=hexmix(GHOST, WHEAT, 0.3))
    hills(d, [(330, (150, 132, 104), 14)], rng)
    d.rectangle([0, 340, W, H], fill=(104, 94, 66))
    hall(d, W // 2, 396, s=1.0)
    glow(im, W // 2, 384, 52, EMBER, peak=160)
    d.polygon([(W // 2 - 90, H), (W // 2 - 12, 396), (W // 2 + 12, 396), (W // 2 + 90, H)], fill=(150, 128, 92))
    blend(im, lambda dd: dd.polygon(
        [(W // 2 - 90, H), (W // 2 - 12, 396), (W // 2 + 12, 396), (W // 2 + 90, H)],
        fill=WHEAT + (60,)))
    # warm light spilling from the open door down the path
    blend(im, lambda dd: dd.polygon(
        [(W // 2 - 40, 470), (W // 2 - 10, 396), (W // 2 + 10, 396), (W // 2 + 40, 470)],
        fill=EMBER + (42,)))
    d = ImageDraw.Draw(im)
    px, py = W // 2, 508
    blend(im, lambda dd: dd.ellipse([px - 34, py + 2, px + 38, py + 12], fill=(60, 50, 40, 90)))
    figure(d, px, py, 26, DARKWOOD, hair=True)
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    panels = {
        "intro_vale": panel_vale(random.Random(11)),
        "intro_hall": panel_hall(random.Random(22)),
        "intro_folk": panel_folk(random.Random(33)),
        "intro_land": panel_land(random.Random(44)),
        "intro_arrival": panel_arrival(random.Random(55)),
    }
    for name, im in panels.items():
        im.convert("RGB").save(OUT / f"{name}.png")
        print("wrote", OUT / f"{name}.png")


if __name__ == "__main__":
    main()
