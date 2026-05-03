#!/usr/bin/env python3
"""
Vicious explainer — element-level motion renderer.

For every (scene, ratio, duration) we render the scene frame-by-frame in PIL
with real per-element animation (cursors moving, panels sliding in, charts
growing, type typing in, chips populating, etc.) — NOT just zoom/pan over a
static frame. Frames are encoded by ffmpeg into a silent clip; clips are
concatenated per cut and per ratio, then muxed with the synthesized audio
master from build_motion.py (gTTS VO + procedural music + SFX).

Run:
    python3 deliverables/explainer_video/scripts/build_motion_anim.py
"""
from __future__ import annotations

import math
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
EXPORTS = ROOT / "exports"
ASSETS = ROOT / "assets"
TMP = ROOT / "_tmp_anim"
EXPORTS.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)

FONT_REG = "/home/runner/workspace/assets/fonts/Inter-Regular.ttf"
FONT_BOLD = "/home/runner/workspace/assets/fonts/Inter-Bold.ttf"

ONYX = (14, 17, 23)
CARBON = (26, 31, 42)
CARBON_2 = (34, 40, 54)
BONE = (245, 246, 248)
BONE_DIM = (210, 215, 222)
STEEL = (118, 128, 145)
STEEL_DIM = (78, 86, 100)
CRIMSON = (225, 29, 46)
CRIMSON_DIM = (140, 22, 32)
SIGNAL = (245, 158, 11)
GREEN = (60, 200, 130)
RED = (220, 60, 70)

FPS = 30
RATIOS = {"16x9": (1920, 1080), "9x16": (1080, 1920), "1x1": (1080, 1080)}


@dataclass
class Scene:
    sid: str
    dur: float


LONG = [Scene("01", 5), Scene("02", 5), Scene("03", 4), Scene("04", 8),
        Scene("05", 8), Scene("06", 6), Scene("07", 6), Scene("08", 6),
        Scene("09", 8), Scene("10", 6), Scene("11", 6), Scene("12", 7)]
SHORT = [Scene("01", 3), Scene("04", 4), Scene("05", 6), Scene("07", 5),
         Scene("09", 6), Scene("11", 4), Scene("12", 7)]


