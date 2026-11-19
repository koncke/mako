# Serie 2 — Educación: tutoriales con la voz de Martín

Contenido para las redes de Martín con su personaje en cubos y su voz clonada, hecho con el método de los videos por código
(HTML + GSAP/Three.js, `C:/dev/artefactos-animaciones`). Arrancó el 19/11/2026 (cuenta claude5, chat `serie-educacion`).
El ranking de temas, con cómo lo explica cada mentor, está en [serie-2-temas.md](serie-2-temas.md).

## Qué pidió Martín (textual, 19/11)

> «contenido de educación de todo tipo… que te enfoques muchísimo en la transcripción de todos los cursos que tenemos, que
> hagas un relevo por ahí y que detectes los top topics y temas que más se repiten, o los que incluso tú consideres a ojo…
> vas a ver cómo lo explican esos mentores, esos gurús. Y como tercer paso también vas a salir afuera a investigar… para ver
> cómo también lo plantearon y descargar el copy y la transcripción de esos otros videos. Y hacemos tutoriales con nuestro
> formato y dándoles nuestra voz… videos de oferta, de vender high ticket, las comparativas, los miedos, videos de anuncios,
> contenido viral versus contenido de nicho, carruseles, creación de contenido, trial reels, historias… es súper importante
> que vayas y hagas una búsqueda de esos temas… para ver si los otros referentes ya lo explican de una manera viral, el hook
> sobre todo».

## Las reglas de la serie

- **Objetivo: SEGUIDORES.** No se vende nada: ni MaKo, ni un curso, ni «comenta y te paso». El cierre invita a seguir la
  cuenta (y, si el tema da para dos partes, «la parte 2 sale mañana»). La chispa dorada de MaKo va chica, como firma.
- **Se toma la idea, nunca se calca.** De los cursos y de los videos de afuera sale QUÉ se enseña y qué gancho funcionó;
  el guion, el ejemplo y las palabras son nuestros. El ejemplo, siempre con un negocio high ticket (coach, mentoría,
  agencia, consultoría, inmobiliaria).
- **Números reales.** O son cuentas que se ven (4 × US$2.500 = US$10.000) o tienen su fuente (Hormozi, con su libro o su
  video). Nada de estadísticas inventadas.
- **Personaje:** Martín en cubos (`reels/kit/toma.js`, `KIT.martin`). Nunca el ilustrado redondo ni el plano de rulos.
- **Voz:** `bash tools/voz_formato.sh <id>` (eleven_v4, voz `I2d6BR9P2dAopVw1khNv`, `_para_texto_sin_video` de
  `C:/dev/reel-mentores/voz/LA-CONFIG.json`). Se escribe como suena: «Máko», «Ei-Ai». El chequeo del guion corre solo al
  final del script: una palabra de más o cambiada pide otra toma.
- **Edición:** la duración la dan las palabras (≈ 3,2 por segundo); sin silencios muertos (el script los recorta a 0,3 s);
  un efecto por momento; subtítulos bajo el mentón; cámara cerca de lo que pasa; nada que suene fuera del guion.
- **Idioma:** español neutro con «tú», neutro en género, frases cortas que se lean en el teléfono.

## La plantilla de guion (≈ 110-160 palabras, 35-50 s)

| Tramo | Qué dice | Qué se ve |
|---|---|---|
| Gancho (0-3 s) | Lo contrario de lo que todos creen, o una promesa concreta con número. Una frase. | Martín en cubos grande + UNA imagen que lo pruebe. |
| Por qué importa (3-8 s) | El error que casi todos cometen y lo que les cuesta. | El error dibujado (tachado, en rojo). |
| El cuerpo (8-40 s) | El marco del mentor en 2-4 pasos, cada uno con el ejemplo de un negocio high ticket. | Una tarjeta o un plano por paso, atado a la palabra que lo nombra. |
| La vuelta (40-45 s) | La frase que resume todo, para guardar. | La frase sola, grande. |
| Cierre (últimos 2-3 s) | «Sígueme para más» o «la parte 2, mañana». | La chispa de MaKo, chica. |

## Proceso por video (y cuánto lleva)

1. Tema y gancho: del ranking + la investigación de afuera (`docs/series/serie-2-temas.md`).
2. Guion → `C:/dev/artefactos-animaciones/voz/guion-<id>.json` (escenas `[["s1","…"],…]`), contado en palabras.
3. Voz: `bash tools/voz_formato.sh <id>` → `reels/voz-<id>.mp3` + `reels/t-<id>.js` + el chequeo del guion.
4. Animación: `reels/<id>.html` sobre el kit (`reels/kit/kit.js`, `toma.js`), con el formato de la galería que mejor sirve.
5. Mirar: capturas por el turno (`node tools/turno.mjs node tools/capturar.mjs …`) y la hoja (`python -I tools/hoja.py`).
6. MP4: `node tools/turno.mjs node tools/render-mp4.mjs reels/<id>.html mp4/<id>.mp4 <dur> reels/voz-<id>.mp3 30`.
7. Ficha `reels/fichas/<id>.json` y aviso a «Galería y series 1 y 4», que la publica en la sección de la serie 2.

## Videos

(se completa a medida que salen)

## Decisiones

- 19/11: la serie no lleva CTA de venta ni «comenta PALABRA» (eso es de la serie 3); cierra invitando a seguir.
