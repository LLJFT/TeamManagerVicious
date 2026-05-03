"""Build two one-page sales PDFs that match the dark premium identity of the
sales decks (Inter typography, deep navy / cyan / coral palette).

Outputs:
- deliverables/sales_decks/Individuals_OnePager.pdf
- deliverables/sales_decks/Organizations_OnePager.pdf

Each one-pager is a single US-Letter portrait page containing:
- Headline value proposition
- Top 3-4 features
- One stat block
- One CTA with URL
"""
import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ---------- Brand system (mirrors scripts/build_sales_decks.py) ----------
BG_DEEP    = HexColor("#0A0F1C")
BG         = HexColor("#0F172A")
SURFACE    = HexColor("#16213A")
SURFACE_2  = HexColor("#1E2C4A")
LINE       = HexColor("#2A3A5C")
PRIMARY    = HexColor("#1FA8E0")
PRIMARY_DK = HexColor("#0E6E96")
ACCENT     = HexColor("#F26D55")
SUCCESS    = HexColor("#22C55E")
TEXT       = HexColor("#E7ECF5")
TEXT_MUTED = HexColor("#9AA6C0")
TEXT_DIM   = HexColor("#6A7895")
WHITE      = HexColor("#FFFFFF")

PAGE_W, PAGE_H = LETTER  # 612 x 792 pt

# ---------- Font registration: Inter is required (vendored in repo) ----------
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_FONT_DIR = os.path.join(_REPO_ROOT, "assets", "fonts")
_INTER_REG_PATH = os.path.join(_FONT_DIR, "Inter-Regular.ttf")
_INTER_BOLD_PATH = os.path.join(_FONT_DIR, "Inter-Bold.ttf")

def _register_inter():
    missing = [p for p in (_INTER_REG_PATH, _INTER_BOLD_PATH) if not os.path.exists(p)]
    if missing:
        raise RuntimeError(
            "Required Inter font files are missing: " + ", ".join(missing) +
            ". Inter typography is required to match the sales decks."
        )
    pdfmetrics.registerFont(TTFont("Inter", _INTER_REG_PATH))
    pdfmetrics.registerFont(TTFont("Inter-Bold", _INTER_BOLD_PATH))
    return "Inter", "Inter-Bold"

FONT_REG, FONT_BOLD = _register_inter()

# ---------- Drawing helpers ----------
def rect(c, x, y, w, h, fill=None, stroke=None, stroke_w=0.5, radius=None):
    if fill is not None:
        c.setFillColor(fill)
    if stroke is not None:
        c.setStrokeColor(stroke)
        c.setLineWidth(stroke_w)
    fill_flag = 1 if fill is not None else 0
    stroke_flag = 1 if stroke is not None else 0
    if radius:
        c.roundRect(x, y, w, h, radius, stroke=stroke_flag, fill=fill_flag)
    else:
        c.rect(x, y, w, h, stroke=stroke_flag, fill=fill_flag)

def text(c, x, y, s, *, size=10, bold=False, color=TEXT, align="left"):
    font = FONT_BOLD if bold else FONT_REG
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, s)
    elif align == "right":
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)

def wrap_text(c, x, y, max_w, text_str, *, size=10, bold=False, color=TEXT,
              leading=None):
    """Draw left-aligned wrapped text. Returns y of the last baseline drawn."""
    font = FONT_BOLD if bold else FONT_REG
    c.setFont(font, size)
    c.setFillColor(color)
    if leading is None:
        leading = size * 1.32
    words = text_str.split()
    line = ""
    cur_y = y
    for w in words:
        test = (line + " " + w).strip()
        if pdfmetrics.stringWidth(test, font, size) <= max_w:
            line = test
        else:
            c.drawString(x, cur_y, line)
            cur_y -= leading
            line = w
    if line:
        c.drawString(x, cur_y, line)
    return cur_y

def eyebrow(c, x, y, label, color=PRIMARY):
    rect(c, x, y + 3, 16, 3, fill=color)
    text(c, x + 22, y, label.upper(), size=8, bold=True, color=color)

