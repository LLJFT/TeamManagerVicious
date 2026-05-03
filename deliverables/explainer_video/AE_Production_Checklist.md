# Vicious Explainer — After Effects Production Checklist

**For:** Motion editor rebuilding the master from animatic → broadcast film
**Pairs with:** `Explainer_Video_Production.md` (the bible — timings, easing, type, color, scene‑by‑scene direction), `frames/` (per‑ratio SVG + PNG keyframes), `exports/` (current animatic, use as picture reference only)
**Deliverable back to producer:** 6 final MP4s + editable AE projects + updated notes.

---

## 0. Ground rules

- **The bible is the source of truth.** Where this checklist and `Explainer_Video_Production.md` disagree, the bible wins. If you change a timing or easing during the edit, update the bible (§2 narrative arc table and §6 timing sheet) and note it in the changelog at the bottom of this file.
- **Brand is locked.** Colors, type, geometry, motion principles all come from `brand/Vicious-Brand-Guidelines.md`. Do not introduce new colors, fonts, glow, RGB split, or spring overshoot. No emoji. No stock 3D.
- **One look across all six masters.** 16:9 is the hero comp; 9:16 and 1:1 are reframes (safe‑area‑aware), not letterboxed crops.

---

## 1. Project setup

| Item | Spec |
|---|---|
| AE version | 2024 or newer |
| Project file | `vicious_explainer_master.aep` saved to `deliverables/explainer_video/ae/` |
| Color working space | sRGB IEC61966‑2.1, 8‑bpc working, 16‑bpc on render |
| Frame rate | 30 fps (matches animatic) |
| Master comp durations | Long: 75s (2250 frames). Short: 35s (1050 frames). |
| Master comp resolutions | 16:9 → 1920×1080. 9:16 → 1080×1920. 1:1 → 1080×1080. |
| Audio | 48 kHz, stereo bus, render at −14 LUFS integrated, true peak ≤ −1 dBTP |
| Folder structure (in project panel) | `00_MASTERS/` `01_SCENES/` `02_ASSETS/` (sub: `frames/` `ui/` `type/` `logos/`) `03_AUDIO/` (sub: `vo/` `music/` `sfx/`) `04_PRECOMPS/` `99_REF/` (animatics) |

### Import order

1. `frames/16x9/*.svg` and `frames/16x9/*.png` → `02_ASSETS/frames/`. Repeat for `9x16/` and `1x1/`. SVGs are continuously rasterized; PNGs are render‑safe fallback.
2. `assets/vo-long.wav`, `vo-short.wav` → `03_AUDIO/vo/`.
3. `assets/music-long.wav`, `music-short.wav` → `03_AUDIO/music/`.
4. `assets/sfx-long.wav`, `sfx-short.wav` → `03_AUDIO/sfx/` *(use as a list of cues; replace individual stings from a licensed SFX library — see §5).*
5. `exports/vicious-explainer-long-16x9.mp4` etc. → `99_REF/`. Drop into a guide layer above the master comp at 25% opacity for sync only — turn off before render.

### Fonts

- Inter (variable). Weights used: 400, 500, 700, 900.
- Display 900, +0.06em (60), uppercase.
- Eyebrow 500, +0.12em (120), uppercase.
- Body 400, default tracking.
- Tabular figures **on** for any numeric (count‑ups, %, scores, dates).

### Color swatches (lock as project swatches)

| Token | Hex | Use |
|---|---|---|
| Onyx | `#0E1117` | Background |
| Carbon | `#1A1F2A` | Cards, panels |
| Bone | `#F5F6F8` | Primary text |
| Steel | `#5B6573` | Secondary text, hairlines @ 30% |
| Crimson | `#E11D2E` | Brand accent (the only loud color) |
| Signal | `#F59E0B` | One warning beat (scene 03 only) |

---

## 2. Build order (top‑down, do not skip)

1. **Lay the spine.** Drop the master VO (long, then short) into `00_MASTERS/long_16x9` and `short_16x9`. Slip to match the timecodes in `Explainer_Video_Production.md` §3. The VO is the metronome — every cursor move, mask reveal, and count‑up hangs off VO syllables.
2. **Music bed.** Drop the licensed track (see §5). Side‑chain duck −4 dB under VO with 80 ms attack / 220 ms release. Hit musical accent on scene 04 ("Vicious is the command center…") and scene 09 ("Less spreadsheet. More winning.").
3. **Build scene precomps in order 01 → 12.** Each scene is its own precomp at 1920×1080, then dropped into the 16:9 master. See §3 for the per‑scene checklist.
4. **Master 16:9 first.** Lock picture, mix, and color. Do not touch 9:16 or 1:1 until the producer signs off on 16:9.
5. **Reframe to 9:16, then 1:1.** New master comps, scene precomps duplicated and re‑laid out per the safe‑area diagrams in `Explainer_Video_Production.md` §7. Do not crop the 16:9 master.
6. **Render all six.** See §6.

