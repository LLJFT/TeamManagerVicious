#!/usr/bin/env python3
"""
Team Manager - Professional PDF Presentation Generator
Generates a polished landscape A4 presentation with dark navy theme.
"""

import os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import Color, HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage

WIDTH, HEIGHT = landscape(A4)

BG_COLOR = HexColor("#0a1628")
BG_LIGHTER = HexColor("#0f1f38")
BG_CARD = HexColor("#111d33")
CYAN = HexColor("#00c8ff")
CYAN_DIM = HexColor("#0090b8")
CYAN_DARK = HexColor("#005570")
WHITE = HexColor("#ffffff")
WHITE_DIM = HexColor("#b0bec5")
WHITE_FAINT = HexColor("#607080")
GOLD = HexColor("#ffc107")
CORAL = HexColor("#ff6b6b")
GREEN = HexColor("#4caf50")
ORANGE = HexColor("#ff9800")

BOTTOM_BAR_H = 22
MARGIN = 40

SCREENSHOTS = {
    "schedule": "uploads/schedule.png",
    "events": "uploads/events.png",
    "results": "uploads/results.png",
    "scoreboard": "attached_assets/scoreboard_1771832282497.png",
    "stats": "uploads/stats.png",
    "compare": "uploads/compare.png",
    "opponents": "uploads/opponents.png",
    "player_stats": "uploads/player_stats.png",
    "player_by_mode": "attached_assets/player_stat_by_mode_1771832364652.png",
    "player_vs_opp": "attached_assets/player_stats_vs_opponents_1771832378197.png",
    "players": "uploads/players.png",
    "attendance_add": "attached_assets/attendance_add_1771832428257.png",
    "attendance_record": "attached_assets/attendance_record_1771832428257.png",
    "dashboard_users": "uploads/dashboard_users.png",
    "dashboard_log": "uploads/dashboard_log.png",
    "chat": "uploads/chat.png",
}


def draw_background(c):
    c.setFillColor(BG_COLOR)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)


def draw_bottom_bar(c, current_slide, total_slides):
    bar_y = 0
    c.setFillColor(HexColor("#060e1a"))
    c.rect(0, bar_y, WIDTH, BOTTOM_BAR_H, fill=1, stroke=0)

    progress_w = 200
    progress_h = 4
    progress_x = (WIDTH - progress_w) / 2
    progress_y = bar_y + (BOTTOM_BAR_H - progress_h) / 2

    c.setFillColor(HexColor("#1a2a40"))
    c.roundRect(progress_x, progress_y, progress_w, progress_h, 2, fill=1, stroke=0)

    fill_w = progress_w * (current_slide / total_slides)
    if fill_w > 0:
        c.setFillColor(CYAN)
        c.roundRect(progress_x, progress_y, fill_w, progress_h, 2, fill=1, stroke=0)

    c.setFillColor(WHITE_FAINT)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, bar_y + 7, "Team Manager")
    c.drawRightString(WIDTH - MARGIN, bar_y + 7, "@2ndd")


def draw_drop_shadow(c, x, y, w, h, offset=4, blur_steps=6):
    for i in range(blur_steps, 0, -1):
        alpha = 0.08 * (blur_steps - i + 1) / blur_steps
        shadow_color = Color(0, 0, 0, alpha)
        c.setFillColor(shadow_color)
        expand = i * 1.5
        c.roundRect(
            x + offset - expand / 2,
            y - offset - expand / 2,
            w + expand,
            h + expand,
            4,
            fill=1,
            stroke=0,
        )


def draw_screenshot(c, img_path, x, y, max_w, max_h):
    if not os.path.exists(img_path):
        c.setFillColor(BG_CARD)
        c.roundRect(x, y, max_w, max_h, 6, fill=1, stroke=0)
        c.setFillColor(WHITE_FAINT)
        c.setFont("Helvetica", 10)
        c.drawCentredString(x + max_w / 2, y + max_h / 2, "Screenshot not available")
        return

    try:
        img = PILImage.open(img_path)
        iw, ih = img.size
    except Exception:
        iw, ih = 1920, 1080

    scale = min(max_w / iw, max_h / ih)
    draw_w = iw * scale
    draw_h = ih * scale

    draw_x = x + (max_w - draw_w) / 2
    draw_y = y + (max_h - draw_h) / 2

    draw_drop_shadow(c, draw_x, draw_y, draw_w, draw_h, offset=5, blur_steps=8)

    c.setStrokeColor(HexColor("#1a3050"))
    c.setLineWidth(1)
    c.roundRect(draw_x - 1, draw_y - 1, draw_w + 2, draw_h + 2, 4, fill=0, stroke=1)

    c.drawImage(
        img_path, draw_x, draw_y, draw_w, draw_h,
        preserveAspectRatio=True, mask="auto"
    )


