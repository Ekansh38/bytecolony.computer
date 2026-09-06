#!/usr/bin/env python3
"""
GIF frame extractor for the diagram frame explorer.

For every GIF in static/assets/final/ that has a sidecar caption file
(static/assets/final/<name>.frames.txt), extract each frame as a PNG into
static/assets/frames-gen/<name>/frame-NN.png and write a manifest.json
with captions + per-frame delays. Also writes a global index.json listing
every GIF that has frames, so the client can check availability in one fetch.

Sidecar format (plain text, no dependencies):

    title: Half Adder
    grid: 3

    [frame 1]
    Caption for frame one. Can span
    multiple lines until the next [frame N] marker.

    [frame 2]
    Caption for frame two.

Missing [frame N] sections mean an empty caption for that frame.
The generated frames-gen/ directory is gitignored; this script runs in
build.sh before hugo so the output ships with the site.

Idempotent and incremental: a GIF is re-extracted only when the GIF or its
sidecar is newer than its manifest.
"""

import glob
import json
import os
import re
import sys

try:
    from PIL import Image, ImageSequence
except ImportError:
    print("extract_frames: Pillow not installed, skipping frame extraction", file=sys.stderr)
    sys.exit(0)

ASSET_DIR = "static/assets/final"
OUT_DIR = "static/assets/frames-gen"

FRAME_RE = re.compile(r"^\[frame\s+(\d+)\]\s*$", re.IGNORECASE)


def parse_sidecar(path):
    """Parse a .frames.txt sidecar into {title, grid, captions: {n: text}}."""
    meta = {"title": "", "grid": 0, "captions": {}}
    current = None  # frame number currently collecting
    buf = []

    def flush():
        if current is not None:
            meta["captions"][current] = "\n".join(buf).strip()

    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")
            m = FRAME_RE.match(line.strip())
            if m:
                flush()
                current = int(m.group(1))
                buf = []
                continue
            if current is None:
                # header zone
                if line.lower().startswith("title:"):
                    meta["title"] = line.split(":", 1)[1].strip()
                elif line.lower().startswith("grid:"):
                    try:
                        meta["grid"] = int(line.split(":", 1)[1].strip())
                    except ValueError:
                        pass
            else:
                buf.append(line)
    flush()
    return meta


def extract(gif_path, out_dir):
    """Extract coalesced RGBA frames. Returns list of {file, delay}."""
    frames = []
    with Image.open(gif_path) as im:
        for i, frame in enumerate(ImageSequence.Iterator(im)):
            fname = f"frame-{i + 1:02d}.png"
            delay = frame.info.get("duration", 100)
            if delay < 20:  # browsers clamp tiny delays; mirror that
                delay = 100
            frame.convert("RGBA").save(
                os.path.join(out_dir, fname), "PNG", optimize=True
            )
            frames.append({"file": fname, "delay": delay})
    return frames


def needs_rebuild(gif_path, sidecar_path, manifest_path):
    if not os.path.exists(manifest_path):
        return True
    mtime = os.path.getmtime(manifest_path)
    return os.path.getmtime(gif_path) > mtime or os.path.getmtime(sidecar_path) > mtime


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    index = {}
    built = skipped = 0

    for gif_path in sorted(glob.glob(os.path.join(ASSET_DIR, "*.gif"))):
        name = os.path.splitext(os.path.basename(gif_path))[0]
        sidecar_path = os.path.join(ASSET_DIR, f"{name}.frames.txt")
        if not os.path.exists(sidecar_path):
            continue

        out_dir = os.path.join(OUT_DIR, name)
        manifest_path = os.path.join(out_dir, "manifest.json")
        meta = parse_sidecar(sidecar_path)

        if needs_rebuild(gif_path, sidecar_path, manifest_path):
            os.makedirs(out_dir, exist_ok=True)
            # clear stale frames so a shrinking GIF doesn't leave orphans
            for old in glob.glob(os.path.join(out_dir, "frame-*.png")):
                os.remove(old)
            frame_files = extract(gif_path, out_dir)
            built += 1
        else:
            with open(manifest_path, encoding="utf-8") as f:
                frame_files = json.load(f)["frames"]
                frame_files = [{"file": fr["file"], "delay": fr["delay"]} for fr in frame_files]
            skipped += 1

        manifest = {
            "name": name,
            "title": meta["title"] or name.replace("-", " "),
            "grid": meta["grid"],
            "gif": f"/assets/final/{name}.gif",
            "frames": [
                {
                    "file": fr["file"],
                    "src": f"/assets/frames-gen/{name}/{fr['file']}",
                    "delay": fr["delay"],
                    "caption": meta["captions"].get(i + 1, ""),
                }
                for i, fr in enumerate(frame_files)
            ],
        }
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)

        index[name] = {"count": len(manifest["frames"]), "title": manifest["title"]}

    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    print(f"extract_frames: {built} extracted, {skipped} up-to-date, {len(index)} total")


if __name__ == "__main__":
    main()
