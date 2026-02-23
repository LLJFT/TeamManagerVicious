#!/usr/bin/env python3
"""
Team Manager - Professional PDF Presentation Generator
Clean corporate SaaS pitch deck style.
"""

import os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import Color, HexColor, white, black
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from PIL import Image as PILImage

WIDTH, HEIGHT = landscape(A4)

BG = HexColor("#0a1628")
BG_SUBTLE = HexColor("#0e1b30")
CYAN = HexColor("#00c8ff")
CYAN_MUTED = HexColor("#0090b8")
TEXT_PRIMARY = HexColor("#ffffff")
TEXT_SECONDARY = HexColor("#94a3b8")
TEXT_TERTIARY = HexColor("#64748b")
DIVIDER = HexColor("#1e293b")
CARD_BG = HexColor("#0f1d32")
GREEN = HexColor("#22c55e")
FRAME_BG = HexColor("#f0f4f8")

MARGIN = 48
FOOTER_H = 24

SS_DIR = "screenshots_new/Screen shots_"
SCREENSHOTS = {
    "schedule": f"{SS_DIR}/schedule.png",
    "schedule_manage": f"{SS_DIR}/schedule_manage.png",
    "events": f"{SS_DIR}/events.png",
    "results": f"{SS_DIR}/results.png",
    "scoreboard": f"{SS_DIR}/scoreboard.png",
    "stats": f"{SS_DIR}/stats.png",
    "compare": f"{SS_DIR}/compare.png",
    "stats_by_opponents": f"{SS_DIR}/stats_by_opponents.png",
    "overall_player_stats": f"{SS_DIR}/overall_player_stats.png",
    "player_stat_by_mode": f"{SS_DIR}/player_stat_by_mode.png",
    "player_stats_vs_opponents": f"{SS_DIR}/player_stats_vs_opponents.png",
    "players": f"{SS_DIR}/players.png",
    "add_player": f"{SS_DIR}/add_player.png",
    "view_staff": f"{SS_DIR}/view_staff.png",
    "add_staff": f"{SS_DIR}/add_staff.png",
    "attendance_add": f"{SS_DIR}/attendance_add.png",
    "attendance_record": f"{SS_DIR}/attendance_record.png",
    "chat": f"{SS_DIR}/chat.png",
    "channel_settings": f"{SS_DIR}/channel_settings.png",
    "dashboard_users": f"{SS_DIR}/dashboard_users.png",
    "dashboard_roles": f"{SS_DIR}/dashboard_roles.png",
    "create_role": f"{SS_DIR}/create_role.png",
    "dashboard_team": f"{SS_DIR}/dashboard_team.png",
    "dashboard_game_config": f"{SS_DIR}/dashboard_game_config.png",
    "dashboard_log": f"{SS_DIR}/dashboard_log.png",
    "stat_fields": f"{SS_DIR}/stat_fields.png",
}


def draw_bg(c):
    c.setFillColor(BG)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)


def draw_footer(c, slide_num, total):
    c.setFillColor(HexColor("#060d18"))
    c.rect(0, 0, WIDTH, FOOTER_H, fill=1, stroke=0)

    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 7.5)
    c.drawString(MARGIN, 8, "Team Manager")

    c.setFillColor(TEXT_TERTIARY)
    c.drawRightString(WIDTH - MARGIN, 8, f"{slide_num} / {total}")

    bar_w = 120
    bar_h = 2
    bar_x = (WIDTH - bar_w) / 2
    bar_y = FOOTER_H / 2 - 1
    c.setFillColor(DIVIDER)
    c.roundRect(bar_x, bar_y, bar_w, bar_h, 1, fill=1, stroke=0)
    fill = bar_w * (slide_num / total)
    if fill > 0:
        c.setFillColor(CYAN)
        c.roundRect(bar_x, bar_y, fill, bar_h, 1, fill=1, stroke=0)


def draw_shadow(c, x, y, w, h):
    for i in range(10, 0, -1):
        alpha = 0.25 * (10 - i + 1) / 10
        c.setFillColor(Color(0, 0, 0, alpha))
        expand = i * 2.5
        c.roundRect(
            x + 4 - expand / 2,
            y - 6 - expand / 2,
            w + expand,
            h + expand,
            6, fill=1, stroke=0,
        )