def draw_feature_slide(c, slide_num, total, title, subtitle, bullets, screenshot_key,
                        left_pct=0.30):
    draw_background(c)

    left_w = WIDTH * left_pct
    right_w = WIDTH * (1 - left_pct)

    c.setFillColor(CYAN)
    c.setFont("Helvetica-Bold", 26)
    title_y = HEIGHT - 100
    max_title_w = left_w - MARGIN * 2

    words = title.split()
    lines = []
    current_line = ""
    for word in words:
        test = current_line + (" " if current_line else "") + word
        if c.stringWidth(test, "Helvetica-Bold", 26) > max_title_w and current_line:
            lines.append(current_line)
            current_line = word
        else:
            current_line = test
    if current_line:
        lines.append(current_line)

    for i, line in enumerate(lines):
        c.drawString(MARGIN, title_y - i * 32, line)
    title_bottom = title_y - (len(lines) - 1) * 32

    if subtitle:
        c.setFillColor(WHITE_DIM)
        c.setFont("Helvetica", 11)
        c.drawString(MARGIN, title_bottom - 28, subtitle)
        bullet_start_y = title_bottom - 60
    else:
        bullet_start_y = title_bottom - 40

    c.setFont("Helvetica", 11)
    line_height = 22
    for i, bullet in enumerate(bullets):
        by = bullet_start_y - i * line_height
        c.setFillColor(CYAN)
        c.drawString(MARGIN, by, "\u2022")
        c.setFillColor(WHITE_DIM)

        bwords = bullet.split()
        blines = []
        bcurrent = ""
        for word in bwords:
            test = bcurrent + (" " if bcurrent else "") + word
            if c.stringWidth(test, "Helvetica", 11) > max_title_w - 20 and bcurrent:
                blines.append(bcurrent)
                bcurrent = word
            else:
                bcurrent = test
        if bcurrent:
            blines.append(bcurrent)

        for j, bline in enumerate(blines):
            c.drawString(MARGIN + 14, by - j * 16, bline)
        if len(blines) > 1:
            bullet_start_y -= (len(blines) - 1) * 16

    img_margin = 20
    img_x = left_w + img_margin
    img_y = BOTTOM_BAR_H + img_margin + 10
    img_w = right_w - img_margin * 2
    img_h = HEIGHT - img_y - img_margin - 10

    img_path = SCREENSHOTS.get(screenshot_key, "")
    draw_screenshot(c, img_path, img_x, img_y, img_w, img_h)

    draw_bottom_bar(c, slide_num, total)
    c.showPage()


def draw_title_slide(c, slide_num, total):
    draw_background(c)

    c.setFillColor(BG_LIGHTER)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)

    for i in range(5):
        alpha = 0.03 * (5 - i)
        c.setStrokeColor(Color(0, 0.78, 1, alpha))
        c.setLineWidth(1)
        r = 150 + i * 60
        c.circle(WIDTH * 0.75, HEIGHT * 0.4, r, fill=0, stroke=1)

    c.setFillColor(CYAN)
    logo_x = WIDTH / 2
    logo_y = HEIGHT - 160
    c.circle(logo_x, logo_y, 30, fill=0, stroke=0)
    c.setStrokeColor(CYAN)
    c.setLineWidth(3)
    c.circle(logo_x, logo_y, 30, fill=0, stroke=1)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(logo_x, logo_y - 8, "TM")

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 44)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 + 30, "Team Manager")

    c.setFillColor(CYAN)
    c.setFont("Helvetica", 18)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 10, "Professional Esports Team Management Platform")

    line_w = 100
    c.setStrokeColor(CYAN_DARK)
    c.setLineWidth(2)
    c.line(WIDTH / 2 - line_w / 2, HEIGHT / 2 - 35, WIDTH / 2 + line_w / 2, HEIGHT / 2 - 35)

    c.setFillColor(WHITE_DIM)
    c.setFont("Helvetica", 13)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 60,
                        "Streamline your team operations. Dominate the competition.")

    c.setFillColor(WHITE_FAINT)
    c.setFont("Helvetica", 10)
    c.drawCentredString(WIDTH / 2, 80, "Built for competitive teams who take winning seriously")

    draw_bottom_bar(c, slide_num, total)
    c.showPage()


