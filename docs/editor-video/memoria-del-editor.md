# Dónde se va la memoria del editor de video (medido el 11/11/2026)

Pedido de Martín: «medí primero» dónde se va la RAM del editor de hoy, antes de decidir qué traer de Remotion.
Código medido: `main` en 666b5b5c6 (11/11/2026, 07:10 UTC). Las primeras corridas usaron 0a80ae302, que no tiene
diferencias en `services/` ni en `media/`.

**Cómo se midió.** Tres pasos:

1. **Por código.** Un inventario de las ~35 cosas que guardan memoria mientras se edita, con archivo y línea (§6).
2. **En vivo, pieza por pieza.** Corrí el código REAL del editor en un Chrome 157 sin ventana y muteado (el banco
   `scripts/banco-memoria-editor/`). Las piezas: `VideoCache` (lo que decodifica la vista previa), `WaveformCache` (la forma
   de onda de la línea de tiempo) y la subida de cada cuadro al compositor (`ensureOffscreenCanvas` copiada tal cual,
   porque no se exporta). Los videos son sintéticos y se parecen a uno de celular: 1080×1920 a 30 cuadros y 10 Mb/s, y
   4K (3840×2160) a 30 Mb/s, con audio estéreo a 48 kHz.
3. **Qué se cuenta.** La memoria privada que Windows le cuenta a cada proceso de ese Chrome: el de la página y el de la
   GPU. El pico sale de `PeakPageFileUsage`, que es el máximo de toda la vida del proceso. Cada escenario corre en un Chrome
   nuevo.

**Lo que NO se midió en vivo, y por qué:**

- **El editor entero abierto.** La PC tenía 1,9 GB libres, con varios chats trabajando. Además el editor no carga en un
  Chrome sin ventana: se queda en «Cargando…» (está en hallazgos-video-editor.md, SIN RESOLVER del 29/10).
- **Exportar y Whisper.** Lo de esas dos partes sale del código (§4 y §5).

Los números del banco son la memoria que agrega cada pieza. El editor real suma, encima, su base: React, los paneles, el
WASM del compositor y el contexto de WebGPU.

## En corto

| Qué pasa | Cuándo | Cuánto, medido | Se libera |
|---|---|---|---|
| **Forma de onda: lee el archivo ENTERO** | Al abrir el proyecto, por cada video con audio | **≈3,6 veces el archivo**, de golpe: 76 MB → +275 MB. Uno de celular de 1 GB → ≈3,6 GB | Sí, en menos de un segundo. Es un pico, y es el que congela o cierra la pestaña |
| **Un decodificador por clip, a resolución completa** | Al reproducir o mover el cabezal | 1080×1920: ≈+100 MB por clip abierto (3 clips: +314 MB). 4K: +268 MB que quedan, con pico de +606 MB | **No**, mientras el proyecto siga abierto |
| **Un lienzo nuevo por cada cuadro que se sube** | Cada cuadro de video, en reproducción y en exportación | 4K: el pico sube de +606 a **+883 MB** y quedan +643 MB, porque el basurero no da abasto | Sólo cuando pasa el basurero |
| Achicar la vista previa (el «1/2» del editor, o el `maxCanvasSinkFrameSize` de Remotion) | — | **Casi nada**: 3 clips, de +297 a +264 MB. El decodificador sigue a resolución completa (§3) | — |
| **Copia liviana del video (540 px)** | — | **3 clips: de +297 a +86 MB. 4K: el pico baja de +529 a +26 MB**, y cada cuadro sale entre 2 y 10 veces más rápido | — |
| Exportar | Al exportar | Por código: todo el audio decodificado a la vez, más el archivo final entero en memoria (2–3 veces lo que pesa) | Al cerrar el cuadro de exportar |
| Whisper (subtítulos) | Después de generar subtítulos | Por código: ≈250 MB del modelo, que **queda cargado** | No, hasta recargar |

## 1. La forma de onda lee el archivo entero

`services/waveform-cache/service.ts:64-79` hace tres cosas, todas sobre el archivo completo:

1. `sourceFile.arrayBuffer()`: el video ENTERO en memoria;
2. `.slice(0)`: una segunda copia;
3. `decodeAudioData`: todo el audio decodificado.

