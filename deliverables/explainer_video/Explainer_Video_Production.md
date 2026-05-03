# Vicious — Premium Esports Platform Explainer Video

**Project:** Vicious Esports Multi‑Game Management Platform
**Deliverable:** End‑to‑end production package for a cinematic motion explainer + brand film.
**Cuts:** Long master (75s) and short cutdown (35s).
**Ratios:** 16:9 (landscape), 9:16 (vertical), 1:1 (square) — each with safe‑area‑aware reframes (not letterboxed crops).
**Tone:** Tactical command‑center. Premium SaaS. Confident, quietly intense.

This document is the editable production bible accompanying the **final motion deliverables** under `exports/` — six MP4s (long 75s + short 35s, each in 16:9, 9:16, 1:1) rendered with real per‑element animation and a synchronized VO + music + SFX mix. The bible captures the timings, fonts, colors, easing curves, and asset list so a motion editor can re‑build the master in After Effects, Premiere, Canva, or CapCut whenever the placeholder VO/music/SFX (see §8b) are replaced with human VO and licensed library tracks.

---

## 1. Concept & Creative Direction

### Concept
**“Tactical clarity in a chaotic season.”** Open in the chaos coaches actually live in — twelve browser tabs, a group chat at 1AM, a crumpled spreadsheet — then collapse it all into a single Vicious surface that pulses with crimson signal. The film is a transformation: from noise to command.

### Visual language
- **Palette (locked to brand):** Onyx `#0E1117` background, Carbon `#1A1F2A` panels, Bone `#F5F6F8` text, Crimson `#E11D2E` as the only loud color. Steel `#5B6573` for secondary type. Signal `#F59E0B` reserved for one warning beat.
- **Typography:** Inter only. Display 900 +0.06em uppercase, body 400, eyebrow caption 500 +0.12em uppercase, tabular figures for any numeric.
- **Geometry:** sharp angles, hairline rules (1px Steel @ 30%), 9px corner radius on cards, 6px on chips.
- **Motion principles:**
  - 200ms ease‑out for entries, 120ms for hover/elevate, 400ms for full‑frame transitions.
  - Mask reveals (left‑to‑right, 200ms) for kinetic type.
  - Subtle parallax: BG layer moves 0.4× of mid layer; UI mockups float 4–8px on a 6s sine.
  - No bouncing, no spring overshoot, no glow, no RGB.
  - Cursor moves are tactical: short, decisive, always settle for 200ms before clicking.
- **Reference frames:** ESPN broadcast lower‑thirds, Linear changelog motion, Stripe homepage hero loops, Riot LCS overlay graphics, Notion Calendar reveal.

### How it ties to the brand
Pulled directly from `brand/Vicious-Brand-Guidelines.md`: dark surfaces, restrained Crimson, Inter typography, hairline rules, Lucide iconography. The V mark and stacked lockup land in scenes 01 (cold open glyph) and 12 (closing brand lockup). No new visual vocabulary is invented for the video — it is the brand in motion.

---

## 2. Narrative Arc

| Beat | Purpose | Long cut (s) | Short cut (s) |
|---|---|---:|---:|
| 1. Hook | Stop the scroll | 0–5 | 0–3 |
| 2. Problem | The chaos coaches live in | 5–14 | 3–7 |
| 3. Why it matters | Stakes — losses, missed scrims, churn | 14–20 | 7–9 |
| 4. Solution reveal | Vicious dashboard lands | 20–28 | 9–13 |
| 5. How it works | Roster → opponents → draft | 28–44 | 13–22 |
| 6. Feature beat | Analytics & team comps | 44–54 | 22–27 |
| 7. Org / scale beat | Multi‑team, admin, subs | 54–62 | 27–30 |
| 8. Benefits | In control, faster prep, better record | 62–68 | 30–32 |
| 9. CTA + brand close | Logo + URL | 68–75 | 32–35 |

---

## 3. Voiceover Script

### Recommended VO style
Confident male or female head‑coach voice, 30–45 yrs, dry American or neutral mid‑Atlantic. Pace ~150 wpm — measured, never rushed. Lower‑mid register, no upspeak. Think *Athletic Greens narrator meets a tactical analyst*. Royalty‑free options: ElevenLabs **Adam** (male) or **Rachel** (female), both at stability 0.5 / similarity 0.75. Record dry, no reverb, light compression at mix.

### Long cut — 75s