---

## 3. Per‑scene production notes

> Reference `Explainer_Video_Production.md` §5 for the full storyboard description of each scene. The bible's timing sheet (§6) gives in/out frames. This checklist captures the motion mechanics that the animatic could not render.

### Motion principles (apply to every scene)

- Entries: 200ms ease‑out (cubic, `0.16, 1, 0.3, 1`).
- Hover / micro‑elevate: 120ms ease‑out.
- Full‑frame transitions: 400ms ease‑in‑out (`0.65, 0, 0.35, 1`).
- Mask reveals on kinetic type: left‑to‑right wipe, 200ms, ease‑out.
- Parallax: BG layer moves 0.4× of mid layer. UI mockups float ±4–8px on a 6s sine. Never on the loud accent frames.
- Cursor moves: arc path (not linear), 320–480ms travel, 200ms settle before any click. Click = 1‑frame scale to 0.94, 2 frames back to 1.0, plus a 1‑frame Crimson `4px` ring at 60% opacity that fades over 6 frames.
- Count‑ups: tabular figures, `easeOutExpo`, integer rounding, never show decimals mid‑count.
- No bouncing. No spring overshoot. No glow. No RGB split. No lens flares.

### Scene‑by‑scene mechanics

| # | Beat | Must animate (not animatic) | Notes |
|--:|---|---|---|
| 01 | Cold open glyph | V‑mark mask reveal L→R 240ms; hairline tick SFX on first frame | Hold black 6 frames before glyph. |
| 02 | Twelve tabs chaos | 12 browser tabs cascade in over 900ms, staggered 60ms each, ease‑out; group chat bubbles type in with caret | Use Inter 400 for chat. Tabs are `frames/16x9/02_*.svg`. |
| 03 | Stakes | Signal `#F59E0B` warning chip pulses once (scale 1.0 → 1.04 → 1.0 over 320ms) | Only frame Signal appears in the entire film. |
| 04 | Solution reveal | Chaos collapses inward to a single point (400ms), then Vicious dashboard rises from black with a 240ms mask reveal from center | Hit the musical accent on the dashboard land frame. |
| 05a | Roster | Cursor arcs to "Roster" nav, 200ms settle, click ring, panel slide in from right (320ms) | Roster rows stagger‑in at 40ms each. |
| 05b | Opponents scout | Cursor arcs to opponent card, hover micro‑elevate (120ms, 4px lift), click, scout sheet wipes in L→R (240ms) | Opponent stats count up over 600ms. |
| 05c | Draft / comp | Champion/agent tiles drop into draft slots, 180ms each, staggered 80ms. Lock icon appears on final slot with a Crimson ring | Tiles snap, do not bounce. |
| 06 | Analytics | Bar chart bars grow from 0 to value over 700ms, ease‑out. Line chart draws L→R via trim‑paths over 900ms. Numbers count up in tabular figures, synced to bar growth | Crimson highlight on the one stat the VO lands on ("what your team actually does"). |
| 07 | Org / scale | Multi‑team grid: 6 team cards fade+rise in (200ms each, staggered 60ms) | Admin chip and "1 subscription" badge pop on VO syllables "one" and "truth." |
| 08 | Benefits | Three benefit lines mask‑reveal L→R, 200ms each, staggered 220ms | Crimson underline draws under each line on land. |
| 09 | "Less spreadsheet. More winning." | Hard cut to black for 4 frames before line lands. Type mask‑reveals L→R 220ms. Crimson period | This is the emotional peak. Music swells, ducks back under "Vicious." |
| 10 | Tag | Vicious wordmark fades up (180ms), tagline mask‑reveals beneath (200ms) | Center‑aligned, lower‑third position in 16:9. |
| 11 | URL | `vicious.gg` mask‑reveals L→R (200ms), Crimson cursor blinks twice then holds | Tabular figures off here — it's a URL, not a number. |
| 12 | Brand close | Hold the lockup for 18 frames, then a 12‑frame fade to black | Last frame is pure Onyx, not black, to match brand. |

---

## 4. Reframes (9:16 and 1:1)

- **Do not crop the 16:9 master.** Build new scene comps at the target resolution and reposition layers per the safe‑area diagrams in `Explainer_Video_Production.md` §7.
- **9:16 priorities:** UI mockups scale to ~85% width, stack vertically, type moves above mockup. Cursor paths re‑drawn (shorter arcs, vertical bias).
- **1:1 priorities:** Type left, mockup right (long cut) or type top, mockup bottom (scenes 06, 09, 10). Keep 64px outer safe margin.
- **What stays identical across all three:** VO, music, SFX, easing curves, color, type sizes (relative to canvas height — use a `--type-scale` expression), scene durations.
- **What changes:** layer position, mockup scale, cursor path geometry, parallax amplitude (halve it on 9:16 to avoid cropping clipped edges).