def feature_card(c, x, y, w, h, idx, title, body):
    rect(c, x, y, w, h, fill=SURFACE, stroke=LINE, stroke_w=0.6)
    # number badge
    rect(c, x + 12, y + h - 30, 22, 22, fill=PRIMARY_DK, radius=4)
    text(c, x + 12 + 11, y + h - 30 + 7, idx, size=10, bold=True,
         color=WHITE, align="center")
    # title (auto-shrink to fit one line in the available width)
    title_x = x + 42
    title_max = w - 42 - 12
    title_size = 11
    while (title_size > 8.5 and
           pdfmetrics.stringWidth(title, FONT_BOLD, title_size) > title_max):
        title_size -= 0.5
    text(c, title_x, y + h - 22, title, size=title_size, bold=True, color=TEXT)
    # body
    wrap_text(c, x + 12, y + h - 50, w - 24, body,
              size=9, color=TEXT_MUTED, leading=12)

def stat_block(c, x, y, w, h, items):
    """items: list of (value, label, accent_color)."""
    rect(c, x, y, w, h, fill=SURFACE_2, stroke=LINE, stroke_w=0.6)
    n = len(items)
    col_w = w / n
    for i, (val, label, accent) in enumerate(items):
        cx = x + col_w * i
        # accent bar on left of each (except first)
        if i > 0:
            rect(c, cx, y + 12, 0.6, h - 24, fill=LINE)
        # value
        text(c, cx + col_w / 2, y + h - 32, val,
             size=22, bold=True, color=accent, align="center")
        # label (wrap to two lines if needed)
        # split into two lines on natural break
        c.setFont(FONT_REG, 8.5)
        c.setFillColor(TEXT_MUTED)
        words = label.split()
        line1, line2 = "", ""
        max_w = col_w - 16
        for w_ in words:
            test = (line1 + " " + w_).strip()
            if pdfmetrics.stringWidth(test, FONT_REG, 8.5) <= max_w:
                line1 = test
            else:
                test2 = (line2 + " " + w_).strip()
                line2 = test2
        c.drawCentredString(cx + col_w / 2, y + 24, line1)
        if line2:
            c.drawCentredString(cx + col_w / 2, y + 12, line2)

def cta_block(c, x, y, w, h, primary_label, primary_url, secondary_label):
    # primary button
    btn_w = (w - 14) / 2
    btn_h = h
    rect(c, x, y, btn_w, btn_h, fill=PRIMARY, radius=6)
    text(c, x + btn_w / 2, y + btn_h / 2 - 4, primary_label,
         size=11, bold=True, color=WHITE, align="center")
    # secondary outlined
    sx = x + btn_w + 14
    rect(c, sx, y, btn_w, btn_h, fill=None, stroke=PRIMARY, stroke_w=1.2,
         radius=6)
    text(c, sx + btn_w / 2, y + btn_h / 2 - 4, secondary_label,
         size=11, bold=True, color=PRIMARY, align="center")
    # url under primary
    text(c, x, y - 12, primary_url, size=8.5, color=TEXT_DIM)

def bullet_row(c, x, y, max_w, label, *, size=9.5, color=TEXT):
    # use a small filled square as the bullet glyph (always renders)
    rect(c, x, y + 2, 4, 4, fill=PRIMARY)
    wrap_text(c, x + 12, y, max_w - 12, label, size=size, color=color,
              leading=size * 1.35)

# ---------- Page chrome ----------
def page_chrome(c, eyebrow_label, edition_label):
    # full-bleed background
    rect(c, 0, 0, PAGE_W, PAGE_H, fill=BG_DEEP)
    # left accent column
    rect(c, 0, 0, 14, PAGE_H, fill=PRIMARY)
    # top thin band
    rect(c, 14, PAGE_H - 4, PAGE_W - 14, 4, fill=ACCENT)
    # top eyebrow
    eyebrow(c, 36, PAGE_H - 36, eyebrow_label, color=PRIMARY)
    # edition chip top-right
    chip_w, chip_h = 170, 18
    cx = PAGE_W - chip_w - 32
    cy = PAGE_H - 42
    rect(c, cx, cy, chip_w, chip_h, fill=None, stroke=PRIMARY, stroke_w=0.8,
         radius=4)
    text(c, cx + chip_w / 2, cy + 5, edition_label.upper(),
         size=8, bold=True, color=PRIMARY, align="center")
    # bottom footer line
    rect(c, 36, 36, PAGE_W - 72, 0.5, fill=LINE)
    text(c, 36, 24, "Roster Intelligence Platform",
         size=8, color=TEXT_DIM)
    text(c, PAGE_W - 36, 24,
         "Confidential sales material  ·  yourdomain.com",
         size=8, color=TEXT_DIM, align="right")

