# Relevo — serie con avatar IA (chat hijo del Cerebro)

Actualizado: 21/11/2026 ~10:00 UTC, cuenta claude5 (más del 93 %). Content Machine v39: la Serie 1 y la Serie 4 con su reel de referencia en video (Df2WwjMNmQN y DfC0kMiBsoW); fecha de publicación, orden «Más nuevos» y filtro «Publicado»; ×N calculado en la página contra lo que se mira («6× lo normal» arriba a la derecha); 4 tarjetas por fila. Pendiente: la competencia completa `fecha` donde falte. v37: tres tipos (Avatar IA con escena Sketch o Habla a cámara, Animación, Carrusel); las 68 referencias de animación en Spy (`anim-ref-<formato>`); «Hacer mi versión» con método, guardado en `produccion.metodo`. v36: en el detalle de Spy, el lugar de nuestra versión es un recuadro-botón «＋ Hacer mi versión» del tamaño de la referencia. los carruseles se deslizan dentro de la tarjeta de Spy (flechas, puntitos, carga al llegar; con sólo la portada, un sello). Spy en tarjetas cerradas del mismo tamaño; el detalle de Spy muestra sólo la referencia y «＋ Hacer mi versión», que escribe en la colección `produccion` y abre la pieza en Reels o Carruseles, «En preparación», en la pestaña «Guion». Capturas a 1440 y 375 en la carpeta compartida del Cerebro, `content-machine-v34/`.

**A medias (v34):** no se pudo capturar ninguna referencia de diseño (las galerías de Foreplay quedan en negro en el navegador de la app, Atria no tiene galería pública y el Top Ads de TikTok pide cuenta). El guion técnico por lámina lo describe Claude la primera vez que Martín abre cada lámina (`tecnico/<clave>-<lámina>`). Faltan el guion técnico de los otros 84 reels y de las piezas de Carrizo,. Los archivos de la página: `C:/dev/referentes-videos/artefacto/content-machine/` (`cuerpo.html`, `extra.css`, `armar-cm.mjs`, parches `parche-*.py`).

## Dónde está
- **La página: «Content Machine»,** https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz. Tres pestañas:
  - Avatar IA: 93 tarjetas, que son 9 temas con guion y 84 reels nuevos (49 de Rama, 26 de Heras Media, 9 de Víctor).
  - Animaciones: los 7 reels terminados con su referencia, más los 91 formatos, que se ven y se reproducen adentro (videos, pósteres
    y referencias en el almacén de archivos del artefacto; el mapa en `content-machine/assets.json`).
  - Carruseles: 11, lámina contra lámina.
  - El armado: `C:/dev/referentes-videos/artefacto/content-machine/armar-cm.mjs`, que lee el `temas.json` de `serie/armar-pagina.mjs`.
- **Lo que la arma** vive fuera del repo, en `C:/dev/referentes-videos/artefacto/serie/`: `armar-ampliados.mjs` → `armar-pagina.mjs`
  + `pagina-plantilla.html` → publicar. Los videos comprimidos van en `pub/`, en el scratchpad de la sesión que publica; se rehacen
  con `comprimir.sh` y `comprimir-ampliados.sh`.
- **Votos:** colección `votos` del artefacto (`estado` si/no). Revisión: `revision/<sección>-<id>`. **Comentarios** (escritos,
  dictados o con audio): colección `comentarios`; cómo leerlos y transcribir un audio, en `docs/hallazgos-contenido.md` →
  «Comentarios por voz en todo Content Machine».

## Cuentas: hasta dónde se llegó
| Cuenta | Listado | Clasificado | Bajado y en la página |
|---|---|---|---|
| Rama (@ramiro.cubria) | 243, hasta el 08/09/2026 | 193 nuevos: 20 pasan, 57 en duda (de esas, 29 pasan) | los 49 |
| Heras Media (@herasmedia) | 246, todo | 20 pasan, 50 en duda (6 más pasan; 15 no se pudieron bajar) | los 26; relevo en docs/series/referentes/heras-media.md |
| Víctor (@victorherasemprendedor) | 225, hasta 12/2021 | 190 nuevos: 6 pasan, 22 en duda (4 más pasan) | los 10 |
| Hormozi | 48 del 19/11: 19 a cámara en estudio, 13 taller en vivo, 3 podcast… y 1 con viñetas de cómic | con la regla de una hoja: 0 escenas con IA en 48. No entra en avatar IA | — |
| Juan Carrizo (@juanxcarrizo), Francisco Doglio (@franciscodoglio), Guille Collado (@guille.colladomk) | 87, 168 y 52 | la hoja más nueva y la más vieja: 0 pasan; textos: 0 señales. No entran en avatar IA (todo a cámara) | — |
| Julián Alborna | EN ESPERA: Martín tiene que pasar el usuario (las únicas son de un artista visual sin reels) | — | — |

