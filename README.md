# TuaLingua

Aprende inglés desde el español con lecciones cortas e interactivas. App móvil hecha con **Rust + Tauri 2** (backend que gestiona contenido, repetición espaciada, rachas y XP) y **React + TypeScript** (interfaz juguetona con TTS, sonidos y háptica).

## Funcionalidad

- 4 unidades / 16 lecciones con ~130 ejercicios (opción múltiple, escucha, construir frases, emparejar, escribir, rellenar huecos)
- Repaso inteligente con repetición espaciada (SRS tipo Anki, planificado en Rust)
- XP, niveles, rachas diarias, meta diaria y estrellas por lección
- Pronunciación con text-to-speech del sistema y audio/web-haptics sin assets externos
- 100% offline: el contenido va compilado en el binario y el progreso se guarda en JSON

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