> **(0:00)** *(silence — single hairline tick)*
> **(0:02)** Twelve tabs open. Three group chats. A scrim in forty minutes.
> **(0:08)** And nobody knows who's actually playing.
> **(0:14)** This is how seasons quietly fall apart.
> **(0:20)** Vicious is the command center for serious esports orgs.
> **(0:28)** One roster. Every game. Every match.
> **(0:34)** Scout the opponent. Lock the draft. Run the comp.
> **(0:44)** Analytics that show you what your team actually does — not what you think they do.
> **(0:54)** Scale across teams, titles, and staff. One subscription. One source of truth.
> **(1:02)** Less spreadsheet. More winning.
> **(1:08)** Vicious. Run your roster like a pro.
> **(1:13)** *vicious.gg*

### Short cut — 35s

> **(0:00)** Twelve tabs. Three group chats. One scrim in forty minutes.
> **(0:05)** Vicious is the command center for serious esports orgs.
> **(0:10)** One roster, every game. Scout, draft, analyze, win.
> **(0:18)** Multi‑team. Multi‑title. One source of truth.
> **(0:24)** Less spreadsheet. More winning.
> **(0:28)** Vicious. Run your roster like a pro. *vicious.gg*

### On‑screen text rules
- Maximum 6 words per card.
- Eyebrow captions in 11px Steel +0.12em uppercase; headlines in 48–72px Bone 900.
- Type holds for ≥1.2s before next change.
- Numbers always tabular figures, with a 200ms count‑up animation for any single stat.

---

## 4. Scene‑by‑Scene Storyboard & Motion Direction

The long cut is built from twelve master scenes. The short cut uses scenes 01, 04, 05, 07, 09, 11, 12 only. Frame previews live in `storyboard/` and final per‑ratio frames in `frames/<ratio>/scene-NN.svg`.

### Scene 01 — Hook (0:00–0:05 / 0:00–0:03)
- **Layout (16:9):** Full Onyx. Single Crimson hairline grows from center outward (200ms). At 0:8s a Crimson "V" glyph mask‑reveals from below. Eyebrow caption “VICIOUS / TACTICAL ESPORTS PLATFORM” fades in below at 30% opacity.
- **Motion:** rule grow → V mask reveal (left‑to‑right, 240ms) → 0.4s hold → cut.
- **Audio:** single low sub‑pulse + tactical UI tick (SFX: `ui-tick-01.wav`). VO silent.
- **Reframe (9:16 / 1:1):** V centered, hairline becomes vertical instead of horizontal in 9:16; in 1:1 hairline is diagonal at the V's base angle.

### Scene 02 — Problem cold open (0:05–0:10 / 0:03–0:05)
- **Layout:** Cluttered desktop motif on Onyx — 12 ghosted "browser tabs" in Steel hairlines stagger‑drift across frame; a Discord‑style sidebar peeks left; Sheets cells with placeholder names blur in/out.
- **Motion:** tabs cascade in 60ms apart, fade to 40% opacity. Camera dolly +1.04 zoom over 4s.
- **Type:** kinetic VO line "TWELVE TABS." crashes in at 0:06 (240ms mask), then "THREE GROUP CHATS." at 0:08, then "ONE SCRIM IN 40 MIN." at 0:10. Each replaces the prior with a 120ms wipe.
- **SFX:** rapid keystroke layer (low), Discord ping (mute‑pitched).

### Scene 03 — Why it matters (0:10–0:14)
- **Layout:** Center‑stage red card: Signal `#F59E0B` warning chip "ROSTER UNCONFIRMED — 12 MIN" pulses once. Behind it, faint scoreboard reading **L · L · L · L · W · L** in Steel.
- **Motion:** chip pulse 1× (scale 1.0→1.04→1.0, 600ms ease‑in‑out). Scoreboard letters count‑up tabular.
- **Type:** caption "THIS IS HOW SEASONS QUIETLY FALL APART" mask‑reveals bottom.

### Scene 04 — Solution reveal (0:14–0:22)
- **Layout:** Hard cut to black (1 frame). Then dashboard mockup pushes up from bottom on Onyx, settling at center with subtle 6px float. Sidebar (Carbon), top header reading "TODAY · TUE 14 MAY", three KPI tiles (Win rate 64%, Scrims this week 11, Roster ready ✔︎), schedule timeline below.
- **Motion:** dashboard slides up 60px over 400ms ease‑out. KPI numbers count‑up over 600ms (tabular). Sidebar items stagger‑in 40ms apart.
- **Type:** display headline "ONE COMMAND CENTER" lands top‑left as the mockup settles. Subhead "for serious esports orgs" at 18px Steel.
- **Cursor:** none yet — the dashboard speaks for itself.