De todo eso sólo queda el resumen (≈1,5 KB por segundo). Lo pide `timeline/components/audio-waveform.tsx:277`, que
`timeline-element.tsx` monta en la línea `:1412` (video de la pista principal) y en la `:1256` (clips de audio). El caché
se vacía en cada carga del proyecto (`media-manager.ts:113` y `:141`), así que todo se rehace al abrirlo.

| Archivo | Pico del proceso de la página | Tarda | Queda después |
|---|---|---|---|
| 38 MB (30 s, 1080×1920) | +142 MB (3,7×) | 0,27 s | +3 MB |
| 76 MB (60 s, 1080×1920) | +275 MB (3,6×) | 0,43 s | +3 MB |

Crece en línea recta con el archivo. Un video de celular de 1–2 GB pide 3,6–7 GB de golpe, y eso es más de lo que tiene
libre una PC de 8 GB. Es el sospechoso número uno de las pestañas que se cierran solas al abrir un proyecto con videos
largos.

**Lo que lo baja:** leer sólo la pista de audio, en tramos, con el `AudioBufferSink` de mediabunny (ya está en el proyecto:
`media/audio.ts` lo usa), e ir armando el resumen de a pedazos. El pico pasaría a ser de unos pocos MB por tramo, sin
importar el largo del video.

## 2. Un decodificador por clip, a resolución completa, que no se cierra

`services/video-cache/service.ts:281` arma un `CanvasSink` por cada archivo, sin ancho ni alto. Decodifica a la resolución
del original, con 3 lienzos propios y hasta 8 cuadros en cola dentro de mediabunny. El iterador queda abierto aunque el
clip salga de pantalla, y sólo se cierra al sacar el archivo del proyecto o al cambiar de proyecto.

Medido con el `VideoCache` real, pidiendo cuadro por cuadro como la vista previa. El primer clip se reproduce 5 s y cada
clip nuevo 2 s, y los anteriores quedan abiertos como en el editor. En un Chrome sin ventana los lienzos viven en la GPU,
así que la memoria sube en el proceso de la GPU y no en el de la página. Dos corridas:

| 1080×1920, 10 Mb/s | Queda en la GPU (corrida 1 / 2) | Pico en la GPU | Todo Chrome, queda |
|---|---|---|---|
| 1 clip abierto | +68 / +83 MB | +162 / +128 MB | +170 / +40 MB |
| 2 clips | +202 / +197 MB | +203 / +197 MB | +292 / +164 MB |
| 3 clips | +215 / +297 MB | +279 / +302 MB | +314 / +260 MB |

| 4K (3840×2160), 30 Mb/s | Queda en la GPU | Pico en la GPU | Todo Chrome |
|---|---|---|---|
| 1 clip, 5 s | +203 MB | +529 MB | pico +606 MB, queda +268 MB |

Son **≈100 MB por cada clip de celular que se tocó**, y no vuelven mientras el proyecto siga abierto. Un proyecto con 10
clips de celular junta ≈1 GB sólo en decodificadores. Con 4K, cada clip pasa los 500 MB de pico.

**Lo que lo baja:**

- cerrar el decodificador de un clip que salió de pantalla hace rato (hoy sólo se cierra al sacar el archivo);
- y sobre todo, decodificar una copia liviana (§3).

## 3. Achicar la salida no alcanza: lo que baja la memoria es el ARCHIVO liviano

El diagnóstico obvio era el equivocado. Hoy el editor tiene «1/2» y «1/4» para la vista previa
(`canvas/escala-salida.ts`), y Remotion ofrece lo mismo para su `<Video>` (`maxCanvasSinkFrameSize`). Las dos cosas
achican el lienzo de SALIDA. Lo medí poniéndole ancho y alto chicos al mismo `CanvasSink` (540×960):

| 1080×1920 | Original | Mismo archivo, lienzo de 540×960 | **Copia liviana 540×960 (2 Mb/s)** |
|---|---|---|---|
| 1 clip, queda en la GPU | +68 / +83 MB | +53 MB | **+26 MB** |
| 2 clips | +202 / +197 MB | +96 MB | **+62 MB** |
| 3 clips | +215 / +297 MB | +264 MB | **+86 MB** |
| 150 cuadros, tiempo | 520–543 ms | 389 ms | **284 ms** |

