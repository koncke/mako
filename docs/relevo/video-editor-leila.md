# Relevo — «Video Editor: el ruido y los silencios de Leila» (cuentas claude4 y claude3)

*Se reescribe después de cada entrega. Lo abrió el Cerebro; todo lo de este chat va al Cerebro por mensaje, y él sube a main.*

Para retomar: abrir un chat con este título y pegar «Continua: leé docs/relevo/video-editor-leila.md».

## Lo pedido (con sus palabras)

1. **«Eliminar ruido» como CapCut** (Leila): RNNoise servido desde la app, retardo medido, perfil por canal con ganancia
   enlazada, voz limpia intacta, sin salto de ruido entre los trozos de «Borrar silencios». Metas: pausas ≥ 25 dB más
   bajas, la voz no pierde SNR, sin clics en los bordes.
2. **«Borrar silencios» desde el chat del Video Editor**, que se vea construyéndose.
3. **Ticket #15** (Leila): «No se pudo importar ESP_Fabi sentada_limpio.mp4».
4. Decisión del Cerebro: los silencios se buscan en el audio SIN ruido, con el mismo umbral, y se corta el original.
5. **Motion** (`C:/dev/wt-motion-imagen`, rama `motion-imagen-2610`): seguir docs/relevo/motion-nube-2710.md sin la parte
   de la nube. Verificar el WIP, mergear main, cablear lo que falta, typecheck y VERDE. En cola, después: exportar →
   subir el MP4 a Storage, «Mandar al grupo de MaKo», «Programar publicación» (con el chat de Zernio), y sus operaciones en
   lib/api-mako/areas/video.def.ts.
6. **Ticket 23** (Leandro, negocio 10): «No se aplica: no se pudo generar los subtítulos». El Cerebro aprobó: que
   generarSubtitulos devuelva {ok} | {motivo}, que el botón y el chat lean lo mismo, un texto por causa que diga qué
   hacer, ningún return mudo, test rompiéndolo, sin Groq.

## Lo pedido el 30/10 de madrugada (cuenta claude3, el Cerebro con la captura de Martín)

«Se siguen rompiendo cosas, como esta… revisa bien todo». La barra del Reproductor angosto (9:16, ~500 px) encimada: tiempo,
▶, «Completa ▾», lupa ▾, «Relación ▾», pantalla completa. Que NUNCA se enciman a ningún ancho. Y revisar con el mismo ojo
TODO el Video Editor a 1280, 1366 y 1440 con los paneles en su mínimo: la línea de tiempo, las barras, los paneles
laterales y el chat de MaKo plegado y abierto. Capturas de antes y después. Rama nueva desde origin/main; VERDE y el sha a
Integración. Misma prioridad que lo de Leila.

## Lo hecho

- 1 a 4: en main (2cdd45fb3, 10597c1e7, 98e376ab5, rama `editor-leila-2810`). Cosechado en docs/hallazgos-video-editor.md.
- Ticket #15: el aviso ahora dice el porqué (un .mp4 cortado se lee SIN PISTAS). **No está resuelto para Leila**: la causa
  de SU archivo necesita que lo reimporte o el archivo. El Cerebro no lo cierra.
- Motion: 821748730 (merge de main, 21 conflictos), e1fd45e25 (propuestas del Image Editor, tests), b71e3d5e5
  (`HijoHtml`, TS2456), 5f94bc3e3 (hallazgo: chat-api.ts solo pide más de 2,5 GB de heap). Rama `motion-imagen-2610`, sin
  subir.
- Ticket 23: el arreglo en `C:/dev/wt-editor-leila` (rama `editor-leila-2810`) — subtitles/resultado.ts (nuevo),
  subtitles/generar.ts, chat/aplicar.ts, transcripcion/components/transcripcion-view.tsx, test 52 de
  tests/video-editor-chat.test.ts, cosecha (docs/hallazgos-video-editor.md, docs/hallazgos.md) y regla en AGENTS.md.
  **Commit d867f8bbc** (rama `editor-leila-2810`, sin subir: sube el Cerebro). Tests 53/0, 5 roturas del test 52 (cada
  una 52/1), tsc acotado sin errores en los 6 archivos (quedan los 5 del entorno: soundtouchjs, EyeDropper, gpu-renderer).
  VERDE mandado al Cerebro el 28/10. **En producción** con tren-x (`004a4ae57`, 28/10 23:33); el Cerebro cerró el
  ticket y le avisó a Leandro en su grupo.
