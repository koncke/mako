# Tutoriales animados (el método del VSL de julio)

Texto que entra al ritmo de la voz, en el estilo del VSL animado de la landing vieja: Geist 800 sobre blanco, énfasis azul
`#2F6FED`, **MaKo** en dorado, golpes en fondo azul con letra blanca, dos líneas como mucho, marca de agua de MaKo abajo. Las
reglas de estilo completas (de Martín, julio 2026) están en `OneDrive/Escritorio/MaKo-VSL/_voz-martin.md`. Los hallazgos y las
trampas: `docs/hallazgos-video-pipeline.md` §17.

Muestra hecha con esto (16/11/2026): el tutorial del Second Brain, 13,7 s —
`OneDrive/Escritorio/MaKo-VSL/tutoriales/second-brain/` y el artefacto https://claude.ai/artifact/4F88A55UQgir6BGDALNNMU.

## Cómo se arma uno

Se corre dentro de esta carpeta. Lo que genera (`voz.mp3`, `alin.json`, `beats.js`, capturas, el `.mp4`) no se versiona.

```bash
# 1. el guion, exacto como lo va a decir la voz ("Máko" con tilde para que no diga "MaKó")
node voz.mjs tts guion-second-brain.txt voz.mp3
# 2. chequear que dijo el guion y medir el ritmo, ANTES de animar nada
node C:/dev/reel-mentores/voz/chequear-guion.mjs voz.mp3 "<el guion>"
# 3. cada palabra con su segundo
node voz.mjs alinear voz.mp3 guion-second-brain.txt alin.json
# 4. las pantallas: rangos de palabras → beats.js (la lista B de beats.mjs es lo que se escribe por tutorial)
node beats.mjs alin.json beats.js
# 5. la pantalla de la app que se marca (hoy, de la maqueta del onboarding)
node capturar-app.cjs
# 6. mirar cuadros sueltos antes del render entero, y después el video
node render.cjs 30 "700,4700,9700,12300"
node render.cjs 30
```

- **La voz** la pone `C:/dev/reel-mentores/voz/LA-CONFIG.json` → `_para_texto_sin_video` (hoy `eleven_v4` + el clon
  profesional de Martín). No se escribe a mano. La clave sale del `.env.local` del repo y no se imprime.
- **La escena propia de cada tutorial** va en `engine.js` (en la muestra: `drawGrafo` y `drawApp`). Las escenas del VSL de
  julio (kanban, semáforo, Excel que se rompe, ojo → dinero, carrusel en 3D) están en `vsl-julio/kinetic-full.js`.
- **Requisitos:** ffmpeg en el PATH y el Chromium de `C:/dev/playwright-medidor`.

## Medido en la muestra

| | |
|---|---|
| Voz | 217 caracteres → 95 créditos (v4 ≈ 0,44 por carácter); con la alineación y dos transcripciones, 104 |
| Ritmo | 43 palabras en 13,4 s (3,2 por segundo), ningún hueco de más de 0,47 s |
| Render | 418 cuadros a 30 fps en 34 s |

## `vsl-julio/`

El código del VSL de Funnel (julio 2026) **tal como se recuperó del transcript de la sesión 4d6acb52**, porque vivía en un
scratchpad que se borró. No corre tal cual: tiene rutas de ese scratchpad y le faltan los assets (logos, capturas, cuadros del
video de stock, la intro). Sirve para copiar escenas. Su voz (David, `eleven_multilingual_v2`) **no** es la regla de hoy.

- `kinetic-full.js` + `kinetic-full.html` — el motor de pantallas (`window.renderFrame(t)`).
- `chunk-full.js` — el guion partido en pantallas sobre la alineación.
- `eleven-gen.js` (voz), `forced-align.js` (alineación), `eleven-audio.js` (efectos y música de ElevenLabs).
- `gen-sfx2.js` — un efecto por evento, como filtergraph de ffmpeg.
- `cdp-render-b.js` — la captura cuadro por cuadro con un cliente CDP a mano.
- `assemble.sh` — el montaje: intro, cuadros, video de Mauricio, voz, música con techo y efectos.
- `logos-anim.html` — la intro de logos que chocan y forman MaKo.
- `funnel-final.txt` — el guion locutado.