| 4K, 1 clip, 5 s | Original | **Copia liviana 960×540 (2 Mb/s)** |
|---|---|---|
| Queda en la GPU | +203 MB | **+27 MB** |
| Pico en la GPU | +529 MB | **+26 MB** |
| Con la subida de cada cuadro (§4): pico / queda | +762 / +629 MB | **+95 / +95 MB** |
| 150 cuadros, tiempo | 2.620 ms (11 cuadros por segundo: no llega a 30) | **273 ms** |

La medición del lienzo chico en 4K se cortó sola las dos veces. La PC bajó de 1.250 MB libres (llegó a 1.036 MB con los
otros chats trabajando) y el banco frenó para no tumbar a nadie. Para la conclusión alcanza con el resultado en 1080.

**Por qué:** el lienzo chico es lo último de la cadena. Antes, el decodificador del navegador arma cada cuadro a la
resolución del ARCHIVO, y mediabunny guarda hasta 8 de esos cuadros en cola. Achicar el lienzo no toca nada de eso. Lo
único que baja la memoria es que el archivo que se decodifica sea chico: **una copia liviana del video** (un «proxy», como
le dicen Descript y CapCut). Con tres clips de celular abiertos baja de ≈300 a ≈90 MB, y además cada cuadro sale en la
mitad del tiempo.

Así funciona el modelo de Descript que describe `remotion-a-fondo.md` §1:

- se edita sobre la copia liviana;
- se exporta con el original.

La copia se arma una sola vez por archivo, al subirlo.

## 4. Un lienzo nuevo por cada cuadro

`services/renderer/compositor/wasm-compositor.ts:232`: cada cuadro de video que no sea ya un `OffscreenCanvas` se copia a
un `OffscreenCanvas` NUEVO del tamaño del cuadro antes de subirlo al WASM. Los efectos tipo CapCut hacen lo mismo
(`pases-ce.ts:347`, `repartir-ce.ts:93` y `:128`). A 30 cuadros por segundo son 250 MB/s de lienzos tirados en 1080×1920, y
1 GB/s en 4K.

Medido con un clip, reproduciendo 5 s y copiando cada cuadro como hace el compositor:

| | Sin la copia | Con la copia de cada cuadro |
|---|---|---|
| 1080×1920: pico en la GPU | +162 MB | +178 MB |
| 4K: pico en la GPU | +529 MB | **+762 MB** |
| 4K: queda después de pasar el basurero | +203 MB | **+629 MB** |

En 4K son 1,2 GB de lienzos en 5 segundos (el contador de píxeles del banco dio 1.244 millones). La GPU los suelta tarde:
1,5 s después de forzar el basurero todavía había +426 MB de más. Con la copia liviana de 960×540 el mismo recorrido deja
+95 MB.

**Lo que lo baja:** un lienzo por capa que se reusa de cuadro en cuadro, en vez de uno nuevo por cuadro. Es el mismo
`OffscreenCanvas` redibujado.

## 5. Exportar, Whisper y deshacer (por código, sin medir en vivo)

- **Exportar** (`export/exportar.ts`, `media/audio.ts:234`, `services/renderer/scene-exporter.ts:161`):
  - decodifica el audio de TODAS las fuentes a la vez (`Promise.all`), ≈21 MB por minuto por fuente y hasta 4 veces eso
    mientras decodifica;
  - escribe el video final en un búfer en memoria (el «fast start» de mediabunny), y al final lo copia a un Blob. Con
    10 Mb/s son 150–225 MB por minuto de video;
  - el Blob queda vivo hasta cerrar el cuadro de exportar.
- **Whisper** (`services/transcription/service.ts:153-216`): el modelo por defecto es whisper-small, ≈250 MB en WASM o
  ≈300 MB en WebGPU (`transcription/models.ts:12-13`). El hilo **no se termina después de un subtitulado que salió bien**:
  sólo se termina al cancelar, al fallar o al cambiar de modelo. Preparar el audio suma ≈120 MB por minuto, que sí se
  liberan.
- **Deshacer** (`core/managers/commands.ts`): el historial no tiene tope. Cada paso guarda una versión de las pistas
  (comparte lo que no cambió). Subtítulos, emojis, B-roll y el chat rehacen pistas enteras. El «Restaurar» del chat y el
  «Deshacer todo» de la edición automática guardan antes y después de cada mensaje, sin tope.

