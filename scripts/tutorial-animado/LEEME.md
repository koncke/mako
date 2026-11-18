# Tutoriales animados (el método del VSL de julio)

Texto que entra al ritmo de la voz, en el estilo del VSL animado de la landing vieja: Geist 800 sobre blanco, énfasis azul
`#2F6FED`, **MaKo** en dorado, un golpe en fondo azul con letra blanca, dos líneas como mucho y la marca de agua de MaKo abajo.
Cada «toca X», «aquí» o «este…» muestra en ese segundo la pestaña dibujada, clara y de cerca, con lo que se toca marcado. Las reglas
de estilo de Martín (julio de 2026) están en `OneDrive/Escritorio/MaKo-VSL/_voz-martin.md`. Hallazgos y trampas:
`docs/hallazgos-video-pipeline.md` §17.

**Lo que sirve la app:** `public/tutoriales/<key>.mp4` (720p, ≤ 1,5 MB), `<key>.jpg` (el póster) y `public/tutoriales/manifiesto.json`
(key, ruta, archivo, póster, duración, peso, guion, pantallas marcadas, chequeo de la voz). Hay una copia en 1080p para mirar en
`OneDrive/Escritorio/MaKo-VSL/tutoriales/videos/`.

## Cómo se hace uno (18/11/2026: los 35)

Se trabaja en `C:/dev/tutoriales-video/` (la carpeta `motor/` es esta), con una copia de las pestañas dibujadas en
`pestanas-copia/` (de `C:/dev/artefactos-pestanas/publicar/`).

```bash
# el guion de cada pestaña vive en guiones.json: pasos { dice, sel?, ver? }, pagina (app-*.html), icono (Iconify), pantallas
node motor/hacer.mjs crm voz       # la voz (LA-CONFIG: eleven_v4 + el clon de Martín), el chequeo contra el guion y la alineación
node motor/hacer.mjs crm cuadros   # + la pestaña capturada y una hoja de cuadros para MIRAR: trabajo/crm/hoja.jpg
node motor/hoja-pantallas.mjs trabajo/hoja.jpg crm plan   # sólo los cuadros de pantalla de varios, en una hoja
node motor/hacer.mjs crm video     # el render (1080p a OneDrive) + el 720p de public/tutoriales y el manifiesto
node motor/hacer.mjs crm web       # sólo rehace el 720p desde el 1080p ya renderizado
node motor/pagina.mjs              # la página de revisión (artefacto) con los mismos 720p
node motor/subir.mjs "<mensaje>" crm plan   # commit por ruta en C:/dev/wt-tutoriales-videos → punta/tutoriales-videos
```

- **`dice`** es lo que dice la voz (escribir «Máko» con tilde: así lo pronuncia). **`sel`** es lo que se marca en `pagina` cuando
  ese paso va en pantalla. **`ver`** cambia una palabra en pantalla sin tocar la voz (`{"numeral": "«#»"}`).
- **Qué va en pantalla:** todo paso que dice dónde tocar o señala («toca», «aquí», «este»…), más los de `pantallas`. Sin `sel`, va
  la pestaña entera. El resto es texto.
- **Requisitos:** ffmpeg en el PATH, el Chromium de `C:/dev/playwright-medidor`, `ELEVENLABS_API_KEY` en el `.env.local` del repo,
  `C:/dev/reel-mentores/voz/LA-CONFIG.json` y `chequear-guion.mjs`, y la música `C:/dev/reel-mentores/montaje/musica-eleven.mp3`.
- **El nombre de un botón va entero y en una línea** (el Cerebro, 18/11: «A cobrar» quedaba con la «A» azul al final de una
  línea). `hacer.mjs` resalta el nombre completo que sigue a «aquí, (en)» (`nombreDeAccion`), y `engine3.js` une con espacio
  duro las palabras resaltadas seguidas (`unido`). Una coma o un punto cortan la unión: «Publicaciones, Plan, Ventas» son tres
  nombres y pueden partirse entre ellos. Una cita («lo que tengo…») y más de 5 palabras no se unen. El costo: en la columna del
  costado, un nombre largo («Verificación en 2 pasos», «Cuéntale a MaKo qué pasó») baja la letra para entrar en el ancho, y en el
  centro el texto puede ocupar una línea más con la letra del mismo tamaño.
- **De a uno:** cada render abre un Chromium. La PC tiene 16 GB y suele haber otros chats construyendo.

## `vsl-julio/`

El código del VSL de Funnel (julio de 2026) **tal como se recuperó del transcript de la sesión 4d6acb52**: vivía en un scratchpad
que se borró. No corre tal cual (rutas viejas, faltan los assets). Sirve para copiar escenas (kanban, semáforo, Excel que se rompe,
carrusel en 3D). Su voz (David, `eleven_multilingual_v2`) **no** es la regla de hoy.