def draw_pricing_slide(c, slide_num, total):
    draw_background(c)

    c.setFillColor(CYAN)
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(WIDTH / 2, HEIGHT - 65, "Choose Your Plan")
    c.setFillColor(WHITE_DIM)
    c.setFont("Helvetica", 12)
    c.drawCentredString(WIDTH / 2, HEIGHT - 88, "Flexible pricing that scales with your team")

    card_w = 230
    card_h = 340
    gap = 30
    total_w = card_w * 3 + gap * 2
    start_x = (WIDTH - total_w) / 2
    card_y = HEIGHT / 2 - card_h / 2 - 10

    plans = [
        {
            "name": "Monthly",
            "price": "$40",
            "per": "/mo",
            "discount": None,
            "was": None,
            "save": None,
            "best": False,
            "total": None,
            "features": [
                "Schedule Management",
                "Events & Results",
                "Players Management",
                "Match History",
                "Dashboard (Users only)",
            ],
        },
        {
            "name": "3 Months",
            "price": "$30",
            "per": "/mo",
            "discount": "Save 25%",
            "was": "$40/mo",
            "save": "25%",
            "best": False,
            "total": "$90 total",
            "features": [
                "Everything in Monthly",
                "Statistics & Analytics",
                "Player Stats & Stat Fields",
                "Compare Performance",
                "Opponent Analysis",
            ],
        },
        {
            "name": "6 Months",
            "price": "$26",
            "per": "/mo",
            "discount": "Save 35%",
            "was": "$40/mo",
            "save": "35%",
            "best": True,
            "total": "$156 total",
            "features": [
                "Everything in 3 Months",
                "Unlimited Users",
                "Full Admin Access",
                "Game Config & Roles",
                "Activity Log",
                "Unlimited Storage",
                "Custom Permissions",
            ],
        },
    ]

    for i, plan in enumerate(plans):
        cx = start_x + i * (card_w + gap)
        cy = card_y

        if plan["best"]:
            cy += 10
            ch = card_h + 10
            c.setStrokeColor(CYAN)
            c.setLineWidth(2)
            c.setFillColor(HexColor("#0a1e35"))
            c.roundRect(cx, cy - 5, card_w, ch, 10, fill=1, stroke=1)

            banner_h = 24
            c.setFillColor(CYAN)
            c.roundRect(cx, cy + ch - banner_h - 5, card_w, banner_h + 5, 10, fill=1, stroke=0)
            c.setFillColor(HexColor("#0a1628"))
            c.rect(cx, cy + ch - banner_h - 5, card_w, 10, fill=1, stroke=0)
            c.setFillColor(CYAN)
            c.roundRect(cx, cy + ch - banner_h, card_w, banner_h + 5, 10, fill=1, stroke=0)
            c.setFillColor(BG_COLOR)
            c.setFont("Helvetica-Bold", 11)
            c.drawCentredString(cx + card_w / 2, cy + ch - banner_h + 5, "BEST VALUE")
        else:
            ch = card_h
            c.setStrokeColor(HexColor("#1a3050"))
            c.setLineWidth(1)
            c.setFillColor(BG_CARD)
            c.roundRect(cx, cy, card_w, ch, 10, fill=1, stroke=1)

        content_top = cy + ch - (40 if plan["best"] else 20)

        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(cx + card_w / 2, content_top - 10, plan["name"])

        c.setFillColor(CYAN if plan["best"] else WHITE)
        c.setFont("Helvetica-Bold", 36)
        price_w = c.stringWidth(plan["price"], "Helvetica-Bold", 36)
        price_x = cx + card_w / 2 - price_w / 2 - 10
        c.drawString(price_x, content_top - 55, plan["price"])
        c.setFillColor(WHITE_DIM)
        c.setFont("Helvetica", 14)
        c.drawString(price_x + price_w + 2, content_top - 50, plan["per"])

        info_y = content_top - 75
        if plan["was"]:
            c.setFillColor(WHITE_FAINT)
            c.setFont("Helvetica", 9)
            was_text = f"was {plan['was']}"
            c.drawCentredString(cx + card_w / 2 - 30, info_y, was_text)

            c.setFillColor(GREEN)
            c.setFont("Helvetica-Bold", 9)
            c.drawCentredString(cx + card_w / 2 + 30, info_y, plan["discount"])
            info_y -= 14

        if plan["total"]:
            c.setFillColor(WHITE_FAINT)
            c.setFont("Helvetica", 9)
            c.drawCentredString(cx + card_w / 2, info_y, plan["total"])

        c.setStrokeColor(HexColor("#1a3050"))
        c.setLineWidth(0.5)
        sep_y = content_top - 100
        c.line(cx + 20, sep_y, cx + card_w - 20, sep_y)

        feat_y = sep_y - 20
        c.setFont("Helvetica", 9.5)
        for feat in plan["features"]:
            c.setFillColor(CYAN)
            c.drawString(cx + 25, feat_y, "\u2713")
            c.setFillColor(WHITE_DIM)
            c.drawString(cx + 40, feat_y, feat)
            feat_y -= 18

    draw_bottom_bar(c, slide_num, total)
    c.showPage()