## 6. El inventario completo

Las rutas son relativas a `app/video-editor/_opencut/`. Esto sale de leer el código; lo medido está arriba.

| Qué | Dónde | Cuánto | Se libera |
|---|---|---|---|
| Decodificador por archivo (3 lienzos + hasta 8 cuadros en cola + 8 MiB de lectura) | `services/video-cache/service.ts:281` | §2 | Al sacar el archivo o cambiar de proyecto |
| Segundo decodificador del mismo archivo en una transición | `transiciones/escena.ts:117` | Lo duplica | Igual que arriba |
| Lienzo nuevo por cuadro subido; también en los efectos | `services/renderer/compositor/wasm-compositor.ts:232`, `services/renderer/pases-ce.ts:347`, `compositor/repartir-ce.ts:93,128` | §4 | Basurero |
| Texturas dibujadas (texto, fondo, máscara): lienzo + textura de GPU del tamaño del lienzo | `compositor/frame-descriptor.ts`, `wasm-compositor.ts:47` | 8,3 MB + 8,3 MB por capa a 1080×1920 | Sí, cuando la capa sale del cuadro |
| Recorte: 2 lienzos por clip, hasta 48 clips | `recorte/ganchos.ts:45,89` | Hasta ≈800 MB | Tope de 48, saca el más viejo y no el menos usado |
| Quitar fondo: 2 lienzos por clip + el modelo de MediaPipe | `fondo/recorte-persona.ts:67`, `fondo/segmentador.ts:36` | ≈100 MB + 13 MB y su propio WebGL2 | Tope de 6; el segmentador no se cierra |
| Caché de imágenes decodificadas | `services/renderer/nodes/image-node.ts:18,67` | Una foto de 12 MP pesa 48 MB en el export | **Nunca**: cada recarga del proyecto suma entradas nuevas |
| Tira de miniaturas: hasta 1.500 lienzos de 96 px | `timeline/components/miniaturas.ts:28` | ≈31 MB (9:16) a ≈98 MB (16:9) | Tope de 1.500; no se vacía al cerrar el proyecto |
| Tira de miniaturas: un `Input` de mediabunny por archivo | `miniaturas.ts:42-78` | 8 MiB de lectura por archivo | **Nunca** (no hay `dispose`) |
| Forma de onda | `services/waveform-cache/service.ts:64-79` | §1 | Sí (es un pico) |
| Audio con efectos (voz, ruido, velocidad): fuente decodificada + copia del clip | `core/managers/audio-manager.ts:641-813` | 23 MB por minuto por fuente; ×4 mientras decodifica | Se poda al reproducir |
| Sonido de la biblioteca guardado decodificado dentro de la pista | `sounds/sounds-store.ts:224-234` | 23 MB por minuto, copiado al historial y al portapapeles | Cuando nada lo referencia |
| Medios generados que quedan como `File` en memoria (revertir, extraer audio, grabar, avatar, B-roll, voz, congelar) | `retime/revertir.ts`, `sounds/components/extraer-audio.ts:107`, `audio/grabar.ts:272`, `broll/red.ts:53` | Lo que pese cada archivo | Al recargar |
| Miniatura del proyecto en PNG en memoria | `core/managers/project-manager.ts:672-684` | 1–4 MB por proyecto de la lista | No |
| Whisper | `services/transcription/service.ts` | ≈250–300 MB | No, después de un subtitulado bueno |
| Historial de deshacer, «Restaurar» del chat y «Deshacer todo» | `core/managers/commands.ts:14`, `chat/aplicar.ts:79`, `enjambre/estado.ts:20` | Sin tope | Al abrir otro proyecto |
| Exportar | `media/audio.ts:234`, `services/renderer/scene-exporter.ts:161`, `export/exportar.ts:188` | §5 | Al cerrar el cuadro |

**Fugas claras** (se crean y nunca se sueltan):

