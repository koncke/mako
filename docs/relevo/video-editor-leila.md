# Relevo — «Video Editor: el ruido y los silencios de Leila» (cuenta claude4)

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
  **Sin commitear** a propósito (corte al 97 %, 28/10 ~21:25): está en el árbol de `C:/dev/wt-editor-leila`, sin probar.

## Lo que quedó a medias

- **Ticket 23, lo que falta, en orden:**
  1. Correr `node C:/dev/con-turno.mjs node --import tsx --test tests/video-editor-chat.test.ts`. El primer intento salió 99:
     no consiguió turno en 30 min y NO corrió.
  2. Las roturas del test 52, de a una y restaurando, anotadas al final del archivo:
     - correrLarga vuelve a `await generarSubtitulos(editor); return [];`;
     - un `return;` mudo en generarSubtitulos;
     - el texto de «descarga» genérico;
     - Transcribir vuelve a `void generarSubtitulos(`.
  3. El tsc acotado por con-turno de resultado.ts, generar.ts, aplicar.ts, transcripcion-view.tsx,
     subtitles/components/assets-view.tsx y el test.
  4. Commit por ruta (los 8 archivos de `git status`) y el VERDE al Cerebro. Él cierra el ticket con el aviso a Leandro
     cuando esté desplegado.
- **Motion (frenado por cuota hasta que el Cerebro diga):** el typecheck dio dos cosas del WIP, no de main:
  - tests/editores-por-prompt.test.ts:383, TS2352: `(op as { op: never }).op` después de `assert.ok(op.ok)` → usar `op.op`.
  - app/image-editor/editor/Estudio.tsx y estudio.ts conviven: en Windows tsc los confunde (TS1149/TS1261). En Linux
    anda; revisar si conviene renombrar uno.
  - El resto son los de siempre del entorno (wasm/opencut sin generar).
  Después: tests-afectados por con-turno y el VERDE de Motion con las 4 shas. Notas para el VERDE: marcar_calificado ya
  no llega al turno de la app (proponer_cambio_etapa sí); nada se miró en el navegador.

## Lo que falta verificar

- Nada de esto se miró en el navegador (regla del Cerebro: el Video Editor en Chrome se lleva 5 GB).
- Ticket 23: cuál fue la causa de Leandro no se sabe (el ticket trae Chrome 156 de escritorio y nada más). El próximo
  reporte ya trae el motivo.

## Lo que espera a Martín

- Ticket #15: que Leila reimporte el archivo o lo abra en su computadora (si no se reproduce, está cortado).