def draw_custom_order_slide(c, slide_num, total):
    draw_background(c)

    for i in range(3):
        alpha = 0.04 * (3 - i)
        gc = Color(0, 0.78, 1, alpha)
        c.setFillColor(gc)
        c.roundRect(
            MARGIN + i * 15, BOTTOM_BAR_H + 30 + i * 15,
            WIDTH - MARGIN * 2 - i * 30, HEIGHT - BOTTOM_BAR_H - 60 - i * 30,
            15, fill=1, stroke=0
        )

    c.setFillColor(HexColor("#0d1f35"))
    c.setStrokeColor(CYAN_DARK)
    c.setLineWidth(1.5)
    box_x = MARGIN + 50
    box_y = BOTTOM_BAR_H + 80
    box_w = WIDTH - MARGIN * 2 - 100
    box_h = HEIGHT - BOTTOM_BAR_H - 150
    c.roundRect(box_x, box_y, box_w, box_h, 12, fill=1, stroke=1)

    c.setFillColor(CYAN)
    c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(WIDTH / 2, box_y + box_h - 70, "Want something custom?")

    c.setStrokeColor(CYAN)
    c.setLineWidth(2)
    line_w = 60
    c.line(WIDTH / 2 - line_w, box_y + box_h - 90, WIDTH / 2 + line_w, box_y + box_h - 90)

    body_lines = [
        "We offer fully custom-built versions of Team Manager",
        "tailored to your team's needs.",
        "",
        "Different game. Different features. Different design.",
        "Whatever you need, we'll build it.",
    ]

    c.setFont("Helvetica", 15)
    text_y = box_y + box_h - 135
    for line in body_lines:
        if line == "":
            text_y -= 10
            continue
        if "Different game" in line:
            c.setFillColor(WHITE)
            c.setFont("Helvetica-Bold", 15)
        else:
            c.setFillColor(WHITE_DIM)
            c.setFont("Helvetica", 15)
        c.drawCentredString(WIDTH / 2, text_y, line)
        text_y -= 26

    features = [
        "Custom Game Support",
        "Tailored Features",
        "Unique Design",
        "Priority Support",
    ]

    feat_y = text_y - 20
    feat_gap = 160
    total_feat_w = (len(features) - 1) * feat_gap
    feat_start_x = WIDTH / 2 - total_feat_w / 2

    for i, feat in enumerate(features):
        fx = feat_start_x + i * feat_gap
        c.setFillColor(CYAN)
        c.circle(fx, feat_y + 12, 4, fill=1, stroke=0)
        c.setFillColor(WHITE_DIM)
        c.setFont("Helvetica", 11)
        c.drawCentredString(fx, feat_y - 8, feat)

    c.setFillColor(CYAN)
    cta_w = 180
    cta_h = 36
    cta_x = WIDTH / 2 - cta_w / 2
    cta_y = box_y + 30
    c.roundRect(cta_x, cta_y, cta_w, cta_h, 18, fill=1, stroke=0)
    c.setFillColor(BG_COLOR)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(WIDTH / 2, cta_y + 11, "Contact Us Today")

    draw_bottom_bar(c, slide_num, total)
    c.showPage()