### Scene 05 — Roster management (0:22–0:30)
- **Layout:** Mockup pivots to a Roster page. Left column: roster list with avatars (initials in Crimson circles), role chips (DUELIST · CONTROLLER · IGL). Right pane: player profile expanded — name "K. ‘Vortex’ Tanaka", availability calendar with 7‑day strip, recent KD 1.34 (Crimson).
- **Motion:** cursor enters from right, hovers a row → row hover‑elevates, then clicks → right pane mask‑reveals left‑to‑right (200ms). Calendar cells pop in column‑by‑column over 400ms.
- **Type:** kinetic line "ROSTER. SCRIMS. AVAILABILITY." top‑right, mask reveal 200ms.

### Scene 06 — Opponents & scouting (0:30–0:36)
- **Layout:** Pivot to Opponent Scouting view. Top: opponent org logo placeholder (Steel block) + record 18‑6. Below: heatmap of map picks (Haven 31%, Bind 22%, Lotus 19%, Ascent 14%, Sunset 14%) — Crimson bars on Carbon. Side panel: top 3 agent comps with win rates.
- **Motion:** heatmap bars grow left‑to‑right 500ms ease‑out, staggered 80ms apart. Stat labels count‑up.
- **Type:** "SCOUT THE OPPONENT" eyebrow + "Map pool · Comp tendencies · Star players" subhead.

### Scene 07 — Maps & heroes / agent picker (0:36–0:42)
- **Layout:** Map/agent picker grid. 6 map tiles top row (each ~140×80, Carbon with hairline border), 12 agent tiles bottom (icon placeholders, role chip). One agent tile is selected — Crimson ring + label "JETT — DUELIST".
- **Motion:** tiles fade in 30ms staggered. Cursor lands on Jett, ring snaps in (180ms), tile lifts 4px.
- **Type:** "PICK YOUR COMP" eyebrow, count "5/5" tabular bottom right.

### Scene 08 — Draft stats & scouting numbers (0:42–0:48)
- **Layout:** Draft simulator screen. Two columns labeled "US" (Crimson chip) and "OPP" (Steel chip), each with 5 agent slots. Below: side‑by‑side bar comparison "First‑blood rate 58% vs 41%", "Plant rate 72% vs 64%". A pulsing Crimson highlight on the projected win prob: **64%**.
- **Motion:** agents drop into slots one by one (220ms each, 60ms stagger). Bars grow simultaneously after slot 5 fills. Win prob counts 50→64.
- **Type:** "DRAFT. STATS. EDGE." kinetic at 240ms.

### Scene 09 — Analytics & team comps (0:48–0:56)
- **Layout:** Analytics dashboard. Big line chart of win rate over last 12 weeks (Crimson line, Steel grid hairlines). Side: top 3 winning team comps, each a row of 5 mini agent icons + win % bar.
- **Motion:** line chart draws left‑to‑right over 900ms ease‑out. Crimson dot at end‑point pulses once. Comps slide up from below 80px stagger.
- **Type:** "WHAT YOUR TEAM ACTUALLY DOES" headline left, "not what you think they do" Steel subhead.

### Scene 10 — Org / admin / subscriptions (0:56–1:02)
- **Layout:** Multi‑team org view. Top bar: org logo + "VICIOUS — ORG ADMIN". Grid of 4 team cards (CS2, Valorant, LoL, Rocket League), each with roster size, next match, status chip. Right rail: Subscription card "PRO · per seat · billed annually" with seat count toggle 12 → 18.
- **Motion:** team cards mask‑reveal in a 2×2 stagger (60ms apart). Seat counter ticks 12 → 18 over 500ms with each tick punching the card 1px.
- **Type:** "SCALE — TEAMS · TITLES · STAFF" eyebrow, "One subscription. One source of truth." subhead.

### Scene 11 — Benefits payoff (1:02–1:08)
- **Layout:** Three full‑bleed kinetic type cards in sequence (each ~2s):
  1. **LESS SPREADSHEET.** (Bone on Onyx, Crimson hairline under)
  2. **MORE WINNING.** (Crimson on Onyx)
  3. **IN CONTROL.** (Bone on Onyx, V glyph as period)
- **Motion:** each card mask‑reveals left‑to‑right 220ms, holds 1.6s, hard cut to next.