# ---------- helpers ----------
def run(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write(f"\n$ {' '.join(map(str, cmd))}\n{res.stderr}\n")
        raise SystemExit(res.returncode)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def lerp(a, b, t): return a + (b - a) * t
def clamp(x, lo=0.0, hi=1.0): return max(lo, min(hi, x))
def ease_out_cubic(t): return 1 - (1 - t) ** 3
def ease_in_out(t): return 0.5 * (1 - math.cos(math.pi * t))


def lerp_color(a, b, t):
    return tuple(int(lerp(a[i], b[i], clamp(t))) for i in range(3))


def with_alpha(rgb, a):
    return (rgb[0], rgb[1], rgb[2], int(255 * clamp(a)))


def stagger(t: float, i: int, total: int, dur: float, step: float = 0.18) -> float:
    """Per-item progress 0..1 with staggered start."""
    start = i * step
    return clamp((t - start) / max(dur - start - 0.2, 0.001))


def text(draw: ImageDraw.ImageDraw, xy, s, fnt, fill, anchor="lt"):
    draw.text(xy, s, font=fnt, fill=fill, anchor=anchor)


def rounded(draw: ImageDraw.ImageDraw, box, r, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def card(draw, xy, size, fill=CARBON, border=(60, 70, 90), r=8):
    x, y = xy
    w, h = size
    rounded(draw, (x, y, x + w, y + h), r, fill=fill, outline=border, width=2)


def cursor(draw, x, y, color=BONE):
    """Tiny arrow cursor."""
    pts = [(x, y), (x + 14, y + 11), (x + 6, y + 11), (x + 4, y + 18)]
    draw.polygon(pts, fill=color, outline=ONYX)


_VIGNETTE_CACHE: dict = {}


def _build_vignette(w, h):
    over = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    for i in range(20):
        a = int(i * 3)
        od.rectangle((i * 8, i * 8, w - i * 8, h - i * 8),
                     outline=(0, 0, 0, a), width=8)
    return over.filter(ImageFilter.GaussianBlur(60))


def vignette(img: Image.Image):
    key = img.size
    if key not in _VIGNETTE_CACHE:
        _VIGNETTE_CACHE[key] = _build_vignette(*key)
    img.alpha_composite(_VIGNETTE_CACHE[key])


def grain(img: Image.Image, strength=8):
    import random
    px = img.load()
    w, h = img.size
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            r, g, b, a = px[x, y]
            n = random.randint(-strength, strength)
            px[x, y] = (clamp_byte(r + n), clamp_byte(g + n), clamp_byte(b + n), a)


def clamp_byte(v): return max(0, min(255, v))


_BASE_CACHE: dict = {}


def _build_base(W, H) -> Image.Image:
    img = Image.new("RGBA", (W, H), ONYX + (255,))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 60):
        d.line((x, 0, x, H), fill=(20, 24, 32, 255), width=1)
    for y in range(0, H, 60):
        d.line((0, y, W, y), fill=(20, 24, 32, 255), width=1)
    d.rectangle((0, 0, W, 6), fill=CRIMSON)
    text(d, (24, 22), "VICIOUS", font(int(20 * H / 1080), bold=True), BONE)
    return img


def base(W, H, label_id="01") -> Image.Image:
    """Common scene chassis: background + corner ID + brand bar."""
    key = (W, H)
    if key not in _BASE_CACHE:
        _BASE_CACHE[key] = _build_base(W, H)
    img = _BASE_CACHE[key].copy()
    d = ImageDraw.Draw(img)
    text(d, (W - 24, 22), f"SC.{label_id}", font(int(18 * H / 1080), bold=True), STEEL, anchor="rt")
    return img


def safe_box(W, H, t, dur, fade_in=0.25, fade_out=0.20) -> float:
    """Global per-scene alpha multiplier (fade in/out)."""
    a = clamp(t / fade_in) * clamp((dur - t) / fade_out)
    return a


# ---------- scene renderers ----------
def scene_01(W, H, t, dur):
    """Hook: chaotic tabs / chats / countdown."""
    img = base(W, H, "01")
    d = ImageDraw.Draw(img)
    sx = W / 1920
    sy = H / 1080
    # countdown clock top center
    text(d, (W // 2, int(70 * sy)), "SCRIM IN", font(int(28 * sy), True), STEEL, "mt")
    secs = max(0.0, 40 * 60 - int(t * 33))
    mm = int(secs // 60)
    ss = int(secs % 60)
    text(d, (W // 2, int(110 * sy)), f"00:{mm:02d}:{ss:02d}",
         font(int(110 * sy), True), CRIMSON, "mt")

    # browser tab strip - tabs slide in stagger from left
    tab_y = int(H * 0.40)
    tab_h = int(72 * sy)
    tab_w = int(170 * sx)
    titles = ["Discord", "Sheets", "Twitch", "VOD", "Calendar",
              "Gmail", "DM-Coach", "Stats", "Patch", "Liquipedia",
              "Notion", "Steam"]
    for i, ttl in enumerate(titles):
        p = stagger(t, i, len(titles), dur, step=0.12)
        if p <= 0: continue
        x = int(40 * sx + i * (tab_w + 8 * sx))
        if x + tab_w > W - 40 * sx: continue
        y = int(tab_y + (1 - ease_out_cubic(p)) * 40)
        a = ease_out_cubic(p)
        c = CARBON_2 if i != int(t * 2) % len(titles) else CRIMSON_DIM
        layer = Image.new("RGBA", (tab_w, tab_h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, tab_w, tab_h), 6, fill=c, outline=(70, 80, 100), width=2)
        text(ld, (12, tab_h // 2), ttl, font(int(20 * sy), True), BONE, "lm")
        ld.ellipse((tab_w - 22, tab_h // 2 - 5, tab_w - 12, tab_h // 2 + 5), fill=CRIMSON)
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (x, y))

    # chat bubbles popping in from bottom-right
    bub_y0 = int(H * 0.65)
    msgs = ["@coach: who's IGL?", "scrim cancelled?", "i thought J was sub",
            "vod link?", "lobby up?", "where's K?"]
    for i, m in enumerate(msgs):
        p = stagger(t, i, len(msgs), dur, step=0.18)
        if p <= 0: continue
        x = int(W * 0.62)
        y = int(bub_y0 + i * 60 * sy + (1 - ease_out_cubic(p)) * 30)
        a = ease_out_cubic(p)
        bw = int(330 * sx)
        bh = int(48 * sy)
        layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, bw, bh), 8, fill=CARBON_2, outline=(70, 80, 100), width=2)
        text(ld, (14, bh // 2), m, font(int(20 * sy)), BONE, "lm")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (x, y))

    # Cursor sweeping
    cx = int(lerp(80 * sx, W - 100 * sx, ease_in_out(clamp(t / dur))))
    cy = int(tab_y + tab_h // 2 - 4 + math.sin(t * 3) * 6 * sy)
    cursor(d, cx, cy)

    # global fade
    alpha = safe_box(W, H, t, dur)
    if alpha < 1:
        a = Image.new("RGBA", (W, H), (0, 0, 0, int((1 - alpha) * 255)))
        img.alpha_composite(a)
    vignette(img)
    return img


def scene_02(W, H, t, dur):
    """Nobody knows who's playing — roster cards w/ question marks."""
    img = base(W, H, "02")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (W // 2, int(120 * sy)), "TODAY'S STARTING FIVE",
         font(int(40 * sy), True), STEEL, "mt")
    n = 5
    cw = int(min(220 * sx, (W - 200 * sx) / n - 20 * sx))
    ch = int(cw * 1.35)
    gap = int(28 * sx)
    total = n * cw + (n - 1) * gap
    x0 = (W - total) // 2
    y0 = int(H * 0.32)
    for i in range(n):
        p = stagger(t, i, n, dur, step=0.18)
        if p <= 0: continue
        a = ease_out_cubic(p)
        x = x0 + i * (cw + gap)
        y = int(y0 + (1 - ease_out_cubic(p)) * 60)
        layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, cw, ch), 10, fill=CARBON, outline=(70, 80, 100), width=2)
        # avatar circle
        ld.ellipse((cw // 2 - 50, 30, cw // 2 + 50, 130), fill=CARBON_2,
                   outline=STEEL_DIM, width=3)
        # blinking ?
        blink = (math.sin(t * 6 + i) + 1) / 2
        text(ld, (cw // 2, 80), "?", font(int(70 * sy), True),
             lerp_color(CRIMSON_DIM, CRIMSON, blink), "mm")
        text(ld, (cw // 2, ch - 50), "TBD", font(int(22 * sy), True), STEEL, "mm")
        text(ld, (cw // 2, ch - 24), "ROLE ?", font(int(16 * sy)), STEEL_DIM, "mm")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (x, y))

    # caption types in
    cap = "And nobody knows who's actually playing."
    chars = int(clamp((t - 1.0) / 1.6) * len(cap))
    text(d, (W // 2, int(H * 0.86)), cap[:chars], font(int(34 * sy)), BONE, "mm")
    # caret
    if 0 < chars < len(cap) and int(t * 2) % 2 == 0:
        bbox = d.textbbox((W // 2, int(H * 0.86)), cap[:chars], font=font(int(34 * sy)), anchor="mm")
        if bbox[3] > bbox[1] + 8:
            d.rectangle((bbox[2] + 2, bbox[1] + 4, bbox[2] + 14, bbox[3] - 4), fill=CRIMSON)

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_03(W, H, t, dur):
    """Stakes: declining win-rate line."""
    img = base(W, H, "03")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (W // 2, int(110 * sy)), "WIN RATE — LAST 6 WEEKS",
         font(int(36 * sy), True), STEEL, "mt")
    # chart frame
    cx0, cy0 = int(W * 0.18), int(H * 0.30)
    cx1, cy1 = int(W * 0.82), int(H * 0.80)
    rounded(d, (cx0, cy0, cx1, cy1), 12, outline=STEEL_DIM, width=2)
    # gridlines
    for k in range(1, 5):
        y = cy0 + (cy1 - cy0) * k // 5
        d.line((cx0, y, cx1, y), fill=(40, 48, 60, 255), width=1)
    # data points (declining)
    pts_full = [(0.05, 0.70), (0.20, 0.62), (0.35, 0.66), (0.50, 0.50),
                (0.65, 0.40), (0.80, 0.30), (0.95, 0.18)]
    progress = clamp(t / max(dur - 0.6, 0.1))
    revealed = int(progress * len(pts_full))
    pts = []
    for i, (px, py) in enumerate(pts_full[:max(revealed, 1)]):
        x = int(cx0 + px * (cx1 - cx0))
        y = int(cy0 + (1 - py) * (cy1 - cy0))
        pts.append((x, y))
    if len(pts) > 1:
        d.line(pts, fill=CRIMSON, width=int(6 * sy))
    for x, y in pts:
        d.ellipse((x - 8, y - 8, x + 8, y + 8), fill=CRIMSON, outline=BONE, width=2)
    # delta label drops in at end
    if t > dur * 0.7:
        a = ease_out_cubic(clamp((t - dur * 0.7) / (dur * 0.3)))
        layer = Image.new("RGBA", (int(360 * sx), int(80 * sy)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, layer.width, layer.height), 8, fill=CRIMSON_DIM, outline=CRIMSON, width=2)
        text(ld, (layer.width // 2, layer.height // 2), "−52% vs Q1",
             font(int(34 * sy), True), BONE, "mm")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (W - layer.width - int(60 * sx),
                                    cy0 - layer.height - int(20 * sy)))

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_04(W, H, t, dur):
    """Solution intro: command center reveal."""
    img = base(W, H, "04")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    # large wordmark with letter stagger
    word = "VICIOUS"
    fnt = font(int(180 * sy), True)
    bbox_total = d.textbbox((0, 0), word, font=fnt)
    total_w = bbox_total[2] - bbox_total[0]
    x0 = (W - total_w) // 2
    y0 = int(H * 0.18)
    cur_x = x0
    for i, ch in enumerate(word):
        p = stagger(t, i, len(word), dur, step=0.06)
        if p <= 0:
            cw = d.textbbox((0, 0), ch, font=fnt)[2]
            cur_x += cw
            continue
        a = ease_out_cubic(p)
        dy = int((1 - a) * 40)
        layer = Image.new("RGBA", (W, int(220 * sy)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        text(ld, (0, 0), ch, fnt, BONE)
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (cur_x, y0 + dy))
        cw = d.textbbox((0, 0), ch, font=fnt)[2]
        cur_x += cw
    # tagline rises
    tag_p = clamp((t - 1.0) / 1.5)
    if tag_p > 0:
        a = ease_out_cubic(tag_p)
        layer = Image.new("RGBA", (W, int(60 * sy)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        text(ld, (W // 2, 0), "THE COMMAND CENTER FOR SERIOUS ESPORTS",
             font(int(28 * sy), True), CRIMSON, "mt")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (0, int(y0 + 200 * sy + (1 - a) * 20)))

    # dashboard panel slides up from bottom
    db_p = clamp((t - 1.8) / 2.5)
    if db_p > 0:
        a = ease_out_cubic(db_p)
        dy = int((1 - a) * 200 * sy)
        dx0 = int(W * 0.10)
        dy0 = int(H * 0.50) + dy
        dx1 = int(W * 0.90)
        dy1 = int(H * 0.92) + dy
        layer = Image.new("RGBA", (dx1 - dx0, dy1 - dy0), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, dx1 - dx0, dy1 - dy0), 14, fill=CARBON, outline=(70, 80, 100), width=2)
        # tile grid 4x2
        cols = 4
        rows = 2
        pad = int(20 * sy)
        gap = int(16 * sy)
        tw = (dx1 - dx0 - 2 * pad - (cols - 1) * gap) // cols
        th = (dy1 - dy0 - 2 * pad - (rows - 1) * gap) // rows
        labels = ["ROSTER", "SCOUT", "DRAFT", "COMP",
                  "ANALYTICS", "SCHED", "VOD", "BILLING"]
        for i in range(cols * rows):
            ti_p = clamp((t - 2.4 - i * 0.12) / 1.0)
            ta = ease_out_cubic(ti_p)
            r = i // cols
            c = i % cols
            tx = pad + c * (tw + gap)
            ty = pad + r * (th + gap)
            tile = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
            td = ImageDraw.Draw(tile)
            rounded(td, (0, 0, tw, th), 8, fill=CARBON_2, outline=STEEL_DIM, width=2)
            td.rectangle((0, 0, 4, th), fill=CRIMSON)
            text(td, (16, th // 2), labels[i], font(int(22 * sy), True), BONE, "lm")
            tile.putalpha(tile.split()[3].point(lambda v: int(v * ta)))
            layer.alpha_composite(tile, (tx, ty))
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (dx0, dy0 - dy))

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_05(W, H, t, dur):
    """One roster, every game — rows of player avatars w/ game logos rotating."""
    img = base(W, H, "05")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (W // 2, int(80 * sy)), "ONE ROSTER • EVERY GAME",
         font(int(40 * sy), True), BONE, "mt")
    # players row
    n = 6
    cw = int(min(150 * sx, (W - 200 * sx) / n - 20 * sx))
    ch = int(cw * 1.25)
    gap = int(20 * sx)
    total = n * cw + (n - 1) * gap
    x0 = (W - total) // 2
    y0 = int(H * 0.28)
    names = ["SHADOW", "RIPPER", "VOID", "ECHO", "VEX", "HEX"]
    roles = ["IGL", "DUEL", "SUP", "FRAG", "SUB", "COACH"]
    for i in range(n):
        p = stagger(t, i, n, dur, step=0.10)
        if p <= 0: continue
        a = ease_out_cubic(p)
        x = x0 + i * (cw + gap)
        y = int(y0 + (1 - ease_out_cubic(p)) * 30)
        layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, cw, ch), 10, fill=CARBON, outline=(70, 80, 100), width=2)
        ld.ellipse((cw // 2 - 36, 22, cw // 2 + 36, 94), fill=CARBON_2,
                   outline=CRIMSON, width=3)
        text(ld, (cw // 2, 130), names[i], font(int(20 * sy), True), BONE, "mm")
        text(ld, (cw // 2, ch - 30), roles[i], font(int(16 * sy)), STEEL, "mm")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (x, y))

    # game tiles cycle (snap into a row that grows)
    games = ["VAL", "CS2", "LOL", "DOTA", "RL", "OW2", "APEX", "R6"]
    gy = int(H * 0.72)
    gw = int(min(140 * sx, (W - 200 * sx) / 6 - 16 * sx))
    gh = int(80 * sy)
    visible = min(int(t * 1.6) + 1, len(games))
    total_g = visible * gw + (visible - 1) * 16 * sx
    gx0 = (W - total_g) // 2
    for i in range(visible):
        appear = clamp((t - i * 0.5) / 0.5)
        if appear <= 0: continue
        a = ease_out_cubic(appear)
        x = int(gx0 + i * (gw + 16 * sx))
        y = int(gy + (1 - a) * 30)
        layer = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, gw, gh), 8, fill=CARBON_2, outline=CRIMSON, width=2)
        text(ld, (gw // 2, gh // 2), games[i], font(int(28 * sy), True), BONE, "mm")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (x, y))

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_06(W, H, t, dur):
    """Scout opponent — opponent card slides in from right, stat bars grow."""
    img = base(W, H, "06")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (int(80 * sx), int(110 * sy)), "OPPONENT • SCOUT REPORT",
         font(int(36 * sy), True), STEEL)
    text(d, (int(80 * sx), int(160 * sy)), "vs. NIGHTBLOOM ESPORTS",
         font(int(56 * sy), True), BONE)
    # left stats panel (bars grow)
    bx, by = int(80 * sx), int(H * 0.32)
    bw = int(W * 0.45)
    bh = int(H * 0.55)
    rounded(d, (bx, by, bx + bw, by + bh), 12, fill=CARBON, outline=(70, 80, 100), width=2)
    stats = [("MAP WIN %", 0.62), ("FIRST BLOOD %", 0.41), ("PISTOL %", 0.55),
             ("LATE-ROUND %", 0.30), ("CLUTCH %", 0.48)]
    bar_pad = int(40 * sy)
    bar_h = int(40 * sy)
    bar_gap = int(24 * sy)
    for i, (lbl, val) in enumerate(stats):
        y = by + bar_pad + i * (bar_h + bar_gap + int(28 * sy))
        text(d, (bx + 24, y), lbl, font(int(22 * sy), True), STEEL)
        bar_y = y + int(28 * sy)
        bar_w_full = bw - 48
        rounded(d, (bx + 24, bar_y, bx + 24 + bar_w_full, bar_y + bar_h), 6,
                fill=CARBON_2, outline=STEEL_DIM, width=1)
        p = ease_out_cubic(clamp((t - 0.4 - i * 0.18) / 1.4))
        if p > 0:
            fill_w = int(bar_w_full * val * p)
            c = CRIMSON if val < 0.5 else GREEN
            rounded(d, (bx + 24, bar_y, bx + 24 + fill_w, bar_y + bar_h), 6, fill=c)
            # value text
            text(d, (bx + 24 + bar_w_full, bar_y + bar_h // 2),
                 f"{int(val * p * 100)}%", font(int(22 * sy), True), BONE, "rm")

    # right: dot grid of W/L history populates
    rx = bx + bw + int(40 * sx)
    rw = W - rx - int(80 * sx)
    rounded(d, (rx, by, rx + rw, by + bh), 12, fill=CARBON, outline=(70, 80, 100), width=2)
    text(d, (rx + 24, by + 24), "RECENT FORM", font(int(22 * sy), True), STEEL)
    cols = 12
    rows = 6
    cell = min((rw - 80) // cols, (bh - 100) // rows)
    gx = rx + 24
    gy = by + 70
    import random
    random.seed(7)
    history = [(random.random() < 0.55) for _ in range(cols * rows)]
    n_rev = int(clamp(t / max(dur - 0.5, 0.1)) * cols * rows)
    for i in range(min(n_rev, cols * rows)):
        c, r = i % cols, i // cols
        x = gx + c * cell + 4
        y = gy + r * cell + 4
        col = GREEN if history[i] else CRIMSON
        rounded(d, (x, y, x + cell - 8, y + cell - 8), 4, fill=col)

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_07(W, H, t, dur):
    """Lock the draft — pick slots fill one-by-one with cursor moving."""
    img = base(W, H, "07")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (W // 2, int(80 * sy)), "DRAFT BOARD • PICK PHASE",
         font(int(36 * sy), True), BONE, "mt")
    n = 5
    pw = int(min(220 * sx, (W - 200 * sx) / n - 20 * sx))
    ph = int(pw * 1.35)
    gap = int(28 * sx)
    total = n * pw + (n - 1) * gap
    x0 = (W - total) // 2
    y0 = int(H * 0.30)
    pick_names = ["JETT", "SOVA", "OMEN", "KILLJOY", "VIPER"]
    interval = max(dur / (n + 0.6), 0.4)
    cursor_x = x0 + pw // 2
    cursor_y = y0 + ph // 2
    for i in range(n):
        x = x0 + i * (pw + gap)
        y = y0
        # base slot
        rounded(d, (x, y, x + pw, y + ph), 10, fill=CARBON, outline=STEEL_DIM, width=2)
        slot_t = (t - 0.3 - i * interval)
        if slot_t < 0:
            text(d, (x + pw // 2, y + ph // 2), str(i + 1),
                 font(int(80 * sy), True), STEEL_DIM, "mm")
        else:
            p = ease_out_cubic(clamp(slot_t / 0.5))
            # fill snap
            rounded(d, (x, y, x + pw, y + ph), 10,
                    fill=lerp_color(CARBON, CRIMSON_DIM, p),
                    outline=CRIMSON, width=int(2 + 2 * p))
            # name
            text(d, (x + pw // 2, y + int(ph * 0.55)),
                 pick_names[i], font(int(34 * sy), True), BONE, "mm")
            text(d, (x + pw // 2, y + ph - 30),
                 f"P{i + 1}", font(int(20 * sy), True), STEEL, "mm")
            cursor_x = x + pw // 2
            cursor_y = y + ph // 2
    # bans row
    by_b = int(y0 + ph + 60 * sy)
    text(d, (x0, by_b - 30), "BANS",
         font(int(22 * sy), True), STEEL)
    for i in range(3):
        bx = x0 + i * (int(120 * sx))
        rounded(d, (bx, by_b, bx + int(100 * sx), by_b + int(100 * sx)), 8,
                fill=CARBON_2, outline=STEEL_DIM, width=2)
        if t > 0.8 + i * 0.4:
            d.line((bx + 16, by_b + 16, bx + int(100 * sx) - 16, by_b + int(100 * sx) - 16),
                   fill=CRIMSON, width=int(6 * sy))
            d.line((bx + int(100 * sx) - 16, by_b + 16, bx + 16, by_b + int(100 * sx) - 16),
                   fill=CRIMSON, width=int(6 * sy))

    cursor(d, cursor_x, cursor_y)

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_08(W, H, t, dur):
    """Run the comp — tactical map with arrows growing."""
    img = base(W, H, "08")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (W // 2, int(80 * sy)), "COMP RUN • MAP BIND • A SITE EXEC",
         font(int(34 * sy), True), BONE, "mt")
    # map area
    mx0, my0 = int(W * 0.18), int(H * 0.22)
    mx1, my1 = int(W * 0.82), int(H * 0.90)
    rounded(d, (mx0, my0, mx1, my1), 12, fill=CARBON, outline=(70, 80, 100), width=2)
    # site shapes
    rounded(d, (mx0 + int((mx1 - mx0) * 0.62), my0 + int((my1 - my0) * 0.18),
                mx0 + int((mx1 - mx0) * 0.88), my0 + int((my1 - my0) * 0.42)),
            8, fill=CARBON_2, outline=CRIMSON, width=2)
    text(d, (mx0 + int((mx1 - mx0) * 0.75), my0 + int((my1 - my0) * 0.30)),
         "A", font(int(60 * sy), True), CRIMSON, "mm")
    rounded(d, (mx0 + int((mx1 - mx0) * 0.10), my0 + int((my1 - my0) * 0.55),
                mx0 + int((mx1 - mx0) * 0.36), my0 + int((my1 - my0) * 0.82)),
            8, fill=CARBON_2, outline=STEEL_DIM, width=2)
    text(d, (mx0 + int((mx1 - mx0) * 0.23), my0 + int((my1 - my0) * 0.68)),
         "B", font(int(60 * sy), True), STEEL, "mm")
    # 5 player paths animating from spawn (bottom) to A site
    spawn_x = mx0 + int((mx1 - mx0) * 0.40)
    spawn_y = my0 + int((my1 - my0) * 0.92)
    targets = [(0.80, 0.30), (0.72, 0.34), (0.85, 0.40), (0.78, 0.22), (0.65, 0.32)]
    for i, (tx, ty) in enumerate(targets):
        p = ease_out_cubic(clamp((t - 0.3 - i * 0.18) / max(dur - 1.0, 0.5)))
        ex = mx0 + int((mx1 - mx0) * tx)
        ey = my0 + int((my1 - my0) * ty)
        cx = int(lerp(spawn_x + i * 30, ex, p))
        cy = int(lerp(spawn_y - i * 10, ey, p))
        # path line
        if p > 0:
            d.line((spawn_x + i * 30, spawn_y - i * 10, cx, cy),
                   fill=lerp_color(CARBON_2, CRIMSON, p), width=int(4 * sy))
            d.ellipse((cx - 14, cy - 14, cx + 14, cy + 14),
                      fill=CRIMSON if i == 0 else BONE, outline=ONYX, width=2)
            text(d, (cx, cy), str(i + 1), font(int(16 * sy), True), ONYX, "mm")

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_09(W, H, t, dur):
    """Analytics — bars grow + line chart draws + KPI counters tick up."""
    img = base(W, H, "09")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (W // 2, int(70 * sy)), "TEAM ANALYTICS",
         font(int(34 * sy), True), BONE, "mt")
    # KPI row
    kpis = [("WIN %", 67, "%"), ("ACS", 248, ""), ("ENTRY %", 31, "%"), ("CLUTCH", 12, "")]
    kw = int((W - 200 * sx) / len(kpis))
    ky = int(H * 0.18)
    for i, (lbl, val, suf) in enumerate(kpis):
        x = int(100 * sx + i * kw)
        layer_w = int(kw * 0.85)
        layer_h = int(140 * sy)
        layer = Image.new("RGBA", (layer_w, layer_h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, layer_w, layer_h), 10, fill=CARBON, outline=(70, 80, 100), width=2)
        ld.rectangle((0, 0, 4, layer_h), fill=CRIMSON)
        text(ld, (20, 16), lbl, font(int(20 * sy), True), STEEL)
        p = ease_out_cubic(clamp((t - i * 0.15) / 1.4))
        cur = int(val * p)
        text(ld, (20, 56), f"{cur}{suf}", font(int(56 * sy), True), BONE)
        img.alpha_composite(layer, (x, ky))
    # Bars chart bottom-left
    bx0 = int(100 * sx); by0 = int(H * 0.45); bx1 = int(W * 0.55); by1 = int(H * 0.92)
    rounded(d, (bx0, by0, bx1, by1), 12, fill=CARBON, outline=(70, 80, 100), width=2)
    text(d, (bx0 + 20, by0 + 20), "ROUNDS WON BY MAP",
         font(int(22 * sy), True), STEEL)
    bars = [("BIND", 0.7), ("HAVEN", 0.55), ("ASCENT", 0.85),
            ("LOTUS", 0.40), ("SPLIT", 0.62), ("ICEBOX", 0.30)]
    bar_area_top = by0 + 80
    bar_area_bot = by1 - 60
    n = len(bars)
    bw = (bx1 - bx0 - 60) // n
    for i, (nm, v) in enumerate(bars):
        x = bx0 + 30 + i * bw
        full_h = bar_area_bot - bar_area_top
        p = ease_out_cubic(clamp((t - 0.6 - i * 0.12) / 1.6))
        h = int(full_h * v * p)
        c = CRIMSON if v < 0.5 else GREEN
        rounded(d, (x + 8, bar_area_bot - h, x + bw - 8, bar_area_bot), 4, fill=c)
        text(d, (x + bw // 2, bar_area_bot + 24), nm,
             font(int(18 * sy), True), STEEL, "mm")
    # Line chart bottom-right
    cx0 = int(W * 0.58); cy0 = int(H * 0.45); cx1 = int(W - 100 * sx); cy1 = int(H * 0.92)
    rounded(d, (cx0, cy0, cx1, cy1), 12, fill=CARBON, outline=(70, 80, 100), width=2)
    text(d, (cx0 + 20, cy0 + 20), "FORM TREND",
         font(int(22 * sy), True), STEEL)
    pts_full = [(0.05, 0.55), (0.18, 0.45), (0.32, 0.50), (0.48, 0.40),
                (0.60, 0.30), (0.72, 0.32), (0.84, 0.20), (0.95, 0.15)]
    progress = clamp((t - 0.4) / max(dur - 1.0, 0.1))
    revealed = max(1, int(progress * len(pts_full)))
    pts = []
    for i, (px, py) in enumerate(pts_full[:revealed]):
        x = int(cx0 + 40 + px * (cx1 - cx0 - 80))
        y = int(cy0 + 80 + py * (cy1 - cy0 - 140))
        pts.append((x, y))
    if len(pts) >= 2:
        d.line(pts, fill=CRIMSON, width=int(5 * sy))
    for x, y in pts:
        d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=BONE, outline=CRIMSON, width=2)

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_10(W, H, t, dur):
    """Scale: multi-team, multi-title — team panels stagger in."""
    img = base(W, H, "10")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    text(d, (W // 2, int(80 * sy)), "MULTI-TEAM • MULTI-TITLE",
         font(int(36 * sy), True), BONE, "mt")
    teams = [("MAIN", "VAL"), ("ACADEMY", "VAL"), ("CS", "CS2"), ("LOL", "LOL")]
    n = len(teams)
    cw = int(min(360 * sx, (W - 200 * sx) / n - 20 * sx))
    ch = int(cw * 0.95)
    gap = int(24 * sx)
    total = n * cw + (n - 1) * gap
    x0 = (W - total) // 2
    y0 = int(H * 0.30)
    for i, (nm, gm) in enumerate(teams):
        p = stagger(t, i, n, dur, step=0.18)
        if p <= 0: continue
        a = ease_out_cubic(p)
        x = x0 + i * (cw + gap)
        y = int(y0 + (1 - a) * 60)
        layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rounded(ld, (0, 0, cw, ch), 12, fill=CARBON, outline=CRIMSON if i == 0 else (70, 80, 100), width=2)
        ld.rectangle((0, 0, cw, int(40 * sy)), fill=CRIMSON if i == 0 else CARBON_2)
        text(ld, (16, int(20 * sy)), gm, font(int(20 * sy), True), BONE, "lm")
        text(ld, (cw // 2, int(ch * 0.45)), nm, font(int(40 * sy), True), BONE, "mm")
        # 5 mini avatars
        ay = int(ch * 0.72)
        for j in range(5):
            ax = int((cw - 5 * 40 * sx) / 2 + j * 44 * sx)
            ld.ellipse((ax, ay, ax + int(36 * sx), ay + int(36 * sx)),
                       fill=CARBON_2, outline=STEEL_DIM, width=2)
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (x, y))
    # bottom label drops in
    lp = clamp((t - 1.5) / 1.5)
    if lp > 0:
        a = ease_out_cubic(lp)
        layer = Image.new("RGBA", (W, int(80 * sy)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        text(ld, (W // 2, layer.height // 2), "ONE SOURCE OF TRUTH",
             font(int(40 * sy), True), CRIMSON, "mm")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (0, int(H * 0.86 + (1 - a) * 20)))

    a = safe_box(W, H, t, dur)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_11(W, H, t, dur):
    """Kinetic type: 'LESS SPREADSHEET. MORE WINNING.'"""
    img = base(W, H, "11")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    # Spreadsheet collapse on left (rows shrink to nothing)
    sx0, sy0 = int(60 * sx), int(H * 0.20)
    sx1, sy1 = int(W * 0.42), int(H * 0.85)
    rounded(d, (sx0, sy0, sx1, sy1), 8, fill=CARBON, outline=STEEL_DIM, width=2)
    rows = 12
    row_h = (sy1 - sy0 - 40) // rows
    collapse = clamp((t - 0.6) / 2.0)
    visible_rows = int(rows * (1 - collapse))
    for r in range(visible_rows):
        y = sy0 + 20 + r * row_h
        d.rectangle((sx0 + 12, y, sx1 - 12, y + row_h - 4),
                    fill=CARBON_2 if r % 2 == 0 else CARBON)
        for c in range(5):
            cx = sx0 + 16 + c * ((sx1 - sx0 - 32) // 5)
            d.text((cx + 6, y + 4), "—", font=font(int(18 * sy)), fill=STEEL_DIM)
    # Crimson bar grows on right
    bx0 = int(W * 0.50); by0 = int(H * 0.20)
    bx1 = int(W - 60 * sx); by1 = int(H * 0.85)
    rounded(d, (bx0, by0, bx1, by1), 8, fill=CARBON, outline=(70, 80, 100), width=2)
    grow = ease_out_cubic(clamp((t - 0.4) / 2.0))
    fill_h = int((by1 - by0 - 40) * grow)
    rounded(d, (bx0 + 20, by1 - 20 - fill_h, bx1 - 20, by1 - 20), 6, fill=CRIMSON)
    text(d, ((bx0 + bx1) // 2, by0 + 36), "WIN RATE",
         font(int(28 * sy), True), STEEL, "mt")
    text(d, ((bx0 + bx1) // 2, (by0 + by1) // 2),
         f"{int(67 * grow)}%", font(int(120 * sy), True), BONE, "mm")
    # Big kinetic words snap in over the top
    word1_p = clamp((t - 0.2) / 0.4)
    word2_p = clamp((t - dur * 0.5) / 0.4)
    if word1_p > 0:
        a = ease_out_cubic(word1_p)
        scale = 1 + (1 - a) * 0.3
        sz = int(110 * sy * scale)
        layer = Image.new("RGBA", (W, sz + 40), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        text(ld, (W // 2, 0), "LESS SPREADSHEET.",
             font(sz, True), BONE, "mt")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (0, int(H * 0.06)))
    if word2_p > 0:
        a = ease_out_cubic(word2_p)
        scale = 1 + (1 - a) * 0.3
        sz = int(120 * sy * scale)
        layer = Image.new("RGBA", (W, sz + 40), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        text(ld, (W // 2, 0), "MORE WINNING.",
             font(sz, True), CRIMSON, "mt")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (0, int(H * 0.86 - sz)))

    a = safe_box(W, H, t, dur, fade_in=0.08)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


def scene_12(W, H, t, dur):
    """Lockup — logo punch-in, tagline letter-spacing reveal, URL types in."""
    img = base(W, H, "12")
    d = ImageDraw.Draw(img)
    sx = W / 1920; sy = H / 1080
    # Logo "punch in" — scales from 1.4 → 1.0 with alpha
    p = ease_out_cubic(clamp(t / 0.9))
    if p > 0:
        scale = lerp(1.4, 1.0, p)
        sz = int(220 * sy * scale)
        layer = Image.new("RGBA", (W, sz + 40), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        text(ld, (W // 2, 0), "VICIOUS",
             font(sz, True), BONE, "mt")
        layer.putalpha(layer.split()[3].point(lambda v: int(v * p)))
        img.alpha_composite(layer, (0, int(H * 0.28 - sz * 0.1)))
        # crimson underline grows
        uw = int(W * 0.30 * p)
        d.rectangle((W // 2 - uw // 2, int(H * 0.28 + sz * 0.95),
                     W // 2 + uw // 2, int(H * 0.28 + sz * 0.95) + int(8 * sy)),
                    fill=CRIMSON)

    # Tagline letter-spacing reveal
    tp = clamp((t - 1.2) / 1.4)
    if tp > 0:
        a = ease_out_cubic(tp)
        spacing = int((1 - a) * 24)  # letters spread out, then settle
        s = "RUN YOUR ROSTER LIKE A PRO."
        fnt = font(int(46 * sy), True)
        # build one char at a time with manual spacing
        widths = [d.textbbox((0, 0), c, font=fnt)[2] for c in s]
        total_w = sum(widths) + (len(s) - 1) * spacing
        x = (W - total_w) // 2
        y = int(H * 0.62)
        layer = Image.new("RGBA", (W, int(80 * sy)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        cx = x
        for i, ch in enumerate(s):
            text(ld, (cx, 0), ch, fnt, BONE, "lt")
            cx += widths[i] + spacing
        layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
        img.alpha_composite(layer, (0, y))

    # URL types in
    url = "vicious.gg"
    up = clamp((t - 2.6) / 1.6)
    if up > 0:
        chars = int(up * len(url))
        text(d, (W // 2, int(H * 0.78)), url[:chars],
             font(int(56 * sy), True), CRIMSON, "mt")
        # caret
        if 0 < chars < len(url) and int(t * 3) % 2 == 0:
            bbox = d.textbbox((W // 2, int(H * 0.78)), url[:chars],
                              font=font(int(56 * sy), True), anchor="mt")
            if bbox[3] > bbox[1] + 16:
                d.rectangle((bbox[2] + 4, bbox[1] + 8, bbox[2] + 18, bbox[3] - 8),
                            fill=CRIMSON)

    a = safe_box(W, H, t, dur, fade_out=0.6)
    if a < 1:
        img.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int((1 - a) * 255))))
    vignette(img)
    return img


SCENES = {
    "01": scene_01, "02": scene_02, "03": scene_03, "04": scene_04,
    "05": scene_05, "06": scene_06, "07": scene_07, "08": scene_08,
    "09": scene_09, "10": scene_10, "11": scene_11, "12": scene_12,
}


def _render_frame_range(args):
    sid, ratio, dur, start, end, frames_dir = args
    W, H = RATIOS[ratio]
    fn = SCENES[sid]
    for f in range(start, end):
        t = f / FPS
        img = fn(W, H, t, dur)
        img.convert("RGB").save(Path(frames_dir) / f"f_{f:05d}.png")


def render_clip(sid: str, ratio: str, dur: float) -> Path:
    """Render a single scene clip (no audio)."""
    out = TMP / f"clip-{ratio}-{sid}-{dur}.mp4"
    if out.exists():
        return out
    n_frames = int(round(dur * FPS))
    frames_dir = TMP / f"frames-{ratio}-{sid}-{dur}"
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True)
    # Parallel frame render across processes
    from concurrent.futures import ProcessPoolExecutor
    workers = 6
    chunk = max(1, (n_frames + workers - 1) // workers)
    tasks = []
    for i in range(workers):
        s = i * chunk
        e = min(n_frames, s + chunk)
        if s < e:
            tasks.append((sid, ratio, dur, s, e, str(frames_dir)))
    with ProcessPoolExecutor(max_workers=workers) as ex:
        list(ex.map(_render_frame_range, tasks))
    run([
        "ffmpeg", "-y", "-framerate", str(FPS), "-i", str(frames_dir / "f_%05d.png"),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p", str(out),
    ])
    shutil.rmtree(frames_dir)
    return out


def concat_clips(clips, out_mp4):
    list_file = TMP / f"_concat_{out_mp4.stem}.txt"
    list_file.write_text("\n".join(f"file '{p.resolve()}'" for p in clips))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
         "-c", "copy", str(out_mp4)])


def mux(silent, audio, out):
    run([
        "ffmpeg", "-y", "-i", str(silent), "-i", str(audio),
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0", "-shortest",
        "-movflags", "+faststart", str(out),
    ])


def build_one(cut_name: str, ratio: str):
    audio = ASSETS / f"audio-{cut_name}.m4a"
    if not audio.exists():
        print("audio master missing — run build_motion.py first")
        return
    scenes = LONG if cut_name == "long" else SHORT
    print(f"→ {cut_name} {ratio}", flush=True)
    clips = []
    for s in scenes:
        print(f"   scene {s.sid} ({s.dur}s)", flush=True)
        clips.append(render_clip(s.sid, ratio, s.dur))
    silent = TMP / f"silent-{cut_name}-{ratio}.mp4"
    concat_clips(clips, silent)
    out = EXPORTS / f"vicious-explainer-{cut_name}-{ratio}.mp4"
    mux(silent, audio, out)
    print(f"   ✓ {out.name}", flush=True)


def main():
    if len(sys.argv) >= 3:
        build_one(sys.argv[1], sys.argv[2])
        return
    for ratio in RATIOS:
        for cut in ("long", "short"):
            build_one(cut, ratio)


if __name__ == "__main__":
    main()
