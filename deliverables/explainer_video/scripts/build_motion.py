#!/usr/bin/env python3
"""
Builds the FINAL Vicious explainer video deliverables (real motion + audio).

For every scene PNG produced by build_video.mjs, we render a motion clip with
ffmpeg zoompan + per-scene fade-in / mask-reveal. Scene clips are concatenated
into a long (75s) and a short (35s) master per ratio (16:9, 9:16, 1:1).

Audio is built from:
  - gTTS voiceover lines, time-aligned to scene starts via adelay
  - Procedural music bed (sub + low pad, slowly swelling)
  - Procedural SFX (sub pulse on hook, soft ticks on cuts, swell on close)

Run:
  python3 deliverables/explainer_video/scripts/build_motion.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "frames"
EXPORTS = ROOT / "exports"
ASSETS = ROOT / "assets"
TMP = ROOT / "_tmp"
for d in (EXPORTS, ASSETS, TMP):
    d.mkdir(parents=True, exist_ok=True)

RATIOS = {"16x9": (1920, 1080), "9x16": (1080, 1920), "1x1": (1080, 1080)}
FPS = 30


@dataclass
class Scene:
    sid: str
    dur: float


# Long cut (75s)
LONG = [
    Scene("01", 5), Scene("02", 5), Scene("03", 4), Scene("04", 8),
    Scene("05", 8), Scene("06", 6), Scene("07", 6), Scene("08", 6),
    Scene("09", 8), Scene("10", 6), Scene("11", 6), Scene("12", 7),
]
# Short cut (35s)
SHORT = [
    Scene("01", 3), Scene("04", 4), Scene("05", 6), Scene("07", 5),
    Scene("09", 6), Scene("11", 4), Scene("12", 7),
]

# VO lines: (start_seconds, text)
VO_LONG = [
    (2.2, "Twelve tabs open. Three group chats. A scrim in forty minutes."),
    (8.5, "And nobody knows who's actually playing."),
    (14.0, "This is how seasons quietly fall apart."),
    (20.0, "Vicious is the command center for serious esports orgs."),
    (28.0, "One roster. Every game. Every match."),
    (34.0, "Scout the opponent. Lock the draft. Run the comp."),
    (44.0, "Analytics that show you what your team actually does. Not what you think they do."),
    (54.0, "Scale across teams, titles, and staff. One subscription. One source of truth."),
    (62.0, "Less spreadsheet. More winning."),
    (68.0, "Vicious. Run your roster like a pro."),
    (73.0, "vicious dot gg."),
]
VO_SHORT = [
    (0.4, "Twelve tabs. Three group chats. One scrim in forty minutes."),
    (5.0, "Vicious is the command center for serious esports orgs."),
    (10.5, "One roster, every game. Scout, draft, analyze, win."),
    (18.0, "Multi-team. Multi-title. One source of truth."),
    (24.0, "Less spreadsheet. More winning."),
    (28.0, "Vicious. Run your roster like a pro. vicious dot gg."),
]

# Per-scene SFX cue (start offset within cut)
SFX_CUES_LONG = [
    (0.2, "tick"), (1.2, "subpulse"), (14.5, "tick"), (20.0, "whoosh"),
    (36.0, "tick"), (42.0, "tick"), (62.0, "subpulse"), (68.0, "swell"),
]
SFX_CUES_SHORT = [
    (0.2, "tick"), (5.0, "whoosh"), (24.0, "subpulse"), (28.0, "swell"),
]


def run(cmd, **kw):
    """Run a shell command and surface failures."""
    res = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if res.returncode != 0:
        sys.stderr.write(f"\n$ {' '.join(map(str, cmd))}\n{res.stderr}\n")
        raise SystemExit(res.returncode)
    return res


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ]).decode().strip()
    return float(out)


# ---------- VOICEOVER (gTTS) ----------
def tts_line(text: str, out: Path):
    from gtts import gTTS
    tts = gTTS(text=text, lang="en", tld="co.uk")
    tts.save(str(out))


def build_vo_track(cues, total_seconds: float, out_wav: Path):
    """Generate VO MP3s, then mix all with adelay onto a silent base of total_seconds."""
    line_files = []
    for i, (start, text) in enumerate(cues):
        mp3 = TMP / f"vo_{out_wav.stem}_{i:02d}.mp3"
        if not mp3.exists():
            tts_line(text, mp3)
        line_files.append((start, mp3))

    # Build amix filter with per-line adelay
    inputs = []
    filt = []
    for i, (start, mp3) in enumerate(line_files):
        inputs += ["-i", str(mp3)]
        delay_ms = int(start * 1000)
        filt.append(f"[{i}:a]aresample=44100,adelay={delay_ms}|{delay_ms},apad=pad_dur={total_seconds}[v{i}]")
    mix_inputs = "".join(f"[v{i}]" for i in range(len(line_files)))
    filt.append(f"{mix_inputs}amix=inputs={len(line_files)}:normalize=0:duration=longest,atrim=0:{total_seconds},volume=1.4[out]")
    filter_str = ";".join(filt)

    cmd = ["ffmpeg", "-y", *inputs, "-filter_complex", filter_str,
           "-map", "[out]", "-ac", "2", "-ar", "44100", str(out_wav)]
    run(cmd)


# ---------- MUSIC BED (procedural) ----------
def build_music_bed(total_seconds: float, out_wav: Path):
    """Sub + low pad + soft noise floor with a slow swell."""
    # 55 Hz sub, 165 Hz fifth, 220 Hz pad, brown-noise floor, with afade swell
    fc = (
        f"sine=frequency=55:duration={total_seconds}:sample_rate=44100[a1];"
        f"sine=frequency=82.5:duration={total_seconds}:sample_rate=44100[a2];"
        f"sine=frequency=165:duration={total_seconds}:sample_rate=44100[a3];"
        f"anoisesrc=duration={total_seconds}:colour=brown:amplitude=0.04:sample_rate=44100[a4];"
        f"[a1]volume=0.18[s1];"
        f"[a2]volume=0.07[s2];"
        f"[a3]volume=0.04[s3];"
        f"[a4]highpass=f=80,lowpass=f=400,volume=0.6[s4];"
        f"[s1][s2][s3][s4]amix=inputs=4:normalize=0,"
        f"afade=t=in:st=0:d=2,afade=t=out:st={max(total_seconds - 2, 0)}:d=2,"
        f"volume=0.55[out]"
    )
    cmd = ["ffmpeg", "-y", "-filter_complex", fc, "-map", "[out]", "-t", f"{total_seconds}", "-ac", "2", "-ar", "44100", str(out_wav)]
    run(cmd)


# ---------- SFX ----------
def build_sfx_track(cues, total_seconds: float, out_wav: Path):
    """Place small synthesized SFX onto a silent track at the given times."""
    parts_inputs = []
    parts_filters = []
    for i, (t, kind) in enumerate(cues):
        if kind == "tick":
            fc_src = "sine=f=2200:d=0.05,volume=0.55,afade=t=out:st=0.02:d=0.03"
        elif kind == "subpulse":
            fc_src = "sine=f=60:d=0.7,volume=0.6,afade=t=in:st=0:d=0.05,afade=t=out:st=0.45:d=0.25"
        elif kind == "whoosh":
            fc_src = "anoisesrc=d=0.7:colour=pink:amplitude=0.5,highpass=f=400,lowpass=f=2000,afade=t=in:st=0:d=0.4,afade=t=out:st=0.45:d=0.25,volume=0.7"
        elif kind == "swell":
            fc_src = "sine=f=82:d=1.5,volume=0.7,afade=t=in:st=0:d=1.0,afade=t=out:st=1.2:d=0.3"
        else:
            continue
        parts_inputs += ["-f", "lavfi", "-i", fc_src]

    if not parts_inputs:
        # silent
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={total_seconds}",
             "-ac", "2", "-ar", "44100", str(out_wav)])
        return

    for i, (t, _) in enumerate(cues):
        delay_ms = int(t * 1000)
        parts_filters.append(f"[{i}:a]aresample=44100,adelay={delay_ms}|{delay_ms},apad=pad_dur={total_seconds}[s{i}]")
    mix_inputs = "".join(f"[s{i}]" for i in range(len(cues)))
    parts_filters.append(f"{mix_inputs}amix=inputs={len(cues)}:normalize=0:duration=longest,atrim=0:{total_seconds}[out]")
    fc = ";".join(parts_filters)
    run(["ffmpeg", "-y", *parts_inputs, "-filter_complex", fc, "-map", "[out]",
         "-ac", "2", "-ar", "44100", str(out_wav)])


# ---------- AUDIO MIX ----------
def mix_audio(vo: Path, music: Path, sfx: Path, total_seconds: float, out: Path):
    fc = (
        f"[0:a]volume=1.0,asplit=2[vo1][vo2];"
        f"[1:a]volume=0.30[bed];"
        f"[2:a]volume=0.55[fx];"
        f"[bed][vo1]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400:makeup=2[bed_d];"
        f"[vo2][bed_d][fx]amix=inputs=3:normalize=0:duration=longest,"
        f"atrim=0:{total_seconds},alimiter=limit=0.95[out]"
    )
    run(["ffmpeg", "-y", "-i", str(vo), "-i", str(music), "-i", str(sfx),
         "-filter_complex", fc, "-map", "[out]", "-ac", "2", "-ar", "44100",
         "-c:a", "aac", "-b:a", "192k", str(out)])


# ---------- VIDEO: per-scene motion clip ----------
def render_scene_clip(scene: Scene, ratio: str, out_mp4: Path):
    w, h = RATIOS[ratio]
    png = FRAMES / ratio / f"scene-{scene.sid}.png"
    dur = scene.dur
    frames = int(round(dur * FPS))
    # Slow zoom 1.00 -> 1.045 over the scene duration; subtle pan based on sid
    sid_int = int(scene.sid)
    pan_x = "iw/2-(iw/zoom/2)+sin(on/PI/45)*4"
    pan_y = "ih/2-(ih/zoom/2)+cos(on/PI/45)*4"
    # Special motion for hook (01) and close (12): small punch-in feel
    if scene.sid == "01":
        zoom_expr = f"min(1.0 + on/{frames}*0.06, 1.08)"
    elif scene.sid == "12":
        zoom_expr = f"min(1.02 + on/{frames}*0.04, 1.08)"
    elif scene.sid == "11":
        zoom_expr = f"min(1.0 + on/{frames}*0.03, 1.05)"
    else:
        zoom_expr = f"min(1.0 + on/{frames}*0.045, 1.07)"

    # Mask-reveal feel via fade-in 0.25s, subtle fade-out 0.18s into the next scene
    fade_in = "fade=t=in:st=0:d=0.25"
    fade_out = f"fade=t=out:st={max(dur - 0.20, 0):.3f}:d=0.20"
    # Special: scene 11 (kinetic type) gets a hard "snap" no fade-in
    if scene.sid == "11":
        fade_in = "fade=t=in:st=0:d=0.08"
    # Close scene: longer fade-out to silence
    if scene.sid == "12":
        fade_out = f"fade=t=out:st={max(dur - 0.6, 0):.3f}:d=0.6"

    vf = (
        f"scale={w*2}:{h*2},"
        f"zoompan=z='{zoom_expr}':x='{pan_x}':y='{pan_y}':d={frames}:s={w}x{h}:fps={FPS},"
        f"{fade_in},{fade_out},format=yuv420p"
    )
    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-t", f"{dur}",
        "-i", str(png),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-pix_fmt", "yuv420p", "-r", str(FPS), "-t", f"{dur}",
        str(out_mp4),
    ]
    run(cmd)


def concat_scene_clips(clip_paths: list[Path], out_mp4: Path):
    list_file = TMP / f"_concat_{out_mp4.stem}.txt"
    list_file.write_text("\n".join(f"file '{p.resolve()}'" for p in clip_paths))
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-c", "copy", str(out_mp4),
    ])


def mux_audio_into_video(silent_video: Path, audio: Path, out: Path):
    run([
        "ffmpeg", "-y", "-i", str(silent_video), "-i", str(audio),
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0", "-shortest",
        "-movflags", "+faststart", str(out),
    ])


# ---------- TOP LEVEL ----------
def build_audio_for_cut(name: str, total: float, vo_cues, sfx_cues) -> Path:
    vo = ASSETS / f"vo-{name}.wav"
    music = ASSETS / f"music-{name}.wav"
    sfx = ASSETS / f"sfx-{name}.wav"
    final = ASSETS / f"audio-{name}.m4a"
    if not vo.exists():
        print(f"  → VO ({name})")
        build_vo_track(vo_cues, total, vo)
    if not music.exists():
        print(f"  → music bed ({name})")
        build_music_bed(total, music)
    if not sfx.exists():
        print(f"  → SFX ({name})")
        build_sfx_track(sfx_cues, total, sfx)
    print(f"  → mix ({name})")
    mix_audio(vo, music, sfx, total, final)
    return final


def build_silent_video(name: str, ratio: str, scenes: list[Scene]) -> Path:
    print(f"  → scene clips {name} {ratio}")
    clips = []
    for s in scenes:
        clip = TMP / f"clip-{ratio}-{s.sid}-{s.dur}.mp4"
        if not clip.exists():
            render_scene_clip(s, ratio, clip)
        clips.append(clip)
    silent = TMP / f"silent-{name}-{ratio}.mp4"
    print(f"  → concat → {silent.name}")
    concat_scene_clips(clips, silent)
    return silent


def main():
    print("→ AUDIO")
    audio_long = build_audio_for_cut("long", 75.0, VO_LONG, SFX_CUES_LONG)
    audio_short = build_audio_for_cut("short", 35.0, VO_SHORT, SFX_CUES_SHORT)

    print("→ VIDEO")
    for ratio in RATIOS.keys():
        for cut_name, scenes, audio in [("long", LONG, audio_long), ("short", SHORT, audio_short)]:
            silent = build_silent_video(cut_name, ratio, scenes)
            out = EXPORTS / f"vicious-explainer-{cut_name}-{ratio}.mp4"
            print(f"  → mux → {out.name}")
            mux_audio_into_video(silent, audio, out)

    print("✓ done. See", EXPORTS)


if __name__ == "__main__":
    main()