## Content Machine v25 (21/11 ~06:40 UTC): Spy · Reels · Carruseles
- Spy = 104 piezas: los 93 de avatar IA y los 11 de `otras-series.json` (1 animación y 10 a cámara). Sus videos y pósteres están
  en el almacén de archivos (claves `vid/<código>.mp4` y `poster/<código>.jpg` en `content-machine/assets.json`).
- «Elegir» guarda `votos/<id>` con `estado: "si"`. Lo elegido aparece en Reels (o en Carruseles, si su tipo es carrusel) como
  «Por producir»; su decisión va en `revision/prod-<id>`.
- Capturas: `side-session-notes/local_3f1a66d3-.../content-machine-spy-v25/`.

## La bajada de la competencia la hace OTRO chat (21/11, pedido de Martín)
Ese chat es `local_557794c1-f009-4764-b4de-dd9b15b0e16e`. Escribe en la colección `spy` con el contrato de
`docs/hallazgos-contenido.md` → «Contrato de la colección spy». Este chat sólo publica la página y trabaja el feedback.
Lo que queda para él, con rutas exactas:

| Cuenta | Qué hay | Dónde |
|---|---|---|
| Juan Carrizo (@juanxcarrizo) | 87 reels listados, con metadatos, portadas y 5 hojas de 20 portadas | `C:/dev/referentes-videos/carrizo/lista-ig-21-11.txt`, `carrizo/ampliado/indice.json`, `carrizo/ampliado/<código>.json` y `.jpg`, `carrizo/ampliado/hoja-01..05.jpg` |
| Francisco Doglio (@franciscodoglio) | 168 listados y 9 hojas | `C:/dev/referentes-videos/doglio/…`, con la misma estructura |
| Guille Collado (@guille.colladomk) | 52 listados y 3 hojas | `C:/dev/referentes-videos/collado/…` |
| Rama, Víctor y Heras Media | todo listado y clasificado para IA; falta sumar lo que NO es IA (animación o a cámara) | `C:/dev/referentes-videos/<cuenta>/ampliado/clasificacion-a.json`, `-b.json` y `-dudas.json` (forma y serie de cada reel) |
| Hormozi | 48 reels del 19/11, bajados y transcriptos | `C:/dev/referentes-videos/hormozi/<código>/` (`video.mp4`, `video.info.json`, `meta.json`) |
| Carruseles de todas | sin listar | grilla de PUBLICACIONES desde el Chrome de Martín, sólo leyendo |

- Las herramientas están en `C:/dev/referentes-videos/tools/` (`ampliar.py`, `procesar.py`, `tiras-dudas.py`, `portadas.py`).
- Para recortar, `artefacto/serie/comprimir-ampliados.sh`: los primeros 25 s, a 480 px y crf 30.
- El criterio de IA está en `criterio-video-ia.md`. Para Spy hace falta el tipo (avatar-ia, animación o a cámara), no sólo si pasa.

## Pendiente
- **El lugar del artefacto:** los formatos ya están en el almacén de archivos. Los clips de cuentas nuevas van directo ahí
  (`Artifact` publish con `asset: true`); los 93 clips de Avatar IA siguen en la versión.
- Las dudas de cada cuenta: `tools/tiras-dudas.py <cuenta>` → mirar → `clasificacion-dudas.json` → `armar-ampliados.mjs`.
- Una fila por cuenta nueva en el README de referentes (formatos, N×, temas y CTA). Cómo se releva: `docs/hallazgos-competitors-spy.md`
  → «Relevar a mano la cuenta de Instagram de un referente».
- **Imágenes de nuestra versión** (`generar-imagenes.mts`, Nano Banana Pro por ApiMart): el control de permisos bloquea leer la
  clave de la plataforma, y Martín tiene que autorizarlo en el chat de esta sesión. Las frases de «trazabilidad» y «embudo» hay que
  ajustarlas a la escena del guion: un comisario en lugar del Papa, «el banco» en lugar de Nvidia.
- **El video con avatar:** sólo con el guion aprobado por Martín.