---

## 5. Audio mix

| Bus | Source | Spec |
|---|---|---|
| VO | `assets/vo-long.wav` / `vo-short.wav` (final human masters) | Light comp 3:1, 6 dB GR. De‑ess at 6.5 kHz. EQ: HPF 80 Hz, gentle 200 Hz cut −2 dB, presence +1.5 dB at 4 kHz. Sit at −14 LUFS short‑term under bed. |
| Music | Licensed track — recommended: Musicbed / Artlist "tactical / cinematic minimal" tagged, 90–105 BPM, no vocals, no drops. Edit to land an accent at 0:20 (long) / 0:05 (short) and 1:02 (long) / 0:24 (short). | Side‑chain ducked −4 dB under VO. Bus to −18 LUFS. |
| SFX | Licensed library (Soundly, Splice, KrotosClassic). The scratch `sfx-*.wav` is a **cue list**, not final audio. Replace each sting. | Hairline ticks on glyph land, tab cascade, dashboard land, click rings, count‑up complete, final fade. Bus to −20 LUFS. Pan within ±20% to taste. |
| Master | Sum bus | Limiter, ceiling −1 dBTP. Final integrated −14 LUFS (broadcast / web standard). |

---

## 6. Render & delivery

### Render queue (six items)

| File | Comp | Codec | Bitrate | Audio |
|---|---|---|---|---|
| `vicious-explainer-long-16x9.mp4` | `00_MASTERS/long_16x9` | H.264, High profile, 1920×1080, 30 fps, CBR | 16 Mbps | AAC 320 kbps stereo |
| `vicious-explainer-long-9x16.mp4` | `00_MASTERS/long_9x16` | H.264, 1080×1920, 30 fps | 16 Mbps | AAC 320 kbps |
| `vicious-explainer-long-1x1.mp4` | `00_MASTERS/long_1x1` | H.264, 1080×1080, 30 fps | 12 Mbps | AAC 320 kbps |
| `vicious-explainer-short-16x9.mp4` | `00_MASTERS/short_16x9` | H.264, 1920×1080, 30 fps | 16 Mbps | AAC 320 kbps |
| `vicious-explainer-short-9x16.mp4` | `00_MASTERS/short_9x16` | H.264, 1080×1920, 30 fps | 16 Mbps | AAC 320 kbps |
| `vicious-explainer-short-1x1.mp4` | `00_MASTERS/short_1x1` | H.264, 1080×1080, 30 fps | 12 Mbps | AAC 320 kbps |

Also render: ProRes 422 HQ masters of the 16:9 long and short (for archive / future re‑encodes) into `deliverables/explainer_video/masters_prores/`.

### Delivery layout

```
deliverables/explainer_video/
  exports/                     # OVERWRITE the animatics with these final masters
    vicious-explainer-long-16x9.mp4
    vicious-explainer-long-9x16.mp4
    vicious-explainer-long-1x1.mp4
    vicious-explainer-short-16x9.mp4
    vicious-explainer-short-9x16.mp4
    vicious-explainer-short-1x1.mp4
  masters_prores/
    vicious-explainer-long-16x9.mov
    vicious-explainer-short-16x9.mov
  ae/
    vicious_explainer_master.aep
    (Collect Files) Footage/
```

Before overwriting the animatics, copy the current `exports/*.mp4` to `exports/_animatic_archive/` so the animatic reference is preserved.

---

## 7. QC checklist (before sign‑off)

- [ ] All six MP4s open, play, and are trim‑exact (75.00s and 35.00s ±1 frame).
- [ ] VO is intelligible and sits above the bed at every moment. Spot‑check on phone speaker, laptop speaker, and headphones.
- [ ] Integrated loudness is −14 LUFS ±0.5 on all six. True peak ≤ −1 dBTP.
- [ ] No frame contains: an unauthorized color, a font that isn't Inter, a glow, an RGB split, a spring overshoot, or an emoji.
- [ ] Crimson is the only loud color except scene 03 (Signal).
- [ ] Every cursor click has a settle frame and a ring.
- [ ] Every count‑up uses tabular figures and ends on the integer the VO names.
- [ ] 9:16 and 1:1 have no clipped UI, no off‑safe text. Test on a phone.
- [ ] Brand lockup on last frame matches `brand/Vicious-Brand-Guidelines.md`.
- [ ] AE project is "Collect Files"‑saved with all footage relative.
- [ ] Bible's §2 timing table and §6 timing sheet match the final cut. Update both if anything moved.

---

## 8. Changelog (motion editor fills in)

> Record any deviation from the bible during the edit so the bible stays the source of truth.

| Date | Scene | Change | Reason |
|---|---|---|---|
| _e.g. 2026‑05‑10_ | _05c_ | _Lock ring shortened from 240ms to 200ms_ | _Felt heavy against VO cadence_ |
| | | | |