- un `AudioContext` nuevo por cada sonido de la biblioteca que se inserta (`sounds/sounds-store.ts:225`);
- el caché de imágenes, con imágenes de URLs ya revocadas (`image-node.ts:18`);
- el `Input` de cada tira de miniaturas (`miniaturas.ts:42`);
- el hilo de Whisper después de un subtitulado bueno;
- `AudioManager.dispose()` (`audio-manager.ts:92`), que nadie llama;
- `EditorCore.reset()` (`VideoEditorCliente.tsx:81`), que suelta el editor sin cerrar su `AudioContext` ni revocar sus URLs;
- salir del editor sin cerrar el proyecto (`components/providers/editor-provider.tsx:97`): todo lo de esta tabla sobrevive a
  la navegación dentro de la app;
- una conexión nueva a IndexedDB por cada guardado automático, cada 800 ms, que nunca se cierra
  (`services/storage/indexeddb-adapter.ts:23`).

## 7. Qué haría bajar la memoria, en orden

Ordenado por memoria que ahorra contra trabajo que lleva. Son propuestas; ninguna está hecha.

1. **Forma de onda por tramos.** Es un archivo (`services/waveform-cache/service.ts`): leer sólo la pista de audio con
   `AudioBufferSink`, de a pedazos, y armar el resumen sobre la marcha. Saca el pico más grande (3,6 veces el archivo) y no
   cambia nada de lo que se ve.
   - **HECHO el 11/11/2026** (rama `punta/onda-por-tramos`).
     - Dónde vive: `media/onda-por-tramos.ts`, y los picos en `media/picos-por-tramos.ts`.
     - Lo que mediabunny no lee, y la música de biblioteca, siguen por el camino de antes.
     - Lo fija `tests/video-editor-onda-por-tramos.test.ts`. Medido en el banco: §10.
2. **Copias livianas (proxies) al subir cada video.** Al importar se arma una copia de 540 px de lado corto con el
   `Conversion` de mediabunny, que el editor ya usa en `sounds/components/extraer-audio.ts:93`. Se guarda en OPFS al lado
   del original. La vista previa y las miniaturas usan la copia; exportar usa el original.
   - Ahorra 3,5 veces en 1080 y ≈20 veces en el pico de 4K.
   - Cada cuadro sale entre 2 y 10 veces más rápido: el 4K pasa de 11 a más de 30 cuadros por segundo.
   - Cuesta armar la copia una vez por archivo, en la PC del cliente o en la nube.
   - **HECHO el 11/11/2026** (rama `punta/copias-livianas`).
     - Dónde vive: `media/copia-liviana.ts` y `media/copia-liviana-reglas.ts`; la cola está en
       `core/managers/media-manager.ts`.
     - La vista previa la elige en `services/renderer/scene-builder.ts` (`fuenteDeVideo`), con otra clave del
       `videoCache`. Exportar suelta los decodificadores del original al terminar.
     - La miniatura del proyecto y la portada del cuadro de exportar salen de la copia.
     - Lo fija `tests/video-editor-copia-liviana.test.ts`. Medido en el banco: §9.
3. **Un lienzo por capa que se reusa**, en vez de uno nuevo por cuadro (`wasm-compositor.ts:232`, `pases-ce.ts:347`,
   `repartir-ce.ts`). Saca la basura de 250 MB/s a 1 GB/s.
   - **HECHO el 11/11/2026 para los cuadros de video** (rama `punta/lienzo-por-capa`).
     - Dónde vive: `services/renderer/compositor/lienzo-de-subida.ts`, usado por `wasm-compositor.ts`.
     - Lo fija `tests/video-editor-lienzo-por-capa.test.ts`. Medido: §11.
     - **Sin hacer:** los efectos tipo CapCut (`pases-ce.ts:347`, `repartir-ce.ts`) siguen devolviendo un lienzo nuevo por
       llamada, a propósito: el de su contexto se reusa abajo de quien lo lee. Arreglarlo pide alternar dos lienzos por
       capa, como `recorte/ganchos.ts`.
4. **Cerrar los decodificadores de los clips que salieron de pantalla**, con un tope de unos 4 abiertos y cerrando el que
   se usó hace más tiempo (`video-cache/service.ts`). Con 10 clips de celular, de ≈1 GB pasa a ≈400 MB, y a ≈120 MB con
   copias livianas.
   - **HECHO el 11/11/2026, con otra regla** (rama `punta/tope-decodificadores`).
     - En vez de un tope fijo de abiertos, se cierra el que no pidió un cuadro en **5 s de uso**. El tiempo de uso no
       corre con el editor quieto.
     - Un tope fijo cerraría capas que se ven a la vez, y cada cuadro las reabriría.
     - Dónde vive: `services/video-cache/service.ts` (`podarInactivos`). Lo fija
       `tests/video-editor-tope-decodificadores.test.ts`. Medido: §12.
