#!/usr/bin/env python3
"""Genera los clips de voz (mp3+ogg) del contenido inglés con Piper.

Uso:
    python3 scripts/generate_audio.py --piper <ruta>/piper --model <ruta>/en_US-lessac-medium.onnx

Los archivos se guardan en public/audio/en/<hash>.{mp3,ogg} donde <hash> se
calcula igual que en src/lib/audio.ts (FNV-1a x2 sobre el texto normalizado).
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "src-tauri" / "src" / "content"
OUT = ROOT / "public" / "audio" / "en"

MASK = 0xFFFFFFFF
PRIME = 0x01000193
OFFSET = 0x811C9DC5


def fnv1a(text: str) -> int:
    h = OFFSET
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        unit = data[i] | (data[i + 1] << 8)
        h ^= unit
        h = (h * PRIME) & MASK
    return h


def clip_key(text: str) -> str:
    norm = " ".join(text.split())
    return f"{fnv1a(norm):08x}{fnv1a(norm + '#tualingua'):08x}"


def collect_strings() -> list[str]:
    strings: set[str] = set()
    for path in sorted(CONTENT.glob("u*.json")):
        unit = json.loads(path.read_text(encoding="utf-8"))
        for lesson in unit["lessons"]:
            for phrase in lesson["phrases"]:
                strings.add(phrase["en"])
            for ex in lesson["exercises"]:
                if ex.get("audio"):
                    strings.add(ex["audio"])
                if ex.get("pair"):
                    strings.add(ex["pair"]["en"])
                if ex["type"] == "match":
                    for pair in ex["pairs"]:
                        strings.add(pair["en"])
                if ex["type"] == "type":
                    strings.add(ex["solution"])
    return sorted(strings)


def synthesize(piper: Path, model: Path, text: str, wav: Path) -> None:
    subprocess.run(
        [str(piper), "-m", str(model), "-f", str(wav), "--sentence_silence", "0.15"],
        input=text.encode("utf-8"),
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        cwd=str(piper.parent),
    )


def encode(wav: Path, mp3: Path, ogg: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1",
         "-ar", "22050", "-b:a", "48k", str(mp3)],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1",
         "-ar", "22050", "-c:a", "libvorbis", "-q:a", "3", str(ogg)],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--piper", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument(
        "--prune",
        action="store_true",
        help="borra los clips cuyo texto ya no existe en el contenido",
    )
    args = parser.parse_args()

    piper = Path(args.piper).resolve()
    model = Path(args.model).resolve()
    if not piper.exists() or not model.exists():
        print("piper o modelo no encontrados", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    strings = collect_strings()
    generated = 0
    skipped = 0
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "clip.wav"
        for i, text in enumerate(strings, 1):
            key = clip_key(text)
            mp3 = OUT / f"{key}.mp3"
            ogg = OUT / f"{key}.ogg"
            if mp3.exists() and ogg.exists():
                skipped += 1
                continue
            synthesize(piper, model, text, wav)
            encode(wav, mp3, ogg)
            generated += 1
            print(f"[{i}/{len(strings)}] {text}", flush=True)

    removed = 0
    if args.prune:
        needed = {clip_key(text) for text in strings}
        for path in sorted(OUT.iterdir()):
            if path.stem not in needed:
                path.unlink()
                removed += 1

    total = sum(f.stat().st_size for f in OUT.iterdir())
    print(f"listo: {generated} generados, {skipped} ya existían, {len(strings)} únicos, {total / 1e6:.1f} MB")
    if args.prune:
        print(f"purga: {removed} clips huérfanos eliminados")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
