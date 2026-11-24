# TuaLingua

Aprende idiomas desde el español con práctica enfocada en frases útiles. App hecha con **Rust + Tauri 2** (backend con contenido, progreso, SRS, rachas y XP) y **React + TypeScript** (interfaz responsive con audio y modo TTS del dispositivo).

## Funcionalidad

- **Idiomas**: inglés, ruso, italiano y chino mandarín con lecciones, repaso SRS y práctica de frases.
- **Chino con todo**: 汉字 + pinyin con tonos en cada tarjeta, una minilección de los 4 tonos por unidad, ejercicios de oído para distinguirlos y escritura que acepta hanzi o pinyin sin tonos
- Unidad final «Rumbo al B2» en inglés con estructuras típicas de examen (transformaciones, coletillas, inversión, condicionales mixtas)
- Repaso inteligente con repetición espaciada (SRS tipo Anki, planificado en Rust)
- **Diccionario por categorías** (28 categorías en inglés, 27 en ruso y 12 en chino, con traducción, tipo de palabra y ejemplo) con búsqueda instantánea en inglés/español, ruso/español o chino (con pinyin)/español
- **Flashcards con vocabulario por categorías**: estudia tu mazo personal o cualquier categoría del diccionario (por idioma) con tarjetas que se voltean y practícalas con 5 tipos de ejercicio interactivos (elección, escritura, escucha, completar frase con ejemplo y unir parejas) que dan XP y entran en tu plan de repaso
- **Miniclase tipo Duolingo antes del test**: cada lección empieza con la meta, consejos y el vocabulario clave en tarjetas con audio para escuchar cada palabra; solo después empiezan los ejercicios
- **Añadir en bloque**: guarda toda una categoría en tu mazo con un toque (comando nativo `add_deck_many`, sin duplicados)
- XP, niveles (7 títulos), rachas diarias, **meta diaria configurable** y estrellas por lección
- **Calendario de rachas** (últimos 3 meses) en las estadísticas
- **Exportar / importar progreso** como archivo JSON (respaldo o traslado entre dispositivos); los guardados conservan 3 backups rotativos en la carpeta de datos
- **Idioma de la interfaz** seleccionable (español / inglés)
- Tema oscuro en toda la interfaz (y en la status bar de Android)
- Navegación completa con teclado y estilo accesible (foco visible, diálogos con foco atrapado, `prefers-reduced-motion`)
- **Audio flexible**: TTS nativo del dispositivo (Android `TextToSpeech` vía plugin propio de Tauri) y Web Speech en escritorio, con selección automática de voz e idioma.
- Audio de interfaz y háptica generados en tiempo de ejecución, sin assets externos
- Offline-first: el contenido y progreso se guardan localmente; el audio puede usar clips locales o TTS del dispositivo.

## Audio

La app pronuncia palabras y frases con la voz del sistema. En Android usa el motor TTS nativo (`TextToSpeech`) mediante el plugin local `src-tauri/plugins/tauri-plugin-native-tts`, porque el WebView de Android no implementa `speechSynthesis`. En escritorio usa la Web Speech API. No se empaquetan archivos de audio.

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