def draw_framed_screenshot(c, img_path, x, y, max_w, max_h):
    if not os.path.exists(img_path):
        c.setFillColor(CARD_BG)
        c.roundRect(x, y, max_w, max_h, 4, fill=1, stroke=0)
        c.setFillColor(TEXT_TERTIARY)
        c.setFont("Helvetica", 9)
        c.drawCentredString(x + max_w / 2, y + max_h / 2, "[screenshot]")
        return

    try:
        img = PILImage.open(img_path)
        iw, ih = img.size
    except Exception:
        iw, ih = 1920, 1080

    pad = 6
    inner_w = max_w - pad * 2
    inner_h = max_h - pad * 2
    scale = min(inner_w / iw, inner_h / ih)
    draw_w = iw * scale
    draw_h = ih * scale

    frame_w = draw_w + pad * 2
    frame_h = draw_h + pad * 2
    frame_x = x + (max_w - frame_w) / 2
    frame_y = y + (max_h - frame_h) / 2

    draw_shadow(c, frame_x, frame_y, frame_w, frame_h)

    c.setFillColor(FRAME_BG)
    c.roundRect(frame_x, frame_y, frame_w, frame_h, 5, fill=1, stroke=0)

    c.drawImage(
        img_path, frame_x + pad, frame_y + pad, draw_w, draw_h,
        preserveAspectRatio=True, mask="auto"
    )


def wrap_text(c, text, font_name, font_size, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = current + (" " if current else "") + word
        if c.stringWidth(test, font_name, font_size) > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines


def draw_title_slide(c, sn, total):
    draw_bg(c)

    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 42)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 + 40, "Team Manager")

    c.setFillColor(CYAN)
    c.setFont("Helvetica", 16)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2, "Professional Esports Team Management")

    c.setStrokeColor(DIVIDER)
    c.setLineWidth(1)
    lw = 60
    c.line(WIDTH / 2 - lw, HEIGHT / 2 - 25, WIDTH / 2 + lw, HEIGHT / 2 - 25)

    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 12)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 - 50,
                        "Streamline operations. Track performance. Win more.")

    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 10)
    c.drawCentredString(WIDTH / 2, FOOTER_H + 40,
                        "Built for competitive teams who take winning seriously")

    draw_footer(c, sn, total)
    c.showPage()


def draw_feature_slide(c, sn, total, title, subtitle, bullets, screenshot_key,
                       layout="right"):
    draw_bg(c)

    img_path = SCREENSHOTS.get(screenshot_key, "")
    has_image = os.path.exists(img_path) if img_path else False

    if not has_image:
        layout = "text_only"

    if layout == "right":
        text_x = MARGIN
        text_w = WIDTH * 0.32 - MARGIN
        img_x = WIDTH * 0.32
        img_y = FOOTER_H + 20
        img_w = WIDTH * 0.68 - MARGIN
        img_h = HEIGHT - FOOTER_H - 40
    elif layout == "left":
        img_x = MARGIN
        img_y = FOOTER_H + 20
        img_w = WIDTH * 0.62 - MARGIN
        img_h = HEIGHT - FOOTER_H - 40
        text_x = WIDTH * 0.64
        text_w = WIDTH - WIDTH * 0.64 - MARGIN
    elif layout == "center":
        text_x = MARGIN
        text_w = WIDTH - MARGIN * 2
        img_x = MARGIN + 40
        img_y = FOOTER_H + 20
        img_w = WIDTH - MARGIN * 2 - 80
        img_h = HEIGHT - 200
    else:
        text_x = MARGIN
        text_w = WIDTH - MARGIN * 2

    title_y = HEIGHT - 70

    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 24)
    title_lines = wrap_text(c, title, "Helvetica-Bold", 24, text_w)
    for i, line in enumerate(title_lines):
        c.drawString(text_x, title_y - i * 30, line)
    current_y = title_y - (len(title_lines) - 1) * 30

    if subtitle:
        current_y -= 24
        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 11)
        c.drawString(text_x, current_y, subtitle)

    current_y -= 12
    c.setStrokeColor(DIVIDER)
    c.setLineWidth(0.5)
    c.line(text_x, current_y, text_x + min(text_w, 200), current_y)

    current_y -= 22

    c.setFont("Helvetica", 10.5)
    for bullet in bullets:
        bl = wrap_text(c, bullet, "Helvetica", 10.5, text_w - 16)
        for j, bline in enumerate(bl):
            if j == 0:
                c.setFillColor(CYAN)
                c.drawString(text_x, current_y, "\u2022")
            c.setFillColor(TEXT_SECONDARY)
            c.drawString(text_x + 14, current_y, bline)
            current_y -= 18

    if layout in ("right", "left"):
        draw_framed_screenshot(c, img_path, img_x, img_y, img_w, img_h)
    elif layout == "center" and has_image:
        draw_framed_screenshot(c, img_path, img_x, img_y, img_w, img_h)

    draw_footer(c, sn, total)
    c.showPage()