- Motion, cuenta claude3 (29/10): merge de origin/main `7f36fa9c6` en `d22770e72` (un conflicto: el índice
  docs/hallazgos.md, quedan los dos lados) y los dos rojos del typecheck arreglados en un commit aparte (ver abajo).

- **Tickets 31 y 32** (Leila, 29/10: «Quiero borrar silencios y me dice que no hay cuando sobran»): rama `editor-leila-2810`
  (C:/dev/wt-editor-leila), arreglo `5946a5dc9` y cosecha `3b6a9b3ee`, sobre main `4b8f8145d`. NO era el detector: el modelo
  copió `"ref":"v1"` del catálogo y buscó en un pedazo de 0,93 s. El #32 es el mismo episodio, un minuto después. Ahora:
  sin ref es todo el video, `pausa_min` de 0,2 a 2 s (chat y API), y el aviso dice dónde buscó y la frase para seguir. Tests
  chat 54/0 y silencios 21/0, 11 roturas, hito `tickets: [31, 32]`. El tsc acotado encontró un error real (el aviso del botón
  trataba las pistas como lista): arreglado en `d5baaa302`, que es la punta; con las cuatro .d.ts, 0 errores en lo tocado
  (quedan 2 de `app/conocimientos/Compartir.tsx`, `<style jsx>`, ajeno). El umbral
  NO se tocó: para medir el detector hace falta el archivo original de Leila (174836_h264.mp4); lo pide el Cerebro.
- **Motion, migración renumerada:** `0340_image_editor_propuestas.sql` → `0344` (en main el 0340 es la papelera del CRM),
  con sus seis comentarios en el código. Pedido del Cerebro del 29/10.

- **La barra del reproductor (30/10):** rama `editor-pantalla-3010` en C:/dev/wt-editor-leila, desde origin/main
  `c9070ea0d`, commit **`b93d7f644`**. Niveles por el ancho de la barra (`preview/barra-niveles.ts`), íconos con el valor en
  el tooltip, dos o tres filas si no entra; el teléfono la esconde por `data-barra-reproductor`. Tests barra-reproductor
  3/0 y m-creacion 7/0. Banco y capturas (antes y después, 60 s y 1 h): C:/dev/revisiones/editor-pantalla-3010/ (el
  banco en `banco/`: `node build.mjs <worktree> <salida> [--antes]` y `node sacar.mjs <salida> <prefijo> total=60.06`).
  Cosecha en docs/hallazgos-video-editor.md (+ índice), hito en la bitácora. ⚠️ El hito va al final de la lista, igual
  que el de los tickets 31/32 (d5baaa302, tren-ag): al juntarlos chocan, y se dejan los dos.

## Lo que quedó a medias

- **Ticket 23:** nada a medias. ⚠️ Para la próxima: el árbol está en CRLF; un script que rompe por texto tiene que usar
  el fin de línea del archivo, o «no encuentra» y no rompe nada (el `grep` de Git Bash no ve el CR).
- **Motion:** los dos rojos del typecheck, arreglados el 29/10 (claude3):
  - tests/editores-por-prompt.test.ts:383 (TS2352) → `op.op`, que `assert.ok(op.ok)` ya angosta.
  - `Estudio.tsx` y `estudio.ts` NO era tsc confundido: en Windows `import('./editor/Estudio')` cargaba el estado
    (`.ts` antes que `.tsx`, disco sin mayúsculas) y el editor quedaba en blanco. El estado pasó a
    `editor/estudio-estado.ts`; guarda nueva `tests/nombres-que-chocan-en-windows.test.ts` (2/0, tres roturas, cada
    una 1/1). Cosechado en docs/hallazgos-editor-imagen.md, regla en AGENTS.md.
  - Tests dirigidos en verde: editores-por-prompt 16/0, image-editor-estudio 10/0, image-editor-integracion 7/0,
    image-editor-chat 26/0, video-editor-chat 53/0.
  Commits: merge `d22770e72` y arreglo `d1c9ee86a` (rama `motion-imagen-2610`, sin subir). Punta mandada al Cerebro
  «sin tipos» el 29/10 de madrugada: el vigía mató los cuatro intentos de tsc acotado (2,7 a 3 GB; noche con 1,5 a 4,7 GB
  libres) y tests-afectados (219 tests y las barredoras) no se lanzó por las reglas de la noche (RAM). Las dos cosas
  faltan, por `con-turno`, cuando la PC tenga ~4,5 GB libres sostenidos. Shas de Motion: 821748730, e1fd45e25,
  b71e3d5e5, 5f94bc3e3, d22770e72, d1c9ee86a.
  Notas para el VERDE: marcar_calificado ya no llega al turno de la app (proponer_cambio_etapa sí); nada se miró en
  el navegador. Falta avisar que `RUTAS_QUE_PLIEGAN` (app/_components/Sidebar.tsx:123, del chat Sidebar) no tiene
  /video-editor ni /image-editor.
