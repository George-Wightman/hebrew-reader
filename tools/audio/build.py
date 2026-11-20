"""Hebrew on the move: the clips the app lays end to end into one track to listen to with the
screen off (Phase 4 of docs/superpowers/specs/2026-11-20-practice-everywhere-design.md).

For every course sentence (content/nodes.json, which is public) three clips, made ahead here
because the phone's own voice can't play with the screen off or be recorded:

    audio/clips/<he-hash>.he.mp3     the Hebrew, at normal speed     (Microsoft's Hila)
    audio/clips/<he-hash>.slow.mp3   the Hebrew, slowly              (Hila, 30% slower)
    audio/clips/<en-hash>.en.mp3     the English prompt              (Microsoft's Ryan)

and audio/index.json, which maps each sentence's Hebrew to its two hashes. A clip's name is the
hash of its text, so the app caches a clip for good: a changed sentence is a new file.

ONLY PUBLIC COURSE CONTENT is ever sent to the voice service. His own week's cards live in the
dashboard's private repo and never come here.

The voice is Microsoft Edge's free read-aloud service, through the edge-tts package. It only
returns 48 kbps MP3 with silence either side of the speech, so each clip is trimmed to the
words (plus a little air) using the word timings the service sends with it: MP3 is a run of
independent-length frames, so trimming is cutting whole frames, with no re-encoding.

Setup, once (outside the synced folder):
    python -m venv "%LOCALAPPDATA%\\hebrew-audio-venv"
    "%LOCALAPPDATA%\\hebrew-audio-venv\\Scripts\\python.exe" -m pip install edge-tts
Run from the repo root:
    "%LOCALAPPDATA%\\hebrew-audio-venv\\Scripts\\python.exe" -I tools/audio/build.py [--levels 1-3] [--limit N] [--dry-run]
Re-running only makes what is missing, and rewrites the index from what is on disk.
"""

import argparse
import asyncio
import hashlib
import json
import os
import sys
import unicodedata

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONTENT = os.path.join(ROOT, "content", "nodes.json")
OUT = os.path.join(ROOT, "audio")
CLIPS = os.path.join(OUT, "clips")
INDEX = os.path.join(OUT, "index.json")

VOICE_HE = "he-IL-HilaNeural"
VOICE_EN = "en-GB-RyanNeural"
SLOW = "-30%"
# Air kept either side of the words when trimming, in seconds.
LEAD_S, TAIL_S = 0.12, 0.22
TICKS = 10_000_000          # the service's timings are in 100-ns ticks


def norm(text):
    return unicodedata.normalize("NFC", " ".join(str(text).split()))


def text_hash(kind, text):
    # sha1 of "<kind>|<text>", 12 hex. The app never recomputes it: it looks the Hebrew up in
    # index.json, keyed by norm(he), which it normalises the same way (audioNorm).
    return hashlib.sha1(f"{kind}|{norm(text)}".encode("utf-8")).hexdigest()[:12]


# ---- MP3 frames -------------------------------------------------------------------------------
# MPEG-1/2/2.5 Layer III headers: enough to walk the frames of a CBR stream and cut whole ones.
BITRATES = {
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],      # MPEG-1
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],         # MPEG-2
    0: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],         # MPEG-2.5
}
RATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}