def draw_dual_screenshot_slide(c, sn, total, title, subtitle, key_left, key_right,
                                label_left="", label_right=""):
    draw_bg(c)

    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(WIDTH / 2, HEIGHT - 55, title)

    if subtitle:
        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 11)
        c.drawCentredString(WIDTH / 2, HEIGHT - 78, subtitle)

    gap = 24
    img_w = (WIDTH - MARGIN * 2 - gap) / 2
    img_h = HEIGHT - 140
    img_y = FOOTER_H + 20

    draw_framed_screenshot(c, SCREENSHOTS.get(key_left, ""),
                           MARGIN, img_y, img_w, img_h)
    draw_framed_screenshot(c, SCREENSHOTS.get(key_right, ""),
                           MARGIN + img_w + gap, img_y, img_w, img_h)

    if label_left:
        c.setFillColor(TEXT_TERTIARY)
        c.setFont("Helvetica", 8.5)
        c.drawCentredString(MARGIN + img_w / 2, img_y - 2, label_left)
    if label_right:
        c.setFillColor(TEXT_TERTIARY)
        c.setFont("Helvetica", 8.5)
        c.drawCentredString(MARGIN + img_w + gap + img_w / 2, img_y - 2, label_right)

    draw_footer(c, sn, total)
    c.showPage()


def draw_pricing_slide(c, sn, total):
    draw_bg(c)

    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(WIDTH / 2, HEIGHT - 60, "Choose Your Plan")
    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 11)
    c.drawCentredString(WIDTH / 2, HEIGHT - 82, "Flexible pricing for teams of any size")

    card_w = 220
    card_h = 320
    gap = 28
    total_w = card_w * 3 + gap * 2
    start_x = (WIDTH - total_w) / 2
    card_y = HEIGHT / 2 - card_h / 2 - 15

    plans = [
        {
            "name": "Monthly",
            "price": "$40",
            "per": "/mo",
            "desc": "Essential tools",
            "best": False,
            "features": [
                "Schedule Management",
                "Events & Results",
                "Player Management",
                "Match History",
                "Basic Dashboard",
            ],
        },
        {
            "name": "3 Months",
            "price": "$30",
            "per": "/mo",
            "desc": "$90 total  \u2022  Save 25%",
            "best": False,
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
            "desc": "$156 total  \u2022  Save 35%",
            "best": True,
            "features": [
                "Everything in 3 Months",
                "Unlimited Users & Storage",
                "Full Admin Access",
                "Custom Roles & Permissions",
                "Activity Log",
                "Game Config",
                "Priority Support",
            ],
        },
    ]

    for i, plan in enumerate(plans):
        cx = start_x + i * (card_w + gap)
        cy = card_y
        ch = card_h

        if plan["best"]:
            cy += 8
            ch += 12

            draw_shadow(c, cx - 2, cy - 2, card_w + 4, ch + 4)
            c.setStrokeColor(CYAN)
            c.setLineWidth(1.5)
            c.setFillColor(CARD_BG)
            c.roundRect(cx, cy, card_w, ch, 8, fill=1, stroke=1)

            c.setFillColor(CYAN)
            badge_w = 80
            badge_h = 20
            badge_x = cx + card_w / 2 - badge_w / 2
            badge_y = cy + ch - 6
            c.roundRect(badge_x, badge_y - badge_h / 2, badge_w, badge_h, 10, fill=1, stroke=0)
            c.setFillColor(BG)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(cx + card_w / 2, badge_y - 3, "BEST VALUE")
        else:
            c.setStrokeColor(DIVIDER)
            c.setLineWidth(1)
            c.setFillColor(CARD_BG)
            c.roundRect(cx, cy, card_w, ch, 8, fill=1, stroke=1)

        top = cy + ch - (35 if plan["best"] else 22)

        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 12)
        c.drawCentredString(cx + card_w / 2, top, plan["name"])

        c.setFillColor(TEXT_PRIMARY if not plan["best"] else CYAN)
        c.setFont("Helvetica-Bold", 34)
        pw = c.stringWidth(plan["price"], "Helvetica-Bold", 34)
        px = cx + card_w / 2 - pw / 2 - 8
        c.drawString(px, top - 42, plan["price"])
        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 12)
        c.drawString(px + pw + 2, top - 37, plan["per"])

        c.setFillColor(TEXT_TERTIARY)
        c.setFont("Helvetica", 8.5)
        c.drawCentredString(cx + card_w / 2, top - 60, plan["desc"])

        c.setStrokeColor(DIVIDER)
        c.setLineWidth(0.5)
        sep_y = top - 76
        c.line(cx + 20, sep_y, cx + card_w - 20, sep_y)

        fy = sep_y - 20
        c.setFont("Helvetica", 9)
        for feat in plan["features"]:
            c.setFillColor(CYAN if plan["best"] else GREEN)
            c.drawString(cx + 22, fy, "\u2713")
            c.setFillColor(TEXT_SECONDARY)
            c.drawString(cx + 36, fy, feat)
            fy -= 17

    draw_footer(c, sn, total)
    c.showPage()