def draw_cta_slide(c, slide_num, total):
    draw_background(c)

    c.setFillColor(BG_LIGHTER)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)

    for i in range(4):
        alpha = 0.025 * (4 - i)
        c.setStrokeColor(Color(0, 0.78, 1, alpha))
        c.setLineWidth(1)
        r = 100 + i * 80
        c.circle(WIDTH / 2, HEIGHT / 2, r, fill=0, stroke=1)

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 40)
    c.drawCentredString(WIDTH / 2, HEIGHT - 140, "Get Started Today")

    c.setFillColor(WHITE_DIM)
    c.setFont("Helvetica", 14)
    c.drawCentredString(WIDTH / 2, HEIGHT - 175,
                        "Ready to take your team to the next level?")

    c.setStrokeColor(CYAN_DARK)
    c.setLineWidth(1)
    box_w = 400
    box_h = 160
    box_x = WIDTH / 2 - box_w / 2
    box_y = HEIGHT / 2 - box_h / 2 - 10
    c.setFillColor(HexColor("#0d1f35"))
    c.roundRect(box_x, box_y, box_w, box_h, 12, fill=1, stroke=1)

    contact_y = box_y + box_h - 40

    c.setFillColor(CYAN)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(WIDTH / 2, contact_y + 10, "CONTACT US")

    c.setStrokeColor(HexColor("#1a3050"))
    c.setLineWidth(0.5)
    c.line(box_x + 40, contact_y, box_x + box_w - 40, contact_y)

    c.setFillColor(WHITE_FAINT)
    c.setFont("Helvetica", 11)
    c.drawString(box_x + 50, contact_y - 35, "Discord")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(box_x + 150, contact_y - 40, "@2ndd")

    c.setFillColor(WHITE_FAINT)
    c.setFont("Helvetica", 11)
    c.drawString(box_x + 50, contact_y - 80, "Email")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(box_x + 150, contact_y - 85, "lljftpp@gmail.com")

    c.setFillColor(CYAN)
    cta_w = 200
    cta_h = 40
    cta_x = WIDTH / 2 - cta_w / 2
    cta_y = box_y - 60
    c.roundRect(cta_x, cta_y, cta_w, cta_h, 20, fill=1, stroke=0)
    c.setFillColor(BG_COLOR)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(WIDTH / 2, cta_y + 13, "Let's Build Together")

    c.setFillColor(WHITE_FAINT)
    c.setFont("Helvetica", 9)
    c.drawCentredString(WIDTH / 2, 55, "Team Manager  |  Professional Esports Management  |  @2ndd")

    draw_bottom_bar(c, slide_num, total)
    c.showPage()