def frames(data):
    """[(start, length, seconds)] for each Layer III frame, skipping anything before the first sync."""
    out, i, n = [], 0, len(data)
    while i + 4 <= n:
        b1, b2, b3 = data[i + 1], data[i + 2], data[i + 3]
        if data[i] != 0xFF or (b1 & 0xE0) != 0xE0:
            i += 1
            continue
        ver, layer = (b1 >> 3) & 3, (b1 >> 1) & 3
        bi, si, pad = (b2 >> 4) & 15, (b2 >> 2) & 3, (b2 >> 1) & 1
        if ver == 1 or layer != 1 or bi in (0, 15) or si == 3:
            i += 1
            continue
        kbps, rate = BITRATES[ver][bi], RATES[ver][si]
        samples = 1152 if ver == 3 else 576
        length = (samples // 8) * kbps * 1000 // rate + pad
        if length < 4 or i + length > n:
            break
        out.append((i, length, samples / rate))
        i += length
    return out


def trim(data, first_s, last_s):
    """The frames from just before the first word to just after the last."""
    fs = frames(data)
    if not fs or first_s is None or last_s is None:
        return data
    keep, t = [], 0.0
    for start, length, dur in fs:
        if t + dur >= first_s - LEAD_S and t <= last_s + TAIL_S:
            keep.append(data[start:start + length])
        t += dur
    return b"".join(keep) if keep else data


# ---- the voice ---------------------------------------------------------------------------------
async def speak(text, voice, rate="+0%"):
    import edge_tts
    audio, first, last = bytearray(), None, None
    comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / TICKS
            end = (chunk["offset"] + chunk["duration"]) / TICKS
            first = start if first is None else min(first, start)
            last = end if last is None else max(last, end)
    if not audio:
        raise RuntimeError("no audio")
    return trim(bytes(audio), first, last)


async def make(path, text, voice, rate, sem, stats):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        stats["kept"] += 1
        return
    async with sem:
        for attempt in range(4):
            try:
                data = await speak(text, voice, rate)
                tmp = path + ".part"
                with open(tmp, "wb") as f:
                    f.write(data)
                os.replace(tmp, path)
                stats["made"] += 1
                stats["bytes"] += len(data)
                return
            except Exception as e:  # the service drops the odd request; try again, slower
                if attempt == 3:
                    stats["failed"].append(f"{os.path.basename(path)}: {type(e).__name__} {str(e)[:80]}")
                    return
                await asyncio.sleep(2 * (attempt + 1))


def levels_of(spec):
    lo, _, hi = spec.partition("-")
    return set(range(int(lo), int(hi or lo) + 1))


def course(levels):
    with open(CONTENT, encoding="utf-8") as f:
        items = json.load(f).get("items", [])
    seen, out = set(), []
    for it in items:
        if it.get("type") not in ("sentence", "listen") or not it.get("he") or not it.get("en"):
            continue
        if int(it.get("lvl") or 1) not in levels:
            continue
        he = norm(it["he"])
        if he in seen:
            continue
        seen.add(he)
        out.append({"he": he, "en": norm(it["en"])})
    return out


def write_index():
    """Every sentence whose three clips are on disk, from the whole course, whatever the levels."""
    items = {}
    for it in course(set(range(1, 6))):
        h, e = text_hash("he", it["he"]), text_hash("en", it["en"])
        if all(os.path.exists(os.path.join(CLIPS, n)) for n in (f"{h}.he.mp3", f"{h}.slow.mp3", f"{e}.en.mp3")):
            items[it["he"]] = [h, e]
    index = {"v": 1, "voices": {"he": VOICE_HE, "slow": SLOW, "en": VOICE_EN},
             "items": dict(sorted(items.items()))}
    with open(INDEX, "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    return len(items)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--levels", default="1-3")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    todo = course(levels_of(a.levels))
    if a.limit:
        todo = todo[:a.limit]
    print(f"{len(todo)} sentences at levels {a.levels}")
    if a.dry_run:
        return
    os.makedirs(CLIPS, exist_ok=True)
    sem = asyncio.Semaphore(a.concurrency)
    stats = {"made": 0, "kept": 0, "bytes": 0, "failed": []}
    jobs = []
    for it in todo:
        h, e = text_hash("he", it["he"]), text_hash("en", it["en"])
        jobs.append(make(os.path.join(CLIPS, f"{h}.he.mp3"), it["he"], VOICE_HE, "+0%", sem, stats))
        jobs.append(make(os.path.join(CLIPS, f"{h}.slow.mp3"), it["he"], VOICE_HE, SLOW, sem, stats))
        jobs.append(make(os.path.join(CLIPS, f"{e}.en.mp3"), it["en"], VOICE_EN, "+0%", sem, stats))
    done = 0
    for coro in asyncio.as_completed(jobs):
        await coro
        done += 1
        if done % 150 == 0:
            print(f"  {done} of {len(jobs)} clips")
    n = write_index()
    print(f"made {stats['made']} clips ({stats['bytes'] // 1024} KB), kept {stats['kept']}; index: {n} sentences")
    for f in stats["failed"]:
        print("  failed:", f)
    sys.exit(1 if stats["failed"] else 0)


if __name__ == "__main__":
    asyncio.run(main())
