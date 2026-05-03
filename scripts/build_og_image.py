"""Generate Vicious OG share image (1200x630 PNG) and app icon PNGs."""
from PIL import Image, ImageDraw, ImageFont
import os, subprocess

W, H = 1200, 630
ONYX = (14, 17, 23)
CRIMSON = (225, 29, 46)
BONE = (245, 246, 248)
STEEL = (91, 101, 115)
MUTED = (156, 163, 175)
SOFT = (203, 213, 225)
GRID = (31, 37, 48)


def find_font(keywords):
    try:
        out = subprocess.check_output(["fc-match", "-f", "%{file}\n", keywords], text=True, timeout=3)
        path = out.strip().splitlines()[0]
        if path and os.path.exists(path):
            return path
    except Exception:
        pass
    for cand in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        if os.path.exists(cand):
            return cand
    return None


bold_path = find_font("Inter:weight=900") or find_font("sans-serif:weight=900")
reg_path = find_font("Inter:weight=400") or find_font("sans-serif")


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


img = Image.new("RGB", (W, H), ONYX)
draw = ImageDraw.Draw(img)

for x in range(0, W, 40):
    draw.line([(x, 0), (x, H)], fill=GRID, width=1)
for y in range(0, H, 40):
    draw.line([(0, y), (W, y)], fill=GRID, width=1)

draw.rectangle([0, 0, 8, H], fill=CRIMSON)

vpts = [(0, 0), (42, 0), (70, 110), (98, 0), (140, 0), (84, 230), (56, 230)]
draw.polygon([(80 + x, 130 + y) for x, y in vpts], fill=CRIMSON)

f_huge = font(bold_path, 120)
f_lead = font(bold_path, 34)
f_eyebrow = font(reg_path, 18)
f_body = font(reg_path, 20)
f_meta = font(reg_path, 13)


def tracked(xy, text, fnt, fill, tracking=0):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        bbox = fnt.getbbox(ch)
        x += (bbox[2] - bbox[0]) + tracking


tracked((260, 170), "VICIOUS", f_huge, BONE, tracking=10)
tracked((262, 310), "ESPORTS  \u00b7  TEAM PLATFORM", f_eyebrow, MUTED, tracking=8)
draw.rectangle([260, 360, 360, 363], fill=CRIMSON)
draw.text((260, 395), "Run your roster like a pro.", font=f_lead, fill=BONE)
draw.text((260, 450), "The tactical command center for multi-game esports teams \u2014", font=f_body, fill=SOFT)
draw.text((260, 480), "schedule, scout, and scale your roster.", font=f_body, fill=SOFT)
tracked((80, 595), "VICIOUS  \u00b7  v1.0", f_meta, STEEL, tracking=4)

os.makedirs("brand/exports", exist_ok=True)
img.save("brand/exports/vicious-og-1200x630.png", "PNG", optimize=True)
img.save("client/public/vicious-og.png", "PNG", optimize=True)

icon_pts = [(96, 112), (184, 112), (256, 320), (328, 112), (416, 112), (292, 448), (220, 448)]
for size in (512, 1024):
    icon = Image.new("RGB", (size, size), ONYX)
    d2 = ImageDraw.Draw(icon)
    s = size / 512
    d2.polygon([(int(x * s), int(y * s)) for x, y in icon_pts], fill=CRIMSON)
    icon.save(f"brand/exports/vicious-app-icon-{size}.png", "PNG", optimize=True)

print("Wrote OG image and app icon PNGs.")