# ---------- Page builders ----------
def build_individuals_pdf(path):
    c = canvas.Canvas(path, pagesize=LETTER)
    c.setFont(FONT_REG, 10)
    c.setTitle("Roster Intelligence — Individuals One-Pager")

    page_chrome(
        c,
        eyebrow_label="Roster Intelligence  ·  Single Roster Edition",
        edition_label="Individuals  ·  Single Roster",
    )

    # ---- Headline block ----
    title_y = PAGE_H - 90
    text(c, 36, title_y, "Stop guessing.", size=30, bold=True, color=WHITE)
    text(c, 36, title_y - 32, "Start winning your matches.",
         size=30, bold=True, color=WHITE)
    # accent underline
    rect(c, 36, title_y - 46, 38, 3, fill=ACCENT)
    # subhead
    wrap_text(c, 36, title_y - 70, PAGE_W - 72,
              "A professional-grade roster, stats and prep workspace — built for "
              "the player who takes the game seriously. One roster, fully owned, "
              "with everything you need to log matches, scout opponents and "
              "actually improve.",
              size=11, color=TEXT_MUTED, leading=15)

    # ---- Top features (3 cards) ----
    eyebrow(c, 36, PAGE_H - 252, "What you get")
    card_y = PAGE_H - 380
    card_h = 110
    gap = 12
    card_w = (PAGE_W - 72 - gap * 2) / 3
    feature_card(c, 36 + (card_w + gap) * 0, card_y, card_w, card_h, "01",
                 "One Roster, Fully Owned",
                 "Players, matches, stats and scouting notes — private to you, "
                 "organized like a pro team would.")
    feature_card(c, 36 + (card_w + gap) * 1, card_y, card_w, card_h, "02",
                 "Real Match Data",
                 "Log results, drafts, maps, heroes/agents and KDA. Trends and "
                 "win-rates appear automatically as you play.")
    feature_card(c, 36 + (card_w + gap) * 2, card_y, card_w, card_h, "03",
                 "Pre-Match Prep",
                 "Scout opponents, study past meetups, and walk into your next "
                 "match knowing exactly what works.")

    # ---- Why-now bullet strip ----
    eyebrow(c, 36, card_y - 30, "Why it matters", color=ACCENT)
    bullets_y = card_y - 50
    bullets = [
        "Spot the comps your opponent loses to before the match starts",
        "Identify your weakest map and fix it with targeted practice",
        "Build a season narrative you can actually review and share",
    ]
    for i, b in enumerate(bullets):
        bullet_row(c, 36, bullets_y - i * 16, PAGE_W - 72, b, size=10)

    # ---- Stat block ----
    stat_y = bullets_y - (16 * len(bullets)) - 84
    stat_block(c, 36, stat_y, PAGE_W - 72, 64, [
        ("< 1 min",    "to log a match",                  PRIMARY),
        ("8–10",       "matches until insights land",     ACCENT),
        ("2.4x",       "improvement vs. ad-hoc prep",     SUCCESS),
    ])

    # ---- CTA ----
    cta_y = stat_y - 70
    cta_block(c, 36, cta_y, PAGE_W - 72, 40,
              primary_label="Start your free trial",
              primary_url="https://yourdomain.com/start",
              secondary_label="Book a 15-min demo")

    c.showPage()
    c.save()


