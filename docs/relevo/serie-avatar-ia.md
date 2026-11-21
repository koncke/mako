# Relevo — serie con avatar IA (chat hijo del Cerebro)

Actualizado: 21/11/2026 ~06:40 UTC, cuenta claude5 (92 %). Martín decidió: Spy trae TODO lo de la competencia, clasificado por tipo.

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

## Las cuentas, paso por paso (para sumar a Spy por tandas)
| Cuenta | Listado | Lo que falta para Spy |
|---|---|---|
| Rama | 243 reels | sumar los que NO pasaron el filtro de IA (están en `ramiro/ampliado/clasificacion-*.json`, con su forma): bajar, recortar a 25 s, subir al almacén y armar |
| Víctor y Heras Media | 225 y 246 | lo mismo; de Heras Media, 15 dudas no se pudieron bajar |
| Carrizo, Doglio, Collado | 87, 168, 52 (hojas hechas) | clasificar por tipo con subagentes (criterio nuevo: avatar · animación · a cámara), bajar lo mejor por N× y subir |
| Hormozi | 48 del 19/11 (con forma) | bajar sus reels y sumar como «a cámara» |
| Carruseles de todas | sin listar | listar la grilla de PUBLICACIONES (no la de reels) desde el Chrome de Martín, sólo leyendo; `yt-dlp --dump-single-json` da una entrada por lámina, pero las de imagen vienen recortadas al cuadrado: la lámina entera se baja abriendo la publicación |
| Serie 1 (avión) y Serie 4 | — | la referencia es una captura: buscar el reel exacto de @paralisisaldormir (una «parte 1») y de @manuelzapater («Respondiendo preguntas de seguidores», 3,2 M) desde el Chrome y bajarlo con yt-dlp |

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