def draw_custom_order_slide(c, sn, total):
    draw_bg(c)

    box_w = 500
    box_h = 260
    box_x = WIDTH / 2 - box_w / 2
    box_y = HEIGHT / 2 - box_h / 2

    c.setStrokeColor(DIVIDER)
    c.setLineWidth(1)
    c.setFillColor(CARD_BG)
    c.roundRect(box_x, box_y, box_w, box_h, 8, fill=1, stroke=1)

    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(WIDTH / 2, box_y + box_h - 50, "Want something custom?")

    c.setStrokeColor(DIVIDER)
    c.setLineWidth(0.5)
    c.line(box_x + 60, box_y + box_h - 65, box_x + box_w - 60, box_y + box_h - 65)

    lines = [
        "We build fully custom versions of Team Manager",
        "tailored to your team's specific needs.",
        "",
        "Different game. Different features. Different design.",
    ]

    ty = box_y + box_h - 95
    for line in lines:
        if not line:
            ty -= 8
            continue
        if "Different game" in line:
            c.setFillColor(TEXT_PRIMARY)
            c.setFont("Helvetica-Bold", 12)
        else:
            c.setFillColor(TEXT_SECONDARY)
            c.setFont("Helvetica", 12)
        c.drawCentredString(WIDTH / 2, ty, line)
        ty -= 22

    items = ["Custom Game Support", "Tailored Features", "Unique Design", "Priority Support"]
    item_gap = 130
    total_iw = (len(items) - 1) * item_gap
    ix_start = WIDTH / 2 - total_iw / 2
    iy = box_y + 40
    for i, item in enumerate(items):
        ix = ix_start + i * item_gap
        c.setFillColor(CYAN)
        c.circle(ix, iy + 8, 3, fill=1, stroke=0)
        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 9.5)
        c.drawCentredString(ix, iy - 10, item)

    draw_footer(c, sn, total)
    c.showPage()