def generate_pdf():
    output_path = "Team_Manager_Presentation.pdf"

    slides = [
        ("title", None),
        ("feature", {
            "title": "Schedule",
            "subtitle": "Weekly availability at a glance",
            "bullets": [
                "Persistent weekly availability grid",
                "Per-player time slot management",
                "Staff availability tracking",
                "Availability overview with statistics",
                "Coverage percentage and status",
            ],
            "screenshot": "schedule",
        }),
        ("feature", {
            "title": "Events Calendar",
            "subtitle": "Organize scrims, tournaments, and more",
            "bullets": [
                "Full monthly calendar view",
                "Color-coded event types",
                "Scrim and tournament scheduling",
                "OFF day management",
                "One-click event duplication",
            ],
            "screenshot": "events",
        }),
        ("feature", {
            "title": "Events & Results",
            "subtitle": "Track outcomes and performance",
            "bullets": [
                "Upcoming and past event views",
                "Win/Loss result badges",
                "Opponent tracking per event",
                "Type badges (Scrim / Tournament)",
                "Quick-view event details",
            ],
            "screenshot": "results",
        }),
        ("feature", {
            "title": "Game Scoreboard",
            "subtitle": "Detailed game-level tracking",
            "bullets": [
                "Per-game score and result tracking",
                "Player stat entry per game",
                "Game mode and map selection",
                "Scoreboard image uploads",
                "VOD link support",
            ],
            "screenshot": "scoreboard",
        }),
        ("feature", {
            "title": "Overall Statistics",
            "subtitle": "Combined performance across all events",
            "bullets": [
                "Event and game win rates",
                "Performance by game mode",
                "Performance by map",
                "Overall, monthly, and seasonal filters",
                "Scrim vs tournament breakdown",
            ],
            "screenshot": "stats",
        }),
        ("feature", {
            "title": "Compare & Opponents",
            "subtitle": "Deep-dive performance analysis",
            "bullets": [
                "Season vs season comparison",
                "Month vs month analysis",
                "Performance trend tracking",
                "Win rate change indicators",
                "Best modes and maps per period",
            ],
            "screenshot": "compare",
        }),
        ("feature", {
            "title": "Stats by Opponent",
            "subtitle": "Performance analysis against each team",
            "bullets": [
                "Per-opponent win rates",
                "Best modes and maps vs each team",
                "Strength indicators",
                "Match history per opponent",
                "Sortable by most matches played",
            ],
            "screenshot": "opponents",
        }),
        ("feature", {
            "title": "Player Statistics",
            "subtitle": "Per-player stat aggregations and breakdowns",
            "bullets": [
                "Player leaderboard rankings",
                "Individual stat totals and averages",
                "Overall and by-mode breakdowns",
                "Per-opponent performance tracking",
                "Dynamic custom stat fields",
            ],
            "screenshot": "player_stats",
        }),
        ("feature", {
            "title": "Player Stats by Mode",
            "subtitle": "Granular performance per game mode",
            "bullets": [
                "Stat breakdown per game mode",
                "Kills, deaths, objectives tracked",
                "Mode-specific averages",
                "Custom stat field support",
                "Toggle between overall and mode view",
            ],
            "screenshot": "player_by_mode",
        }),
        ("feature", {
            "title": "Player vs Opponents",
            "subtitle": "Individual matchup breakdowns",
            "bullets": [
                "Per-player stats against each opponent",
                "Win rate badges per matchup",
                "Expandable stat details",
                "Kill/death/objective breakdowns",
                "Cross-opponent comparisons",
            ],
            "screenshot": "player_vs_opp",
        }),
        ("feature", {
            "title": "Players & Attendance",
            "subtitle": "Manage your roster and track attendance",
            "bullets": [
                "Full player roster management",
                "Role assignments (AR, SUB, Flex)",
                "Attendance statistics overview",
                "Individual attendance records",
                "Staff integration in roster view",
            ],
            "screenshot": "players",
        }),
        ("feature", {
            "title": "Add Attendance",
            "subtitle": "Quick and easy record creation",
            "bullets": [
                "Date picker with event linking",
                "Status selection (Attended/Late/Absent)",
                "Optional notes per record",
                "Ringer name tracking",
                "Event auto-population",
            ],
            "screenshot": "attendance_add",
        }),
        ("feature", {
            "title": "Attendance History",
            "subtitle": "Detailed per-player attendance tracking",
            "bullets": [
                "Complete attendance timeline",
                "Status badges per record",
                "Event-linked history view",
                "Filterable and searchable",
                "Individual record management",
            ],
            "screenshot": "attendance_record",
        }),
        ("feature", {
            "title": "Team Chat",
            "subtitle": "Discord-style integrated messaging",
            "bullets": [
                "Channel-based conversations",
                "File sharing and image preview",
                "Video and audio playback",
                "Voice message recording",
                "Emoji support and @mentions",
                "Role-based message permissions",
            ],
            "screenshot": "chat",
        }),
        ("feature", {
            "title": "Dashboard & Users",
            "subtitle": "Full administrative control",
            "bullets": [
                "User management and approval",
                "Role assignment (Owner/Admin/Member)",
                "Player linking per user",
                "Ban/unban and force logout",
                "Account creation and renaming",
            ],
            "screenshot": "dashboard_users",
        }),
        ("feature", {
            "title": "Activity Log",
            "subtitle": "Complete audit trail of all actions",
            "bullets": [
                "Team activity and system log",
                "44 tracked action types",
                "Filterable by action and user",
                "Per-entry deletion (Owner only)",
                "Login tracking with device info",
            ],
            "screenshot": "dashboard_log",
        }),
        ("pricing", None),
        ("custom", None),
        ("cta", None),
    ]

    total_slides = len(slides)
    c = canvas.Canvas(output_path, pagesize=landscape(A4))
    c.setTitle("Team Manager - Professional Esports Management Platform")
    c.setAuthor("@2ndd")

    for idx, (slide_type, data) in enumerate(slides):
        slide_num = idx + 1

        if slide_type == "title":
            draw_title_slide(c, slide_num, total_slides)
        elif slide_type == "feature":
            draw_feature_slide(
                c, slide_num, total_slides,
                data["title"], data["subtitle"],
                data["bullets"], data["screenshot"]
            )
        elif slide_type == "pricing":
            draw_pricing_slide(c, slide_num, total_slides)
        elif slide_type == "custom":
            draw_custom_order_slide(c, slide_num, total_slides)
        elif slide_type == "cta":
            draw_cta_slide(c, slide_num, total_slides)

    c.save()
    print(f"PDF generated: {output_path}")
    print(f"Total slides: {total_slides}")
    print(f"File size: {os.path.getsize(output_path) / 1024:.1f} KB")


if __name__ == "__main__":
    generate_pdf()
