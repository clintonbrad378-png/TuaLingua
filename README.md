# TuaLingua

Aprende inglés o ruso desde el español con lecciones cortas e interactivas. App hecha con **Rust + Tauri 2** (backend que gestiona contenido, repetición espaciada, rachas y XP) y **React + TypeScript** (interfaz juguetona con TTS, sonidos y háptica).

## Funcionalidad

- **Inglés (12 unidades / 48 lecciones) y ruso (8 unidades / 32 lecciones)**, de A1 a B2 (pasados, perfectos, condicionales, pasiva, estilo indirecto, phrasal verbs, collocations de examen…)
- Unidad final «Rumbo al B2» en inglés con estructuras típicas de examen (transformaciones, coletillas, inversión, condicionales mixtas)
- Repaso inteligente con repetición espaciada (SRS tipo Anki, planificado en Rust)
- **Diccionario por categorías** (16 categorías por idioma, ~420 entradas cada uno con traducción, tipo de palabra y ejemplo) con búsqueda instantánea en inglés/español o ruso/español
- **Flashcards personales**: selecciona palabras del diccionario en tu mazo, estúdialas con tarjetas que se voltean y practícalas con ejercicios (opción mixta/escucha/escritura) que dan XP y entran en tu plan de repaso
- XP, niveles (7 títulos), rachas diarias, **meta diaria configurable** y estrellas por lección
- **Calendario de rachas** (últimos 3 meses) en las estadísticas
- **Exportar / importar progreso** como archivo JSON (respaldo o traslado entre dispositivos); los guardados conservan 3 backups rotativos en la carpeta de datos
- **Idioma de la interfaz** seleccionable (español / inglés)
- Tema oscuro en toda la interfaz (y en la status bar de Android)
- Navegación completa con teclado y estilo accesible (foco visible, diálogos con foco atrapado, `prefers-reduced-motion`)
- **Voz neuronal incorporada**: 937 frases (Piper, mp3) empaquetadas en la app, sin depender del TTS del sistema; si falta un clip se usa el TTS del sistema como respaldo
- Audio de interfaz y háptica generados en tiempo de ejecución, sin assets externos
- 100% offline: el contenido y las voces van en el binario y el progreso se guarda en JSON

## Voces

Los clips viven en `public/audio/<lang>/` (nombre = hash FNV-1a del texto). Solo se empaquetan **mp3** (los WebViews donde corre Tauri los reproducen siempre, y duplicar formato doblaba el tamaño de la app). Para regenerarlos o añadir voces de contenido nuevo:

```bash
python3 scripts/generate_audio.py --lang en --piper <ruta>/piper --model <ruta>/en_US-lessac-medium.onnx --prune
```

Solo genera los clips que falten (idempotente) y, con `--prune`, borra los que ya no corresponden a ningún texto del contenido. Necesita `piper` y `ffmpeg`. `--ogg` añade también vorbis (solo para pruebas locales).

Para comprobar la cobertura sin sintetizar (esto es lo que ejecuta la CI):

```bash
npm run audio:check
```

Ojo: el hash depende del texto **exacto**, así que cambiar mayúsculas o puntuación de un texto invalida su clip y obliga a regenerarlo. Si falta un clip, la app usa el TTS del sistema como respaldo (en Android el WebView puede no tener TTS: sin regenerar, esos textos quedan mudos a menos que el sistema provea Google TTS).

## Desarrollo

Requisitos: Rust, Node 22+, Android SDK + NDK 27 (móvil) o las librerías del sistema de Tauri (escritorio).

```bash
npm install
npm run tauri dev              # escritorio
npm run tauri -- android dev   # móvil conectado por USB
```

Verificación local (lo mismo que la CI ejecuta en el job de checks):

```bash
npm run lint && npm run typecheck && npm run test
cargo test                     # en src-tauri/
npm run audio:check
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

## Escritorio y checks (CI)

`.github/workflows/ci.yml` ejecuta en cada push/PR:

- **checks**: `npm run lint` + `tsc --noEmit` + `vitest` + `cargo test` + cobertura de audio.
- **desktop**: build de escritorio para Linux (AppImage + deb), con artifact y publicación en tags `v*`.
