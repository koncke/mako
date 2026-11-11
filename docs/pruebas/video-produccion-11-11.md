# La tab Video en producción — 11/11/2026, después del despliegue de las 11:05 UTC

Pedido del Cerebro, por Martín: probar en producción la portada de outliers (que no quede con un solo outlier, ni con
miniaturas grises, ni con títulos cortados), el editor sin colgarse por memoria, y los pedidos al chat y los cursores. Todo
con capturas a 1440 y a 375.

- **Despliegue:** main en `ada98995d`. Incluye todo lo del chat Video: la portada nueva (`17a163644`), los 8 arreglos de
  memoria y la cosecha.
- **Navegador:** el de la app, con la sesión de Martín (`/api/auth/me`: martinkoncke, ws 9, super admin), y `?ws=3` para lo
  que escribe.
- **Chrome no se usó:** a las 11:45 UTC tenía la sesión de Leandro (ws 10).
- Las capturas están en [video-produccion-11-11/](video-produccion-11-11/).

## Portada de outliers

| Qué | Resultado |
|---|---|
| ws 9 a 1440 ([01](video-produccion-11-11/01-portada-ws9-1440.jpg), [02](video-produccion-11-11/02-portada-ws9-1440-abajo.jpg)) | **Pasa.** 159 reels de 4 cuentas, cada uno con imagen, «×» de su cuenta (15,7×, 12,4×, 8,4×…), título legible, foto y link de la cuenta, vistas, me gusta y comentarios. La tarjeta de MaKo con la estructura entera. |
| Detalle a 1440 | Dos reels de @herasmedia que Spy no midió decían «▶ —». **Arreglado:** sin el dato no se muestra nada. |
| ws 9 a 375 ([03](video-produccion-11-11/03-portada-ws9-375.jpg)) | **Pasa, salvo un título cortado:** la última banda de la plantilla decía «Cierre sin …». **Arreglado:** en la tarjeta angosta se achican la letra y los márgenes (`@container`). Bajar a dos renglones mordía las bandas cortas («El / producto»), y partir palabras («Credenci/al») se leía peor. Medido en local a 300, 340 y 390 px: a 340 entran todos; a 300, que es más angosto que cualquier teléfono común, se cortan dos con «…». |
| ws 3 a 1440 ([04](video-produccion-11-11/04-portada-ws3-1440.jpg)) | 96 reels, **todos de @leilahormozi**: es la única cuenta con Instagram en el Spy de ese negocio. No es una falla del código; la mejora es sumar cuentas en Spy. |

En el panel oculto, la primera captura sale con las tarjetas en blanco. No es la página: las imágenes están cargadas (179 de
179, ninguna falla) y aparecen en la captura siguiente, cuando el panel repinta. Las 140 de más abajo cargan al bajar
(`loading="lazy"`).

## Editor (ws 3, el negocio de prueba)

| Qué | Resultado |
|---|---|
| Abrir un proyecto nuevo de Reel | **Pasa.** Abre con WebGPU y no se queda en «Cargando…» ([05](video-produccion-11-11/05-editor-ws3-clip-1440.jpg)). |
| Importar un video de celular (1080×1920, 6 s, con voz) | **Pasa.** Entra por el puente del fragmento (`scratchpad/videos/puente.html`), porque el navegador de la app no sube archivos. |
| **Copia liviana** | **Pasa.** En el OPFS del ws 3 quedan el original (`88cf0b2d-…`, 702 KB, 1080×1920) y `88cf0b2d-….liviana` (461 KB, **540×960**, 6 s). |
| La vista previa decodifica la copia | **Pasa.** Al mover el cabezal, el lienzo con que se sube el cuadro se crea a **540×960**, nunca a 1080×1920. |
| Exportar | **Pasa** ([06](video-produccion-11-11/06-exportado-1080x1920.jpg)). En menos de 10 s sale `1111.mp4`, **1080×1920**, 6,01 s y 6,1 MB: del ORIGINAL. |
| MaKo toma la iniciativa | **Pasa.** Al poner el clip: «Tu video tiene voz y todavía no tiene subtítulos. ¿Lo van a ver sin sonido?», con sus tres botones. |

Un detalle sin investigar: el cuadro de exportar ofrecía 24 fps, y los detalles del proyecto dicen 30. El clip de prueba es de
24 fps.

## Lo que NO se pudo probar, y por qué

- **Los pedidos al chat en el ws 3:** el chat dice «Instala MaKo para escribir», porque ese negocio no tiene IA conectada.
  Para probarlos hace falta un negocio de prueba con IA, o hacerlo en el ws 9, que escribe en el negocio de Martín.
- **Subtítulos («Sí, en el feed») y «Edición automática» (los cursores):** el panel abre con sus 10 agentes en espera y
  «Editar con MaKo» ([07](video-produccion-11-11/07-edicion-automatica-ws3.jpg)). No se corrieron porque cargan Whisper
  (≈250 MB) y la PC estaba en 770 MB libres; a las 11:48 llegó a 442.
- **Lo que anima,** con el panel de la app oculto: los cursores de los agentes y los fundidos. La entrada del teléfono
  (`app/m/_ui/EntradaApp.tsx`) se va recién con el respaldo de 15 s.
- **El editor a 375:** el editor es de computadora; en el teléfono la tab Video muestra la portada.