### Scene 12 — Brand close + CTA (1:08–1:15 / 0:32–0:35)
- **Layout:** Stacked Vicious lockup centered on Onyx. Below: tagline "RUN YOUR ROSTER LIKE A PRO." in 16px Steel +0.12em uppercase. Below that: URL "vicious.gg" in Bone 18px. Faint `pattern-grid.svg` extension at 8% opacity behind.
- **Motion:** lockup mask‑reveals from V outward (340ms ease‑out). Tagline fades 200ms after. URL fades last. Final 1.5s static hold.
- **SFX:** low Crimson swell + single tactical click on logo lock‑in.

---

## 5. Reframe Strategy (Safe‑Area Aware)

Each scene is re‑composed — not letterboxed — for each ratio. Master is built at 1920×1080. Reframe rules:

| Ratio | Canvas | Safe area | Reframe approach |
|---|---|---|---|
| 16:9 | 1920×1080 | 64px margin | Master composition. UI mockups land at 60% width centered. |
| 9:16 | 1080×1920 | 80px H / 200px V | UI mockups rotate to vertical stacks; type stacks vertically with bigger leading; multi‑column grids become single column. |
| 1:1 | 1080×1080 | 64px margin | UI mockups crop to the most data‑rich panel; type wraps to two lines max; tagline always two‑line center. |

Type sizing per ratio:
- Display: 72px (16:9), 96px (9:16), 64px (1:1)
- H1: 32px / 44px / 28px
- Body: 15px / 20px / 14px

Logo placement final beat: always centered, with at least 1× V‑bar clear space. The CTA URL never touches the safe‑area edge.

---

## 6. Animated UI Mockups — Inventory

All mockups styled to brand: Carbon panels, Onyx page, Bone text, Steel hairlines, Crimson reserved for the user's own series / primary actions. Living source: `frames/16x9/scene-NN.svg`.

| # | Mockup | Used in scene |
|---|---|---|
| M01 | Dashboard (KPIs, schedule strip, sidebar) | 04 |
| M02 | Roster list + player profile | 05 |
| M03 | Opponent scouting (logo, record, map heatmap, agent comps) | 06 |
| M04 | Map + agent picker grid | 07 |
| M05 | Draft simulator (US vs OPP, bars, win prob) | 08 |
| M06 | Analytics (line chart + top comps) | 09 |
| M07 | Org admin (team grid + subscription card) | 10 |
| M08 | Kinetic type cards (3) | 11 |
| M09 | Brand close lockup | 12 |

---

## 7. Asset List

### Brand
- `brand/logos/vicious-icon.svg` — Scene 01 V glyph, Scene 12 mark.
- `brand/logos/vicious-stacked.svg` — Scene 12 lockup.
- `brand/logos/vicious-horizontal-dark.svg` — fallback header lockup.
- `brand/extensions/pattern-grid.svg` — Scene 12 background, 8% opacity.
- `brand/extensions/divider-tactical.svg` — Scene 03 / Scene 11 hairlines.

### Type
- Inter (Variable, weights 400/500/600/700/800/900). Loaded from Google Fonts; embed locally for AE.

### Generated frames (under this folder)
- `frames/16x9/scene-01..12.svg` (1920×1080)
- `frames/9x16/scene-01..12.svg` (1080×1920)
- `frames/1x1/scene-01..12.svg` (1080×1080)
- `frames/16x9/scene-NN.png` raster equivalents at 1920×1080 (for ffmpeg).
- Same for `9x16` (1080×1920) and `1x1` (1080×1080).

### Final renders
- `exports/vicious-explainer-long-16x9.mp4`
- `exports/vicious-explainer-long-9x16.mp4`
- `exports/vicious-explainer-long-1x1.mp4`
- `exports/vicious-explainer-short-16x9.mp4`
- `exports/vicious-explainer-short-9x16.mp4`
- `exports/vicious-explainer-short-1x1.mp4`

> The MP4s under `exports/` are the **final motion deliverables** — element‑level animation (cursors, sliding panels, growing charts, KPI counters, kinetic type, lockup punch‑in) rendered frame‑by‑frame and muxed with a synchronized VO + music + SFX mix. The static SVGs/PNGs under `frames/` are the storyboard reference layer; they are the source of truth for layout, type, and color but are **not** themselves the deliverable. See §8b for the placeholder‑audio replacement plan tracked under follow‑up #26.

