# TuaLingua

Aprende inglés desde el español con lecciones cortas e interactivas. App móvil hecha con **Rust + Tauri 2** (backend que gestiona contenido, repetición espaciada, rachas y XP) y **React + TypeScript** (interfaz juguetona con TTS, sonidos y háptica).

## Funcionalidad

- **12 unidades / 48 lecciones / ~350 ejercicios** que cubren de A1 a B2 (pasados, perfectos, condicionales, pasiva, estilo indirecto, phrasal verbs, collocations de examen…)
- Unidad final «Rumbo al B2» con estructuras típicas de examen (transformaciones, coletillas, inversión, condicionales mixtas)
- Repaso inteligente con repetición espaciada (SRS tipo Anki, planificado en Rust)
- XP, niveles, rachas diarias, meta diaria y estrellas por lección
- **Tema oscuro** en toda la interfaz (y en la status bar de Android)
- **Voz neuronal incorporada**: clips (Piper, mp3+ogg) empaquetados en la app, sin depender del TTS del sistema; si falta un clip se usa el TTS del sistema como respaldo
- Audio de interfaz y háptica generados en tiempo de ejecución, sin assets externos
- 100% offline: el contenido y las voces van en el binario y el progreso se guarda en JSON

## Voces

Los clips viven en `public/audio/en/` (nombre = hash FNV-1a del texto). Para regenerarlos o añadir voces de contenido nuevo:

```bash
python3 scripts/generate_audio.py --piper <ruta>/piper --model <ruta>/en_US-lessac-medium.onnx
```

Solo genera los clips que falten (idempotente). Necesita `piper` y `ffmpeg`.

## Desarrollo

Requisitos: Rust, Node 22+, Android SDK + NDK 27.

```bash
npm install
npm run tauri dev              # escritorio
npm run tauri -- android dev   # móvil conectado por USB
```

## Android (CI)

Cada push a `main` compila el APK en GitHub Actions:

- `TuaLingua-debug-arm64` — APK de debug instalable (artifact)
- `TuaLingua-release-arm64` — APK release firmado (si existen los secrets del keystore)

Los tags `v*` además publican los APK en GitHub Releases.

### Secrets necesarios para firmar

| Secret | Descripción |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | keystore en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | contraseña del keystore |
| `ANDROID_KEY_ALIAS` | alias de la clave |

El keystore local está en `.keystore/` (ignorado por git). **Guárdalo**: sin él no podrás firmar actualizaciones compatibles.

### Build universal (todas las ABIs)

```bash
npm run tauri -- android build --apk          # en lugar de --target aarch64
```