def build_organizations_pdf(path):
    c = canvas.Canvas(path, pagesize=LETTER)
    c.setFont(FONT_REG, 10)
    c.setTitle("Roster Intelligence — Organizations One-Pager")

    page_chrome(
        c,
        eyebrow_label="Roster Intelligence  ·  Organization Edition",
        edition_label="Organizations  ·  Multi-Roster",
    )

    # ---- Headline block ----
    title_y = PAGE_H - 90
    text(c, 36, title_y, "Run your esports org",
         size=28, bold=True, color=WHITE)
    text(c, 36, title_y - 30, "like a professional team.",
         size=28, bold=True, color=WHITE)
    rect(c, 36, title_y - 44, 38, 3, fill=ACCENT)
    wrap_text(c, 36, title_y - 68, PAGE_W - 72,
              "A unified roster, analytics and scouting platform for "
              "organizations, coaches and managers. One source of truth for "
              "every roster, every game and every match — so the data your "
              "org generates actually compounds into a competitive edge.",
              size=11, color=TEXT_MUTED, leading=15)

    # ---- Top features (4 pillars) ----
    eyebrow(c, 36, PAGE_H - 252, "Platform pillars")
    card_y = PAGE_H - 380
    card_h = 110
    gap = 10
    card_w = (PAGE_W - 72 - gap * 3) / 4
    feature_card(c, 36 + (card_w + gap) * 0, card_y, card_w, card_h, "01",
                 "Roster Management",
                 "Multi-roster structure, players, roles, contracts and "
                 "attendance in one workspace.")
    feature_card(c, 36 + (card_w + gap) * 1, card_y, card_w, card_h, "02",
                 "Analytics",
                 "Hero, map, mode, draft and player performance — across "
                 "patches and rosters.")
    feature_card(c, 36 + (card_w + gap) * 2, card_y, card_w, card_h, "03",
                 "Scouting",
                 "Opponent profiles auto-built from your own match history. "
                 "No more starting from zero each event.")
    feature_card(c, 36 + (card_w + gap) * 3, card_y, card_w, card_h, "04",
                 "Org Controls",
                 "Roles, permissions, audit visibility and per-roster access "
                 "for staff and players.")

    # ---- What changes bullets ----
    eyebrow(c, 36, card_y - 30, "What changes for the org", color=ACCENT)
    bullets_y = card_y - 50
    bullets = [
        "Cross-roster visibility — one unified view across every team you run",
        "Match history persists when players move on; the org keeps the data",
        "Scouting auto-builds from your own matches instead of restarting each event",
    ]
    for i, b in enumerate(bullets):
        bullet_row(c, 36, bullets_y - i * 16, PAGE_W - 72, b, size=10)

    # ---- Stat block (ROI) ----
    stat_y = bullets_y - (16 * len(bullets)) - 84
    stat_block(c, 36, stat_y, PAGE_W - 72, 64, [
        ("8–12h",  "saved per roster, per month",   PRIMARY),
        ("100%",   "match history retained",         SUCCESS),
        ("3x",     "faster opponent prep",           ACCENT),
        ("1",      "source of truth for the org",    PRIMARY),
    ])

    # ---- CTA ----
    cta_y = stat_y - 70
    cta_block(c, 36, cta_y, PAGE_W - 72, 40,
              primary_label="Start an org pilot",
              primary_url="https://yourdomain.com/org-pilot",
              secondary_label="Book a walkthrough")

    c.showPage()
    c.save()


def _validate_pdf(path):
    """Sanity-check the generated PDF: exactly one page, Inter fonts embedded."""
    with open(path, "rb") as f:
        data = f.read()
    n_pages = data.count(b"/Type /Page") - data.count(b"/Type /Pages")
    if n_pages != 1:
        raise RuntimeError(f"{path}: expected 1 page, found {n_pages}")
    if b"Inter-Regular" not in data or b"Inter-Bold" not in data:
        raise RuntimeError(f"{path}: Inter fonts not embedded")


def main():
    out_dir = "deliverables/sales_decks"
    os.makedirs(out_dir, exist_ok=True)
    individuals = os.path.join(out_dir, "Individuals_OnePager.pdf")
    organizations = os.path.join(out_dir, "Organizations_OnePager.pdf")
    build_individuals_pdf(individuals)
    build_organizations_pdf(organizations)
    for p in (individuals, organizations):
        _validate_pdf(p)
        print(f"Wrote {p}  (validated: 1 page, Inter embedded)")


if __name__ == "__main__":
    main()