### Music — royalty‑free recommendations (final license is yours)
1. **Tom Fox — “Tactical”** (Artlist) — sub pulse, cinematic restraint. Best primary pick.
2. **Push — “Operator”** (Musicbed) — minimal techno underbed, builds at scene 04.
3. **Ben Fox — “Quiet Storm”** (Artlist) — ambient rise into scene 09.
4. **Free fallback:** YouTube Audio Library — *“Cinematic Documentary Hybrid”* by Soundridemusic (CC0).

Mix levels: VO −6 dB, music bed −18 dB ducked −3 dB under VO with 200ms fades, SFX −12 dB.

### SFX — royalty‑free
- `ui-tick-01.wav` — Scene 01 hairline tick. Source: freesound.org #523485.
- `ui-click-soft.wav` — Scene 05/07 cursor clicks.
- `whoosh-low-01.wav` — Scene 04 dashboard rise.
- `count-up-tick.wav` — Scene 04/08 stat count‑ups (1 tick per 30ms).
- `crimson-swell.wav` — Scene 12 brand close (sub bass swell, 1.5s).

---

## 8. Production Notes (Editor Rebuild Spec)

### Project setup (After Effects preferred)
- Comp: 1920×1080, 30 fps, sRGB. Duration 75s for long, 35s for short.
- Pre‑comp each scene as `S01_Hook`, `S02_Problem`, …, `S12_Close`.
- Master comp drops scene pre‑comps end‑to‑end on a single video layer; transitions live inside each scene's pre‑comp so cuts are clean.

### Easing curves (apply via Graph Editor)
- **Standard ease‑out:** `cubic-bezier(0.16, 1, 0.3, 1)` — entries, slides.
- **UI snap:** `cubic-bezier(0.2, 0.0, 0.0, 1.0)` — chip/button reveals.
- **Pulse:** `ease‑in‑out` 600ms scale 1.0 → 1.04 → 1.0.
- **Type mask reveal:** linear 220ms, mask grows from left edge.

### Type
- Family: **Inter**. Weights used: 400 body, 500 caption, 700 H2, 800 H1, 900 display.
- Display tracking +0.06em uppercase. Caption tracking +0.12em uppercase. Body tracking 0.
- Tabular figures everywhere a number appears.

### Color tokens (locked)
| Token | Hex |
|---|---|
| Onyx (BG) | `#0E1117` |
| Carbon (panels) | `#1A1F2A` |
| Bone (text) | `#F5F6F8` |
| Steel (muted) | `#5B6573` |
| Crimson (primary) | `#E11D2E` |
| Signal (warning) | `#F59E0B` |
| Success | `#16A34A` |
| Chart‑2 (Steel‑blue) | `#5B7FB1` |
| Chart‑5 (Violet) | `#8B5CF6` |

### Per‑scene durations

| Scene | Long cut in/out | Short cut in/out |
|---|---|---|
| 01 Hook | 0.0–5.0 | 0.0–3.0 |
| 02 Problem | 5.0–10.0 | — |
| 03 Why it matters | 10.0–14.0 | — |
| 04 Solution reveal | 14.0–22.0 | 3.0–7.0 |
| 05 Roster | 22.0–30.0 | 7.0–13.0 |
| 06 Opponents | 30.0–36.0 | — |
| 07 Maps & heroes | 36.0–42.0 | 13.0–18.0 |
| 08 Draft stats | 42.0–48.0 | — |
| 09 Analytics | 48.0–56.0 | 18.0–24.0 |
| 10 Org & subs | 56.0–62.0 | — |
| 11 Benefits | 62.0–68.0 | 24.0–28.0 |
| 12 Brand close | 68.0–75.0 | 28.0–35.0 |

### Audio cue sheet (long cut)
| Time | Event |
|---|---|
| 0:00 | Sub pulse in. UI tick at 0:01. |
| 0:05 | VO line 1 begins. Music bed enters at −24 dB. |
| 0:14 | Bed rises to −18 dB. |
| 0:20 | Whoosh on dashboard rise + VO line "Vicious is the command center…" |
| 0:48 | Bed swells +2 dB into analytics scene. |
| 1:02 | Bed ducks for benefit cards. |
| 1:08 | Crimson swell, brand lockup tick. |
| 1:13 | URL reveal, soft tail to silence by 1:15. |

### Export presets
- **MP4 (web/social):** H.264, CRF 18, AAC 192k, faststart.
- **MOV (broadcast):** ProRes 422 HQ, PCM 48k.
- **GIF (preview):** 800px wide, 12 fps, palette‑optimized — first 6s of long cut.