5. **Terminar el hilo de Whisper** al terminar de subtitular (`services/transcription/service.ts`): ≈250 MB.
6. **Exportar sin juntar todo en memoria.**
   - Decodificar el audio fuente por fuente en vez de todo a la vez (`media/audio.ts:234`).
   - Escribir el MP4 a un archivo de OPFS con `StreamTarget` en vez del búfer en memoria (`scene-exporter.ts:161`).
   - O exportar en la nube: el render de Remotion en Lambda (parte 2) saca este pico de la PC del cliente.
7. **Las fugas de §6.** Cada una es chica, pero se suman en una sesión larga y al pasar de un negocio a otro.
8. **Un tope al historial de deshacer** (por ejemplo, 100 pasos) y al «Restaurar» del chat.

## 8. ¿Y Remotion?

Cambiar el reproductor por el de Remotion **no baja la memoria por sí solo**. Ahora está medido, no sólo deducido como en
`remotion-a-fondo.md` §1:

- El `<Video>` de `@remotion/media` decodifica con el mismo mediabunny, en el mismo navegador (`packages/media/src` de
  Remotion 4.0.542: `media-player.ts`, `canvas-ahead-of-time.ts`).
- Su opción para gastar menos, `maxCanvasSinkFrameSize`, achica el lienzo de salida. En §3 está medido que eso casi no baja
  nada, porque el decodificador sigue a la resolución del archivo.

Lo que baja la memoria es lo mismo con OpenCut que con Remotion:

- copias livianas;
- forma de onda por tramos;
- lienzos que se reusan;
- decodificadores que se cierran.

Remotion sigue valiendo por lo que trae: plantillas, transiciones y efectos. Y su render en Lambda saca de la PC del cliente
el otro pico grande, el de exportar.

**Para repetir la medición** después de cada arreglo:

```bash
node scripts/banco-memoria-editor/armar.mjs
```

```bash
node scripts/banco-memoria-editor/medir.mjs repro-1080 repro-proxy-1080 onda-60s
```

Los videos se arman con ffmpeg; los comandos están en la cabecera de `medir.mjs`. Cada corrida deja su `resultado-*.json`
al lado. Antes de correrlo tiene que haber al menos 1,5 GB libres, y si la PC baja de 1.250 MB el banco se corta solo.

## 9. Después: la copia liviana del editor, medida (11/11/2026)

Es la copia REAL que arma el editor (`media/copia-liviana.ts`), en el mismo banco y con el mismo video de celular (60 s,
1080×1920, 10 Mb/s). El escenario es `copia-1080`.

| | Antes: el original | Después: la copia del editor |
|---|---|---|
| 1 clip, queda en la GPU | +68 / +83 MB | +42 MB |
| 3 clips, queda en la GPU | +215 / +297 MB | **+89 MB** |
| 3 clips, todo Chrome | +314 / +260 MB | **+81 MB** |
| 150 cuadros, tiempo | 520–543 ms | 370 ms |

**Lo que cuesta armarla** (una vez por video, en segundo plano):

- 60 s de video tardaron 27–30 s. Una vez, con la PC cargada por otros chats, pasó de 90 s;
- pide +256 MB de pico mientras se arma (+113 en la GPU y +82 en la página): decodifica el original una vez;
- pesa 6,1 MB (≈0,8 Mb/s), contra 76 MB del original.

**Los tiempos se respetan:** comparando los primeros 60 cuadros desde el 0 y desde el segundo 10, los 120 caen en el
mismo instante que en el original, con 0 diferencias.

⚠️ La función del banco que compara esos tiempos (`mismosTiempos`) es pesada. El 11/11 llevó la GPU a +1,3 GB y la PC a
437 MB libres. No va en ningún escenario: se llama a mano y con más de 3 GB libres.

**Sin medir todavía:**