def draw_cta_slide(c, sn, total):
    draw_bg(c)

    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 + 80, "Get Started Today")

    c.setFillColor(TEXT_SECONDARY)
    c.setFont("Helvetica", 13)
    c.drawCentredString(WIDTH / 2, HEIGHT / 2 + 48,
                        "Ready to take your team to the next level?")

    box_w = 360
    box_h = 120
    box_x = WIDTH / 2 - box_w / 2
    box_y = HEIGHT / 2 - box_h / 2 - 20

    c.setStrokeColor(DIVIDER)
    c.setLineWidth(1)
    c.setFillColor(CARD_BG)
    c.roundRect(box_x, box_y, box_w, box_h, 8, fill=1, stroke=1)

    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 10)
    c.drawString(box_x + 30, box_y + box_h - 40, "Discord")
    c.drawString(box_x + 30, box_y + box_h - 75, "Email")

    c.setFillColor(TEXT_PRIMARY)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(box_x + 120, box_y + box_h - 42, "@2ndd")
    c.drawString(box_x + 120, box_y + box_h - 77, "lljftpp@gmail.com")

    c.setFillColor(TEXT_TERTIARY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(WIDTH / 2, FOOTER_H + 30,
                        "Team Manager  |  @2ndd")

    draw_footer(c, sn, total)
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
                "Coverage percentage and status indicators",
            ],
            "screenshot": "schedule",
            "layout": "center",
        }),

        ("feature", {
            "title": "Schedule Management",
            "subtitle": "Full control over availability slots",
            "bullets": [
                "Add and edit time slots per player",
                "Manage staff availability alongside players",
                "Visual weekly grid overview",
                "Quick availability status updates",
            ],
            "screenshot": "schedule_manage",
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
                "Performance by game mode and map",
                "Overall, monthly, and seasonal filters",
                "Scrim vs tournament breakdown",
            ],
            "screenshot": "stats",
            "layout": "center",
        }),

        ("dual", {
            "title": "Compare & Opponents",
            "subtitle": "Deep-dive performance analysis across seasons and rivals",
            "key_left": "compare",
            "key_right": "stats_by_opponents",
            "label_left": "Season Comparison",
            "label_right": "Stats by Opponent",
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
            "screenshot": "overall_player_stats",
        }),

        ("dual", {
            "title": "Player Performance",
            "subtitle": "Mode-specific breakdowns and opponent matchup analysis",
            "key_left": "player_stat_by_mode",
            "key_right": "player_stats_vs_opponents",
            "label_left": "Stats by Mode",
            "label_right": "Stats vs Opponents",
        }),

        ("feature", {
            "title": "Stat Fields",
            "subtitle": "Fully customizable stat tracking",
            "bullets": [
                "Create custom stat fields",
                "Define per-game tracking metrics",
                "Flexible field types",
                "Organize by category",
            ],
            "screenshot": "stat_fields",
            "layout": "center",
        }),

        ("feature", {
            "title": "Players & Roster",
            "subtitle": "Manage your full team roster",
            "bullets": [
                "Full player roster management",
                "Role assignments (AR, SUB, Flex)",
                "Attendance statistics overview",
                "Individual attendance records",
                "Staff integration in roster view",
            ],
            "screenshot": "players",
        }),

        ("dual", {
            "title": "Staff & Players",
            "subtitle": "Add and manage players and staff with detailed profiles",
            "key_left": "add_player",
            "key_right": "view_staff",
            "label_left": "Add Player",
            "label_right": "Staff View",
        }),

        ("feature", {
            "title": "Attendance Tracking",
            "subtitle": "Link attendance to events with detailed records",
            "bullets": [
                "Date picker with event linking",
                "Status: Attended, Late, Absent",
                "Optional notes and ringer tracking",
                "Complete attendance timeline",
                "Filterable history per player",
            ],
            "screenshot": "attendance_record",
            "layout": "center",
        }),

        ("feature", {
            "title": "Team Chat",
            "subtitle": "Discord-style integrated messaging",
            "bullets": [
                "Channel-based conversations",
                "File sharing and media preview",
                "Voice message recording",
                "@mentions and role display",
                "Permission-based access control",
            ],
            "screenshot": "chat",
        }),

        ("dual", {
            "title": "Dashboard",
            "subtitle": "Full administrative control over users, roles, and team settings",
            "key_left": "dashboard_users",
            "key_right": "dashboard_roles",
            "label_left": "User Management",
            "label_right": "Roles & Permissions",
        }),

        ("dual", {
            "title": "Configuration",
            "subtitle": "Game config, team settings, and comprehensive activity logging",
            "key_left": "dashboard_game_config",
            "key_right": "dashboard_log",
            "label_left": "Game Configuration",
            "label_right": "Activity Log",
        }),

        ("pricing", None),
        ("custom", None),
        ("cta", None),
    ]

    total_slides = len(slides)
    c = canvas.Canvas(output_path, pagesize=landscape(A4))
    c.setTitle("Team Manager - Professional Esports Management Platform")
    c.setAuthor("@2ndd")

    for idx, (stype, data) in enumerate(slides):
        sn = idx + 1

        if stype == "title":
            draw_title_slide(c, sn, total_slides)
        elif stype == "feature":
            layout = data.get("layout", "right")
            draw_feature_slide(
                c, sn, total_slides,
                data["title"], data["subtitle"],
                data["bullets"], data["screenshot"],
                layout=layout,
            )
        elif stype == "dual":
            draw_dual_screenshot_slide(
                c, sn, total_slides,
                data["title"], data["subtitle"],
                data["key_left"], data["key_right"],
                data.get("label_left", ""), data.get("label_right", ""),
            )
        elif stype == "pricing":
            draw_pricing_slide(c, sn, total_slides)
        elif stype == "custom":
            draw_custom_order_slide(c, sn, total_slides)
        elif stype == "cta":
            draw_cta_slide(c, sn, total_slides)

    c.save()

    file_size = os.path.getsize(output_path) / 1024
    print(f"PDF generated: {output_path}")
    print(f"Total slides: {total_slides}")
    print(f"File size: {file_size:.1f} KB")


if __name__ == "__main__":
    generate_pdf()
