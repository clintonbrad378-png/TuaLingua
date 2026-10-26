#!/usr/bin/env python3
"""Comprueba que cada texto hablado por la app tenga su clip de audio.

Calcula la clave FNV-1a de cada texto (igual que src/lib/audio.ts y
generate_audio.py) y verifica que exista <clave>.mp3 en public/audio/<lang>,
y que no queden clips huérfanos (incluye .ogg sobrantes de versiones
anteriores: la app ya solo usa mp3).

Uso: python3 scripts/check_audio.py --lang en (o --lang ru)

Sale con código 1 si algo no cuadra, para poder usarlo en CI.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "src-tauri" / "src" / "content"
CONTENT_GLOBS = {"en": "u*.json", "ru": "r*.json"}

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


def collect_strings(args) -> set[str]:
    """Textos que la app intenta reproducir (phrases, audio, pairs, type)."""
    strings: set[str] = set()
    glob = CONTENT_GLOBS[args.lang]
    for path in sorted(CONTENT.glob(glob)):
        unit = json.loads(path.read_text(encoding="utf-8"))
        for lesson in unit.get("lessons", []):
            for phrase in lesson.get("phrases", []):
                strings.add(phrase["t"])
            for ex in lesson.get("exercises", []):
                if ex.get("audio"):
                    strings.add(ex["audio"])
                if ex.get("pair"):
                    strings.add(ex["pair"]["t"])
                if ex.get("type") == "match":
                    for pair in ex.get("pairs", []):
                        strings.add(pair["t"])
                if ex.get("type") == "type" and ex.get("solution"):
                    strings.add(ex["solution"])
    return {s for s in strings if s.strip()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", choices=("en", "ru"), default="en")
    args = parser.parse_args()
    out_dir = ROOT / "public" / "audio" / args.lang
    if not out_dir.is_dir():
        print(f"no existe {out_dir}", file=sys.stderr)
        return 1

    strings = collect_strings(args)
    needed = {clip_key(text) for text in strings}
    mp3 = {p.stem for p in out_dir.glob("*.mp3")}
    ogg = {p.stem for p in out_dir.glob("*.ogg")}

    missing = sorted(needed - mp3)
    orphans = sorted((mp3 | ogg) - needed)

    by_key = {clip_key(text): text for text in strings}
    problems = 0

    if missing:
        problems += len(missing)
        print(f"✗ {len(missing)} textos sin clip mp3:")
        for key in missing:
            print(f"    {by_key.get(key, key)!r}")
    if orphans:
        problems += len(orphans)
        if only_ogg := sorted((ogg - mp3) & orphans):
            print(f"✗ {len(only_ogg)} ogg sin pareja mp3 (la app solo usa mp3): borra o regenera")
            for key in only_ogg:
                print(f"    {by_key.get(key, key)!r}")
        rest = [k for k in orphans if k not in set(only_ogg)]
        if rest:
            print(f"✗ {len(rest)} clips huérfanos (su texto ya no está en el contenido)")
        print("    regenera con: python3 scripts/generate_audio.py --prune ...")

    if problems:
        print(f"\nFALLO: {problems} problema(s) de audio")
        return 1

    print(
        f"✓ audio correcto: {len(strings)} textos, {len(mp3)} mp3, "
        f"{len(ogg)} ogg (sobrantes), sin faltantes ni huérfanos"
        if ogg
        else f"✓ audio correcto: {len(strings)} textos, {len(mp3)} mp3, sin faltantes ni huérfanos"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
