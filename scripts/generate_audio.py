#!/usr/bin/env python3
"""Genera los clips de voz (mp3, y opcionalmente ogg) del contenido con Piper.

Uso:
    python3 scripts/generate_audio.py --lang en --piper <ruta>/piper --model <ruta>/en_US-lessac-medium.onnx
    python3 scripts/generate_audio.py --lang ru --piper <ruta>/piper --model <ruta>/ru_RU-irina-medium.onnx

La app solo reproduce mp3 (formato más compatible); `--ogg` genera además una
copia vorbis para pruebas locales. Los archivos se guardan en
public/audio/<lang>/<hash>.mp3 donde <hash> se calcula igual que en
src/lib/audio.ts (FNV-1a x2 sobre el texto normalizado).
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def speech_text(text: str) -> str:
    """La voz no debe leer el pinyin entre paréntesis de las entradas chinas."""
    return re.sub(r"[(（][^)）]*[)）]", " ", text)

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "src-tauri" / "src" / "content"
CONTENT_GLOBS = {"en": "u*.json", "ru": "r*.json", "it": "i*.json", "zh": "c*.json"}
DICTIONARIES = {
    "en": "dictionary.json",
    "ru": "dictionary_ru.json",
    "it": "dictionary_it.json",
    "zh": "dictionary_zh.json",
}

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
    norm = " ".join(speech_text(text).split())
    return f"{fnv1a(norm):08x}{fnv1a(norm + '#tualingua'):08x}"


def collect_strings(args) -> list[str]:
    """Todo lo que la app puede reproducir: lecciones + diccionario."""
    strings: set[str] = set()
    glob = CONTENT_GLOBS[args.lang]
    for path in sorted(CONTENT.glob(glob)):
        unit = json.loads(path.read_text(encoding="utf-8"))
        for lesson in unit["lessons"]:
            for phrase in lesson["phrases"]:
                strings.add(phrase["t"])
            for ex in lesson["exercises"]:
                if ex.get("audio"):
                    strings.add(ex["audio"])
                if ex.get("pair"):
                    strings.add(ex["pair"]["t"])
                if ex["type"] == "match":
                    for pair in ex["pairs"]:
                        strings.add(pair["t"])
                if ex["type"] == "type":
                    strings.add(ex["solution"])
    dict_path = CONTENT / DICTIONARIES[args.lang]
    if dict_path.exists():
        dictionary = json.loads(dict_path.read_text(encoding="utf-8"))
        for category in dictionary:
            for word in category["words"]:
                strings.add(word["t"])
    return sorted(strings)


def generate_lang(args, strings: list[str]) -> tuple[int, int]:
    """Sintetiza los clips que falten; devuelve (generados, saltados)."""
    out_dir = ROOT / "public" / "audio" / args.lang
    piper = Path(args.piper).resolve()
    model = Path(args.model).resolve()
    if not piper.exists() or not model.exists():
        print("piper o modelo no encontrados", file=sys.stderr)
        return 0, 0
    out_dir.mkdir(parents=True, exist_ok=True)
    generated = 0
    skipped = 0
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "clip.wav"
        for i, text in enumerate(strings, 1):
            key = clip_key(text)
            mp3 = out_dir / f"{key}.mp3"
            ogg = out_dir / f"{key}.ogg" if args.ogg else None
            if mp3.exists() and (ogg is None or ogg.exists()):
                skipped += 1
                continue
            synthesize(piper, model, speech_text(text), wav)
            encode(wav, mp3, ogg)
            generated += 1
            print(f"[{i}/{len(strings)}] {text}", flush=True)
    return generated, skipped


def generate_lang_python(args, strings: list[str]) -> tuple[int, int]:
    """Variante en proceso: usa la librería piper-tts (sin CLI nativo).

    Más rápido con muchos clips porque carga el modelo una sola vez.
    """
    import wave

    from piper import config as piper_config
    from piper import PiperVoice

    out_dir = ROOT / "public" / "audio" / args.lang
    model = Path(args.model).resolve()
    if not model.exists():
        print("modelo no encontrado", file=sys.stderr)
        return 0, 0
    out_dir.mkdir(parents=True, exist_ok=True)
    voice = PiperVoice.load(str(model))
    syn_cfg = piper_config.SynthesisConfig(normalize_audio=True)
    generated = 0
    skipped = 0
    print(f"    sample rate de la voz: {voice.config.sample_rate} Hz")
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "clip.wav"
        for i, text in enumerate(strings, 1):
            key = clip_key(text)
            mp3 = out_dir / f"{key}.mp3"
            ogg = out_dir / f"{key}.ogg" if args.ogg else None
            if mp3.exists() and (ogg is None or ogg.exists()):
                skipped += 1
                continue
            with wave.open(str(wav), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(voice.config.sample_rate)
                for chunk in voice.synthesize(speech_text(text), syn_cfg):
                    wf.writeframes(chunk.audio_int16_bytes)
            encode(wav, mp3, ogg)
            generated += 1
            print(f"[{i}/{len(strings)}] {text}", flush=True)
    return generated, skipped


def encode(wav: Path, mp3: Path, ogg: Path | None) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1",
         "-ar", "22050", "-b:a", "48k", str(mp3)],
        check=True,
    )
    if ogg is not None:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1",
             "-ar", "22050", "-c:a", "libvorbis", "-q:a", "3", str(ogg)],
            check=True,
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", choices=("en", "ru", "it", "zh"), default="en")
    parser.add_argument(
        "--piper",
        help="binario piper (variante subprocess). Obligatorio a menos que use --python-piper",
    )
    parser.add_argument(
        "--python-piper",
        action="store_true",
        help="usa la librería piper-tts en proceso (corre con el Python del venv de piper)",
    )
    parser.add_argument("--model", required=True)
    parser.add_argument(
        "--ogg",
        action="store_true",
        help="genera también .ogg (solo para pruebas; la app usa mp3)",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="borra los clips cuyo texto ya no existe en el contenido",
    )
    args = parser.parse_args()

    strings = collect_strings(args)
    if args.python_piper:
        generated, skipped = generate_lang_python(args, strings)
    else:
        generated, skipped = generate_lang(args, strings)

    out_dir = ROOT / "public" / "audio" / args.lang
    removed = 0
    if args.prune:
        needed = {clip_key(text) for text in strings}
        for path in sorted(out_dir.iterdir()):
            if path.suffix not in (".mp3", ".ogg"):
                continue
            if path.stem not in needed:
                path.unlink()
                removed += 1

    total = sum(f.stat().st_size for f in out_dir.iterdir())
    print(f"listo: {generated} generados, {skipped} ya existían, {len(strings)} únicos, {total / 1e6:.1f} MB")
    if args.prune:
        print(f"purga: {removed} clips huérfanos eliminados")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
