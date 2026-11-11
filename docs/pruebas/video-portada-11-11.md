# La portada de la tab Video — 11/11/2026

Martín, con la captura de `hola-mako.com/video-editor`: «deberían haber detectado esto… quiero que prueben y miren todo y
detecten oportunidades de mejora». La referencia es la portada de Image (`/image-editor`), que copia la grilla de Top Carousels.

Las capturas de «después» salen de un render LOCAL con el componente real (`app/video-editor/OutliersVideo.tsx`), su CSS real
(los dos `.module.css`, por esbuild) y los datos reales de producción (sólo lectura). Las de producción van cuando se despliegue
la rama `punta/video-portada-1111`. Las capturas están en [video-portada-11-11/](video-portada-11-11/).

## Antes: lo que vio Martín ([01](video-portada-11-11/01-antes-1440.jpg))

| Crítica | Por qué está mal | La mejora, de la referencia |
|---|---|---|
| UNA tarjeta y el resto vacío | Image muestra cientos de carruseles; un negocio que sigue cuentas en Spy tiene sus reels guardados (ws9: 525 con vistas) y no se veían | La grilla de Image con los reels de las cuentas que sigue (`FUENTE_SPY`) y los suyos por Zernio (`FUENTE_PROPIOS`) |
| Las tomas, rectángulos grises | Sin imagen no se sabe qué reel es | La miniatura que Spy ya guardó en nuestro bucket, en 9:16, con el ▶ |
| «Dis…», «Creden…», «El p…» | Las columnas de la estructura medían ~40 px | Bandas horizontales, con el nombre entero |
| «Sin datos de su cuenta» | Es el motivo del múltiplo, puesto como chip: no le dice nada a nadie | En la plantilla, «MaKo te guía» (como en «Crear desde cero»); en un reel, el «×» con su color, como en Image |
| Sin manera de llenarla | No decía de dónde salen los outliers | «+ Seguir cuentas» (como Image) y, sin cuentas, «Abrir Competitors Spy» |

## Después

- **Escritorio, ws9** ([02](video-portada-11-11/02-despues-ws9-1440.jpg)). Arriba la plantilla de MaKo y después 159 reels,
  ordenados por cuánto superaron a su cuenta (15,7×, 12,4×, 8,4×…). Cada tarjeta lleva su imagen, el gancho de título, la
  cuenta con su foto y su link a Competitors Spy, hace cuánto se publicó, y vistas, me gusta y comentarios. Pasa.
- **Oscuro** ([03](video-portada-11-11/03-despues-ws9-oscuro.jpg)). Pasa.
- **Teléfono, 390 px** ([04](video-portada-11-11/04-despues-telefono-390.jpg)). Dos columnas, como Image en el teléfono, y
  ahora también en `/m/video-editor`, que antes no mostraba outliers. La primera versión ([06](video-portada-11-11/06-antes-de-arreglar-390.jpg))
  tenía un reel por pantalla, el total cortado («…los que más supe») y «Basada en…» corrido; arreglado.
- **ws3** ([05](video-portada-11-11/05-despues-ws3-1440.jpg)). Sigue 2 cuentas, así que la primera fila es casi toda de una
  sola. La variedad (2 por creador cada 12) no tiene con quién alternar. Mejora: sumar cuentas en Spy.

## Lo que falta

- **Shorts de YouTube** (ws9 tiene 1.378 videos): no hay «×» hasta la enmienda III.L. Decisión de Martín (§7 de
  `docs/investigacion-outliers-video.md`).
- **Anuncios en video** de Spy (ws9 tiene 262 anuncios): hoy no se sabe cuáles son video.
- **Una biblioteca de reels de la plataforma**, para un negocio que no sigue a nadie: es gasto de Apify, decisión de Martín (§7.1).
- **«Replicar» un reel cualquiera.** Hoy sólo se replica la plantilla «Mensaje para…»; un reel de Spy lleva al original.
- **Filtros y búsqueda** como los de Image (por cuenta, por «×», guardados).
