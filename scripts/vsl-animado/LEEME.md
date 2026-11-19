# El VSL animado de MaKo (el Martín en cubos, 16:9)

El motor del VSL principal (19/11/2026). Sirve igual para el VSL de cada landing: se cambia el guion, no el código.
Se trabaja en `C:/dev/vsl-video` (fuera del repo: recs, voces y renders pesan); el código y el guion se copian a
`scripts/vsl-animado/` del repo. El guion explicado para Martín: `docs/vsl/guion-vsl-principal.md`.

## Qué hay

- `guion.json`: el VSL entero, por **secciones** (cada una es un MP4) y **escenas** (`{ id, dice, vis }`). Una sección
  con `"martin": true` es una toma de Martín a cámara: un solo texto (`dice`), su número (`n` de `de`), `titulo` y
  `grabar` (cómo se graba).
- `vsl.html?sec=<id>`: dibuja una sección a 1920×1080 con el kit de la galería (`kit-h.js`: el `kit.js` de
  `C:/dev/artefactos-animaciones/reels/kit/` con el escenario de ancho y alto variables). Todo sale de T: el mismo
  segundo da siempre la misma imagen.
- `personaje.js`: el Martín en cubos (`toma.js` de la galería, makeBoy) con **poses con nombre** que pasan de una a otra
  en 0,38 s: `reposo`, `saludo`, `abre`, `senala` (a la izquierda de la pantalla), `senalaDer`, `festeja`, `explica`,
  `encoge`, `telefono`.
- `hacer.mjs`: la tubería. `render.mjs`: las fotos y el MP4 de una sección. `hoja.py`: la hoja de contacto 16:9.
- `recs/<rec>/`: las grabaciones de la portada (`public/vsl-assets/sitio/<rec>.webm`) en cuadros JPG a 30 fps (las saca
  `hacer.mjs` sola). `logos/`: los logos de las apps (`public/vsl-assets/logos/apps`). `icons/`: los íconos de los
  rótulos. `toma-referencia.jpg`: un cuadro del VSL de junio, de fondo en el lugar de cada toma.

## Los tipos de escena (`vis.tipo`)

| Tipo | Qué es | Campos |
|---|---|---|
| `cara` | El personaje de cerca; subtítulos bajo el mentón | `lugar` (centro, der, izq, cerca, chico), `pose`, `poses` [[palabra, pose]], `clave` (palabras en azul), `dato` (tarjeta grande: `en`, `v`, `s`, `x`, `y`, `tacha`, `color`), `barras` |
| `pantalla` | Una grabación de la app en un marco; el personaje chico a la derecha | `rec`, `desde` (segundo de la grabación), `vel`, `zoom` [[palabra, escala, cx, cy]], `rotulo` ({n, t, ico}), `pose`, `pj: false` |
| `lista` | Apps que aparecen alrededor del personaje y se juntan en MaKo | `items` [{en, logo o ico, txt, sub, pos, rot}], `junta` (palabra), `juntaEn`, `heredar` (las de otra escena), `pos` |
| `golpe` | Fondo azul, la frase gigante en blanco (corte duro) | — |
| `toma` | El lugar de una toma de Martín (lo arma solo una sección `martin`) | — |
| `precio` | Las tarjetas de los planes | `planes` [{en, nombre, precio, resumen, pro}] |
| `cierre` | La marca, el titular y el botón con un cursor | `titular`, `cta`, `ctaEn`, `clicEn` |

`en` es siempre una palabra de esa escena (minúsculas, sin tildes: «máko» vale; `palabra#2` para la segunda vez).
En `dice`, «Máko» con tilde, «vsl» en minúscula, «Ei-Ai» (AI) e «Ímich» (Image): así los pronuncia el clon. En
pantalla se ven MaKo, VSL, AI e Image (`VER`, en `vsl.html`).

## Cómo se corre (desde `C:/dev/vsl-video`)

```bash
node hacer.mjs voz todas        # la voz de cada sección (sólo las que cambiaron), su chequeo y sus tiempos
node hacer.mjs fotos gancho     # cuadros para MIRAR: cap/gancho/ y cap/gancho-hoja.jpg (por el turno del navegador)
node hacer.mjs video todas      # un MP4 por sección: salida/secciones/<sec>.mp4 (por el turno, de a una)
node hacer.mjs montar           # todas en orden + la música baja → salida/vsl-principal.mp4
node hacer.mjs tomas            # la lista de lo que graba Martín → salida/tomas.md
```

- **La voz:** el clon de Martín (LA-CONFIG `_para_texto_sin_video`: `eleven_v4`, voz `I2d6BR9P2dAopVw1khNv`), alineada
  palabra por palabra; las pausas de más de 0,3 s se recortan (sin silencios muertos) y queda a -14 LUFS. El chequeo
  transcribe y compara con el guion: «maco» por «Máko» y «Conque» por «Koncke» son del transcriptor, no de la voz.
- **Las tomas de Martín:** mientras no grabe, su sección lleva su clon diciendo el texto (para mirar el ritmo) sobre un
  cuadro del VSL de junio. Cuando grabe, su clip va a `tomas/<sec>.mp4` (recortado: sin los 2 s de silencio) y `montar`
  lo pone en lugar del marcado. La música se calla en las tomas.
- **El navegador va por el turno de la PC** (`C:/dev/artefactos-animaciones/tools/turno.mjs`): `hacer.mjs` lo usa
  solo. No hace falta servidor: Playwright sirve la carpeta como `http://vsl.local/`.

## El VSL de una landing

Copiar `guion.json` a `guion-<landing>.json` (y apuntar `hacer.mjs` a ese archivo con `GUION=guion-<landing>.json`),
dejar el gancho de esa función, 2 o 3 escenas `pantalla` con su grabación de la portada (`public/vsl-assets/sitio/`),
el precio y el cierre, y correr lo mismo. Las grabaciones que hay: cerebro, referentes, spy (y spy-gancho, spy-oferta,
spy-anuncios, spy-funnel…), copywriting, carruseles, video, replicar, copilot (y copilot-reporte, copilot-whatsapp),
crm-ficha, chats, automations, calendario, cobranza, comunidad, equipo, tableros (y `tableros/<tablero>`).