- la copia del editor en 4K: la PC no tenía memoria libre para armarla sin riesgo;
- el editor entero con varias copias en un proyecto real. Eso se mira en producción después del despliegue.

## 10. Después: la forma de onda de a trozos, medida (11/11/2026)

Es el `WaveformCache` REAL, que ahora lee el archivo con `media/onda-por-tramos.ts`, sobre los mismos videos y en el
mismo banco (escenarios `onda-30s` y `onda-60s`).

| Archivo | Pico antes | **Pico después** | Tarda antes → después |
|---|---|---|---|
| 38 MB (30 s) | +142 MB (3,7×) | **+37 MB** | 0,27 → 0,65 s |
| 76 MB (60 s) | +275 MB (3,6×) | **+61 MB** | 0,43 → 1,31 s |

- **El pico ya no es 3,6 veces el archivo.** Crece un poco con el largo (37 → 61 MB): son los trozos ya mirados que
  esperan al basurero, no el archivo.
- **Tarda unas 3 veces más,** pero corre aparte: la línea de tiempo se dibuja sin esperarla y la onda aparece cuando
  está.
- **Da el MISMO dibujo** (escenario `onda-igual-30s`, contra el camino de antes con el mismo archivo):
  - 11.250 baldes con diferencia máxima 0;
  - las dos lecturas a 48 kHz;
  - la nueva trae 768 muestras de más al final, que son el relleno del códec AAC (16 ms).

## 11. Después: un lienzo por capa, medido (11/11/2026)

Es la función REAL del compositor (`compositor/lienzo-de-subida.ts`), cuadro a cuadro sobre el mismo clip, contra la
copia de antes. Escenarios `repro-1080-subida` (antes) y `subida-reusada-1080` (después), corridos uno detrás del otro.

| 1080×1920, 5 s con la subida de cada cuadro | Antes: lienzo nuevo por cuadro | Después: un lienzo por capa |
|---|---|---|
| Pico en la GPU | +198 MB | **+152 MB** |
| 150 cuadros, tiempo | 737 ms | **568 ms** |
| Queda en la GPU | +81 MB | +80 MB |

Sin ninguna subida, el mismo clip da +128 a +162 MB de pico: la subida casi dejó de costar memoria. Lo que queda es el
decodificador (§2).

**Sin medir:** el 4K, que es donde más se notaba (+529 → +762 MB de pico). La PC tenía 2 GB libres, y el 4K la habría
bajado de los 1.250 MB del corte. Se corre con `node scripts/banco-memoria-editor/medir.mjs repro-4k subida-reusada-4k`
cuando haya 3 GB libres.

## 12. Después: cerrar el decodificador de lo que salió de pantalla, medido (11/11/2026)

Es el `VideoCache` REAL, compartido entre clips como en el editor, con un reloj simulado a 30 cuadros por segundo: el
banco pide cuadros mucho más rápido que la reproducción, y con el reloj de verdad nunca pasarían 5 s de uso.

- **Antes:** el mismo código con `inactivoMs` infinito.
- **Escenarios:** `tope6-antes-1080` y `tope6-despues-1080`: 6 clips de celular de 6 s, uno detrás del otro.

| Después de cada clip | Antes: abiertos / GPU / todo Chrome | Después: abiertos / GPU / todo Chrome |
|---|---|---|
| 1 | 1 / +113 / +205 MB | 1 / +85 / +117 MB |
| 2 | 2 / +217 / +303 MB | 1 / +99 / +135 MB |
| 3 | 3 / +238 / +332 MB | 1 / +218 / +231 MB |
| 4 | 4 / +302 / +414 MB | 1 / +219 / +235 MB |
| 5 | 5 / +393 / +447 MB | 1 / +223 / +173 MB |
| 6 | 6 / +368 / +411 MB | **1 / +259 / +188 MB** |

- **Antes, cada clip sumaba unos 60 MB en la GPU. Después se estabiliza** cerca de +220–260 MB, y Chrome entero queda en
  menos de la mitad.
- **La GPU no devuelve en el momento lo que se suelta:** cerrar 3 decodificadores no la baja, la deja de hacer crecer.
  Chrome guarda esa memoria para reusarla. Por eso el beneficio se ve en un proyecto largo y no en uno de 2 clips: con 4
  clips daba +309 contra +270 MB.