- **Lo que sigue de Motion después del VERDE** (docs/relevo/motion-nube-2710.md, «Pendientes»): los huecos de la API de
  los dos inventarios, el bug de la plantilla cifra (paso 1 redondea 4,5), el modelo de imágenes antes de subir, y en cola
  exportar → MP4 a Storage, «Mandar al grupo de MaKo» y «Programar publicación» (con el chat de Zernio).

- **Barra del reproductor: VERDE mandado** con la punta `d121a5e6f` (rama `editor-pantalla-3010`): 5 roturas, cada una 2/1
  (B1 también en el banco), y tsc acotado ✓ en 8 archivos (con las cuatro .d.ts de `_opencut`).
- **La revisión del resto del editor (orden del Cerebro: 1 la línea de tiempo, 2 los paneles laterales en su mínimo, 3 la
  cabecera; mismo método, VERDE con el sha):**
  1. **Barra de la línea de tiempo: HECHO** en `e5b4f2bd6` (misma rama `editor-pantalla-3010`). MEDIDO en el banco: 983 px
     de herramientas, a 1366 con el chat abierto «Acercar» quedaba fuera de la vista (ScrollArea con la barra oculta). Ahora
     sin ScrollArea, se esconde lo `prescindible` (el deslizador) por debajo de 1000 px y la barra se parte en dos filas.
     Tests barra-linea 3/0. Roturas (6) y tsc corriendo por con-turno al escribir esto (`roturas-linea.mjs`, log en el
     scratchpad: `roturas-linea.log`); falta anotarlas en tests/video-editor-barra-linea.test.ts y mandar el VERDE.
  1b. Paso 1 en VERDE: punta `f297cf096` (6 roturas 2/1, tsc ✓ en 12), mandado al Cerebro.
  2. **Paneles laterales: HECHO en `b7495299e`** (mínimos 280/160/280 px pasados a % con el ancho medido; el rótulo de los detalles se parte; captura `paneles-despues.png`; tests paneles-minimos 3/0). Roturas (5) y tsc por con-turno al escribir esto (`roturas-paneles.mjs`, log `roturas-paneles.log` en el scratchpad); falta anotarlas y el VERDE. Lo medido antes: Banco `banco/entrada-paneles.tsx` (+ `build-paneles.mjs`,
     `sacar-paneles.mjs`; el stub `motor-linea.ts` ya trae un comodín y un proyecto inventado). Captura
     C:/dev/revisiones/editor-pantalla-3010/paneles-antes.png. Biblioteca: de 240 px para abajo «Importar» y la zona para
     arrastrar se aplastan (una palabra por renglón) y de 160 se cortan. Propiedades (los detalles, sin nada elegido): la
     columna de rótulos es proporcional y «Cuadros por segundo:» se corta aun a 300 px; de 160 para abajo no se lee. Plan:
     mínimos en PÍXELES (biblioteca y propiedades ~280, reproductor 160) pasados a % con el ancho medido del grupo
     horizontal (`editor-page.tsx`, `useAncho`), escalados si no suman; y la columna de rótulos de `detalles.tsx` al ancho
     de su texto.
  Antes era: **Paneles laterales en su mínimo: SIN EMPEZAR.** Visto leyendo: las pestañas del panel de propiedades van en un
     `overflow-x-hidden` (las que no entran se esconden) y cada fila del kit pide ~76 + 66 px fijos; el mínimo de los
     paneles es 15 % del centro (~103 a ~130 px). Idea: mínimos en PÍXELES convertidos a % con el ancho medido del grupo
     (`editor-page.tsx`, react-resizable-panels 2.1.9 sólo acepta %). Medir primero en el banco.
  3. **Cabecera: SIN EMPEZAR.**

## Lo que falta verificar

- Nada de esto se miró en el navegador (regla del Cerebro: el Video Editor en Chrome se lleva 5 GB).
- Ticket 23: cuál fue la causa de Leandro no se sabe (el ticket trae Chrome 156 de escritorio y nada más). El próximo
  reporte ya trae el motivo.

## Lo que espera a Martín

- Ticket #15: que Leila reimporte el archivo o lo abra en su computadora (si no se reproduce, está cortado).