### Rebuild workflow
1. Import all SVGs from `frames/<ratio>/` into AE as vector layers (continuous rasterize on).
2. Replace static frames with live AE pre‑comps using the same layer order.
3. Apply easing per the table above.
4. Drop VO on track 1, music on track 2, SFX on track 3. Sync VO line endings to scene cuts (±2 frames).
5. Render long cut master first; the short cut is a duplicate comp with scenes 02/03/06/08/10 disabled and the master timeline rippled.
6. Reframe by duplicating the master comp into 1080×1920 and 1080×1080 comps, then re‑position each scene pre‑comp using the reframe rules in §5.

---

## 8b. Final Deliverables vs. Temporary Substitutions

The six MP4s in `exports/` are the **final motion deliverables** for this task —
real per‑element animation (cursors moving across draft slots, panels sliding
in with stagger, KPI counters ticking up, charts growing, kinetic letter‑stagger
on the lockup, type‑in URL on the close, etc.) at the locked durations and
ratios with synchronized voiceover, music bed and SFX.

Two media inputs are **temporary substitutions** in the current cut and are
slated for replacement during real production. These are tracked under
**follow‑up task #26** (record real VO + master in After Effects):

| Element | Current state (this delivery) | Replacement plan (follow‑up #26) |
|---|---|---|
| **Voiceover** | Synthesized via gTTS, UK English, time‑aligned per scene start in `assets/vo-{long,short}.wav` | Record human VO talent matching the direction in §3 (calm, grounded, late‑20s/30s, neutral mid‑Atlantic). Re‑mux through `assets/audio-{long,short}.m4a`. |
| **Music bed** | Procedurally synthesized (sub 55 Hz + low pad 82.5/165 Hz + filtered brown‑noise floor, slow swell) in `assets/music-{long,short}.wav` | License or compose a tempo‑locked bed per §7 (sub‑heavy, ~78–88 BPM, builds across acts). Drop in over the existing track structure. |
| **SFX** | Procedural (sine sub‑pulse, sine ticks, filtered‑noise whoosh, sine swell) at the cue points in `assets/sfx-{long,short}.wav` | Replace with library SFX (Splice / SoundMorph / KeepForest) per the audio cue sheet in §8. |

Everything else (motion, type, color, layout, timing, ducking, limiter chain)
is final and should not need a rebuild for the replacement pass.

## 9. Folder Map

```
deliverables/explainer_video/
├── Explainer_Video_Production.md          # this document (source)
├── Explainer_Video_Production.pdf         # rendered production bible
├── scripts/
│   ├── build_video.mjs                    # storyboard frames (SVG → PNG)
│   ├── build_motion.py                    # audio masters (VO + music + SFX)
│   └── build_motion_anim.py               # FINAL element-level motion renderer
├── frames/
│   ├── 16x9/   scene-01..12.svg + .png    # storyboard reference frames
│   ├── 9x16/   scene-01..12.svg + .png
│   └── 1x1/    scene-01..12.svg + .png
├── assets/
│   ├── vo-{long,short}.wav                # gTTS narrator (placeholder, see §8b)
│   ├── music-{long,short}.wav             # procedural bed (placeholder, see §8b)
│   ├── sfx-{long,short}.wav               # procedural SFX (placeholder, see §8b)
│   └── audio-{long,short}.m4a             # final mixed master (AAC 192k)
└── exports/                               # ← FINAL DELIVERABLES
    ├── vicious-explainer-long-16x9.mp4    # 1920×1080, 75s, h264 + AAC
    ├── vicious-explainer-long-9x16.mp4    # 1080×1920, 75s
    ├── vicious-explainer-long-1x1.mp4     # 1080×1080, 75s
    ├── vicious-explainer-short-16x9.mp4   # 1920×1080, 35s
    ├── vicious-explainer-short-9x16.mp4   # 1080×1920, 35s
    └── vicious-explainer-short-1x1.mp4    # 1080×1080, 35s
```

To regenerate every frame and final MP4:
```bash
# 1. storyboard reference frames (SVG → PNG, 3 ratios × 12 scenes)
node deliverables/explainer_video/scripts/build_video.mjs

# 2. audio masters (gTTS VO + procedural music + SFX, mixed + ducked)
python3 deliverables/explainer_video/scripts/build_motion.py

# 3. FINAL element-level motion + mux into 6 deliverables
python3 deliverables/explainer_video/scripts/build_motion_anim.py
```

To rebuild this PDF after editing the markdown:
```bash
node scripts/build-explainer-pdf.mjs
```
