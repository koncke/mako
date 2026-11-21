# Relevo — serie con avatar IA (chat hijo del Cerebro)

Actualizado: 21/11/2026 ~05:05 UTC, cuenta claude5.

## Dónde está
- **La página: «Content Machine»,** https://claude.ai/artifact/FeLyfHY62GRHbLBAJX6QUz. Tres pestañas:
  - Avatar IA: 83 tarjetas, que son 9 temas con guion y 74 reels nuevos (49 de Rama, 20 de Heras Media, 5 de Víctor).
  - Animaciones: los 7 reels terminados con su referencia, más 91 formatos que se abren en la galería.
  - Carruseles: 11, lámina contra lámina.
  - El armado: `C:/dev/referentes-videos/artefacto/content-machine/armar-cm.mjs`, que lee el `temas.json` de `serie/armar-pagina.mjs`.
- **Lo que la arma** vive fuera del repo, en `C:/dev/referentes-videos/artefacto/serie/`: `armar-ampliados.mjs` → `armar-pagina.mjs`
  + `pagina-plantilla.html` → publicar. Los videos comprimidos van en `pub/`, en el scratchpad de la sesión que publica; se rehacen
  con `comprimir.sh` y `comprimir-ampliados.sh`.
- **Votos:** colección `votos` del artefacto (`estado` si/no).

## Cuentas: hasta dónde se llegó
| Cuenta | Listado | Clasificado | Bajado y en la página |
|---|---|---|---|
| Rama (@ramiro.cubria) | 243, hasta el 08/09/2026 | 193 nuevos: 20 pasan, 57 en duda (de esas, 29 pasan) | los 49 |
| Heras Media (@herasmedia) | 246, todo | 20 pasan, 50 en duda | los 20 que pasan; FALTAN las 50 dudas (bajadas: `tools/tiras-dudas.py herasmedia`) |
| Víctor (@victorherasemprendedor) | 225, hasta 12/2021 | 190 nuevos: 6 pasan, 22 en duda | los 6; FALTAN las 22 dudas (bajadas) |
| Hormozi | no (casi no tiene escenas) | — | — |
| Juan Carrizo (@juanxcarrizo), Francisco Doglio (@franciscodoglio), Guille Collado (@guille.colladomk) | EN COLA, usuario confirmado | — | — |
| Julián Alborna | EN ESPERA: Martín tiene que pasar el usuario (las únicas son de un artista visual sin reels) | — | — |

## Pendiente
- **El lugar del artefacto:** quedan unos 55 archivos y 36 MB. Antes de sumar las dudas de Heras Media y Víctor, recortar a 25 s o
  sacar los pósteres de formatos al almacén aparte.
- Las dudas de cada cuenta: `tools/tiras-dudas.py <cuenta>` → mirar → `clasificacion-dudas.json` → `armar-ampliados.mjs`.
- `docs/series/referentes/heras-media.md` y una fila por cuenta nueva en el README de referentes: formatos, N×, temas y CTA.
- **Imágenes de nuestra versión** (`generar-imagenes.mts`, Nano Banana Pro por ApiMart): el control de permisos bloquea leer la
  clave de la plataforma, y Martín tiene que autorizarlo en el chat de esta sesión. Las frases de «trazabilidad» y «embudo» hay que
  ajustarlas a la escena del guion: un comisario en lugar del Papa, «el banco» en lugar de Nvidia.
- **El video con avatar:** sólo con el guion aprobado por Martín.
