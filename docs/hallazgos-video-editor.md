# Hallazgos — el Video Editor (la copia de CapCut)

La tab Video Editor (`app/video-editor/`) es una copia de CapCut Desktop 9.3 armada sobre el motor de
OpenCut classic portado (MIT). El plano —decisiones, arquitectura, ranuras, reglas y paquetes— está en
[diseno-editor-video.md](diseno-editor-video.md); los relevamientos que lo sostienen, en
[editor-video/](editor-video/). Lo que se hizo está en el commit; acá va lo que hay que saber **antes**
de tocarlo: el síntoma, la causa, dónde vive y la regla que queda.

## La memoria del editor, medida: achicar la vista previa NO la baja, la copia liviana sí (11/11/2026)

Martín preguntó si con Remotion se podía editar sin gastar la RAM del cliente. Antes de decidir, se midió dónde se va hoy.
El código real (`VideoCache`, `WaveformCache`) corrió en un Chrome sin ventana: el banco `scripts/banco-memoria-editor/`.
Números y método en docs/editor-video/memoria-del-editor.md.

- **El diagnóstico obvio era el equivocado.** «1/2» y «1/4» en la vista previa (`canvas/escala-salida.ts`), igual que el
  `maxCanvasSinkFrameSize` del `<Video>` de Remotion, achican el lienzo de SALIDA. Medido con 3 clips de 1080×1920:
  - lienzo achicado: de +297 a +264 MB, casi nada;
  - una COPIA liviana del archivo (540×960, 2 Mb/s): **+86 MB**.

  El navegador decodifica a la resolución del archivo, y mediabunny guarda hasta 8 cuadros en cola antes del lienzo. En 4K
  el pico baja de +529 a +26 MB, y cada cuadro sale 10 veces más rápido: de 11 a más de 30 cuadros por segundo. **Regla:**
  para bajar la memoria de la vista previa se cambia lo que se DECODIFICA, no el tamaño en que se dibuja.
- **El pico más grande es la forma de onda**, no el video: `services/waveform-cache/service.ts:64-79` lee el archivo
  entero, lo copia (`.slice(0)`) y decodifica todo el audio. Mide 3,6 veces el archivo (76 MB → +275 MB) en cada carga del
  proyecto; un video de celular de 1 GB pide ≈3,6 GB.
- **Cada clip que se tocó deja su decodificador abierto** (≈100 MB en 1080×1920) hasta sacar el archivo o cambiar de
  proyecto. Y el compositor copia cada cuadro a un `OffscreenCanvas` NUEVO (`wasm-compositor.ts:232`): en 4K sube el pico de
  +529 a +762 MB, y la GPU lo suelta tarde.
- **La copia liviana y la exportación NO pueden compartir clave en el `videoCache`.** El caché guarda un
  decodificador por clave, y el que llega primero se queda. Si la vista previa abre la copia con la clave del medio,
  exportar recibe ESE decodificador y sale en 540 px, sin ningún error. Por eso la copia va con `claveLiviana()`
  (`media/copia-liviana-reglas.ts`) y exportar usa el original con la clave de siempre.
  - La miniatura del proyecto y la portada del cuadro de exportar se arman sin `isPreview`, así que abrían el
    decodificador del ORIGINAL en cada guardado. Ahora van con la copia.
  - Exportar suelta los decodificadores del original al terminar.
- **Trampas del banco, para la próxima medición:**
  - En un Chrome sin ventana los lienzos viven en el proceso de la GPU: midiendo sólo el de la página, el video «no gasta
    nada».
  - Sumar todos los procesos de tipo renderer mete el `about:blank` inicial: se abre la página como ÚNICA pestaña.
  - Muestrear cada ~0,5 s no ve un pico de 0,3 s: el pico sale de `PeakPageFileUsage` de Windows.
  - Una llamada de CDP sin tope queda esperando para siempre si Chrome se cae. Ya pasó: lo cortó la guarda de RAM.
- **Sin hacer** (orden y archivos en memoria-del-editor.md §7):
  1. ~~forma de onda por tramos~~ **HECHO el 11/11** (`media/onda-por-tramos.ts`; 76 MB de video: pico de +275 a +61 MB, el mismo dibujo, memoria-del-editor.md §10);
  2. ~~copias livianas al importar~~ **HECHO el 11/11** (`media/copia-liviana.ts`; 3 clips de +297 a +81 MB, memoria-del-editor.md §9);
  3. ~~un lienzo por capa que se reuse~~ **HECHO el 11/11 para el video** (`compositor/lienzo-de-subida.ts`; 1080: pico de la GPU de +198 a +152 MB, cuadros un 23 % más rápidos). Los efectos tipo CapCut siguen con un lienzo nuevo por llamada (`pases-ce.ts:347`), a propósito: el de su contexto se reusa abajo de quien lo lee;
  4. ~~tope de decodificadores abiertos~~ **HECHO el 11/11, con otra regla**: se cierra el que no pidió un cuadro en 5 s DE USO, y con el editor quieto no corre. Un tope fijo cerraría capas que se ven a la vez. Con 6 clips de celular, Chrome queda en +188 MB contra +411. ⚠️ La GPU no devuelve en el momento lo que se suelta: cerrar no la baja, la deja de hacer crecer, y con 2–4 clips no se nota;
  5. ~~terminar el hilo de Whisper~~ **HECHO el 11/11**: se suelta al minuto sin uso, nunca con un subtitulado en curso (≈250–300 MB);
  6. exportar sin juntar todo en memoria: **el audio, HECHO el 11/11** (de a una fuente: 4 clips de 60 s, de +450 a +200 MB de pico, el mismo resultado); falta el MP4 a OPFS con `StreamTarget` (el «fast start» en memoria pone el índice al principio, y escribiendo de a poco hay que elegir dónde va);
  7. las fugas: **HECHAS el 11/11 cuatro** (IndexedDB cierra cada conexión, y una abierta dejaba colgado a `deleteDatabase`; el caché de imágenes, el `AudioContext` de cada sonido de la biblioteca y el `Input` de la tira de miniaturas se sueltan). Falta `EditorCore.reset()` / `AudioManager.dispose()` / salir sin cerrar el proyecto, que se prueba con el editor entero.

    8. **el tope al historial, HECHO el 11/11** (200 pasos). ⚠️ Un tope que olvida los más viejos rompe la cuenta de «Deshacer todo»: la Edición automática resta la profundidad de antes y la de después, y con el historial lleno daba 0. Por eso `profundidad()` cuenta también los olvidados.

  Sin medir en vivo: el editor ENTERO (la PC tenía 1,9 GB libres, y sigue el SIN RESOLVER de «Cargando…» en un Chrome sin
  ventana), exportar y Whisper.

## Remotion: lo que la nube hace y lo que no (11/11/2026)

- **La nube de Remotion EXPORTA; no edita.** La vista previa (`<Player>`) corre siempre en el navegador; un render en Lambda tarda segundos (7,56 s caliente en su ejemplo más simple), sirve para exportar, no para mover el cabezal. Lo que baja la RAM es otra cosa: proxies livianos hechos en la nube, el `<Video>` de `@remotion/media` (descarga por partes, caché acotado), `maxCanvasSinkFrameSize`, y NO usar `prefetch()` (guarda el archivo entero en memoria). **Antes de migrar de OpenCut, medir dónde se va hoy la memoria**: cambiar de motor no la baja sola.
- **12 de las 21 transiciones** (`dissolve`, `crossZoom`, `filmBurn`…) y los efectos sobre TEXTO necesitan `<HtmlInCanvas>`, que en la vista previa pide un flag de Chrome y sin él tira un error fatal. En el render andan todas.
- **Licencias dentro de lo gratis:** de `@remotion/sfx` sólo 7 de 32 sonidos son CC0; los emojis animados piden atribución (CC BY 4.0). Detalle: docs/editor-video/remotion-a-fondo.md.

## La portada de outliers con UNA tarjeta gris (11/11/2026)

Martín, con la captura de `/video-editor`: «Encuentra tu siguiente OUTLIER» tenía UNA tarjeta (la plantilla «Mensaje para…»),
las tomas eran rectángulos grises, los títulos se leían «Dis…», «Creden…», y decía «Sin datos de su cuenta». «Deberían haber
detectado esto.»

- **El recorrido del 10/11 no lo marcó porque lo miré como «pasa»**: la portada cargaba, sin error, con su tarjeta. **Una
  pantalla vacía o pobre en producción ES una falla**, aunque no tire nada: se la compara con su referencia (la grilla de
  Image, cientos de carruseles con imagen) y se la critica como Martín, no como un test.
- **Los datos estaban**: Spy ya tenía, en ws9, 525 reels de Instagram con vistas y miniatura en nuestro bucket, el gancho
  leído en 554 de 561, y la cuenta de cada uno con su foto. La portada tenía una sola fuente enchufada (la curada de MaKo). La
  fuente «Ya» de `docs/investigacion-outliers-video.md` no gasta nada: lee `spy_piezas` como lo hace Image (`FUENTE_SPY`,
  `outliersDeSpy`, con el múltiplo de toda la app sobre TODAS las piezas de la cuenta).
- **«Sin datos de su cuenta» era el motivo del múltiplo de la plantilla**, puesto como chip. Para la persona no significa
  nada. La tarjeta de la plantilla dice lo que dice en «Crear desde cero»: «MaKo te guía».
- **Los títulos cortados eran la estructura en columnas** de ~40 px. Van en bandas horizontales, con el nombre entero.
- **SIN HACER**: los reels propios por Zernio (la fuente «3» de la investigación), los Shorts de YouTube (sin «×» hasta la
  enmienda III.L), los anuncios en video, y la portada del teléfono (`/m/video-editor` no muestra outliers).

## El recorrido de la tab en producción, con dos clips de 24 fps (10/11/2026)

Martín pidió revisar la tab de punta a punta en producción. Proyecto de prueba: ws9 «1110», dos clips del teléfono con voz.

- **«Los textos se ajustan automáticamente a los nuevos tiempos» era falso.** «Un poco más rápido» puso 1,3× en los dos clips y
  la Vinculación (ripple/iman.ts, copiada de CapCut) **corre** en bloque lo que está encima de cada clip, pero **no lo
  reescala**: los clips terminaron en 16,6 s y los subtítulos en 18,8 s (2 s de negro con texto), «Por eso creé una app» salía
  1,3 s después de dicho y dos subtítulos se pisaban. A simple vista parecía que «sí se ajustaban», porque los del segundo clip
  se habían movido: se movían con el clip, no con la voz. **La regla:** cuando el CHAT cambia la velocidad (constante) de un
  clip que lleva la voz, sus subtítulos y sus tiempos por palabra pasan por la misma cuenta (`chat/velocidad-subtitulos.ts`);
  la cola de uno que termina en el clip siguiente se corre con ese clip. Con curva no hay cuenta lineal: no se toca y el
  catálogo le dice a MaKo que no lo prometa. El panel Velocidad sigue como CapCut.
- **La regla de la línea de tiempo con 24 fps no mostraba nunca un segundo**: «00:00, 15f, 6f, 21f, 12f, 3f…». El proyecto
  toma los fps del primer clip, y la serie de rótulos de OpenCut (2, 3, 5, 10, 15 cuadros) está pensada para 30: 15 no divide
  24 y los rótulos se corren del segundo. **La serie tiene que dividir los fps** (`intervalosDeRotulo`: a 24, 2-3-4-6-8-12), y el
  rótulo sale del NÚMERO de cuadro, no de `t % 1`: a 23,976 fps el cuadro 24 cae en 1,001 s y decía «0f». El diagnóstico salió
  de la serie misma: 15, 6, 21, 12, 3, 18, 9 es `15k mod 24`.
- **«Sí, en el feed» (la apertura de MaKo) corría los subtítulos sin decir nada en el chat**: ~2 min la primera vez (baja el
  reconocedor) con la pregunta y sus botones quietos. Parecía roto; el progreso estaba en el panel de Subtítulos, que nadie
  tenía abierto. Mientras corren, el chat dice lo mismo que el panel (`SubtitulandoEnElChat`). Y en el panel, con «Cancelar» al
  lado, el porcentaje se cortaba («Generando subtítulos… 0…»): el rótulo va en dos partes y lo que se corta es el qué.
- **El hilo del chat lo firmaba la criatura «Video Editor»** (un triángulo rosa) debajo de la cabecera con la estrella de MaKo.
  La regla de Martín del 21/10 («los iconos de las criaturas siempre debe ser el icono de MaKo») había llegado a la cabecera
  (29/10) y no al hilo. **El Image Editor tiene lo mismo** (`app/image-editor/mako/chat/PanelMakoIA.tsx`, `QUIEN`): sin hacer.
- **Las cabeceras de pista quedaban una pista más arriba que su contenido en CADA apertura** (tres pistas, ventana de 674 px):
  `useInitialScrollBottom` baja las pistas al fondo (scrollTop 51) y copia ese valor a las cabeceras, que en ese momento
  medían menos y lo recortaban a 7. Nada volvía a copiarlo hasta que alguien movía la rueda (la sincronización corre en
  `onScroll` y en la rueda, no cuando cambia el tamaño). **Toda caja que sigue el scroll de otra se realinea también al
  cambiar de tamaño** (un `ResizeObserver` sobre las dos cajas y lo que tienen adentro, timeline/components/index.tsx).
- **En «Edición automática» el rol de cada agente se leía «S…», «E…»**: en 212 px, la etiqueta, una barra de 48 px y un estado
  de 86 px FIJOS le dejaban 8 px al rol. Un ancho fijo para el texto más largo («nada que hacer») se paga en todas las filas.
  Y con la ventana baja el cuerpo del panel se desbordaba DEBAJO del pie («Editar con MaKo» tapaba el registro): un cuerpo
  `flex-1 min-h-0` sin `overflow` no se achica, se sale.
- **«Estilo Hormozi» por chat armaba OTRA cosa**: karaoke amarillo y salto, sin Anton, sin mayúsculas, sin el contorno, y
  MaKo decía que resaltaba palabras clave sin proponerlo. El panel tiene esa plantilla («Hormozi», subtitles/estilos.ts),
  pero el chat no veía la galería: sólo los presets de la MARCA. **Lo que el panel ofrece con nombre, el chat lo tiene que
  ver con el mismo nombre** (`plantillas_subtitulos` en DISPONIBLES); si no, el modelo lo arma con piezas y sale parecido y
  distinto. Se usa con `usar_preset_subtitulos` (la de la marca, si se llama igual, gana). SIN HACER: la API sigue aceptando
  sólo los presets de la marca.
- **La barra de Multimedia corría la sección de lado**: a 1440 px con el chat abierto, el panel mide 203 px y la barra 247. El
  foco del «+» de una miniatura corrió la caja `overflow: hidden` 32 px. **Una caja que sólo recorta va con `overflow-clip`**:
  `hidden` se puede correr con el foco o un `scrollIntoView`, y nadie la vuelve a su lugar.
- **⚠️ Las pruebas «en ws9» desde Claude in Chrome fueron como LEANDRO, en su ws10** (un usuario real): ese Chrome tiene su
  sesión y `?ws=9` no hace nada para quien no es super admin, sin avisar. Quedaron 2 proyectos de prueba, 1 hilo de chat y 3
  llamadas a la IA en su negocio. La señal estaba: IndexedDB sólo tenía bases `mako-ws10-…`. **El primer paso de toda pasada
  en un navegador es `fetch('/api/auth/me')`** (ya lo decía la memoria `verificar-en-navegador` desde el 15/10).
- **El navegador de la app no sirve para el editor si la sesión no está en una ventana**: el panel queda oculto, la página
  corre en segundo plano, la importación se cuelga en «Importando…», los cursores no se animan y el B-roll queda en
  «Trabajando». Tampoco tiene subida de archivos ni deja pedirle nada a `127.0.0.1` desde https. Los videos de prueba
  entraron por el fragmento `#` de una navegación (un puente en un servidor local que los pasa en base64, ≤ 2 MB).
- **SIN HACER — al reabrir un proyecto en el navegador de la app, sus videos ya no estaban en OPFS** (la metadata sí). El
  archivo se escribe ANTES que la metadata (`saveMediaAsset`) y quien borra medios borra las dos cosas, así que alguien los
  sacó después. Un archivo de prueba en OPFS sobrevivió a la recarga. En Chrome no pasó. Y el editor no avisa: muestra una
  biblioteca vacía y un video negro con los subtítulos encima.
- **El teléfono no se pudo mirar desde acá**: la ventana de la extensión está maximizada (`resize_window` contesta «resized» y
  no cambia), la app no se deja enmarcar en un iframe y `/m/…` con la computadora redirige al escritorio.
- **SIN HACER — la lista de proyectos es la de ESTE navegador**: en otro Chrome dice «Todavía no hay ninguno» aunque ws9 tenga 6
  proyectos en `video_editor_proyectos`. El proyecto vive en IndexedDB/OPFS del navegador donde se editó (los medios también);
  la base sólo tiene la copia de lectura (`vista`). Que se vean en otra computadora es pasar los proyectos y sus medios al
  servidor: no es un arreglo chico.

## La tab Video: outliers primero, la plantilla guiada «Mensaje para…» y el modo simple (9/11/2026, nube)

**El pedido** (Martín, 9/11): unificar Video Editor y AI Avatar en UNA tab «Video», con los outliers primero (como Image), la
plantilla del reel de mentores guiada por MaKo («pásame una foto o selecciona de estas», con el resto opacado y su pregunta
marcada), menos botones y los cursores de MaKo. El diseño y lo que queda: [relevo/nube-tab-video.md](relevo/nube-tab-video.md).

- **El modo simple dejó de cargar la fila de pestañas en su test, y el error no lo nombraba.** `crear-qa-pantallas` arma
  `tabbar.tsx` con esbuild en CJS, y al sumarle `useModoSimple` (que leía el proyecto con `useEditor`) entró el motor entero:
  «Top-level await is currently not supported with the "cjs" output format» en `_opencut/wasm/opencut.ts`. La regla de
  siempre («`_opencut/wasm` no carga en node») mordió por un import de un hook. **Lo que sólo pregunta un dato del proyecto no
  importa el motor**: la cabecera del editor (que ya lo tiene) fija el proyecto abierto (`fijarProyectoAbierto`, guia/estado.ts)
  y el modo simple lo lee de ahí. Las listas del modo simple van aparte (`guia/modo-simple-reglas.ts`), en POSITIVO.
- **La memoria de las aperturas no sirve de estado de un proyecto, ni para callar.** `respuestasDeMemoria` (lib/aperturas/reglas.ts)
  descarta a propósito las claves con entidad (`|`): un paso contestado de un proyecto no vuelve como respuesta, sólo calla esa
  clave. Y callar también rompía: la primera versión envolvía `useApertura`, y como la guía muestra sólo el primer paso que
  falta, «Ahora no» en ese paso (14 días, el segundo para siempre) o tres vistas sin respuesta **callaban la guía entera**.
  Lo cazó la revisión adversarial, no un test: los EJEMPLOS de la superficie no pueden ver la memoria. **Una superficie que
  lleva pasos de UNA cosa (un proyecto) guarda en esa cosa lo contestado Y lo salteado** (`app/video-editor/guia/estado.ts`,
  con el workspace en la clave), arma su `EstadoApertura` sin `useApertura`, saltea lo salteado y deja retomarlo
  (`pasosDeLaGuia`, la lista «Tu video»).
- **«Mientras MaKo pregunta» no es «el proyecto es guiado».** Las píldoras y la pregunta de los subtítulos callaban con la marca
  del proyecto: con todo contestado, el chat quedaba sin sugerencias para siempre. Calla sólo con la pregunta a la vista
  (`onHablando`). Y la tarjeta del chat plegada escondía la pregunta: quien pregunta la despliega (`desplegarCrear`).
- **El velo de la guía vive ARRIBA de la pila de modales** (z 400 contra 130). Su modo nuevo, la pregunta marcada
  (`destacarEnElChat`, `dibujoDestacado` en lib/guia/huecos.ts), no se dibuja con un modal abierto: si no, opacaba el editor
  del guion que la misma pregunta acababa de abrir. Y nunca marca algo que no está ADENTRO de un chat.
- **El chat del editor no llevaba `data-mako-chat`**: sin la marca, el velo no le deja hueco y lo opaca junto con todo. Toda
  tarjeta de chat donde MaKo pueda preguntar con el velo la lleva.
- **La galería de fotos es de la pieza de todos** (`Apertura.galeria`, `AperturaMako`), no de la tab: cualquier superficie la
  usa. Cada opción es una `respuesta`; su imagen tiene que ser https o de la app (una `data:` o un `javascript:` no se dibuja).
- **El manual da dos ritmos para un clip con gesto**: 2,8 palabras/s (§3 regla 7, medido con la transcripción de Omni) y 2,1
  (§7.1 regla 12, sin medir). `duracionDeClip` usa el medido (regla 29: gana el que se puede medir) y el §7.1 se corrigió en el mismo commit.
- **Un test que no veía un paso.** Saltear el paso del guion (R13) daba 9/9 en tests/video-tab.test.ts: lo cubría sólo
  tests/aperturas.test.ts por los EJEMPLOS de la superficie. Se sumó el caso al test 5. Contar las roturas que dan 0 es lo que
  lo encontró.
- **Lo que se reusó y no se reescribió:** subir la foto es `/api/onboarding/persona` (la del estudio del personaje; su
  `useSubirFoto` no está exportado y la llamada se copió en guia/GuiaEnElChat.tsx: si cambia la respuesta, cambian las dos),
  clonar la voz es `ModalClonar` (app/automations/VozAIStep.tsx, exportado para esto) y las fotos y personajes salen de
  `inicioAvatarAction`.
- **Sacar AI Avatar de la barra dejaba a un Esencial sin su personaje, y nada lo marcaba.** Video es sólo de Pro
  (`NAV_SOLO_PRO`, lib/plan-esencial-reglas.ts) y AI Avatar es de los tres planes: unificarlas es también una decisión de qué
  ve cada plan, que es de Martín. La fila se quedó; el test la ata a esa condición. **Antes de mudar una tab adentro de otra,
  se mira si las dos las ven los mismos planes y roles.**
- **Un link «al inicio» cambia de destino cuando la portada cambia.** `/video-editor` pasó a ser los outliers, y «Volver al
  inicio», borrar el proyecto abierto y el link «Ir al inicio» del chat seguían yendo ahí, lejos de la lista de proyectos. Van a
  `RUTA_CREAR_VIDEO` (`?ver=crear`), como Image con su `RUTA_CREAR`.

**Sin hacer** (docs/relevo/nube-tab-video.md §8): MaKo no filma sola los clips, las tomas blancas ni el montaje (lleva al
estudio y al Video Generator); la corrida del montaje con los cursores del enjambre (los `agentes` de cada paso ya están en la
plantilla); las carpetas en Multimedia (definidas en `lib/video-plantillas/piezas.ts`, sin dibujar); la voz voice-to-voice
(`convertirVoz` en lib/elevenlabs.ts no tiene llamador en la app); la fuente de outliers del chat «Outliers de reels y
anuncios» (se enchufa en `FUENTES_OUTLIERS_VIDEO`); el teléfono no ofrece la plantilla guiada; si AI Avatar sale de la barra
(decide Martín, por los planes). Nada se miró en un navegador.

**Vive en:** `lib/video-plantillas/` · `lib/video-outliers.ts` · `lib/video-outliers-servidor.ts` · `lib/aperturas/video-guia.ts` ·
`app/video-editor/guia/` · `app/video-editor/OutliersVideo.tsx` · `app/video-editor/vista.ts` · `app/_ui/guia/VeloGuia.tsx` ·
`lib/guia/huecos.ts` · test `tests/video-tab.test.ts`.

*9/11/2026, sesión en la nube (`cli_0c6817ed-9a7f-5be0-bade-2bb8adac6555`).*
## Tanda 4: ruido en un worker, seguir a la persona, cinco botones al chat, B-roll con videos y el rango I/O (10/11/2026)

**Vive en:** `audio/ruido-hilo/` · `clips/seguir.ts` y `seguir-en-editor.ts` · `chat/linea.ts` (duplicar, fondo, efecto y plantilla de
texto, emoji, recorte) · `broll/cambiar.ts` y `lib/pexels.ts` · `rango/` y `export/exportar.ts`. Punta `punta/editor-tanda4-0911`.

- **Un worker que arranca desde un `blob:` (Turbopack) no resuelve un `fetch("/ve/wasm/…")` relativo**: la dirección del
  `.wasm` se arma contra `location.origin`. Y transferir `getChannelData` VACÍA el AudioBuffer de quien llama: se copia antes.
- **El reflejo se aplica DESPUÉS de medir**: el centro de la persona se mide en el cuadro sin reflejar y el gancho `ce-reflejo`
  da vuelta la capa al dibujar, así que con «Reflejar» el encuadre la sacaba del cuadro. El test de la geometría copiaba la
  fórmula del compositor a mano y daba verde: ahora dibuja con el gancho real.
- **Una copia del mismo pedido no tiene ids todavía**: lo que corre después del lote (cambiar el B-roll, revertir, congelar,
  borrar silencios) la aceptaba y fallaba al aplicar con un mensaje falso. Se rechaza en la revisión, y la copia se simula con
  el estado del original EN ESE MOMENTO del pedido.
- **Agregar un archivo a Multimedia puede subir los fps del proyecto fuera del historial** (`ratchetFpsForImportedMedia`):
  un video de Pexels a 60 fps dejaba el proyecto en 60 y apagaba «Restaurar» del chat, que comparaba los ajustes enteros. El
  B-roll agrega sin el ratchet y el chat compara sólo el fondo.
- **Exportar un rango mezclaba (y le reducía el ruido a) toda la línea de tiempo** antes de recortar: ahora saltea lo que
  no se cruza con el tramo.
- **Seguridad de la bajada de Pexels**: el único `fetch` directo va a un host fijo (api.pexels.com); los archivos de video se
  bajan sólo si vinieron en la respuesta y son de sus hosts, con `validarDestino` en cada salto; el navegador manda un id,
  nunca una URL. La guarda de SSRF lo fija (O6).

**Lo que quedó sin hacer:** Tab (el relevamiento no dice qué hace) y el DIBUJO del rango copiado de CapCut (capcut.com está
fuera de la red de la nube); leer los términos y la documentación de videos de Pexels (pexels.com, igual); el acercamiento a
la cara del B-roll; verlo todo en Chrome (lista en `docs/relevo/editor-pendientes-nube.md`).

## Motion graphics traído por partes, y lo que encontró su revisión (10/11/2026)

**Vive en:** `lib/motion/` (el motor, con `LICENSE-IART` y `LICENSE-WEBKIT`) · `app/video-editor/_opencut/motion/` ·
`app/video-editor/_opencut/graphics/definitions/motion*` · `lib/editor-video/chat-catalogo.ts` (`agregar_motion`,
`editar_motion`) · `lib/editor-video/chat-api.ts` (`agregar_motion_video`, `editar_motion_video`). Punta `punta/motion-0911`.

- **Mezclar la rama vieja eran 97 conflictos; traerlo por partes (motor → elemento → chat y API) sobre el código de hoy,
  ninguno.** El bloque motion del Web Generator, que vivía en la misma etiqueta, no vino: es de otro chat.
- **Tres lectores de números con `replace(',', '.')` leían «1.250» como 1,25** (la cifra, la API y el panel), mientras
  las barras leían bien. El motor escribía «1.250» y después no leía lo que había escrito. Ahora hay UNO
  (`lib/motion/numeros.ts`: un separador seguido de exactamente tres cifras es de miles), y lo ambiguo que manda la IA
  o la API se rechaza con las dos lecturas y qué escribir.
- **Un render que normaliza «sin ser estricto» reemplaza en silencio lo que no pasa por el EJEMPLO de la plantilla**: un
  nombre o una cita inventados en el video de un cliente, o el color de fábrica porque el selector devolvía el alfa.
  La validación va donde se escribe (la pestaña, al salir del campo, con el motivo) y el render, ante un obligatorio
  vacío, deja la capa vacía.
- **Una escena con un tope propio (60 s) dentro de un clip que puede durar 600 s** se vaciaba al minuto con el fondo
  tapando el video: la escena dura lo que el clip.
- **El aviso de un port**: `curvas.ts` era el UnitBezier.h de WebKit (BSD, Apple) sin su aviso; va el texto literal.
- **«motion» no estaba en las palabras del área video**: en el chat de la app, «agrega un motion graphic…» llegaba sin
  `agregar_motion_video`. Se sumó, salvo en una frase que nombra una landing o una web (ahí se llevaba las
  herramientas de la landing). El margen del presupuesto quedó en 319 (piso 300).

**Lo que quedó sin hacer:** dividir un motion repite la entrada en la mitad derecha (decisión para Martín, en
`docs/editor-video/pendientes-video-editor.md` §3.1); marquesina, pasos con íconos, el logo desde un SVG y exportar con
transparencia; verlo en Chrome.

## Subtítulos de Submagic: la palabra que salta, las claves a mano y los emojis automáticos (10/11/2026)

**Vive en:** `app/video-editor/_opencut/text/resaltado.ts` · `text/dibujar.ts` · `subtitles/emojis.ts` · `subtitles/emojis-pista.ts` ·
`subtitles/emojis-poner.ts` · `lib/editor-video/claves.ts` · `lib/editor-video/presets-subtitulos.ts` · `chat/linea.ts`.
Pedido de Martín (9/11): «duplicar Submagic para el tema de los subtítulos». Relevo de la fuente: [editor-video/relevo-submagic.md](editor-video/relevo-submagic.md).

- **Submagic no publica sus números.** Su sitio y su blog describen los dos estilos de Hormozi («pop-in de abajo hacia arriba», «más
  grandes o de otro color») y nada más: ni curvas, ni tamaños, ni cuántos emojis pone. Lo que se copió con datos es eso; las cifras de
  la animación (`CURVA_POP`, `ESCALA_CRECER`) son nuestras y lo dicen. La app pide cuenta y la nube no la abrió: el relevo lista qué
  falta mirar con cuenta.
- **La forma de la palabra va por una TABLA, no por una curva.** La textura del texto se vuelve a dibujar cuando cambia cualquier cosa
  de lo medido (`collectTextNode`): una escala continua la redibujaba en cada cuadro de la palabra. Con cuatro renglones por palabra,
  cambia cuatro veces. Es la misma razón de `cuantizarRevelado`.
- **La animación necesita saber cuál se dice aunque no haya karaoke.** `resaltadoDe` buscaba los tiempos por palabra SÓLO con el modo
  del karaoke puesto: con «Salta» y sin color, devolvía null y no animaba nada, sin error. Ahora los busca con cualquiera de los dos, y
  sin karaoke nada se atenúa (`dichas` = todas).
- **La palabra con otra forma se pinta AL FINAL** (`recorrerPiezas`): agrandada en su lugar, la tapaba el relleno de la de al lado.
- **Una plantilla escribe SIEMPRE la animación** («ninguna» incluida), igual que el resaltado: si sólo la escribe la que la tiene,
  «Clásico» después de «Hormozi» deja la palabra saltando.
- **Los emojis son de su subtítulo por una MARCA** (`subtitulo.emojiDe`) y no por la pista: apagar los saca a ellos y deja el sticker que
  puso la persona en cualquier pista. Prender dos veces reemplaza, no duplica. El diccionario va por raíz con `$` para la palabra entera
  («auto$» no agarra «automatizar»; «año$» sin tilde es «ano» y no agarra «anotar») y una lista `NO_SON` («mesa», «planta», «ganas»).
- **El chat los aplica AL FINAL de todo** (`diferidas`, después de generar los subtítulos y de borrar los silencios): van con el tiempo de
  cada subtítulo, y antes de un corte quedan en el lugar viejo.
- **Un guard que pedía la ÚLTIMA línea de `LARGAS`** («"usar_plantilla", "borrar_silencios"])») cayó con el cableado bien al sumar una
  operación al final. Se volvió una prueba de lo que cuida: que `borrar_silencios` esté en la lista (`tests/video-editor-chat.test.ts`, 51).

- **La revisión adversarial (render real con node-canvas) encontró que la palabra agrandada PISABA a las vecinas:**
  «HOY DINERO YA» salía «HOYDINEROYA» con «Hormozi», y la clave al 130 % tapaba letras. Escalar una palabra en su
  lugar no le hace lugar: el renglón tiene que RESERVARLO. La reserva es la del pico (`escalaMaximaDePalabra`, no la
  del instante: así el renglón no baila) y va en la MEDICIÓN (`reservas`, sumada al ancho del bloque), no sólo en el
  dibujo: si no, el fondo y el recuadro de selección quedan cortos. La ubicación es una función pura
  (`ubicarPalabras`) porque `dibujar.ts` arrastra el motor y no carga en node. Y la palabra con forma va en una
  pasada COMPLETA aparte (contorno y relleno): con el contorno de todas antes que todos los rellenos, el relleno de la
  vecina le pisaba el contorno.
- **Un emoji colocado UNA vez no sigue a su subtítulo**: cambiar de plantilla lo dejaba encima del texto, y borrar o
  regenerar los subtítulos dejaba emojis huérfanos. La regla (`sincronizarEmojis`) corre en `timeline.updateTracks`,
  como el imán: recoloca si cambió el subtítulo, saca el huérfano, y si la persona tocó o duplicó el emoji le saca la
  marca (queda suyo). ⚠️ El orden importa: si el subtítulo cambió, manda el subtítulo, porque un «Deshacer» trae los
  dos cambiados y, preguntando primero «¿lo tocó a mano?», deshacer un cambio de estilo le sacaba la marca.
- **La vista del chat crecía ~190 caracteres por emoji** (animaciones y posición) y un video largo pasaba su tope:
  el emoji automático va compacto.

**Lo que quedó sin hacer:** el subtítulo escalonado («Stagger Stack», §1.6 de los pendientes: no hay descripción en el repo y copiarlo de
memoria es diseñarlo); verlo todo en Chrome (la lista está en `docs/relevo/editor-pendientes-nube.md`); la palabra
que BAJA con «Salta» no entra en lo medido (sobresale apenas del recuadro de selección); la alineación izquierda o
derecha del subtítulo no mueve el emoji (se centra en su `x`); y el reparto de renglones (`partirYUbicar`, 82 % del
ancho) no cuenta la reserva, así que una clave al 160 % al final de un renglón lleno podría salirse del lienzo.

## Edición automática: los arreglos de la revisión (10/11/2026)

**Vive en:** `app/video-editor/_opencut/enjambre/plan.ts` · `audio/normalizar.ts` · `audio/claves.ts` · `broll/proponer.ts` ·
`transcripcion/modelo.ts`. Punta `punta/edicion-arreglos-0911` @ `101042780` (VERDE con Node 24: 7227 tests y el tsc entero).

- **El «nada que hacer» de un agente salía de comparar TEXTOS escritos en dos archivos.** `esNadaQueHacer` buscaba «no se cortó las
  muletillas» y `linea.ts` decía «no se identificaron muletillas»: todo video grabado con guion terminaba en «1 no pudo» con «Reportar
  a Soporte». Ahora es una constante (`NO_HAY_MULETILLAS`) que usan los dos, y el test usa el texto real que devuelve `revisarOperaciones`.
- **−14 LUFS por pedazo no es −14 LUFS.** Cortar las pausas parte una toma en pedazos, y medir cada uno por separado le da a cada uno su
  ganancia: una frase baja salía más fuerte que la de al lado. Se mide la toma entera (`normalizarJuntos`) y un pedazo casi mudo, cuya
  medida propia se dispara, usa la de su toma (`medidaDePedazos`, tolerancia 6 LU).
- **«Detener» y «falló» son dos desenlaces** (`comoTerminaFalla`): un paso cancelado por la persona no se reporta.
- **Una falla no puede multiplicar el gasto.** Con los subtítulos caídos, el B-roll y los planos volvían a transcribir cada uno; ahora
  las frases se leen una vez (`alLeerFrases`) y sin Pexels se pregunta ANTES de gastar la IA del negocio.

## ⚠️ El `npm ci` del veredicto, en un worktree con `node_modules` ENLAZADO, vacía el del clon (10/11/2026)

**Vive en:** `scripts/veredicto.mjs` (corre `npm ci`) y la receta de `docs/relevo/nube-metodologia.md` (worktree limpio para sacarlo).
El veredicto necesita un árbol limpio, así que se saca en un worktree aparte; si ese worktree tiene `node_modules` como enlace al del
clon (lo que pide AGENTS.md para pushear desde un worktree), `npm ci` **borra el contenido del destino del enlace** y deja un
`node_modules` real en el worktree. El clon principal quedó con la carpeta vacía y otro agente que trabajaba sobre él perdió `tsx` a la
mitad, con errores que no nombraban la causa («Cannot find module»). La regla: **el worktree del veredicto lleva su `node_modules` propio**
(sin enlace), y si ya pasó, `npm ci` en el clon.
## La edición por prompt, medida en producción con los pedidos de los clientes (9/11/2026)

**El pedido** (Martín, 9/11): «revisá que todos los tickets del editor estén resueltos, que se pueda editar perfectamente por
prompting». Los tickets del editor eran cuatro (#15 importar, #23 subtítulos, #31 y #32 silencios) y estaban cerrados: se
volvieron a medir en producción (ws 9, proyecto «1109», clips con la voz de Martín y una pausa de 1,5 s armada con ffmpeg) y
andan: importa, subtitula (~70 s la primera vez) y borra los silencios (21 → 15 s, 7 de 7). La batería de pedidos salió de
`video_editor_chats` (lo que escribieron Leila, Leandro y Mauricio) y corre sin pantalla con
`scripts/probar-chats/video-editor.mts` (ws 9, sin levantar tickets: anota cuál habría salido).

- ⚠️ **El diagnóstico obvio («la IA entiende mal») era el equivocado en la mitad de los casos: la IA acertaba y el EDITOR
  descartaba.** «Los subtítulos en amarillo y en Bebas Neue» → la IA mandó bien un `estilo_texto` por subtítulo y la revisión
  (`chat/linea.ts`) tiraba la operación ENTERA porque traía la fuente: no cambiaba ni el color. Ahora lo que cambia el ancho
  del renglón va a `estilo_subtitulos` (`aplicarEstiloASubtitulos` de subtitles/insert.ts, el de «Aplicar en todos», con
  `solo`), después del lote.
- **El titular del chat es el `resumen` del modelo, escrito ANTES de que el editor revise**: afirmaba lo que no quedó («Aquí
  tienes la limpieza de muletillas» con «no se identificaron muletillas» debajo y sin tarjeta). Con operaciones propuestas y
  ninguna aplicable, el titular lo pone el código: «No cambié nada.» (`chat/respuesta.ts`), y cada motivo va una vez (el mismo
  salía tres veces, uno por subtítulo).
- **El chat no ve la charla** (lib/editor-video/ia.ts manda sólo el pedido y la línea de tiempo): «si hazlo» debajo de una
  propuesta contestaba «es muy vago» (Leandro, 28/10) y, desde la regla de lo que no existe, **levantaba un ticket «no existe:
  si hazlo»**. Ahora un «sí» suelto debajo de una propuesta que espera es su «Aceptar» (`chat/confirmar.ts`), sin ir a la IA.
- **Una tarjeta con un nombre de archivo largo cortaba el «Aceptar» y corría el chat entero a la izquierda.** Un `grid` con
  columna `auto` toma el ancho mínimo de sus hijos, y un `truncate` (sin cortes) mide el texto entero: 296 px en una burbuja de
  231. Con `grid-cols-1` (`minmax(0,1fr)`) el `truncate` funciona: medido en la página antes de tocar el código.
- **Lo que confunde a la IA está en el `para` del catálogo**: `fundido` es SÓLO el sonido (pidió «que empiece desde negro» y
  puso transiciones en los cortes), una transición no va al principio ni al final, «un poco más rápido» le daba 2×, y un título
  «al inicio» corría todos los clips 3 s. Van dicho en `chat-catalogo.ts`. Re-medido con el arnés, 2 de 2 cada uno: el
  fundido sale como animación de entrada del primer clip y de salida del último, «un poco más rápido» da 1,2× y el título
  queda encima sin mover nada.
- **Con la propuesta bien armada, el modelo a veces suma `[[no-pude: …]]`** (1 de 2 en «ponelo todo un poco más rápido»:
  «no pude aplicar la velocidad a toda la pista en un solo comando»). En producción eso abre un ticket y le dice al cliente
  «Quedó el ticket #N» al lado de un cambio que salió. Este chat no ejecuta (sólo propone): con operaciones, `[[no-pude]]` se
  saca sin ticket y `[[no-existe]]` se queda (`lib/editor-video/marcas-chat.ts`).
- **Mientras se generan los subtítulos la tarjeta era un círculo mudo un minuto**: el store `useTrabajoSubtitulos` ya tenía
  fase y %, el panel lo mostraba y el chat no. El rótulo vive en `subtitles/resultado.ts` (`rotuloProgresoSubtitulos`).
- ⚠️ **«Pushear no es desplegar» también para medir**: la edición automática con los agentes y sus cursores entró a main a las
  12:30 UTC y el despliegue diario es a las 11:05 UTC (lib/desplegar-main.ts): en producción, «usá la edición automática»
  contestaba «eso no existe», y era cierto. Antes de medir algo en producción, mirá si su commit es anterior al último
  despliegue.
- **Leer el lienzo del reproductor por JS no mide nada**: `drawImage` de un canvas WebGPU sin `preserveDrawingBuffer` da negro
  o el último cuadro. Para ver si el video se traba, capturas reales mientras corre.
- **El arnés local**: con `C:/dev/mako-api/.env.local` dos cuentas de Gemini de la plataforma contestan «API key not valid» y
  la cascada sigue con las otras (10 a 60 s por pedido). Es la copia local; no se midió si producción tiene las mismas.

**Sin hacer (derivado al chat de la nube «Video Editor: todos los pendientes»):** agregar un medio de Multimedia a la línea de
tiempo por chat (ticket #73 del ws 9: la vista ni lista los audios, `mediosParaReemplazo(medios, "ambos")`; pide su gemela en la
API); fotogramas clave por chat; música de biblioteca (vacía a propósito: falta una con licencia comercial, decisión de
producto). **Sin reproducir:** «se bugguea el video» de Leila (2/11) después de poner «Mezclar» en cada corte: con la misma
transición en «1109» el video corre de punta a punta. **Sin medir en producción:** los cursores de la edición automática
(llegan con el despliegue del 10/11).

## Cortar al ritmo de una referencia: lo que mide un reel que funciona (9/11/2026)

**Síntoma.** El reel de mentores (template «Mensaje para…», copiado del de Josep / Tacho, `instagram.com/reel/DdTdIIPDzHU`)
se sentía lento y «sin tren» al lado del original, con el mismo guion y la misma estructura.

**El diagnóstico obvio era el equivocado, dos veces:**
- «Le falta música de fondo, bien mezclada»: no. **Josep NO tiene música bajo la voz** (piso de −49,7 dBFS en sus pausas);
  la música entra SÓLO como golpe pegado en cada inserto blanco y, continua, en el cierre mudo. El v1 la ponía debajo de
  todo con `sidechaincompress`: es la gramática de un anuncio, no la de este template.
- «Martín habla lento»: tampoco. A 1,10 (atempo) dice 7,45 sílabas/s contra 7,08 de Josep, con los mismos huecos entre
  palabras (36 contra 40 ms). La lentitud eran 3 s de silencio digital en las animaciones (Hormozi quieto, el humo) y un
  tramo de 7,8 s sin ningún golpe (Josep nunca pasa de 3,6 s).

**La gramática medida** (`C:/dev/reel-mentores/josep/analisis/ritmo-josep.json`, verificada por un segundo agente con otro
método; el montaje que la aplica es `C:/dev/reel-mentores/montaje/montar-v2.mjs`, fuera del repo):
- 130,95 BPM (beat 0,458 s), 4/4 en half-time de trap. El 129,2 que da librosa por defecto es un escalón de su grilla
  (hop 512 a 22.050 Hz), no la medición: hay que medir el período por regresión sobre los beats del tramo sin voz.
- Cada inserto usa el MISMO pedazo de canción (correlación 0,98-0,99), desde el «1» de una frase; el corte de imagen cae en
  el golpe o hasta un cuadro antes (−4 a −42 ms), nunca después; la palabra roja aparece en ese mismo cuadro y se va con el
  corte de salida. Inserto corto = 1,30 beats (0,596 s); el largo, 2,1 beats. El audio se corta en seco al volver la voz.
- Tramos hablados de 2,9 s de media (máximo 3,6); ningún hueco sin voz ni música de más de 0,52 s.
- Cierre mudo: la canción desde su 0:00, continua, ~4,5 LU por encima de la voz; ahí los cortes siguen la acción, no el beat.
  El dominio titila 2 cuadros sí / 2 no durante ~0,93 s y queda fijo.

**Herramientas (para el corte automático de MaKo).** `audio/dsp/ritmos.ts` ya marca beats como librosa, pero no sabe dónde
cae el «1» del compás: su Ritmo 1 («uno cada dos») no es el downbeat. Lo que suma es **Beat This!** (CPJKU, código y pesos
MIT, el modelo chico pesa 8 MB y corre en CPU: devuelve beats + downbeats) en un paso Python del worker, con **Demucs**
(htdemucs, MIT) antes cuando hay voz encima (además cubre «Aislar voz»). No: madmom/BeatNet (sus MODELOS son CC BY-NC-SA,
no comerciales), Essentia (AGPL), Spotify audio-analysis (cerrada desde el 27/11/2024). Para «¿qué música es?»: AudD (API
HTTP con precio público); Shazam (`shazamio`) sólo reconoce en ventanas SIN voz encima (con voz: 0 de 9).

**Trampas que costaron una vuelta:**
- Acelerar la voz: `atempo` conserva el tono (130,6 → 130,6 Hz); `asetrate` lo sube 9,7 %, la voz de ardilla.
- Los .ass van en centésimas: redondear al más cercano (2,708 → 2,71) deja el subtítulo un cuadro sobre el inserto y la
  palabra roja entra un cuadro tarde. Se redondea hacia abajo. Y una hoja de contacto con `fps=2` no sirve para medir
  cortes: muestrea el cuadro equivocado. Se mide con `select` por número de cuadro.
- El voice-to-voice convierte el soplido de un efecto (humo) en un zumbido con tono (f0 142 Hz) que suena a risa: en los
  huecos sin voz se calla la pista de voz y va el golpe.
- `python -I` ignora los paquetes de `pip install --user`: `shazamio` daba ModuleNotFoundError estando instalado. Se
  arregla con `sys.path.append(site.getusersitepackages())`.
- La palabra roja pintada encima tapa el pelo y el celular; Josep pone al sujeto DELANTE del texto. Se compone con una
  máscara «donde el cuadro es blanco» (`maskedmerge`); y en el cierre la toma se corre hacia abajo para que el texto
  quede libre (achicarla deja costuras duras a los costados).

**Sin hacer:** el plano del celular es una foto quieta (falta su video, 12 créditos); las tres tomas blancas de la noche
llevan la luz corregida en el montaje con `curves`, no regeneradas; no se verificó que «WE ON GO» (BIA) esté en la
biblioteca de Instagram de una cuenta de empresa; a 1,10 queda un micro-tirón cada 10 cuadros (`fps=24` descarta uno de
cada 11).

## `toast.error` lleva «Reportar a Soporte»: se envuelve UNA vez, en el Toaster (23/10/2026)

Los ~45 archivos del editor llaman `toast.error` de sonner, que dibuja su toast con su propia librería (no es un `role="alert"`
de la app, y el guardián de los avisos no lo ve). En vez de tocar los 45, `components/ui/sonner.tsx` cambia `toast.error` del
objeto de sonner —que es UNO para todos los que lo importan— por uno que agrega la acción «Reportar a Soporte» (salvo que quien
llama traiga la suya) y dura 8 s. Vale porque ese módulo lo cargan las dos raíces del editor (VideoEditorCliente y EditorVideoM)
antes de que nadie llame a `toast.error`; un archivo que use sonner FUERA del editor no lo tendría. Marca `conSoporte` para no
envolverlo dos veces con el recargado en caliente.

## Cómo está armado, en una tabla

| Pieza | Vive en | Qué decide |
|---|---|---|
| Quién lo abre | `app/video-editor/acceso.ts` | Hoy, sólo el super admin (la persona, también mirando un cliente con `?ws=`). Lo usan las dos pages y el botón de Video Generator |
| El motor | `app/video-editor/_opencut/` | OpenCut classic portado: línea de tiempo, render WebGPU, exportar con WebCodecs |
| El tema | `app/video-editor/capcut-theme.css` | La paleta medida de CapCut, encerrada en `.ce` |
| El almacenamiento | `app/video-editor/espacio.ts` | IndexedDB y OPFS con el prefijo del workspace |
| Las ranuras | `app/video-editor/ce/` | Dónde se enchufa cada función de CapCut |
| «Editar en el editor» | `app/video-editor/desde/` + `app/video-generator/editor-video.tsx` | La ref que viaja, su resolución en el server y la importación en el navegador |

Las rutas de abajo son relativas a `app/video-editor/_opencut/`, salvo las que empiezan con `app/`,
`lib/`, `tests/`, `docs/` o `proxy.ts`.

## El HEAD de OpenCut classic no compila tal cual

**Vive en:** el port entero (`_opencut/`, de `cf5e79e9`, archivado)

Al portarlo salieron **21 inconsistencias que ya estaban arriba**: funciones importadas que no existen
en ningún archivo y constructores llamados con argumentos posicionales cuando la firma ya había pasado
a un objeto. El repo quedó archivado a mitad de un refactor; no es un problema del port ni de Next 16.
Ante un error de tipos raro adentro de `_opencut/`, primero mirá si el mismo código compila en
`cf5e79e9`. No hay versión de arriba que lo arregle: lo portado es nuestro (diseño §1.3).

## El tiempo son ticks enteros, y `retime/` no sabe en qué unidad le hablan

**Vive en:** `wasm/media-time.ts` · `retime/{resolve,split,curva}.ts` y sus llamadores
(`services/renderer/resolve.ts`, `media/audio.ts`, `media/waveform-summary.ts`,
`timeline/components/portada.ts`, `commands/timeline/element/split-elements.ts`)

- **`MediaTime` es un entero de ticks con marca de tipo**: `mediaTimeToSeconds` no acepta un `number`
  suelto. Un número que ya está en ticks se pasa a segundos dividiendo por `TICKS_PER_SECOND`.
- ⚠️ **La curva de velocidad parecía «cambiar `getSourceTimeAtClipTime`», y así salía bien en unos
  llamadores y mal en otros**: el render pasa ticks; el audio, la forma de onda, las miniaturas y la
  portada pasan segundos. Con velocidad constante da igual (es una proporción); la curva vive en el 0–1
  del clip y necesita la duración en la MISMA unidad que el instante. Sin ella se lee como la velocidad
  media: exacta en los extremos (por eso duración y recortes no la necesitan) y equivocada en el medio.
  El contrato quedó en diseño §4.1.
- **Partir una curva re-normalizando sus nudos no da el mismo tramo**: «Montaje» partido al 37 % daba
  4,83 s de fuente para un tramo de 4,68 s. Cada mitad se escala para que su media dé justo la fuente
  que le toca (caso 3 de `tests/video-editor-velocidad-curva.test.ts`): lo que cierra en una división es
  la suma de fuentes, no la forma.
- **La música de la biblioteca caía fuera de lugar**: `fetchLibraryAudioClip` (`media/audio.ts`) entregaba
  ticks donde el resto del audio espera segundos. El tipo no lo frena porque los dos son `number`; todo
  tiempo que cruza de `media/` al audio-manager se mira en qué unidad viene.

## Velocidad: el tono por defecto es el contrario, y 1× no guarda nada

**Vive en:** `speed/components/speed-tab.tsx` · `retime/rate.ts` (`shouldMaintainPitch`) ·
`core/managers/audio-manager.ts` (`shouldUsePreparedClipBuffer`)

OpenCut cambia el tono salvo `maintainPitch: true`; CapCut lo conserva por defecto (`is_tone_modify:
false`). Y un retime a 1× con `maintainPitch` hacía que el audio-manager decodificara el clip ENTERO en
memoria para reproducirlo igual. Una velocidad nueva se guarda con `maintainPitch: true` y a 1×
conservando el tono no se guarda retime. Un proyecto viejo con retime sin `maintainPitch` muestra
«Cambiar tono del audio» PRENDIDO, porque ahí el tono sí cambia.

## Los efectos se aplican en el descriptor del cuadro, no en `applyEffect`

**Vive en:** `services/renderer/compositor/frame-descriptor.ts` · `services/renderer/gpu-renderer.ts` ·
`services/renderer/effect-preview.ts` · `rendering/index.ts` · `services/renderer/resolve.ts`

⚠️ **El diagnóstico obvio era el equivocado.** `gpuRenderer.applyEffect` parece «el lugar donde se
aplican los efectos», y sólo lo usan las miniaturas (`effect-preview.ts`). El render real arma el
`FrameDescriptor` y le manda los pases al WASM **adentro** del descriptor de cada capa. Un efecto
enchufado en `applyEffect` se ve en la tarjeta de la biblioteca y no en el reproductor ni en el MP4. Por
eso los pases `ce-*` (diseño §1.4) se separan en `frame-descriptor.ts`. De ahí:

- **Toda textura que llega al compositor pasa por la separación `ce-*` / WASM**: las fuentes con
  `preaplicarPasesCe` y las dibujadas (el texto) con `envolverDibujo`, sumando los pases al hash.
  `collectTextNode` le pasaba al WASM todos los grupos del texto, el WASM no conoce los `ce-*`, y un
  filtro soltado sobre un texto podía dejarlo sin dibujar.
- **El WASM trae exactamente 17 modos de mezcla** (la cadena `normal…luminosity` adentro de
  `opencut_wasm_bg.wasm`; no hay `linear-burn`). Un modo inventado no da error: `readBlendModeFromParams`
  cae callado a `normal`. Un modo nuevo exige el compositor de Rust; un pase `ce-*` no alcanza porque
  necesita el fondo.
- **El croma corre primero por algo que no se ve**: el cuentagotas elige el color del ORIGINAL. Con un
  ajuste o un filtro antes en `element.effects`, el croma comparaba contra el color ya corregido y no
  recortaba nada (`resolveEffectPassGroups`).

## Un shader `ce-*` roto no falla: el efecto «no hace nada»

**Vive en:** `services/renderer/pases-ce.ts` · `effects/glsl.ts` (`CABECERA`) · `effects/definitions/*` ·
`effects/lut/leer-lut.ts`

`pases-ce.ts` atrapa a propósito el error de compilación para que la reproducción siga: el cuadro sale
sin el efecto y el error queda sólo en la consola. Cuatro formas de que un pase falle sin avisar:

- **Un uniform con un nombre de la cabecera.** El «Giro» del Remolino se mapeaba a `u_giro`, que la
  cabecera ya declara: «redefinition», y el Remolino no hacía nada. Los nombres reservados están en la
  cabecera de `pases-ce.ts`; los frena `tests/video-editor-color.test.ts`.
- **Un `sampler3D` sin unidad propia.** En WebGL2 dos samplers de tipos distintos no pueden apuntar a la
  misma unidad, y uno sin asignar apunta a la 0, donde está la imagen: sin LUT elegida, `INVALID_OPERATION`
  en el draw. `ce-ajuste` manda `u_lut` siempre (0 = identidad 2³) y `pases-ce` lo enlaza en la unidad 2.
- **Un uniform que no se manda HEREDA el valor de la vuelta anterior** (quedan guardados en el
  programa). Lo que un pase no manda tiene que poder heredar sin daño, o `pases-ce` lo resetea. Los de
  las transiciones (`transiciones/shaders.ts`) mandan TODOS sus uniforms en cada vuelta.
- **`smoothstep` con los dos bordes iguales no está definido en GLSL**: cada GPU devuelve lo que quiere.
  Un borde suave de ancho 0 (un barrido sin difuminado) no se deja llegar a 0 (`u_suavidad` en
  `transiciones/shaders.ts`).

Y uno de rendimiento de la misma familia: el hash de una textura dibujada incluye los uniforms, y
`u_tiempo` cambia en cada cuadro. Mandado a un filtro quieto, el texto y el fondo de abajo se
redibujaban siempre. `u_tiempo` va sólo a lo que se mueve (`animado`, o filtros con grano).

**Validar un shader sin navegador** (no hay validador de GLSL ES en el repo ni en la máquina): volcar los
fragments con `shadersRegistrados()` corriendo `node --import tsx` sobre los archivos de definiciones
SOLOS (`effects/definitions/index.ts` arrastra `opencut-wasm` y node no carga el `.wasm`), cambiar
`#version 300 es` por `#version 330 core`, sacar los `precision` y compilar con moderngl (`pip install
--target`). Así salió el Remolino. El GL de escritorio es MÁS permisivo —convierte solo los enteros a
float y GLSL ES no—, así que los enteros en contexto float se buscan a mano.

Y los `.3dl`: con una malla chica (N = 3) la línea de la malla tiene 3 números, igual que un punto, y
buscarla como «la primera con más de 3» tiraba «no compatibles». La primera línea numérica ES la malla;
el `.3dl` lista con B variando más rápido y la textura 3D espera R (se reordena), y nada de
`Math.max(...arr)` con 33³·3 elementos: revienta la pila.

## Un efecto de capa repartido a las capas no puede salir de la suya

**Vive en:** `services/renderer/compositor/repartir-ce.ts` · `pases-ce.ts` (`registrarPase({ desplaza })`)

⚠️ **Diagnóstico obvio y falso:** «repartir el pase de una capa de efecto a las capas de abajo da lo
mismo que aplicarlo al cuadro compuesto». Corrido con una capa en la mitad izquierda de un lienzo de
128×64, el Espejo dejaba la mitad derecha VACÍA: una capa sólo pinta adentro de su recuadro, así que lo
que un efecto MUEVE (zoom, sacudida, espejo, caleidoscopio, un brillo que se derrama) no puede salir.
Lo de color y de posición (viñeta, grano) sí da lo mismo en coordenadas del lienzo. Un pase que mueve
contenido o lee vecinos lejanos se registra con `desplaza: true`: cada capa de abajo se dibuja antes en
una textura del tamaño del lienzo y pasa a ocupar el cuadro entero.

## Todo se mide en píxeles del LIENZO: la resolución se cambia escalando, no achicando el renderer

**Vive en:** `services/renderer/compositor/frame-descriptor.ts` (`computeVisualTransform`) ·
`services/renderer/scene-exporter.ts` · `canvas/escala-salida.ts` · `text/typography.ts` ·
`commands/timeline/element/insert-element.ts`

Las posiciones son `renderer.width/2 + position.x` en píxeles del lienzo del proyecto, y el renderer no
escala nada: sólo encuadra con `containScale`. Dos veces el diagnóstico obvio fue el equivocado:

- **Exportar a 720p/2K/4K «renderizando al tamaño de salida»** corre los elementos y cambia las
  proporciones. El render va SIEMPRE al tamaño del lienzo y lo que cambia es el archivo, con el
  `transform: {width, height, fit: 'fill'}` de mediabunny. Por eso 2K y 4K interpolan (ver «sin hacer»).
- **Bajar la resolución del reproductor «con un renderer más chico»** corre todo igual. Se escala el
  `FrameDescriptor`: el compositor muestrea con UV normalizadas (se ve en el WGSL que trae el `.wasm`) y
  lo único que mide en píxeles de salida es el `u_sigma` del desenfoque. Un pase del WASM nuevo con
  uniforms en píxeles de salida se suma a `escalarPases`; los `ce-*` no, porque corren sobre la fuente.

El texto tampoco es absoluto: `fontSize` es relativo al ALTO del lienzo (÷90) y el relleno del fondo se
multiplica por fontSize/15. Con números fijos un subtítulo vertical salía casi el doble que uno
horizontal; se calcula desde el lado corto, en px, y se convierte (`subtitles/estilos.ts`). Las
plantillas de texto cayeron en lo mismo en la tanda 3 (casi al doble en 9:16): `paramsParaLienzo`
(`text/estilos-predefinidos.ts`) las escala por el lado corto. Todo tamaño de texto que se escriba fijo
pasa por una de esas dos.

Y el lienzo lo fijaba el PRIMER clip visual, siempre: elegir 9:16 y agregar un clip 16:9 volvía a 16:9.
En CapCut eso pasa sólo con «Original»: manda el primer clip si `settings.relacion` está vacío o es
`'original'`, y el tilde de «Relación» se deduce del lienzo real (`relacionActual`), porque el tamaño
también cambia desde deshacer.

## El compositor es UNO, su canvas es el del reproductor, y compara por IDENTIDAD

**Vive en:** `services/renderer/compositor/wasm-compositor.ts` (singleton, `syncExternalTexture`) ·
`preview/components/index.tsx` · `export/exportar.ts` (`refrescarReproductor`)

- **Después de exportar, sacar la portada o generar una miniatura, el reproductor queda mostrando otro
  cuadro** (quizá de otro tamaño) hasta que se mueve el cabezal: el canvas del compositor ES el montado
  en el reproductor, y el reproductor sólo redibuja si cambia el número de cuadro o la identidad del
  árbol de render. Todo render con `CanvasRenderer` fuera del reproductor termina con
  `refrescarReproductor(editor)`.
- **Un gancho de fuente que devuelve siempre el mismo lienzo congela un VIDEO en su primer cuadro** (con
  una imagen no se nota): el compositor decidía re-subir por identidad del objeto, no por contenido.
- ⚠️ **Y «los cuadros normales se salvan porque el `CanvasSink` rota 3 lienzos» era FALSO** (medido el
  11/10 en Chrome): saltar un MÚLTIPLO de 3 cuadros devuelve el mismo lienzo con otro contenido, así que el
  reproductor mostraba un cuadro viejo al mover el cabezal 1 s, y a Velocidad 3× el MP4 salía CONGELADO
  desde 0,67 s (lo delató `ffmpeg -vf freezedetect`, y desapareció al prender el arreglo). Ahora una textura
  externa lleva `version` (el timestamp del cuadro) y el compositor compara identidad Y versión
  (`compositor/textura-vigente.ts`). El fondo desenfocado tenía la misma trampa. Lo cuida
  `tests/video-editor-motor.test.ts`.

## Todo rojo en el reproductor: el WASM achicaba el canvas que comparte con él

**Vive en:** `services/renderer/gpu-renderer.ts` · `services/renderer/compositor/wasm-compositor.ts`

- **Al agregar «Glitch» como capa, el reproductor quedaba de un solo color (rojo)**. ⚠️ El diagnóstico
  obvio —el reparto de los pases `ce-*` a las capas o las uniforms de espacio— era el EQUIVOCADO: la
  textura salía bien del reparto. Lo que pasaba: con sólo ABRIR Biblioteca › Efectos, la miniatura de
  «Desenfoque» (el único efecto que no es `ce-*`) llamaba a `applyEffectPasses` del WASM, que dibuja en SU
  canvas y lo deja de 160×160 — y ese canvas es el mismo que el compositor monta en el reproductor.
  `ensureInitialized` sólo miraba el tamaño anotado en JS, así que el cuadro siguiente de 1280×720 se
  dibujaba en 160×160: se veía la esquina de arriba a la izquierda estirada, que en las barras de prueba
  es la roja. Se detectó espiando el setter `width` del canvas.
- **Regla:** nada del editor llama a `applyEffectPasses` ni a `applyMaskFeather` fuera del compositor (la
  miniatura del desenfoque va con el `filter: blur()` del canvas 2D), y el compositor compara contra el
  tamaño REAL del canvas. Lo cuida el test.
- **Y «Desenfoque» como capa tiraba `missing field effect_pass_groups` en cada cuadro y congelaba el
  reproductor hasta recargar**: el `serde` de opencut-wasm 0.2.10 espera la variante `SceneEffect` en
  snake_case y la capa en camelCase (salió de las cadenas del `.wasm`; venía así de OpenCut), y la promesa
  de render no tenía `catch`, así que la marca de «render en curso» quedaba prendida. La frontera con el
  WASM se traduce en `paraElWasm` (`wasm-compositor.ts`); un render que falla nunca deja la marca prendida.

## Los ganchos `ce-*`: el orden decide, y todo gancho devuelve el estado ENTERO

**Vive en:** `services/renderer/ganchos-ce.ts` · `recorte/ganchos.ts` · `fondo/recorte-persona.ts` ·
`animaciones/{gancho,calcular}.ts` · `transiciones/{gancho,catalogo,escena}.ts` ·
`services/renderer/{resolve.ts,compositor/frame-descriptor.ts}`

Los ganchos corren en fila por `orden`. Los de FUENTE tocan el cuadro antes de que llegue al compositor
(recorte 10, quitar fondo 20); los VISUALES, la transformación, la opacidad y los pases de la capa
(animación 100, reflejo 1000, transiciones 1100). El contrato está en el diseño §4.1; lo que no se ve:

- ⚠️ **Los barridos sobre un clip reflejado iban al revés, y «la máscara está mal» era falso**: los pases
  de la transición corren sobre la FUENTE, antes de que el compositor la voltee y la gire, así que «hacia
  la derecha» en pantalla es hacia la izquierda en un clip reflejado. Un pase con dirección recibe la de
  pantalla llevada a la capa con el signo FINAL de la escala y el giro (`direccionEnCapa`,
  `transiciones/catalogo.ts`). Por eso las transiciones van últimas y sólo multiplican la escala por
  positivos.
- **Un gancho visual que rearma el estado como `{ transform, opacity }` tira los `pases` que sumó otro**:
  le pasaba a `aplicarPose` (`animaciones/calcular.ts`). Hoy no se ve porque la animación (100) corre
  antes que las transiciones (1100), que son las que suman pases; aparece el día que alguien reordene o
  sume un gancho después. Todo gancho visual devuelve `{ ...estado, … }`.
- **Las puntas son la identidad, o el clip salta**: una transición en p = 0 y p = 1, y una animación
  Combinada o en Bucle al empezar y al terminar cada vuelta, dejan el cuadro EXACTAMENTE como estaba.
  «Latido» terminaba en escala 1,0000015 porque una campana de Gauss nunca llega a 0: se multiplica por
  una ventana sin(π·fase). Sólo se nota reproduciendo, como un salto al entrar o salir del tramo (tests 1
  y 2 de `tests/video-editor-animaciones.test.ts`, test 1 de `tests/video-editor-transiciones.test.ts`).
- **Con una transición el clip se dibuja también fuera de su rango** (la ventana va centrada en el corte).
  «Fuera del clip» se chequeaba en dos lugares (`resolveVisualState` y `resolveVideoNode`) y los dos
  pasaron a `fueraDeVentana` (`transiciones/escena.ts`); el gancho recibe el instante sin acotar en
  `ContextoVisual.tiempoClip`. El fondo «Lienzo con desenfoque» quedó con el chequeo viejo (ver «sin
  hacer»).
- **Un gancho de fuente que necesita bajar algo no puede ser síncrono**: los primeros cuadros del export
  salían sin recortar porque el modelo de quitar fondo todavía bajaba. Lo que hay que esperar se espera
  DENTRO del render (`preparar(ctx)`, esperado en `frame-descriptor.ts`), y toda espera lleva tope (2 min,
  `fondo/segmentador.ts`): un CDN que no contesta dejaría el reproductor y el export parados para siempre.

El otro de los ganchos de fuente —devolver siempre el mismo lienzo congela un video— está en «El
compositor es UNO».

## Decodificar: un decodificador por clave, y fuera del reproductor nunca el `videoCache`

**Vive en:** `services/video-cache/service.ts` · `timeline/components/miniaturas.ts` · `recorte/cuadro.ts` ·
`retime/revertir.ts` · `transiciones/{escena,claves}.ts` · `commands/media/remove-media-asset.ts`

El `videoCache` es del reproductor: UN decodificador por medio, con los pedidos numerados por
«generación». Un pedido de la línea de tiempo (miniaturas) o de un comando (Congelar, el diálogo de
Recortar) invalida el cuadro que espera el reproductor o le salta el decodificador: la reproducción
tartamudea o la imagen salta. Los cuadros fuera del reproductor salen de un `Input` y un `CanvasSink`
de mediabunny PROPIOS, que se cierran con `dispose`.

Adentro del reproductor pasa lo mismo con el MISMO video a los dos lados de un corte (dividir y poner una
transición, el caso común): en la ventana los dos clips piden cuadro a la vez, uno pierde la generación
y muestra el cuadro del otro. Dos nodos que piden cuadros del mismo video en el mismo instante usan
claves distintas (`claveDecodificadorTransicion` → `${mediaId}#transicion`), y quien suelte los
decodificadores de un medio suelta también ése (`remove-media-asset.ts`). Y las trampas de mediabunny:

- **Con `poolSize` recicla sus lienzos en anillo**: guardar cuadros para codificarlos después
  (Revertir) da N veces el último. Para guardar, `poolSize: 0`, con la ventana calculada por memoria
  (~200 MB): a 1080p son 8 MB por cuadro, unos 15 GB por minuto.
- **`canvasesAtTimestamps` devuelve `null` antes del primer cuadro**, y muchos videos empiezan en
  0,033 s. Cada `null` dejaba el pedido sin caché, el aviso de «llegaron cuadros» redibujaba y se volvía
  a pedir: decodificación en bucle. Se pide con `max(t, getFirstTimestamp())` y se recuerdan los pedidos
  sin cuadro o con error.
- **En el final EXACTO del video tampoco hay cuadro**, y una transición lo pide (sin material recortado,
  el clip de la izquierda se queda en su último cuadro): se pide 1 ms antes (`acotarFuente`,
  `transiciones/escena.ts`).
- **`Output` pierde el tipo del target** si la variable se declara `Output | null` («Property 'buffer'
  does not exist»): se guarda la referencia al `new BufferTarget()` y se lee `.buffer` de ella.

## Lo que el navegador y mediabunny contestan mal

**Vive en:** `media/processing.ts` · `export/opciones.ts` (`cadenaAvc`) · `media/audio.ts`

- **Un `.webm` de audio (Opus extraído, una grabación) puede dar `duration = Infinity`** en el `<audio>`
  si la cabecera no trae la duración, y el clip quedaba infinito. Se valida con `Number.isFinite` y, si
  no, se mide el contenedor con mediabunny (`Input.computeDuration`).
- **H.264 a 1080p60 (o 4K60) puede fallar en un codificador estricto**: `buildVideoCodecString` elige
  el nivel AVC sólo por tamaño, sin mirar los fps, y a 1080p60 le da 4.0 (tope 245.760 macrobloques/s;
  hacen falta 489.600). Se pasa un `fullCodecString` con el nivel calculado con los fps, confirmado con
  `canEncodeVideo(…, {fullCodecString, frameRate})`, y si no lo acepta se vuelve a la de mediabunny.
- **Un `AudioContext` que no se cierra se acumula, y Chrome topea los contextos vivos**:
  `decodeAudioToFloat32` dejaba uno por llamada, y cada export creaba otro que nunca se cerraba y
  decodificaba N veces un archivo partido en N clips. Para decodificar o remuestrear, `OfflineAudioContext`
  o cerrar en un `finally`, y una decodificación por archivo (`createTimelineAudioBuffer`, `media/audio.ts`).

## La vista previa del motor: `previewElements` reemplaza `params` entero y no pasa por el pipeline

**Vive en:** `core/managers/timeline-manager.ts` (`previewElements`, `applyPreviewOverlay`,
`commitPreview`, `getTrackById`) · `timeline/update-pipeline.ts`

La vista previa mezcla `{...element, ...cambio}` por campo de PRIMER nivel, y `commitPreview` guarda con
`command.push()` un snapshot ya aplicado. Cuatro bugs en cuatro paquetes salieron de ahí:

- **`params` se reemplaza entero.** Arrastrar la línea de volumen dejaba `params = {volume}` (sin
  silencio ni fundidos) y `commitPreview` lo guardaba así; dos `previewElements` seguidos (X y después
  Y) dejaban sólo el segundo. Todo `previewElements` que toca params pasa `params: { ...element.params,
  clave }`, y varios params van en UNA llamada (`useParamsConFotogramas.construir()`). Con comandos no
  se nota porque `UpdateElementsCommand` sí mezcla.
- **No recalcula campos derivados.** Previsualizar `{retime}` no movía el largo del clip y
  `commitPreview` dejaba la duración vieja. Se previsualiza `{retime, duration}` con la duración
  calculada (`duracionConRetime`) y se confirma con `discardPreview()` y un comando que pase por
  `applyElementUpdate` (`CambiarVelocidadCommand`). Nunca `commitPreview` con campos derivados.
- **El panel no ve la vista previa.** `getElementsWithTracks → getTrackById` lee la escena CONFIRMADA:
  al arrastrar un número el valor no se movía hasta soltar. Lo que se MUESTRA sale de
  `useElementPreview`; lo que se ESCRIBE parte del confirmado, para que arrastrar no acumule.
- **`onCommit` en cada blur.** `CajaNumero` confirma en todo blur, cambie o no: entrar y salir sin tocar
  aplicaba la velocidad vieja guardada en un ref y sumaba un paso de deshacer. Una confirmación que lee
  un valor pendiente confirma sólo si `editor.timeline.isPreviewActive()`.

Y del lado de los comandos, al revés: **`UpdateElementsCommand` MEZCLA los params, así que omitir una
clave no la borra.** «Ninguno» o cambiar de plantilla de subtítulos dejaba el halo de la anterior.
Sacar algo es ESCRIBIR su valor apagado: quitar una transición pone los defaults de `transicion.*`, y
`SIN_EFECTO` y toda plantilla escriben todos los interruptores de apariencia, apagados los que no usan
(`text/estilos-predefinidos.ts`).

## El imán de CapCut no es el ripple de OpenCut, y va en `updateTracks`

**Vive en:** `ripple/iman.ts` · `core/managers/commands.ts` · `actions/use-editor-actions.ts`
(`delete-selected`) · `timeline/components/track-layout.ts`

⚠️ **Diagnóstico obvio y falso: «el ripple de OpenCut es el imán, sólo hay que renombrarlo».** El ripple
corre los clips de TODAS las pistas por intervalos liberados, y mover un clip a la derecha no cierra el
hueco. El imán sólo empaqueta la pista principal; lo de encima sigue a su clip sólo con «Vinculación».
Son dos interruptores, como en la barra de CapCut.

- **El ripple vivía en `CommandManager.execute/redo`**, y todo lo que pasa por `previewElements →
  commitPreview` (velocidad, volumen, cualquier edición en vivo del panel) se lo saltaba. Una regla que
  vale para TODO cambio de pistas va en `timeline.updateTracks`, el único lugar por donde pasan
  comandos, deshacer y `commitPreview`: idempotente, y devolviendo el mismo objeto si no cambió nada.
- **Desde `updateTracks` un borrado y un deshacer se ven iguales** (un clip de la principal que deja de
  existir): borrar ahí lo vinculado habría borrado textos al DESHACER una inserción. Lo destructivo va
  en la ACCIÓN de borrar; en el hook sólo se corre lo que el cambio no tocó.
- Y una de geometría: la principal es más alta que una superposición del mismo tipo, así que todo
  cálculo vertical nuevo de la línea de tiempo recibe el id de la principal, o coincide con el dibujo en
  todas las filas menos en la más grande.

## Dividir y borrar: lo que va pegado a un borde se queda de su lado

**Vive en:** `commands/timeline/element/{split-elements,delete-elements}.ts` · `animaciones/reglas.ts` ·
`transiciones/reglas.ts` · `audio/claves.ts`

Un clip lleva cosas pegadas a su principio o a su final, y al dividirlo las dos mitades las copiaban
enteras:

- **Los fundidos de audio**: las dos mitades conservaban los dos y el volumen bajaba y subía en el
  corte. La izquierda se queda con la aparición y la derecha con la desaparición.
- **Las animaciones**: igual, la Entrada en la izquierda y la Salida en la derecha.
- **La transición vive en el clip de la IZQUIERDA del corte**: si la mitad izquierda la conservara,
  aparecería en el corte nuevo. Y al BORRAR un clip, su vecino izquierdo la pierde: el imán cerraría el
  hueco y se la pasaría al clip siguiente.

Todo param nuevo que dependa de un borde del clip se reparte en `split-elements.ts` (la fila de `sin…`
de `leftParams`) y se revisa en `delete-elements.ts`. «Recuperar audio» todavía no lo cumple (ver «sin
hacer»).

## El teclado: `actions/` escucha en captura y le gana al reproductor

**Vive en:** `actions/use-keybindings.ts`, `actions/definitions.ts`, `actions/keybindings-store.ts` ·
`preview/atajos-reproductor.ts`, `preview/navegacion.ts` · `timeline/hooks/use-timeline-playhead.ts`

`actions/` escucha en `document` en CAPTURA y hace `preventDefault` para TODA tecla atada, tenga handler
o no; el reproductor escucha en `window` en burbuja y respeta `defaultPrevented`. Con los defaults de
OpenCut, Shift+→ saltaba 5 s en vez de 10 cuadros, J/L buscaban ±1 s y Enter iba al inicio, aunque el
reproductor ya tenía hechas las teclas de CapCut.

- **Una tecla va en el preset de `actions/` sólo si alguien ata su acción**; las del reproductor
  delegan en `preview/navegacion.ts`. Pantalla completa, zoom y guías del reproductor no van en el preset.
- **Una acción con atajo y sin `useActionHandler` no hace nada y no avisa**: Ctrl+I figuraba en el
  diálogo de Atajos y no abría nada. Al integrar, cada entrada de `ACTION_DEFAULT_SHORTCUTS` tiene su
  handler o un listener propio documentado (Ctrl+E y Ctrl+Alt+Q los escucha la barra superior; si además
  se atan en `actions/`, disparan dos veces).
- **Ctrl++ no se puede escuchar por `event.code` en un teclado latino**: en LatAm `Equal` es la tecla
  ¿¡ y `Minus` el apóstrofo. `[` `]` `;` `,` `.` y el acento grave van por `event.code` (posición, como
  CapCut); + y - por `event.key` o el teclado numérico, guardadas como «=» y «-» y mostradas «Ctrl++».
- **Mover el cabezal por código con `setScrubbing(true)`** («imagen sin sonido») hace que la línea de
  tiempo se desplace sola: prende el auto-scroll de la regla, que sigue la última posición del mouse
  aunque ya no esté ahí. Por código se hace `seek` con la reproducción en pausa (el audio-manager corta
  el sonido); `setScrubbing` es sólo para el arrastre con el mouse.

## Las ranuras y los ids por string no avisan de nada

**Vive en:** `app/video-editor/ce/ranuras.ts` (`class Ranura`) ·
`components/editor/panels/properties/{registry.tsx,respaldo.ts}` ·
`preview/components/preview-interaction-overlay.tsx` · `timeline/components/timeline-element.tsx`

- **Registrar el mismo id REEMPLAZA**, también desde otra pestaña: cada ranura es un `Map` por `id`
  (pensado para el HMR). Los ids son únicos en toda la ranura: `video-basico`, no `basico`.
- **Un id que no existe cae en silencio en la primera pestaña.** La varita de efectos del clip pedía
  `"effects"` (lo que decía el contrato) y F registró `"efectos-clip"`: abría «Video». Al integrar, todo
  id que abre OTRO paquete se verifica con un grep del registro.
- **El modo máscara del reproductor cuelga de un string del panel**: entra si
  `activeTabPerType[tipo] === "masks"`. Ese id está reservado y no se renombra.
- **Los respaldos** (las pestañas genéricas hasta que el dueño registra la suya): ⚠️ la regla obvia,
  «ocultarlo si ya hay otra pestaña para el elemento», borraba el volumen del audio, porque «Velocidad»
  (I) aplica al audio y llegó antes que el «Básico» de J. Se ocultan sólo ante una pestaña con SU rótulo.
  Y en orden 900, elegir un texto abría «Texto a voz»: se abre la primera de la fila (el orden quedó en
  diseño §4.1).

## `params/extra`: todo lo declarado se dibuja, y la ruta del ◇ depende de dónde vive el parámetro

**Vive en:** `params/extra/` · `params/index.ts` · `components/editor/panels/properties/respaldo-contenido.tsx`,
`hooks/use-params-con-fotogramas.ts` · `timeline/animation-targets.ts` · `services/renderer/resolve.ts` ·
`subtitles/build-subtitle-text-element.ts` · `commands/timeline/element/atributos.ts`

- **Todo param declarado entra como CONTROL en las listas genéricas.** `subtitulo` es una marca, y el
  panel «Texto» dibujaba un interruptor que convertía cualquier texto en subtítulo. Una marca no se
  declara (como `tts`) o se excluye de toda lista genérica. Por lo mismo, el respaldo «Audio» de un
  VIDEO mostraba Reflejar y los cuatro recortes: ahora lista sólo `volume`, `muted` y `audio.*`, así que
  un param de audio nuevo lleva ese prefijo o no aparece.
- **Un elemento nuevo se arma desde el registro, no desde defaults a mano.** `buildSubtitleTextElement`
  usaba `DEFAULTS.text.element.params` escrito a mano y el subtítulo nacía SIN los params de
  `params/extra`. Va `buildDefaultParamValues(getBuiltInElementParams({ type }))`.
- **Un ◇ puede no crear nada con la UI pareciendo andar**: `resolveAnimationTarget` devuelve `null` si la
  ruta no corresponde. Param del registro → su clave; de una forma o de una capa de efecto →
  `params.<clave>` (y el render los resuelve con `resolveGraphicParamsAtTime`: antes pasaba los params
  fijos); de un efecto del clip → `effects.<id>.params.<clave>`. Fuera del registro se pasa `ruta` a
  `CampoParam` y el param lleva `read`/`write`.
- **El ↺ de un param con `write` propio** parchaba sólo `params`, y el valor de un efecto del clip vive
  en `element.effects`: quitaba los fotogramas y dejaba el valor. Un parche que sale de un `write` lleva
  también el campo que ese `write` cambia.
- **«Pegar atributos» copia lo declarado, y SÓLO eso**: `audio.normalizar` viajaba sin su medida
  (`audio.intensidad`, sin declarar) y en el otro clip la casilla quedaba marcada sin efecto. Lo que
  depende del ARCHIVO del clip (una medida, los ritmos, una marca como `audio.extraidoDe`) no se declara,
  ni la casilla ni su dato.
- **`coerceParamValue` (`params/index.ts`) descarta EN SILENCIO el id de un select que no está en sus
  `options`**: un predefinido con un id fuera de la lista no se aplica, sin error. Cada preset es una
  opción de su selector (test 5 de `tests/video-editor-animaciones.test.ts`).

## El tema vive en `.ce`: portales, pantalla completa, z-index y `hsl(var())`

**Vive en:** `app/video-editor/{portal.ts,VideoEditorCliente.tsx,capcut-theme.css}` ·
`preview/hooks/use-pantalla-completa.ts` · `components/ui/{select,dropdown-menu,dialog}.tsx` ·
`guides/reglas.tsx`

Los tokens viven en `.ce` y en ningún otro lado. Lo que se dibuja afuera sale sin colores y sin error:

- **Los portales de radix montan en `<body>`**: menús, popovers y diálogos salían transparentes. De ahí
  el contenedor `#ce-portal` adentro de `.ce` (la regla, diseño §3.4).
- ⚠️ **«La pantalla completa ya está, OpenCut trae `useFullscreen`»**: con `requestFullscreen` sobre el
  PANEL, los menús de Relación, resolución y zoom se abrían invisibles, porque sólo se pinta el
  subárbol elegido y `#ce-portal` queda afuera. Pasa a pantalla completa la raíz `.ce` y el panel se
  agranda con CSS (`fixed inset-0`, z por encima de las capas de la línea de tiempo —llegan a 40— y por
  debajo de los menús, z-50). Es la trampa de `hallazgos-second-brain.md` → «La pantalla completa mata
  el portal», otra vez.
- **Un Select o un menú adentro de un Dialog se abre DEBAJO**: van al mismo portal con z-50 de fábrica y
  el Dialog usa z-250. Exportar lo había parchado sólo en su diálogo con `className='z-300'`, y en Recortar
  la «Relación de aspecto» no se podía elegir (la lista se abría invisible): ahora z-300 es el valor POR
  DEFECTO de `components/ui/select.tsx`. Un parche en el lugar donde se vio no arregla el patrón.
- **`hsl(var(--x))` es CSS inválido en el port**: los tokens de OpenCut eran tripletes HSL; en `.ce` son
  hex, `hsl(#262626)` no vale y queda transparente (los marcadores se dibujaban sin fondo). Se buscan con
  `grep "hsl(var"`; ya no queda ninguno, y lo vigila `tests/video-editor-tema.test.ts` (13/10).
- **Un `<canvas>` posicionado con `left` + `right` mide 300 px**: es un elemento reemplazado y toma su
  ancho de fábrica. Lleva `width` y `height` explícitos.

## React y los stores del motor: cinco trampas y el lint

**Vive en:** `editor/use-editor.ts` · `preview/preview-store.ts` · `guides/lineas-guia.tsx` ·
`components/editor/editor-header.tsx`, `inicio/projects-page.tsx` ·
`components/editor/panels/properties/index.tsx` · `eslint.config.mjs`

- **Un selector de `useEditor` que arma un objeto re-dibuja sin fin**: compara con `Object.is`, y
  `settings.canvasSize ?? {width, height}` sin proyecto colgaba la portada. Devuelve primitivos,
  referencias del estado o arrays de primitivos.
- ⚠️ **«Para sumar un campo a un store persistido de zustand, subo la versión»: eso BORRA lo guardado.**
  Al cambiar la versión pasa por `migrate`, que en `preview-store` devuelve sólo lo que conoce. Los
  campos opcionales nuevos se suman a `partialize` sin subir la versión; se sube sólo si cambia la forma
  de un campo existente, y entonces `migrate` conserva todo.
- **Los eventos de React burbujean por el árbol de REACT, no por el DOM**: el `pointerdown` de un menú en
  portal llega al `onPointerDown` del elemento que lo envuelve, y un clic en «Editar guía» arrastraba la
  guía hasta el menú (visto leyendo el código). Se filtra con `event.currentTarget.contains(event.target
  as Node)` o se corta la propagación alrededor del portal.
- **Abrir un Dialog desde el `onSelect` de un menú de radix** puede dejar `pointer-events: none` pegado
  en `<body>` (problema conocido de radix; acá no se reprodujo, va de prevención): se abre con
  `setTimeout(…, 0)`.
- **La cáscara del panel derecho pone `${element.id}:${pestaña}` en la key**: cambiar el elemento
  DESMONTA la pestaña. Una pestaña que cambia la selección (la lista de subtítulos) guarda afuera del
  componente lo que tiene que sobrevivir: foco, búsqueda, scroll.

Y el lint: **`react-hooks/set-state-in-effect` es ERROR**, también sobre el código original de OpenCut,
que inicializa estado copiándolo en efectos. El estado inicial va en `useState(() => …)`, lo derivado en
`useMemo`, lo que puede fallar hace el `setState` adentro del `.then/.catch`, y el estado de un diálogo
que depende de abrirse va en un hijo del Portal (se monta sólo abierto). Ningún hook lo frena en el push.

## El almacenamiento es por ORIGEN: el prefijo del workspace y el guardado que llega tarde

**Vive en:** `app/video-editor/espacio.ts` · `services/storage/service.ts` · `editor-page.tsx` ·
`core/managers/{project-manager,save-manager}.ts` · `inicio/{nombre,tamano}.ts`

IndexedDB y OPFS son por origen, y el super admin abre varios clientes con `?ws=` en el mismo navegador:
sin el prefijo se mezclan sus proyectos (la decisión, diseño §1.5). Lo que no se ve:

- **El prefijo se lee en CADA apertura, no en el constructor**: `storageService` es un singleton creado
  al importar el módulo, antes de que se sepa el workspace.
- **Un guardado en el cleanup del desmontaje escribiría en el workspace NUEVO**: `VideoEditorCliente`
  llama a `fijarEspacio(ws)` DURANTE el render, y el cleanup del árbol viejo corre después, en el commit.
  Todo guardado en un cleanup compara `conEspacio('')` del montaje con el del cleanup y no escribe si
  cambió. **Sin verificar:** el debounce de 800 ms del `SaveManager` puede tener el mismo agujero.
- **`getSavedProjects()` desde el editor da `[]`**: esa lista la carga sólo el inicio, y llamar a
  `loadAllProjects` desde el editor pone el ProjectManager en «cargando», con lo que `saveNow` deja de
  guardar. Para nombres o metadata desde el editor, `storageService.loadAllProjectsMetadata()`, que sólo
  lee.
- **El peso de un proyecto no está en su metadata**: se suma del `size` de cada medio en la base
  `video-editor-media-<id>` (almacén `media-metadata`, con prefijo) con `IndexedDBAdapter.getAll()`, sin
  abrir OPFS, y se cachea por proyecto y `updatedAt`.

## Quién ve la tab: `adminOnly` en las familias y la capa del super admin

**Vive en:** `app/_components/Sidebar.tsx` (`puedeVer`) · `lib/capas.ts` (`CAPAS.superadmin.navKeys`) ·
`app/video-editor/acceso.ts`

- **`adminOnly: true` no escondía nada en una tab de producto**: el Sidebar sólo lo leía en `USER_NAV`;
  las FAMILIAS pasan por `puedeVer`, que miraba rol y capa. Ahora exige `!it.adminOnly || rol ===
  'admin'`. Igual es cosmético: la puerta es `requireEditorVideo()` en las pages y `veEditorVideo` en
  cada ruta `/api` (tests 1b–1d de `tests/video-editor-integracion.test.ts`).
- **El super admin no lo ve en SU workspace**: la capa `superadmin` tiene `navKeys` explícitas sin
  `video-editor` (ni `video-generator`), así que `tabEnCapa` la filtra y `requireCapa` rebota la page. Se
  prueba adentro de un cliente con capa completo/agencia (ws3).

## «Editar en el editor»: la importación termina ANTES de montar el editor

**Vive en:** `app/video-editor/desde/` (`ImportarDesde.tsx`, `desde.ts`, `resolver.ts`) ·
`app/video-editor/VideoEditorCliente.tsx` · `components/providers/editor-provider.tsx`

⚠️ **El diagnóstico obvio era pasarle `?desde=` a `EditorPage`, y se perdía**: con un id que no existe,
el `EditorProvider` crea el proyecto y hace `router.replace` a una URL sin el query; encima, su
`loadProject` limpia medios y escenas mientras la importación corre. Por eso, mientras haya `desde`,
`VideoEditorCliente` dibuja `ImportarDesde`: bajar → crear → importar → insertar → guardar → replace
sin `?desde=`.

- **StrictMode corre el efecto, lo limpia y lo vuelve a correr**: con un pestillo por ref que además
  cancela en el cleanup, la primera corrida queda cancelada y la segunda frenada (no importa nunca); sin
  pestillo salen dos proyectos. Pestillo por ref SIN cancelar, más un mapa de módulo con la promesa en
  vuelo por espacio+ref.
- **El mp4 público de Supabase no necesita una ruta proxy**: medido con curl el 11/10 con Origin
  `https://hola-mako.com`, 206 con `Access-Control-Allow-Origin: *` y el preflight con `range` en 200. Si
  el bucket deja de ser público o cambia su CORS, el síntoma es «error en la red».
- **«Anuncios terminados» no son montajes**: salen del setting `video-generator.anuncios` (cargado a mano,
  con URLs estáticas del repo; el 11/10 existe sólo en el ws1). Por eso la ref `anuncio:<id>`, resuelta en
  el server. NO se sumó a `lib/creativo-mako.ts`: ampliaría lo que Ads Manager acepta subir a Meta.

## El proxy y `public/`: un 200 puede ser la página de login

**Vive en:** `proxy.ts` (`config.matcher`) · `app/video-editor/desde/ImportarDesde.tsx` (`bajar`)

El matcher exime de la sesión sólo algunas extensiones. Sin cookie, cualquier otra cosa contesta 307 a
`/login`, `fetch` sigue el redirect y termina en **200 con HTML**:

- Los `.json` y `.avif` de `public/` (atlas de fuentes, banderas, formas): el `.json()` explotaba. Se
  eximió `public/ve/` por RUTA en el matcher. **`video-editor/` no se puede eximir**: el proxy es el
  único que valida el `?ws=` de la página.
- Los `.mp4` de `/anuncios/` y `/formatos/` (medido con curl contra `hola-mako.com/anuncios/<el que haya>.mp4`).
  Al bajar un medio se valida el `content-type` (`video/*`), no el status.

Es la familia de `hallazgos-infra.md` → «El manifest de la app estaba detrás del login».

## Subtítulos con Whisper en el navegador

⚠️ **Whisper devuelve los tiempos por palabra y el editor los TIRABA** (hasta el 15/10): `armarSubtitulos`
recibía las palabras con su tiempo y armaba cada subtítulo con texto, inicio y duración, y nada más. Por eso no
había karaoke, ni muletillas fuera del video, ni edición por transcripción, aunque la transcripción las
traía. **Regla: lo que el modelo da y cuesta volver a pedir se GUARDA con el resultado, aunque hoy no lo use
nadie.** Ahora van en `subtitulo.palabras` (`subtitles/palabras.ts`):
- relativas al **origen del recorte** (`startTime − trimStart`), no al inicio: «Dividir» corre el `trimStart`
  de la mitad derecha, así que las dos mitades ven sus palabras donde se dijeron, y mover el subtítulo las
  mueve con él;
- **cotejadas contra el texto** al leerlas: si alguien lo reescribió, no valen (null), en vez de dar tiempos
  de otro texto. Corregir una palabra sin cambiar cuántas son las conserva;
- con las **muletillas** que se sacaron del texto, marcadas: son los tiempos que hacen falta para sacarlas
  del video.
Dividir, combinar y «Buscar y reemplazar» del panel salen de la ayuda de CapCut (`pc_double_click_delete`,
`find replace`) y viven en `subtitles/editar.ts`. ⚠️ El blur que sigue a dividir NO puede confirmar lo escrito:
pisaría la mitad izquierda con el texto entero (`saltarConfirmar` en `pestana-subtitulos.tsx`, lo fija el test).

**Vive en:** `services/transcription/worker.ts` (`detectarIdioma`) · `transcription/models.ts`,
`transcription/audio.ts` (`trocearAudio`), `transcription/caption.ts` (`quitarNoVoz`) ·
`subtitles/build-subtitle-text-element.ts` (`partirYUbicar`) · `subtitles/repartir.ts` ·
`services/renderer/nodes/text-node.ts`

- **«Auto detect» (el default de OpenCut) no existe**: transformers.js 3.8 no detecta el idioma, y sin
  `language` arranca con `<|en|>` avisando sólo en la consola. Un audio en español salía traducido o mal
  escrito. Se detecta a mano con un paso del decoder sobre los logits de los tokens `<|xx|>`; sin
  detección, español.
- **`return_timestamps: 'word'` revienta** («Model outputs must contain cross attentions») con los
  `onnx-community/whisper-*` comunes, exportados sin atenciones cruzadas. Sólo los `*_timestamped`
  (medido el 11/10 en la API de Hugging Face: los cinco traen `alignment_heads`).
- ⚠️ **q4 «para que baje menos» baja MÁS**: en whisper-small el decoder pesa 233 MB en q4 contra 157 MB
  en q8. El tamaño por dtype se mide en `/api/models/<id>/tree/main/onnx`; q4 va sólo en WebGPU.
- **Con silencio o música, Whisper escribe lo que nadie dijo** («Subtítulos realizados por la comunidad
  de Amara.org», «[Música]»). No se le da silencio (se saltean los trozos con RMS < 0,005) y lo que vuelve
  se filtra contra la lista de alucinaciones.
- **El motor de texto no parte líneas**: un subtítulo lleva los saltos que le puso `partirYUbicar` al
  crearlo, medidos con SU fuente y SU tamaño, y uno largo se salía del lienzo. **El contrato «si el panel
  Texto le cambia la fuente o el tamaño, se vuelve a partir» quedó anotado acá y en el mensaje de K, no
  en la tabla del diseño §4.1, y H no lo cumplió**: cada paquete lee la tabla, no los mensajes de los
  otros. Lo cerró el integrador con `subtitles/repartir.ts` (`useRepartirSubtitulo`, enchufado en
  `text/components/pestana-texto.tsx`). Todo contrato entre paquetes va a la tabla, o no existe.
- **El primer test de trozos dio VERDE con la guarda rota** (`RMS_SILENCIO = 0`): medía «ningún trozo
  empieza después de 50,5 s» y el corte caía a los 50,02. Se mide la propiedad (ningún trozo es puro
  silencio), no un número cercano (`tests/video-editor-subtitulos.test.ts`).

## Texto a voz con la key del cliente

**Vive en:** `app/api/video-editor/tts/route.ts` · `lib/credenciales.ts` (`wsDefault`) ·
`lib/elevenlabs.ts` (`TOPE_TTS`) · `lib/elevenlabs-fallo.ts` (`textoEleven`)

- **Una ruta que lee la key sin workspace usa la de OTRO cliente**: `credDelCliente(clave)` sin ws cae en
  `getWorkspaceActual() ?? OWNER_WS`, el ws1 de Mauricio. La ruta exige el ws ANTES de tocar la key y
  corre en `runWithWorkspace(ws)`: un null del workspace no es «sin key», es «la key del ws1».
- **Un texto largo daba un audio cortado a mitad de frase, cobrado igual**: `decirConVoz` hacía
  `.slice(0, 400)` callado (pensado para una línea del onboarding). La ruta rechaza con «Se alcanzó el
  límite de caracteres».
- **Los textos de `textoEleven` mienten fuera del Video Generator**: `proveedor` promete «se reintenta
  solo» (acá nadie reintenta) y `voz_muerta` habla del CLON. La ruta pisa esos dos.

## El texto en el render: el canvas 2D no hace lo que uno supone

**Vive en:** `text/{dibujar,measure-element,revelado,estilos-predefinidos}.ts` ·
`services/renderer/nodes/text-node.ts` · `services/renderer/compositor/frame-descriptor.ts`
(`collectTextNode`) · `text/components/pestana-texto.tsx`

El trazo, la sombra, el brillo y la curva los dibuja `text/dibujar.ts`, que reemplaza en el render a
`drawMeasuredTextLayout` de OpenCut. Lo que el canvas 2D hace distinto de lo esperado:

- **`shadowOffset*` y `shadowBlur` no siguen la transformación del contexto** (van en píxeles del lienzo
  de destino): la sombra no giraba ni escalaba con el texto. El desplazamiento se pasa a mano por la
  matriz.
- **La sombra no se le pone al trazo y al relleno por separado**: donde se pisan se oscurece dos veces. Y
  el `source-atop` del trazo «Dentro» recortaba también el fondo. Las letras van SOLAS en un lienzo
  aparte, y la sombra sale de ahí con un único `drawImage`.
- **Brillo + Sombra dibujaban las letras dos veces**: el brillo es una sombra sin desplazamiento, y
  dibujado como la sombra trae sus propias letras. Se dibuja sólo el halo: la imagen va corrida FUERA del
  lienzo y su sombra, corrida un lienzo exacto, cae en su lugar.
- **La textura del texto se redibuja si cambia CUALQUIER cosa de lo medido** (el hash es un JSON de todo,
  `collectTextNode`): la «Máquina de escribir» con la fracción cruda redibujaba en cada cuadro aunque no
  apareciera ninguna letra. La fracción se cuantiza a unidades visibles (`cuantizarRevelado`). Es la
  familia de `u_tiempo` en «Un shader `ce-*` roto no falla».
- **Un texto insertado antes de que cargue su fuente queda con la de respaldo PARA SIEMPRE**: el
  compositor no redibuja si nada de lo medido cambió, y que la fuente termine de bajar no cambia nada.
  `loadFonts` antes de insertar o de aplicar un estilo.
- ⚠️ **«May./min.» parecía ir en `buildTextLayoutParamsFromElement`, y ahí está mal**: el editor de texto
  sobre el reproductor edita ese `content` y lo guardaría en mayúsculas. Se aplica sólo al MEDIR
  (`measure-element.ts`).

Que el tamaño del texto es relativo al alto del lienzo está en «Todo se mide en píxeles del LIENZO»; que
el motor no parte líneas, en «Subtítulos con Whisper»; que quitar un efecto es escribirlo apagado, en
«La vista previa del motor».

## Quitar el fondo con MediaPipe en el navegador

**Vive en:** `fondo/{segmentador,recorte-persona,mascara}.ts` · `fondo/panel-eliminar-fondo.tsx` ·
`public/ve/modelos/selfie_segmenter.tflite` · `next.config.ts` (CSP) · `tests/video-editor-fondo.test.ts`

- ⚠️ **El suavizado obvio era el equivocado**: el `filter: blur()` del canvas toma como TRANSPARENTE lo
  que está fuera del cuadro, así que una persona cortada por el borde salía desvanecida contra ese borde.
  Las máscaras se suavizan con un desenfoque propio que repite los bordes (`mascara.ts`, test 5).
- ⚠️ **El cuentagotas no lee el clip, lee la PANTALLA**: con el croma andando, volver a elegir el color
  tomaba el negro de lo ya recortado. Mientras el cuentagotas está abierto, el reproductor muestra el
  clip sin croma (vista previa, sin paso de deshacer) y se esperan 150 ms antes de leer (`verSinCroma`,
  `panel-eliminar-fondo.tsx`). Es la otra cara de «el croma corre primero» (en «Los efectos se aplican en
  el descriptor»): el color se elige contra el ORIGINAL.
- **El JS de npm y el wasm del CDN se separan sin avisar**: `@mediapipe/tasks-vision` va con `^1.1.0` y
  el wasm sale de jsdelivr con la versión fija (`VERSION_MEDIAPIPE`); un `npm install` que suba la versión
  los desparejaría. Lo frena el test 1.
- **El modo VIDEO de MediaPipe exige marcas de tiempo crecientes**, y el editor salta hacia atrás y
  alterna clips: va en modo IMAGEN.
- **La doc de MediaPipe dice dos máscaras para el selfie y el modelo trae un solo rótulo**:
  `segmentador.ts` maneja los dos casos. **Medido en Chrome (12/10): llega UNA sola máscara** (la de la
  persona), corre en GPU aun en headless, ~14 ms por cuadro con entrada de 512×288, y la primera máscara
  tarda 4,6–7,4 s desde que se prende (baja el modelo y el wasm).
- **Trampa del entorno**: MediaPipe carga su JS desde el CDN con una etiqueta `<script>`. Si alguien suma
  `script-src` a la CSP de `next.config.ts`, quitar fondo se rompe callado (sólo queda el aviso).

La espera del modelo dentro del render está en «Los ganchos `ce-*`».

## El audio: «Recuperar audio» no recuperaba, y la caché se tiraba por mover un texto

**Vive en:** `timeline/audio-separation/index.ts` ·
`commands/timeline/element/toggle-source-audio-separation.ts` · `core/managers/audio-manager.ts`

- ⚠️ **«OpenCut ya trae Recuperar audio» era el diagnóstico equivocado**: sólo volvía a prender el audio
  del video y NO sacaba el extraído, así que sonaban dos audios (corridos, si se había movido uno). El
  extraído lleva `audio.extraidoDe` y se saca con `sinAudioExtraido`. Lo que todavía no cubre está en
  «sin hacer».
- **Mover un TEXTO dejaba muda la reproducción de un clip con voz modificada mientras se reprocesaba, y
  arrastrar el volumen tartamudeaba**: cada cambio tiraba todo lo procesado, y la clave incluía el id y
  el inicio del clip. La caché se indexa por lo que cambia el SONIDO, se descarta lo que nadie usa, y
  durante una vista previa (un arrastre) no se reinicia nada.

## «Eliminar ruido»: RNNoise decide la ganancia, y se aplica sobre el audio original (27–28/10/2026)

**Vive en:** `audio/dsp/ruido.ts` · `audio/dsp/rnnoise.ts` · `audio/cadena.ts` ·
`public/ve/wasm/rnnoise-0.2-jitsi-0.2.1.wasm` · `tests/video-editor-ruido.test.ts`

- **El síntoma:** Leila (ws11): «no funciona tan eficientemente como en CapCut». Martín: «lo copiamos de un repo, revisá si
  lo copiamos bien o nos faltan cosas».
- ⚠️ **La pregunta era la equivocada (27/10, Cerebro).** El `ruido.ts` de hasta el 28/10 era propio (7e4fb076e): una
  compuerta espectral con un perfil fijo por clip. OpenCut no trae reducción de ruido y CapCut usa RNNoise, una red. No
  había constantes «mal copiadas». Medido con la voz del sistema (Windows, «Helena», en el scratchpad) a 15 dB del ruido:
  pausas −16,3 dB con ruido rosa, −18,9 con ventilador, −1,5 con un ruido que cambia, −7 con el ruido en un solo canal
  (el perfil salía de L+R). Ahora: −40,4 · −42,3 · −39,9 · −40,1; la voz, ±0,1 dB; los bordes, 0,01 del salto de la
  entrada (antes 0,5–0,85).
- ⚠️ **El arreglo obvio, «pasar el audio por RNNoise», daña la voz:** la red RE-SINTETIZA, y una voz LIMPIA sale con una
  SNR de 11 dB contra la entrada (modelo 0.1). Por eso la red sólo DECIDE: por cuadro de 10 ms y por sus 21 bandas,
  ganancia = √(energía que dejó / energía que entró), y esa ganancia se aplica con una STFT propia al audio original, a
  su tasa (lo que suena nunca se remuestrea). Donde la ganancia es 1, sale idéntico.
- **El retardo no es el que se supone:** 480 muestras el modelo 0.1 y **960** el 0.2 (correlación de una voz contra la
  salida). No hay worklet: el clip se procesa entero, igual en la vista previa y en el export (44,1 kHz), y la red
  escucha una copia llevada a 48 kHz (Lanczos-4).
- **El modelo se eligió midiendo:** con un ruido que cambia, el 0.1 (los wasm de 150 KB de shiguredo y
  web-noise-suppressor) bajaba −18 dB y el 0.2 −42. El 0.2 sólo viene EMBEBIDO en base64 en
  `@jitsi/rnnoise-wasm@0.2.1/dist/rnnoise-sync.js`; se extrajo tal cual (sha1 del tarball = el de npm) a
  `public/ve/wasm/` con su licencia, y el test cuida el sha256. Su pegamento es «web,worker» (no corre en node) y el
  binario importa sólo dos funciones de memoria con nombres minimizados (`a.a`, `a.b`; el mapa sale de
  `rnnoise-sync.js`): el pegamento son 40 líneas propias. No se agregó dependencia.
- ⚠️ **RNNoise se come las fricativas** («s», «f») de una voz limpia: SNR 24,6 dB con ellas, 113 sin ellas. La guarda:
  un canal cuyo piso (el cuadro más bajo en ±2 s, sin contar el silencio digital) está bajo −75 dBFS no recibe
  ganancia. ⚠️ El silencio digital NO cuenta como «sin ruido» (una intro muda en un clip ruidoso dejaba 2 s sin
  limpiar): una voz con las pausas en cero (ya pasada por una compuerta) sigue procesada.
- ⚠️ **La regla del 27/10 («ganancia enlazada por máximo») falla con un canal limpio que tiene eco de sala:** su cola
  vota 1 y deja pasar el ruido del otro (pausas −17 dB con un eco de 0,3 s, −8 con uno de 1 s). Se enlaza donde los dos
  canales llevan LO MISMO (coherencia por banda, en ±2 cuadros): con 0,4 s de eco, −29,7. Lo que cuesta, medido: con la
  voz a 0 dB de su ruido en un canal, la imagen se corre 1,6 dB (todo enlazado: 0,3, pero el eco vuelve a −13,8). Una
  curva más firme (coherencia 0,5 = enlazado) arregla la imagen y rompe el eco (−24): se dejó la lineal.
- **La rodilla:** una banda que la red baja menos de 6 dB se deja entera. Lleva la voz limpia de 19 a 35 dB de SNR y la
  voz con ruido de −0,6 a −0,1 dB, sin mover las pausas.
- **«Borrar silencios» y el salto entre piezas:** cada pieza se procesa sola y la red arranca de cero. Con un espejo de
  3 s (el principio al revés) el principio de cada pieza baja ≥ 25 dB, como una pausa, y queda a 3,9 dB de procesarlo
  de corrido (con la compuerta vieja, 13,8: cada pieza sacaba su perfil). Con 1 s, hasta 18 dB.
- **Cuesta ~6 s por minuto de audio y canal distinto** (la red, ~0,7 ms por cuadro): 8 veces lo de antes, en el hilo
  principal, soltándolo cada 40 cuadros. Un estéreo con los dos lados iguales se escucha una vez.
- **La regla:** un test de ruido usa una VOZ (la sintética de `tests/video-editor-ruido.test.ts`, con formantes y
  fricativas: RNNoise le da 0,97 de probabilidad de voz) y prueba que una voz LIMPIA queda intacta. Un seno no prueba
  nada de esto.
- **Quién:** el chat «Video Editor: el ruido y los silencios de Leila» (rama `editor-leila-2810`). Diagnóstico: workflow
  `wf_80b91164-275` del Cerebro.

## El DSP de audio propio: cada fórmula de libro se midió, y estaba corrida

**Vive en:** `audio/dsp/{ruido,intensidad,ritmos,tono}.ts` · `tests/video-editor-audio.test.ts`

- ⚠️ **«El percentil bajo de la magnitud es el piso del ruido» era falso**: subestima la potencia del
  ruido unas 5 veces, y la pausa bajaba sólo 3,6 dB. La magnitud de un ruido en una banda sigue una
  Rayleigh, y el percentil se corrige con esa distribución (la compuerta vieja de `ruido.ts`, que desde el
  28/10 es RNNoise: ver la entrada de «Eliminar ruido»).
- **Un clip mono medido como UN canal da 3 dB menos**, y normalizado quedaba 3 dB más fuerte que una
  música estéreo. Se mide como suena, por los dos lados (`intensidad.ts`).
- **Los ritmos caían 8,6–8,9 ms antes del golpe** (el desfase del flujo espectral): se corrige 0,8 de un
  salto. Y al bajar la tasa por trozos, el resto se guarda entre trozos o los ritmos se van corriendo
  (`ritmos.ts`).
- **SoundTouch en JS no entrega los últimos ~0,27 s, adelanta 10–20 ms y tarda 0,33 s por minuto de
  audio**, que congelaba la pantalla: relleno de silencio al final, recorte al largo original y ceder el
  hilo (`tono.ts`).

## Los textos de CapCut: el `.po` manda, con sus erratas

**Vive en:** la tabla en/es del scratchpad (no se versiona, ver el diseño) ·
`components/editor/panels/properties/video/basico.tsx` · `effects/definitions/{ajuste,efectos}.ts` ·
`commands/timeline/element/{split,duplicate}-elements.ts` · `{animaciones,transiciones}/catalogo.ts` ·
`audio/voz.ts`

- **El relevamiento no es la fuente**: «Tamaño: aprox. 82 MB» es traducción propia; el `.po` dice
  «Duración: %1 | Tamaño: alrededor de %2» (`pc_new_size`). El texto sale de `look.py`.
- **Erratas del `.po` que se corrigen y se anotan en el comentario**: «Alinar al centro» y «Alinar arriba»
  (`pc_align_title_center`, `pc_align_title_up`), «Amplia» sin tilde.
- **Rótulos que no son los que uno adivina**: Highlights = «Iluminar», Sharpen = «Enfocar», Brilliance =
  «Luminosidad», Lightness (HSL) y Clarity = «Claridad» las dos, Glow = «Brillo» igual que Brightness.
- **Lo que CapCut baja de su servidor no está en el `.po`, y los nombres son nuestros**: efectos y
  filtros, animaciones, efectos y plantillas de texto, transiciones y filtros de voz (éstos, con un
  sonido también nuestro).
- **La consigna también se equivoca**: pedía «Combinado» para las animaciones de texto, y CapCut ahí
  tiene «Bucle» (relevamiento §2.6); se sumó `anim.bucle.*`. Ante una diferencia, manda el relevamiento.
- **Dividir y duplicar sumaban «(left)» y «(copy)» al nombre**, invisible hasta que el nombre se dibujó en
  el clip. Al barrer inglés, mirar también las plantillas que terminan en `element.name`.

## La biblioteca

**Vive en:** `components/editor/panels/assets/{draggable-item,tabbar}.tsx` · `stickers/stickers-store.ts`

- ⚠️ **«prueba.mp4» se veía «prueba.mp4...mp4», y el diagnóstico obvio (el guardado duplica la
  extensión) era falso**: ni IndexedDB, ni OPFS, ni `processMediaAssets` tocan el nombre. Era el rótulo:
  pedía `length > 8` y cortaba con `slice(0,16) + '...' + slice(-3)`, así que un nombre de 9 a 16 letras
  salía entero MÁS la cola. Un nombre largo se corta con CSS (`truncate` + `title`), nunca con `slice`.
- **Las flechas ‹ › de la barra de pestañas son una excepción aceptada** a AGENTS.md «Una barra de
  navegación NO lleva scroll horizontal»: la regla nació de pestañas que se corrían sin pista visible, y
  las flechas son la pista (aparecen sólo si sobran pestañas). Para traer la elegida a la vista se calcula
  `scrollLeft` a mano: `scrollIntoView` corre también los ancestros con `overflow: hidden` y movía el
  armado del editor.
- **Agregar un sticker rearmaba el «browse» entero** (con emojis, un PNG de 512 px por cada reciente,
  hasta 50) porque el store lo recalculaba con la vista por defecto aunque nadie la mirara. Un store no
  recalcula lo que ninguna vista pidió.

## Las guardas del repo sobre el port

**Vive en:** `tests/borrar-tacho-casa.test.ts` · `tests/frontera-use-client.test.ts` ·
`tests/puente-panel-copy.test.ts` · `tests/video-editor-integracion.test.ts` ·
`app/admin/dev/_historial.generado.ts`

- **El emoji del tacho (U+1F5D1) no puede estar en ningún archivo de `app/`**, tampoco en un catálogo de
  stickers: la guarda lo acusa (sólo exceptúa `app/whatsapp/EmojiPicker.tsx` y los comentarios que
  arrancan la línea). Si hace falta, va a `PERMANENTES` con su porqué.
- **`frontera-use-client` dio 12 rojos en `_opencut/`, y eran falsos positivos**: trata como del server a
  todo módulo sin `'use client'`, y los hooks y stores del motor son cliente por su única puerta
  (`dynamic(…, { ssr: false })` desde `VideoEditorCliente`). `_opencut/` y `ce/` quedan exceptuados SÓLO
  mientras ningún módulo del server importe de ellos, y eso lo vigila el test 4 de la integración. Lo
  que el server necesite va a un `.ts` aparte (como `desde/desde.ts`).
- ⚠️ **`npm test` dio 16 rojos en 12 tests del CRM, automations, pixel y cursos, con ENOENT, y el
  diagnóstico obvio («el editor rompió el CRM») era FALSO**: había dos archivos del editor borrados sin
  stagear, y esos tests hacen `readFileSync` de cada ruta de `git ls-files` (la trampa está en
  `hallazgos-infra.md`, 06/10). Se comprueba SIN tocar el índice real: copiar el índice al scratchpad,
  `GIT_INDEX_FILE=<copia> git update-index --remove <archivo>` y correr los tests con esa variable
  (dio 154/154).
- **Y al revés: con `git add` prohibido, voseo, tacho y frontera daban verde sin haber visto los 46
  archivos nuevos.** Se corre una copia de la guarda en el scratchpad con la raíz absoluta,
  `git ls-files --cached --others --exclude-standard` y un filtro `existsSync` (dio 17/17).
- **`_historial.generado.ts` estaba viejo en la rama**: regenerarlo para sumar UN área reescribió ~1650
  líneas. Ante un conflicto de merge se vuelve a correr `node scripts/gen-dev-historial.mjs`, nunca a mano.

## Lo que confunde al MEDIR el editor en un navegador

- ⚠️ **«La Salida del texto se aplicó al clip de video» parecía un bug del panel de Animación y no lo
  era**: el script clicaba por COORDENADAS después de un `scrollIntoView`, el panel se desplaza suave y el
  clic caía en la línea de tiempo, que elegía el video. En el panel se clica con un locator, nunca por
  coordenadas.
- Una captura del reproductor con un clip ELEGIDO incluye los tiradores blancos: la caja mide el lienzo
  entero aunque el clip esté al 89 %. Se suelta la selección antes de capturar.
- Una transición sobre un corte SIMPLE (dividir sin mover nada) da diferencia 0: las dos mitades piden el
  mismo instante de la fuente. Para probar los dos decodificadores se saca el medio y se usa un video que
  cambie mucho en el tiempo. (Y para el producto: en ese caso común sólo se notan Deslizar, Empujar y las
  de Cámara.)
- Para medir cuadro a cuadro REPRODUCIENDO: una captura de Playwright tarda ~400 ms y `captureStream` del
  canvas WebGL2 da un WebM vacío (con `preserveDrawingBuffer` apagado se lee alfa 0). Se muestrea con un
  bucle de `requestAnimationFrame` que copia el canvas a un 2D chico, descartando las lecturas con alfa 0.
- ffmpeg 8 ya no acepta `-vsync`: es `-fps_mode passthrough`.
- ⚠️ **«El renderizador se congeló: CDP no pudo ni capturar pantalla» puede ser una VENTANA OCULTA, no un
  congelamiento.** Medido el 14/10 en el Chrome real con la extensión de Claude: la pestaña daba
  `visibilityState: hidden` y `hasFocus: false`. JavaScript contestaba al instante y
  `Page.captureScreenshot` vencía a los 30 s, que es el mismo síntoma del 13/10. Un
  `requestAnimationFrame` no corrió en 3 s. Y la importación quedó en «Importando… 0 %» más de 45 s:
  `showMediaUploadToast` (`media/upload-toast.ts`) espera dos cuadros antes de empezar, y una pestaña
  oculta no dibuja ninguno. Antes de diagnosticar un congelamiento: `document.visibilityState` y un rAF
  con tope. Si JS contesta y el rAF no, la ventana está minimizada o tapada, y el editor no avanza hasta
  que se vea.

- **«Failed to generate project thumbnail on exit» al ENTRAR al editor**: en desarrollo, React (Strict
  Mode) monta, desmonta y vuelve a montar cada efecto, y ese desmontaje falso disparaba la salida antes de
  que la GPU existiera. Un «al salir» en un cleanup se confirma una microtarea después
  (`editor-page.tsx`); sin GPU no se genera miniatura (`project-manager.ts`).
- El cursor sobre la línea de tiempo prende el **eje de vista previa** y pisa al cabezal: una captura
  «del cuadro en 2 s» puede ser del cuadro bajo el mouse.
- Con varias tarjetas en la biblioteca, el ⊕ se busca ADENTRO de la tarjeta: los ⊕ ocultos de las otras
  también reciben el clic.
- `ffmpeg -sseof -0.1` no da el último cuadro. Y un video de prueba SIN etiquetas de color, ffmpeg lo lee
  BT.601 y el navegador BT.709: se compara contra un export base, nunca contra el original leído por ffmpeg.
- Las pruebas que sirven (Playwright headless y mudo + ffprobe) quedaron en el scratchpad de la sesión
  del 11/10 (`smoke/ve-lib.mjs`, `r3`…`r10`, `e2e.mjs`): para repetirlas, copiarlas a `scripts/`.

## El entorno de esta máquina: `next dev`, `.next` y el typecheck acotado

**Vive en:** `C:/dev/tsc-ve.mjs` y `tsconfig.ve.json` (FUERA de lo versionado) · `.next/`

Medido el 11/10, con 16 GB y 6-7 sesiones abiertas.

- **`next dev` se cae en silencio** —exit 1, sin una línea— al compilar el motor (~100 mil líneas) con
  menos de ~2 GB libres. Y tras una caída la caché queda corrupta: rutas que existen dan 404. Se borra la
  caché y se levanta de nuevo (alcanza con `.next/dev`: `hallazgos-infra.md` → «Un 404 en
  `/api/auth/dev-login` casi nunca es la env»).
- ⚠️ **Y ese «exit 1 sin una línea» casi seguro no es Next quedándose sin memoria: es el vigía de RAM**
  (`taskkill /F` deja exactamente eso). Medido el 14/10: `next dev` dijo «Ready» y a los 2 min murió así.
  `~/.claude/guardia/guardia.log` lo nombraba: `MATO pid … (dev, 1592 MB privados) por zona-roja; libre
  antes 49 MB`. Antes de borrar la caché o culpar al motor, ese log. Y con otros chats trabajando, el
  editor no compila en local: lo que se verifica va contra producción, en el Chrome de Martín.
- ⚠️ **Y un `next dev` muerto a mitad deja `.next/dev/types/routes.d.ts` CORTADO, y el `tsc-ve` queda
  ciego.** Medido el 15/10: cientos de `TS1005: ';' expected` en ese archivo, y ni una línea sobre el código
  propio. tsc informa la sintaxis primero y, si hay alguna, no chequea tipos. Ese archivo lo genera Next y
  es sólo del worktree: se borra `.next/dev/types` (sin enlaces adentro: los de `postcss` y `sharp` viven en
  `.next/dev/node_modules`) y el chequeo vuelve.
- **Al traer main a la rama `video-editor`, `npm install` en su worktree.** Su `node_modules` es propio
  (no es un junction): el 14/10 le faltaban 145 paquetes nuevos de main (`fabric`, `@simplewebauthn/*`…).
- **El typecheck acotado tarda ~40 s; el completo, 8 min con el lock.** `tsc-ve.mjs` se turna por el mismo
  lock de máquina (`%TEMP%/mako-typecheck.lock`). **`tsconfig.ve.json` no está versionado** (lo excluye
  `.git/info/exclude` del clon); en otro clon se recrea con:
  ```json
  { "extends": "./tsconfig.json",
    "compilerOptions": { "incremental": true, "tsBuildInfoFile": "./.tsbuildinfo-ve" },
    "include": ["next-env.d.ts", "app/video-editor/**/*.ts", "app/video-editor/**/*.tsx"] }
  ```
- ⚠️ **Un único error de SINTAXIS ajeno no quiere decir «lo mío compila»**: tsc informa primero la
  sintaxis y, si hay alguna, no corre el chequeo de tipos. Un archivo a medio editar de otro paquete deja
  ciegos a todos. Lo propio se chequea con un tsconfig de scratch que extienda el del worktree e incluya
  sólo esos archivos, con el mismo lock.
- **El verde de `tsc-ve` no cubre `app/api`, `lib/` ni `tests/`**: un paquete del editor que los toca
  los typechequea aparte. Un `tests/video-editor-*` que no compila aparece recién en el typecheck
  completo o en el pre-push: tocar uno pide correr el completo.
- **`timeout 600 node tsc-ve.mjs` volvió con exit 124 y sin errores**: esperaba el lock y `timeout` lo mató
  antes de compilar. Un 124 no es verde ni rojo; el typecheck se espera en segundo plano, sin `timeout`.
- **Una dependencia sin tipos** (`gifenc` 1.0.3) da TS7016 con strict: va un `declare module` en la
  carpeta de quien la usa, con sólo lo que se usa (`export/gifenc.d.ts`).

## Editar el port desde Bash: barras, escapes y CRLF

**Vive en:** las herramientas del entorno (Bash, Write/Edit) · el árbol de `_opencut/`

La trampa general está en `hallazgos-infra.md` → «Escribir una barra invertida a un archivo: ningún
camino es transparente». En esta corrida pegó así:

- **Un heredoc o un `node -e` con barras invertidas se come los escapes** (pasó dos veces), y un Python
  corrido desde Bash recibió `/ ── Diseño` en vez de `// ── Diseño` como ancla: el corte cayó un carácter
  después y el archivo dio TS1161. Las anclas con `//` o barras van adentro de un archivo, o por Edit; y
  después de un reemplazo programático, typecheck.
- **Write convirtió el escape de U+0302 en el carácter combinante LITERAL** (en una regex para sacar
  tildes): sigue andando, pero no se lee y el acento se dibuja sobre el corchete. Pasó en
  `biblioteca-ui.tsx`, `emojis.ts`, `shapes.ts` y `flags.ts`, corregidos con un Python que arma la barra
  con `chr(92)`. Después de escribir un escape, `grep -n 'u0300'` u `od -c`. Y en un heredoc, `\p{…}`
  llega como `p{…}`.
- **El árbol de OpenCut sale con CRLF** (`core.autocrlf`) y una regex con `\n` no matchea. Se edita
  normalizando a LF y se devuelve el fin de línea original.
- **Python en Windows convierte el archivo ENTERO a CRLF** si se escribe con `open(p, 'w')` (pasó el 15/10 con
  `editor-page.tsx`, `congelar.ts` y un test), y `git diff --stat` no lo muestra por `autocrlf=true`. Se escribe con
  `newline='\n'`, en binario o con Edit. Y para editar varios archivos respetando su fin de línea, el patrón que
  anduvo todo el 15/10: un script de node que normaliza a LF, aplica reemplazos EXACTOS (que aparezcan una sola
  vez) y devuelve el CRLF si lo tenía; los reemplazos escritos en un `.mjs` con Write (sin heredoc).
- **`assert.match` sobre un archivo fuente vuelca el archivo entero** cuando falla (31.000 caracteres): para los
  tests que leen el fuente, `assert.ok(texto.includes(…), 'qué')`.
- **Falsa alarma, medida el 11/10:** «`\p{Extended_Pictographic}` en una regex literal es candidato a
  error con `target: ES2017`». No: con TypeScript 5.9.3 compila a ES2017 (falla recién a ES5), y el repo
  ya tiene literales así (`app/conocimientos/PortadaModulo.tsx:344`). El `new RegExp(…)` de
  `stickers/providers/emojis.ts` no hacía falta.

## «Borrar silencios»: el umbral relativo y los bordes del clip

**Vive en:** `audio/dsp/silencios.ts` · `audio/silencios-plan.ts` ·
`commands/timeline/element/borrar-silencios.ts` · `audio/borrar-silencios.ts`

⚠️ **Diagnóstico obvio y falso: «un umbral relativo al clip protege a la grabación bajita».** Es cierto,
y con el aire digital adentro del p95 rompe el caso opuesto: un clip que es casi todo silencio daba un
p95 en el piso, el umbral bajaba a −125 dB y NADA era silencio (medido: 0 tramos). El nivel típico se
mide sobre las ventanas que traen algo; sin ninguna, manda el absoluto de −40 dBFS.

- **El margen de 80 ms protege la palabra de al lado, y en el borde del clip no hay palabra de al
  lado.** Con el margen puesto ahí quedaban 80 ms de aire por toma.
- **El audio arranca en el paquete, no en el recorte.** Un silencio que empieza a 30 ms del borde
  dejaba una astilla de aire como clip suelto: se estira hasta el borde (50 ms).
- **Se recoloca contra las posiciones de ANTES.** El imán corre la principal en el `updateTracks` del
  borrado y las otras pistas no. Calculado contra las de antes, el resultado es el mismo con imán o sin él.
- **Se construyó de cero, y no tenía que pasar sin avisar.** OpenCut classic no lo tiene
  (relevamiento §3) y en CapCut es «Identificar y eliminar muletillas» (Pro). La regla de Martín
  desde el 14/10: antes de construir, mirar la fuente; si no está, decírselo.
- ⚠️ **«MaKo no pudo borrar los silencios» (Leila, 27/10) no era una falla de MaKo: el botón nunca entró al chat.** El
  chat sólo conoce lo que está en `OPERACIONES_CHAT` (lib/editor-video/chat-catalogo.ts); una función de la barra que no
  está ahí no existe para él ni para la API. Ahora es `borrar_silencios` (`borrar_silencios_video` en la API): sin
  `ref`, cada clip con sonido de la pista principal; va ÚLTIMA (escucha el audio al aceptar) y sola respecto de otros
  cortes; un clip con el audio extraído se descarta (cortar sólo el video o sólo su audio los desfasa).
  ⚠️ **Y la receta de MaKo para el editor (`lib/doer-recetas.ts`, la que viaja en WhatsApp y el Ops Center) lo tenía en
  su lista de «lo que no se puede por chat»**: con la operación ya hecha, MaKo seguía contestando que no podía. Una
  capacidad nueva se saca también de esas listas (y de `NO_SE_PUEDE_CHAT`); lo vigila tests/doer-recetas-video-imagen.
- **`objetivosDeSilencios` caía al clip del cabezal si lo pedido quedaba vacío** (todo en una pista bloqueada): para el
  chat, `cabezal: false`. El botón y el chat corren el MISMO trabajo (`quitarSilencios`); el chat además cuenta cada
  silencio que encuentra y la tarjeta lo muestra de a uno (`chat/armado.ts` + `app/_ui/ArmadoEnVivo.tsx`).
- ⚠️ **Con ruido de fondo a 20 dB o menos de la voz, NO encontraba ninguna pausa** (ni el botón): el umbral queda en
  −40/−42 dBFS y las pausas con ruido, arriba (4 y 7 silencios con 25 dB de distancia, 0 con 20). ⚠️ **Bajar el umbral
  hasta el piso del ruido era el arreglo obvio, y se come las sílabas suaves** de un habla sin pausas. Desde el 28/10
  (decisión del Cerebro) las pausas se buscan en el audio SIN RUIDO —la cadena RNNoise de «Reducir el ruido», sobre la
  mezcla mono que mide el detector— con el MISMO umbral, y se corta el original (`dsp/silencios-sin-ruido.ts`), aunque el
  clip no tenga «Reducir el ruido». Medido con la voz del sistema (12 pausas): ruido rosa a 20, 15 y 10 dB, de 0 a las
  12, bordes a ≤ 20 ms; ventilador a 15 y 10 dB, 11 de 12 (falta una de 0,42 s, al límite del mínimo: el error es
  dejar una pausa, no cortar voz); la voz que queda adentro de un corte, ≤ −57 dBFS, como sin ruido; voz limpia,
  idéntico a hoy (la guarda de la cadena no toca lo que no tiene ruido). Cuesta lo de «Reducir el ruido» (~6 s por
  minuto de clip) cada vez que se borran silencios. El audio del decodificador llega en trozos: se juntan en su lugar de
  la fuente (`JuntadorDeTrozos`) porque la red necesita el clip de corrido.

## La API de MaKo y el chat al costado: el proyecto vive en el NAVEGADOR

**Vive en:** `lib/api-mako/areas/video.def.ts` · `app/video-editor/espacio.ts` (decisión 5 del diseño) ·
el molde del chat: `app/landing-generator/editor/paneles/PanelAgente.tsx` + `lib/editor-landing/ia.ts`

Pedido de Martín (15/10, por «Estrategia 3 cuentas»): que el editor tenga un chat al costado para editar
con prompt, como el Landing Generator, y que todos sus botones pasen a la API de MaKo.

- **Inventario del 15/10: 0 funciones del editor declaradas en la API.** El área `video` tiene 14
  operaciones, y son todas lecturas del Video Generator. Lo que tiene la pantalla: 59 acciones (9 internas),
  22 herramientas de la línea de tiempo, 19 pestañas y 12 sub-pestañas del panel derecho, 27 secciones de
  la biblioteca y 61 parámetros editables por clip (35 del motor y 26 propios). Son ≈160 contando las
  repetidas: Dividir, por ejemplo, es atajo y también botón.
- ⚠️ **El diagnóstico obvio («falta declararlas») es el equivocado: no hay de dónde leerlas.** Un runner de
  la API corre en el server, y los proyectos y el material viven en IndexedDB/OPFS del navegador de quien
  editó (decisión 5). Ni MaKo por WhatsApp, ni `/api/v1`, ni la skill pueden ver un proyecto. Antes de la
  primera operación hay que decidir dónde vive el proyecto: por ejemplo, la línea de tiempo (JSON, sin el
  video crudo) también en la base, y que la API PROPONGA cambios que el editor aplique al abrirse.
- **El chat de adentro sí puede hacerse sin eso:** corre en la pestaña y aplica comandos del motor ahí
  mismo. El molde del Landing: la respuesta es un CAMBIO PROPUESTO («Original | Modificado») que se acepta
  o se descarta entero, y antes de aplicarlo se guarda una versión. Modelo: `landing-editor-ia`, `GEMINI()`
  con la key del cliente por la cascada gratis, sin fila en `CLAUDE_PERMITIDO`.
- **Lo que cuesta plata y el chat podría pedir** (Avatar de IA con créditos de Flow, Texto a voz con la
  ElevenLabs del cliente) va con confirmación de pantalla y `rolMinimo: 'admin'`, nunca en el acto.

**El chat, construido el 15/10** (`901786601`). Vive en `app/video-editor/_opencut/chat/`, `lib/editor-video/` y
`app/api/video-editor/ia/route.ts`.
- **El transporte no es el del Landing, y no podía serlo.** Una landing es texto y la IA la devuelve
  entera. La línea de tiempo son ticks, ids de 36 caracteres y parámetros: devuelta entera, se rompe. Así
  que la IA devuelve OPERACIONES de un catálogo cerrado (`chat-catalogo.ts`), con refs cortas (v1, t2…)
  en lugar de ids, y el editor las aplica con los comandos del MOTOR en un `BatchCommand`. Así un corte
  del chat se porta igual que el de la barra: imán, transiciones, fundidos. Para la persona el
  comportamiento es el mismo del Landing.
- **Las refs se conservan al aceptar** (`vistaDeLinea` con `refsPrevias`): entre el pedido y el «Aceptar»
  pudo aparecer un texto adelante, y «t2» tiene que seguir siendo el mismo.
- **Lo que tiene test y lo que no.** La vista, la revisión y el catálogo son puros y tienen 21 tests
  probados rompiéndolos. Que los comandos hagan en pantalla lo que dice cada fila NO tiene test: hay que
  mirarlo en el navegador, y no se miró.
**La segunda tanda, 15/10: de 11 a 32 operaciones** (transición, animación, filtro, efecto, capa de efecto,
ajustar el color, velocidad, recortar, estilo de texto, transformar, reflejar, separar audio, fundidos, reducir
ruido, normalizar, revertir, congelar, cortar por frase o por tramo, eliminar las muletillas y resaltar las
palabras). Regla de Martín: «Debería aceptar cualquier pedido del usuario. Por eso es importante documentar las
cosas de la API»: la descripción de cada operación (`para`, en `chat-catalogo.ts`) es lo que lee el modelo, y lo
que no sabe hacer va en `NO_SE_PUEDE_CHAT` para que lo DIGA en vez de simularlo.
- ⚠️ **El diagnóstico obvio («armar todos los comandos al pedir, como antes») era el equivocado.**
  `applyElementUpdate` mezcla `params` pero REEMPLAZA `effects` entero: un filtro y un ajuste de color sobre el
  mismo clip en un pedido se pisaban. Un recorte mide bordes que el comando anterior ya movió, y lo nuevo no
  tiene id hasta insertarse. Regla: lo que depende del estado del elemento se arma AL EJECUTAR (`Diferido` en
  `chat/comandos.ts`). Sale de leer el código; no se vio en pantalla.
- **Una regla escondida en un componente no la puede cumplir otra entrada.** La de elegir animación vivía en la
  pestaña y salió a `animaciones/elegir.ts` (la usan el panel y el chat; la fija el test 37). El re-partido de
  los subtítulos sigue en un hook (`useRepartirSubtitulo`): por eso el chat descarta, con motivo, cambiar la
  fuente, el tamaño o el espaciado de un subtítulo.
- **Revertir y congelar tomaban el clip de la SELECCIÓN**; ahora aceptan un objetivo (`videoEn`). Crean medios y
  tardan: van después del lote, cada uno con su paso de deshacer, igual que normalizar y subtitular.
- **Un `cortar_tramo` sólo vale si nada más mueve la principal en el mismo pedido** (sus tiempos son los de la
  vista).
- ⚠️ **«Los cortes por frase y por muletillas se resuelven por texto al ejecutar y no tienen ese problema» era el
  diagnóstico equivocado** (lo encontró la revisión adversarial del 15/10). Salen de los tiempos por palabra de los
  SUBTÍTULOS, y un recorte o una velocidad de un clip de la principal no mueven los subtítulos: en el mismo
  pedido, el corte sacaba habla real y la muletilla quedaba. Ahora van en un pedido aparte, con su motivo.
- **Varios recortes o cortes sobre la principal en un pedido se aplicaban corridos**: el destino iba en segundos
  de la vista y el imán ya había corrido el clip («recorta 2 s al inicio de cada clip» recortaba 2, 4 y 8 s).
  Ahora la revisión guarda dónde empezaba el elemento en su simulación (`base`) y el comando aplica relativo a
  dónde está al ejecutarse (`corrimiento` en `chat/comandos.ts`).
- **Normalizar o revertir un clip que un corte del mismo pedido parte** corrían después del lote y encontraban
  por id sólo el primer pedazo: van aparte. Y `Diferido` al REHACER vuelve a armar el comando (lo nuevo del
  lote vuelve en otra pista, con otro id, y el comando viejo apuntaba a la de antes).
- **La Y es hacia abajo en el motor y hacia arriba en el panel**: la IA habla como el panel y se invierte al
  escribir.
- **Lo que cambia con el código va en un slot del prompt, no en su texto editable**: un override del prompt de
  sistema guardado en /configuraciones antes del 15/10 seguiría diciendo que transiciones y filtros no se
  pueden. Medido el 15/10 en la base: ningún negocio tiene overrides guardados (`app_settings` sin ninguna fila
  `mako.prompt-overrides`), así que no había nada que restablecer.
- **Los nombres válidos los manda el editor** (`chat/disponibles.ts`: transiciones, animaciones, filtros,
  efectos, curvas y fuentes, 3,9 k) y la revisión valida contra eso; el estilo de los subtítulos va UNA vez
  (`estilo_subtitulos`): 300 subtítulos con estilo ocupan 36,6 k del tope de 60 k.
- **SIN HACER:**
  - Verlo andar en el navegador (abrir, pedir, aceptar, restaurar, Ctrl+Z) con cada operación
    (`chat/comandos.ts`, `chat/aplicar.ts` no tienen test: necesitan el editor y el WASM).
  - Fuente, tamaño o espaciado de un subtítulo por chat (el re-partido vive en un hook); los parámetros propios
    de cada efecto (entran con sus valores por defecto); HSL y LUT de Ajustar; curvas de velocidad con puntos
    propios; Borrar silencios por chat (el comando existe y es asíncrono); duplicar, pegar atributos, máscaras,
    croma, quitar fondo, recortar el encuadre, fondo del lienzo, plantillas de texto y fotogramas clave.
  - La simulación de la revisión no sigue el imán ni la vinculación (la fila de un recorte izquierdo en la
    principal lo avisa).
  - Una versión de respaldo como la del Landing («Antes de un cambio de IA»): el editor no tiene historial
    de versiones, y la vuelta es «Restaurar» o Ctrl+Z.
  - La API de MaKo, que esperaba la decisión de dónde vive el proyecto: decidida el 16/10 (abajo, «La copia de
    lectura del proyecto»).

## Edición por transcripción y «Eliminar las muletillas»: borrar texto corta el video

**Vive en:** `_opencut/transcripcion/{cortar,modelo,registro}.ts` · `transcripcion/components/transcripcion-view.tsx` ·
`commands/timeline/element/cortar-tramos.ts` · `timeline/dividir-elemento.ts` · test `tests/video-editor-transcripcion.test.ts`

Hecho el 15/10 (pasos 2–4 del plan de subtítulos). Biblioteca › Subtítulos › «Transcripción» y el botón
«Edición basada en la transcripción» de la barra: se eligen palabras, Supr, y esa parte sale del video.
- ⚠️ **El diagnóstico obvio («reusar Borrar silencios») era el equivocado.** `BorrarSilenciosCommand` corta
  clip por clip en varias pasadas (dividir, borrar, recolocar) y cada una pasa por el imán y la vinculación
  (`ripple/iman.ts`). Lo que está encima de la mitad NUEVA de un clip dividido lo reclama la mitad vieja,
  que conserva el id y no se movió: no se corre. Y no sabe nada de subtítulos. Acá la línea de tiempo nueva
  se arma ENTERA y pura, y se aplica en UN `updateTracks`: todo lo que se mueve lleva su lugar explícito
  («tocado»), así el imán no lo vuelve a correr. La cuenta es una sola: `aLinea(t)` = t menos lo quitado
  antes de t.
- **La transcripción SON los subtítulos con tiempos por palabra**, no un segundo texto: no hay dos cosas que
  se desincronicen, y «Transcribir» es «Subtítulos automáticos». Un subtítulo sin tiempos (importado,
  escrito a mano, reescrito) se ve apagado y no se elige.
- **Cada corte se lleva la palabra y la MITAD de las pausas vecinas.** En los bordes exactos de la palabra
  quedan las dos pausas enteras (un hueco largo); de palabra vecina a palabra vecina, ninguna (se pegan). Y
  los tiempos de Whisper bailan ±0,1 s: el medio de la pausa es lo más lejos de comerse una sílaba.
- **Qué se corta y qué no, como CapCut:** la pista principal y el audio extraído de un video
  (`audio.extraidoDe`) se cortan; los subtítulos pierden sus palabras y se corren; lo VINCULADO se corre y,
  si atraviesa un tramo, se ACORTA (correrlo sin acortarlo lo deja pisando al vecino de su pista); lo no
  vinculado —la música— queda quieto. Si la voz está en una pista de audio y no en la principal, no hay
  video que cortar: se avisa en vez de cortar otra cosa.
- **Se va el final de un clip → la mitad que queda conserva la transición, la Salida y el fundido** (como
  «Borrar a la derecha»): siguen yendo hacia el mismo vecino. Partirlo «en dos» se los sacaba.
- ⚠️ **Trampa del entorno: `@/app/video-editor/_opencut/wasm` NO es puro.** `wasm/media-time.ts` importa
  `wasm/opencut.ts`, que baja e instancia el WASM con top-level await. Cualquier módulo que importe un VALOR
  de ahí (`roundMediaTime`, `TICKS_PER_SECOND`, `addMediaTime`) no carga en los tests de node. Por eso
  `cortarTramos` recibe «Dividir» por parámetro (`dividir`) y los ticks por segundo (`tps`): los tipos sí se
  pueden importar. Para ver la cadena: un `import` de valor que llegue a `wasm/opencut`.
- **El chat** pide frases o tramos («corta donde digo…», «saca las muletillas») y el comando los resuelve
  AL EJECUTAR (`CortarTramosCommand` acepta una función de las pistas): en un lote, lo de antes pudo
  correr el video.
- **Lo que arregló la revisión adversarial del 15/10** (un agente que sólo lee, con escenas simuladas):
  - Un subtítulo partido con «Dividir» (o recortado) guarda el texto ENTERO y sus palabras valen sólo contra
    ese texto: re-guardar sólo las visibles las anulaba (perdía karaoke y transcripción). Ahora pasan todas por
    la misma cuenta, con su `trimStart`; y lo que se borra en una mitad se va del texto de las dos.
  - El audio extraído de un video de SUPERPOSICIÓN se cortaba y su video no: ahora sólo se corta el de un
    video de la principal. Y cada pedazo del audio extraído queda emparejado con el pedazo de video de arriba
    (todos apuntaban al primero: «Recuperar audio» los borraba a todos o a ninguno).
  - Deshacer un corte dejaba corrido un elemento vinculado que empezaba justo donde empezaba el tramo: la
    regla del imán «lo que el cambio no tocó se corre con su clip» lo toma por no tocado. El corte se aplica
    y se deshace SIN el imán (`updateTracks(…, { sinIman: true })`): su cuenta ya deja todo en su lugar.
    ⚠️ El mismo problema existe al deshacer otros comandos («Borrar a la derecha»): sin arreglar, porque
    algunos deshacen con parches y necesitan el imán.
- **Dos reglas que vivían en la pantalla y el chat no cumplía** (las encontró la misma revisión): borrar un clip
  de la principal se lleva lo vinculado (estaba adentro del botón Eliminar) y el texto nuevo de un subtítulo
  conserva sus tiempos por palabra y vuelve a partir los renglones (estaba adentro del panel). Salieron a
  `ripple/iman.ts → conLoVinculado` y `subtitles/editar.ts → paramsConTexto`, y las usan el botón, el panel y el
  chat (test 42 del chat). `paramsConTexto` mira TODAS las palabras guardadas: el panel también perdía los
  tiempos al corregir un subtítulo partido con «Dividir».
- **Visto en PRODUCCIÓN el 15/10** (hola-mako.com, Chrome de Martín, su negocio, un clip de 11 s con voz de
  Windows): Whisper bajó el modelo (~2 min la primera vez) y subtituló; la «Transcripción» mostró un párrafo por
  subtítulo, la palabra bajo el cabezal marcada y las 2 muletillas («Eh,», «Bueno,») aunque «Identificar las
  muletillas» estaba APAGADO; «Eliminar las muletillas» llevó el video de 10:29 a 8:20; Deshacer y Rehacer
  volvieron exacto; elegir «de prueba.» y el botón «Eliminar» quitó 0,9 s y dejó «Este es un video».
- ⚠️ **Supr en la transcripción borraba además el CLIP elegido de la línea de tiempo** (medido ahí mismo: el
  video pasó de 8:20 a 5:13 y se fue la frase entera). El atajo global (`actions/use-keybindings.ts`) escucha
  en CAPTURA sobre el documento y sólo se aparta si el foco está en un campo de texto: un `div` con `tabIndex`
  no lo es. Arreglado con `data-teclas-propias="delete backspace"`: el panel declara sus teclas y el atajo
  global las respeta. Regla: un panel que usa una tecla que también es atajo global la declara así.
- **El karaoke se vio andar en producción** (15/10, ~22:00): «Palabra resaltada» sobre los subtítulos de
  Whisper dibuja «COMPRA HOY Y AHORRA MUCHO» en Anton con la palabra que se dice («AHORRA») en verde.
- ⚠️ **La pestaña se colgó dos veces «al aplicar la plantilla de karaoke», y el diagnóstico obvio («el dibujo
  del karaoke») era el equivocado.** Medido con la API Long Animation Frames de Chrome: un cuadro de **2,37 s
  de estilo y layout, 0 ms de script**. Pasa al abrir **Subtítulos › Plantillas**, que al montarse carga de
  golpe las familias de TODAS las plantillas (`PlantillasSubtitulosView`, `loadFonts` → `loadFullFont`: un
  `<link>` de Google Fonts por familia, ~79 caras declaradas). Es pasajero (con las fuentes ya cargadas, la misma
  grilla da 0 ms de layout) y viene de ANTES (las 6 familias eran las mismas antes del karaoke). En un proyecto
  con video y el modelo de Whisper en memoria, ese pico dejó la pestaña sin responder minutos. Con la biblioteca
  en otra sección, el mismo proyecto abre y responde. Lo más probable es que el congelamiento del 13/10
  («Agregar texto predeterminado», en Texto) sea el mismo patrón: `biblioteca-estilos.tsx` también carga todas
  sus fuentes al montarse.
- **Para medir en el Chrome de Martín**: si su ventana queda tapada, Chrome frena los timers y los cuadros
  (`visibilityState` sigue en «visible»), y contar cuadros o vueltas de `setTimeout` da una página «trabada» que
  no lo está. La API Long Animation Frames (`PerformanceObserver` de `long-animation-frame`) separa script de
  estilo/layout y no se confunde con eso.
- **Arreglado el 15/10 (falta medir el «después» en producción):** ninguna biblioteca carga sus fuentes
  enteras al abrirse. Cada miniatura pide a Google SÓLO las letras que dibuja (`&text=`), con un nombre de familia
  propio («Anton · muestra 400», una `FontFace`, sin hojas de estilo) y recién al entrar en pantalla
  (`fonts/muestras.ts`, `useFuenteMuestra`), como el menú de fuentes de Google; la fuente entera llega al elegir
  (subtítulos) o al pasar el mouse por la tarjeta (texto, antes de arrastrarla). El «antes» medido: abrir
  Subtítulos › Plantillas agregaba 5 hojas y 38 caras, con ~2,6 s de bloqueo. Test `tests/video-editor-fuentes.test.ts`.
- ⚠️ **La lista del selector de fuentes salía VACÍA en producción, y no era el freno de la ventana**: cada renglón
  es una máscara con la imagen del atlas, y apuntaba a `/fonts/font-chunk-N.avif`, que no existe (las imágenes
  viven en `public/ve/fonts/` desde el port; el atlas JSON sí se pedía bien). Sin la máscara, el renglón no se ve.
  Ahora usa `FONT_CHUNK_PATH_PREFIX` de `fonts/google-fonts.ts`. Regla: una ruta de `public/ve/` vive en UNA
  constante.
- **SIN HACER:** verlo en el navegador lo que falta (el chat); copiar y pegar partes del video desde
  el texto; la puntuación final de una palabra borrada se va con ella («…de prueba.» → «…video», sin punto);
  «Mostrar texto eliminado»; marcar pausas y repeticiones (CapCut: «Pausa, repetición y duda»); CapCut fuerza el imán de la
  principal mientras se edita por transcripción (`pc_text_cut_mode_lock_cant_change`) y acá no.

## «Animaciones de subtítulos» (karaoke): la palabra que se dice cambia de color

**Vive en:** `_opencut/text/resaltado.ts` (puro) · `text/{measure-element,dibujar}.ts` · `params/extra/subtitulos.ts`
(`subtitulo.resaltar` / `.resaltarColor` / `.noDichasOpacidad`) · panel en `subtitles/components/pestana-subtitulos.tsx` ·
plantillas «Karaoke», «Palabra resaltada» y «Atenuado» en `subtitles/estilos.ts` · test `tests/video-editor-subtitulos-resaltado.test.ts`

Hecho el 15/10, sin mirar en el navegador. «Subtítulos pronunciados»: Palabra (sólo la que se dice) o Frase
(todo lo ya dicho); «Subtítulos no pronunciados»: Opacidad. Se aplica a todos los subtítulos de una vez.
- **Cuantizado como el revelado:** lo medido sólo lleva enteros (qué palabra, cuántas dichas), así la textura
  del texto se redibuja al cambiar de palabra y no en cada cuadro. En una pausa sigue resaltada la última
  dicha: apagarla en cada silencio parpadea.
- ⚠️ **«Aplicar en todos los subtítulos» borraba los tiempos por palabra de todos los demás.** Síntoma: el
  karaoke y el dividir por palabra andan sólo en el subtítulo elegido. El diagnóstico obvio («no se
  guardaron los tiempos», «el karaoke anda mal») era el equivocado: `estiloDe` (`subtitles/insert.ts`)
  copiaba TODOS los params menos `content` y `subtitulo`, también `subtitulo.palabras`, que en los demás no
  coinciden con su texto y quedan anulados. Arreglado (`NO_ESTILO`). Regla: un parámetro que no es un control
  se excluye a mano de todo lo que copia «todos los params» («Pegar atributos» se salva porque recorre sólo
  los declarados).
- **Los subtítulos en mayúsculas se salían por los costados:** `partirYUbicar` medía en minúscula y el dibujo
  pinta con `aplicarMayusculas`; y cambiar «May./min.» no volvía a partir (`repartir.ts`). Ahora se mide como
  se dibuja y `texto.mayusculas` parte.
- **La opacidad de una palabra con trazo no se pone pasada por pasada** (el trazo de afuera se ve a través del
  relleno): lo no dicho se dibuja entero en otro lienzo y se pega con su opacidad.
- **Una palabra suelta dentro del renglón se ubica con `ancho(prefijo + palabra) − ancho(palabra)`**, no con
  `ancho(prefijo)`: así no importa si el navegador cuenta el interletrado de la última letra.
- **Toda plantilla escribe todo lo que alguna plantilla usa** (resaltado, mayúsculas, sombra), en «Ninguno» o
  apagado si no lo usa: si no, «Clásico» después de «Karaoke» deja el amarillo andando.
- **SIN HACER:** «Palabra/Frase no pronunciada» por separado (sólo está la Opacidad); agrandar o hacer rebotar la
  palabra que se dice (tipo Hormozi, `text/dibujar.ts`); el karaoke en el ASS exportado con `\k`
  (`subtitles/ass.ts`); avisar que con precisión «segmento» el karaoke es aproximado; el subrayado de lo no
  dicho sale opaco; resaltar palabras CLAVE. Colores y opacidades de las plantillas, elegidos a ojo.

## Lo que encontró el relevamiento de las plantillas de anuncio (15/10, antes de construirlas)

El plan entero, con archivo:línea de cada cosa: `docs/editor-video/plan-plantillas-anuncio.md`. Lo que vale para
todo el editor:
- ⚠️ **Soltar un archivo de Multimedia ENCIMA de un clip visual no hace nada, y no avisa**: la línea de tiempo
  encuentra el clip y el controlador vuelve sin hacer nada (el stub de OpenCut «Replace media source — not yet
  implemented», `timeline/controllers/drag-drop-controller.ts`). Leído, no visto.
- **La zona segura de Meta en 9:16** (guía oficial, verificada el 15/10): libre el 14 % de arriba, el 35 % de abajo
  y el 6 % de cada lado. Los subtítulos verticales hoy quedan con el borde de abajo al 22 % (`subtitles/estilos.ts`):
  adentro de la franja que tapa Meta. Subirlos cambia todos los proyectos: va aparte.
- **Una forma o un sticker mide `min(ancho, alto)` del lienzo a escala 1** (un rectángulo de W×H en 1080x1920 lleva
  `scaleX = W/1080`, `scaleY = H/1080`); **el relleno del fondo de un texto es `em × alto / 6`** sin importar el
  tamaño de letra (con letra chica en 9:16 la tarjeta queda casi sin relleno); **`letterSpacing` va en px crudos**
  (no escala con el lienzo).
- **`params/registry.ts` y `timeline/element-utils.ts` tampoco cargan en node** (llegan al WASM por
  `timeline/defaults → creation`): lo puro recibe los params por defecto, `tps`, `fps` y la medida por parámetro.
- **La máquina de escribir y el glitch SÍ existen** (el relevamiento de plantillas decía que no; corregido).

**Tanda 1 de las plantillas (15/10, catálogo y armado, puros; `lib/editor-video/plantillas.ts`,
`_opencut/plantillas/{huecos,geometria,armar,escena}.ts`, test `tests/video-editor-plantillas.test.ts`, 46 roturas):**
- ⚠️ **«En un lienzo el doble de grande, las escalas van ×2» era el diagnóstico equivocado.** El compositor encaja
  la fuente RELATIVO al lienzo (`computeVisualTransform`): en 2160x3840 la escala y el tamaño de letra quedan
  IGUALES; lo que va ×2 son las posiciones y el relleno del fondo (su param es em·alto/6). `letterSpacing` va en px
  crudos. Regla: la escala es relativa al lienzo; posición, relleno y espaciado se escalan a mano.
- **`partirYUbicar` ubica la caja CON la tarjeta**: la caja visual incluye el fondo (`getTextVisualRect`) pero el
  ancho disponible se mide sólo con la letra. Alineado a la izquierda, el borde de la tarjeta va al margen y la
  tarjeta puede salir hasta margen + ancho + 2·relleno. Con margen 0,11 en 1080: relleno ≤ 27 px a la izquierda,
  ≤ 54 px centrado.
- **Un default que inventa un dato**: `plantillaPorId` de `subtitles/estilos.ts` devuelve el predeterminado con un id
  desconocido (nunca `null`): validar con `PLANTILLAS_SUBTITULO.some`. La de `lib/editor-video/plantillas.ts`, con el
  mismo nombre, sí devuelve `null`.
- **La máquina de escribir no va por letra**: revela una fracción de un tiempo total (`revelacionTexto`), así que un
  texto más largo se escribe más rápido y el cursor que parpadea del Typewriter de Remotion no existe.
- **Cargan en node** (verificado): `animaciones/{elegir,catalogo,calcular}`, `transiciones/{catalogo,claves,reglas}`,
  `text/{estilos-predefinidos,typography}`, `subtitles/estilos`, `params/extra/{recorte,animaciones,texto}`,
  `recorte/geometria`, `timeline/placement/track-factory`.
- `0.45*60` da 27.000000000000004: las comprobaciones en un borde justo necesitan tolerancia.
**Tanda 2 (15/10, «Reemplazar el clip»; `_opencut/reemplazo/`, test `tests/video-editor-reemplazo.test.ts`, 31
roturas):** se prendió «Reemplazar el clip» del menú, el botón «Sustituir» en las muestras de una plantilla y soltar
un medio sobre una muestra; las tres entradas pasan por `reemplazarClip`. El clip conserva id, inicio, duración,
transición, animaciones, efectos, máscaras, fotogramas y velocidad; un video más corto que lo que el clip recorre de
fuente (duración × velocidad media, también con curva) se rechaza, como CapCut; una muestra cubre el rectángulo donde
se ve HOY (aunque la hayan movido).
- ⚠️ **El diagnóstico obvio («al rearmar los params, excluir `audio.normalizar` y `revertir.*`») era el
  equivocado**: esos dos no son params declarados y nunca pasaban. El riesgo real era el contrario: las marcas
  `plantilla.*` tampoco son declaradas, y al rearmar los params desde los defaults del tipo un hueco dejaba de serlo.
  Regla: quien rearma los params desde los defaults lleva a mano las marcas no declaradas (`reemplazo/puro.ts` →
  `paramsConservados`; lo mismo `clip.silenciadoAntes`).
- **Un filtro que vive en la pantalla no lo ve ningún test**: la grilla del diálogo filtraba en el componente; una
  rotura no cayó hasta pasarlo a una función pura (`mediosParaReemplazo`).
- **SIN HACER:** `rectoMostrado` no mira el giro ni los fotogramas de posición o escala (si un hueco los tiene, pisan
  el transform nuevo); reemplazar un video al que se le extrajo el audio deja ese audio viejo con la misma marca
  (suenan los dos); si el panel derecho y el decodificador aguantan que un clip pase de foto a video con el mismo
  id; nada se vio en el navegador.

- **SIN HACER de la tanda 1**: la zona segura se probó con anchos de letra ESTIMADOS (verla en el navegador); en el
  peor caso (24 caracteres en Montserrat 60) un beneficio puede partirse en dos renglones y pisar al siguiente.

**Tanda 3 (15/10, la pestaña «Plantillas» y «Utilizar plantilla»; `_opencut/plantillas/{uso,dibujo,muestras,instanciar,registro}.ts`,
`plantillas/components/`, `app/video-editor/plantilla/ArmarPlantilla.tsx`, test `tests/video-editor-plantillas-uso.test.ts`, 28 roturas):**
- ⚠️ **El historial de deshacer nunca se vacía al cambiar de proyecto**: `CommandManager.clear()` no lo llama nadie
  (`core/managers/commands.ts`, `project-manager.ts`). Abriendo B en la misma pestaña, Ctrl+Z aplica sobre B las pistas
  de A. **Arreglado el 15/10**: `ProjectManager` lo vacía al crear, abrir y cerrar un proyecto (CapCut tampoco
  conserva el deshacer entre proyectos); `tests/video-editor-historial.test.ts` lo REPRODUCE con el CommandManager
  de verdad (carga en node) y un editor de mentira. No visto en el navegador.
- ⚠️ **«Para ir a un proyecto nuevo alcanza con `router.push`» era el diagnóstico equivocado**: la salida de
  `editor-page.tsx` corre una microtarea DESPUÉS de desmontarse y actúa sobre el proyecto activo; si el componente
  nuevo crea su proyecto en el mismo ciclo, la salida le haría la miniatura y lo guardaría a medio armar. Regla:
  cerrar el proyecto antes de navegar (`prepareExit`, `save.flush`, `closeProject`), o esperar una vuelta del bucle.
- **Una línea de un plan queda vieja**: el plan decía «cargar las fuentes al montar, como `biblioteca-estilos.tsx`»,
  justo lo que colgaba la pestaña. Las líneas de un plan se releen contra los hallazgos posteriores.
- **Probar una transformación con datos que ya la cumplen no prueba nada**: las muestras del catálogo vienen en
  mayúscula, así que sacar las mayúsculas no rompía nada hasta sumar un dato en minúscula.
- **Cargan en node:** `text/revelado`, `plantillas/{uso,dibujo}`. **No:** `media/processing`, `subtitles/insert`.
- **CapCut 9.6 está instalado en la máquina** (`C:/Users/marti/AppData/Local/CapCut/Apps/9.6.0.4097/Resources/po/es-LA.po`):
  `template_pc` «Plantillas», `pc_lyrics_loading_add_effect` «Aplicando plantillas…», `pc_template_editor_material_be_replaced`
  «%1 clips por reemplazar».
- **SIN HACER:** todo lo visual en el navegador; la miniatura no dibuja transiciones, brillo ni curva; las muestras
  se guardan por proyecto en OPFS y nadie las recolecta.

**Tanda 4 (15/10, el chat y la API; tests 43–50 del chat, 28 roturas):** el chat suma `usar_plantilla` (sólo con la
línea de tiempo vacía; si viene con otras operaciones, va la plantilla y lo demás se descarta con su motivo) y
`reemplazar_clip` (el comando del menú); la vista marca `hueco`/`muestra` y lista los `medios` (m1, m2…); un
`cambiar_texto` en un hueco se vuelve a partir y ubicar con su ancla. La API de MaKo suma `listar_plantillas_video`
(gratis, tab `video-editor`, las 7 con sus huecos); USAR una plantilla por la API sigue sin poder (el proyecto vive en
el navegador).
- ⚠️ **El fin de línea medido con Git Bash miente**: `grep -c $'\r'`, `sed -n` y `od -c` no mostraban CR en
  `PanelChat.tsx` y node lo leía CRLF (un reemplazo con `\n` daba «0 veces»). Regla: se mide con node.
- **Una operación que cambia el TIPO de un clip lo cambia también en la simulación de la revisión** (una muestra-foto
  reemplazada por un video seguía «imagen» y un «silenciar» del mismo pedido se descartaba; `simularReemplazo`).
- **Un comando que puede no hacer nada dentro de un lote se verifica después por su efecto** (`ReemplazarClipCommand`
  devuelve `undefined` en silencio; `aplicar.ts` dice «no se pudo reemplazar X»).
- **Exponer una operación por HTTP pide cuatro cosas**: la def, el runner, la ruta en `lib/api-mako/rest.ts` (sin
  ella falla `api-mako-rest`) y regenerar `docs/api-mako.md` y el snapshot. Y `lib/api-mako/` NO entra en
  `tsconfig.ve.json`: para revisarlo, sumarlo un momento al `include`.
- **SIN HACER:** verlo en el navegador (`usar_plantilla` por chat, un reemplazo en un lote, el texto de un hueco
  re-partido); partir una muestra y reemplazarla (la revisión no ve la mitad derecha; el chequeo de después lo dice);
  si por WhatsApp «qué plantillas de video hay» llega a la herramienta nueva.

**Las sugeridas para el negocio (16/10, Martín: «que al principio se posicionen los sugeridos… con un texto sutil de
"Sugerido"»; la regla compartida en docs/plantillas-sugeridas.md, test `tests/plantillas-sugeridas-editores.test.ts`,
27 roturas):** la pestaña, `listar_plantillas_video` y el chat dan la misma lista (`plantillasEnOrden`).
- **Un dato del server llega al motor por un CONTEXTO que pone `VideoEditorCliente`** (`app/video-editor/sugeridas.tsx`),
  no por props por el árbol de OpenCut ni por un módulo global como `espacio.ts`: ése es para lo que el motor lee ANTES
  de montarse (las bases locales) y no se entera si la page vuelve con otro dato.
- **El `para` de `usar_plantilla` en `OPERACIONES_CHAT` es el de SIN señales.** La IA lee el que rearma
  `catalogoParaPrompt(senales)` en cada pedido (las señales las lee `lib/editor-video/ia.ts`, en paralelo con el
  prompt). Quien lea el fijo —la bitácora de /admin/dev, un test— no ve las sugeridas, y es a propósito.
- **Las variantes van `{}`** («Gancho escrito», «Oferta con glitch»): con la fila de su original salían de a dos.
- **«Sugerido» va DEBAJO del nombre**: la tarjeta mide 92 px y al costado lo cortaba a cinco letras.
- **SIN HACER:** verlo en el navegador (ws9, con un funnel declarado: el orden de la pestaña y el `title` del porqué).

## Lottie en un editor de VIDEO: qué aporta si la pieza termina en mp4

- **El repo que vio Martín es `diffusionstudio/lottie`**: 5,6 k estrellas, MIT en el archivo `LICENSE` y en
  `package.json`, verificado el 15/10. Su render es `canvaskit-wasm` (Skia, BSD-3). Pero no es una librería:
  es una skill para un agente de código (Claude Code, Codex) que escribe `lottie.json` y lo revisa en un
  reproductor local. A MaKo le sirve su conocimiento, no su código.
- **En un mp4, un Lottie es una CAPA ANIMADA que se rasteriza al exportar**: un título animado, un sticker
  animado, un lower third, el logo del negocio en movimiento. Vectorial, nítido a cualquier resolución y
  liviano. En CapCut eso es «Plantillas de texto» (relevamiento de funciones §4.2), que el editor no tiene
  porque no hay catálogo. Lottie generado con la marca del cliente es la forma de llenarlo.
- **Lo que falta saber antes de construir:** si el Gemini del cliente escribe un Lottie que sirva (un
  Lottie es un JSON largo y quisquilloso, sin medir), y qué renderer usar, el `lottie-web` en canvas (MIT)
  o Skottie (≈7 MB).

## «Avatar de IA»: un avatar es un escenario del Video Generator

**Vive en:** `app/video-editor/avatar/{avatares,actions}.ts` · `_opencut/avatar/{generar.ts,AvatarIAView.tsx}` ·
`app/video-generator/escenario-reuso.ts` (`sirveParaFilmar`) · `lib/video-planner.ts` (`clipsMinimos`)

- **La pantalla es de CapCut; lo que genera, del Video Generator.** Nada se generó de nuevo: el plan es
  `generarPlanAction` con el guion literal, y filmar y preguntar son `generarTomaAction` y
  `estadoTomaAction`. El único cambio en lo compartido es el piso de tomas.
- ⚠️ **Todos los formatos tienen un mínimo de 3 a 7 tomas.** Sin `clipsMinimos`, una frase dicha por
  el avatar sobre The Office se planificaba en 7 tomas, o sea 7 clips pagados por una oración. Medido
  con `cabidaDeGuion` en el test.
- **La url de la imagen vence a las ~6 h y el `mediaId` no.** La grilla dibuja el avatar sin foto si
  no carga: sigue sirviendo para filmar.
- **El avatar vive en el historial del Video Generator, que topea en 10.** El plan que arma el editor
  lleva la misma imagen, así que generar con un avatar también lo mantiene vivo.
- **La generación está en un store, no en la vista.** Cambiar de pestaña desmonta la vista y la
  cadena tiene que seguir. Si se abre otro proyecto en el medio, la toma no se pega ahí: queda en el
  Video Generator.

## El hilo del chat «Editar con IA», guardado (16/10, etapa 3 del diseño AI-native)

**Vive en:** `lib/editor-video/chat-hilo.ts` (el formato, puro) · `lib/editor-video/chat-hilo-server.ts` ·
`app/api/video-editor/chat/route.ts` · `app/video-editor/_opencut/chat/hilo.ts` (el store) · mig 0298
(`video_editor_chats`) · test `tests/video-editor-chat-hilo.test.ts` (21 roturas).

Uno por persona y por proyecto (decisión 3 del diseño). La persona sale de la sesión (`personaDeSesion`), nunca del
pedido. Sin la tabla, el editor sigue como antes: el hilo vive en la pestaña.
- ⚠️ **Un estado intermedio guardado no vuelve a «pendiente».** Una propuesta guardada en «aplicando» se cortó a la
  mitad de aplicarse (la pestaña se cerró): volver a ofrecerla aplicaría dos veces lo que ya entró. Al abrir queda
  descartada, con el aviso de mirar la línea de tiempo (`hiloAlAbrir`).
- **El deshacer no sobrevive a recargar** (`ProjectManager` vacía el historial al abrir): una aplicada que vuelve de la
  base no tiene «Restaurar», y el botón no se dibuja. Las pistas de cuando se pidió tampoco se guardan, así que sin
  ellas no se avisa «Cambiaste la línea de tiempo»: la revisión al aceptar es la misma.
- **Dos pestañas no se pisan:** el guardado es compare-and-set y ante un 409 la pestaña une su copia con la del server
  por id de mensaje (gana el último cambio, `t`). Al unir, si gana el de la pestaña se queda ESE objeto, que tiene el
  deshacer que no viaja.
- **La prueba 1d de `tests/video-editor-integracion.test.ts` exige `await veEditorVideo()` ESCRITO en cada
  `route.ts`** de /api/video-editor: sacar la puerta a un módulo común la rompe. Por eso la ruta nueva la copia.
- **El test de un tope se prueba con el caso que lo alcanza:** con 80 mensajes de texto, el tope total del hilo
  (400 k) nunca se toca, y la rotura que lo sacaba sobrevivía. Hacen falta las listas de cambios llenas.
- **SIN HACER:** mirarlo en el navegador (recargar con una propuesta pendiente y aceptarla; dos pestañas); el hilo en
  la API de MaKo y en el índice de chats, que es la etapa 2 del diseño (la lista de chats).

## La copia de lectura del proyecto, para la API (16/10, etapa 3, tanda 2)

**Vive en:** `lib/editor-video/espejo.ts` (puro) · `lib/editor-video/espejo-server.ts` · `app/api/video-editor/proyectos/route.ts` ·
`app/video-editor/_opencut/chat/espejo.ts` y `espejo-borrar.ts` · mig 0299 (`video_editor_proyectos`) · las lecturas
`listar_proyectos_video` y `ver_proyecto_video` · test `tests/video-editor-espejo.test.ts` (23 roturas).

**La decisión que esperaba** («La API de MaKo y el chat al costado», arriba): el proyecto SIGUE viviendo en el
navegador, y el server recibe una COPIA DE LECTURA, la misma vista que lee el chat (`vistaDeLinea`: pistas, refs
cortas, medios y nombres disponibles, ≤60 k), no las pistas del motor. La sube el editor un rato después de cada
cambio. Nada escribe la línea de tiempo desde el server: lo que proponga la API lo acepta una persona en el editor
(tanda 3).
- ⚠️ **Las refs se ACUMULAN y no se reusan nunca** (`unirRefs`, y la copia se pasa como `refsPrevias`): si no, un texto
  nuevo heredaba la «t1» de uno borrado y una propuesta vieja a «t1» caía sobre otro texto. **Y el test tiene que mirar
  la VISTA, no la unión:** la unión rechaza la «t1» repetida y tapaba que la vista, que es lo que lee el modelo, se la
  daba al nuevo (la rotura de `usadas` en `linea.ts` sobrevivía).
- ⚠️ **El link de un proyecto sólo lo abre el navegador donde vive.** En otro, `EditorProvider` no lo encuentra, crea un
  proyecto NUEVO y reemplaza la URL. Las lecturas de la API lo dicen, y la tanda 3 tiene que decirlo en cada propuesta.
- **Borrar un proyecto saca la copia desde `ProjectManager.deleteProjects`**: son cuatro las pantallas que borran (el
  inicio, el menú del editor, y lo que limpian «Editar en el editor» y «Utilizar plantilla» cuando fallan). El módulo
  que llama (`espejo-borrar.ts`) no importa nada, así el núcleo del motor no carga el chat.
- **Cada guardado del motor avisa por `project.subscribe`**, y eso vuelve a armar la vista: no hay un pedido de más
  porque no se sube lo que ya se subió (compara el cuerpo entero).
- **SIN HACER:** mirarlo en el navegador (un proyecto viejo sube al abrirse; borrar lo saca de la lista); lo que la copia
  no tiene: el cabezal y la selección (son de quien mira) y los proyectos que no se abrieron desde el 16/10.

## Las operaciones del chat en la API: proponen, y se aceptan en el chat del editor (16/10, etapa 3, tanda 3)

**Vive en:** `lib/editor-video/chat-api.ts` (las 34 acciones) · `lib/editor-video/propuestas.ts` y `propuestas-server.ts` ·
`app/api/video-editor/propuestas/route.ts` · `app/video-editor/_opencut/chat/propuestas.ts` · mig 0302
(`video_editor_propuestas`) · test `tests/video-editor-propuestas-api.test.ts` (35 roturas). Lo de la API, en
docs/hallazgos-api-mako.md («El Video Editor en la API»).

- **La propuesta es un mensaje más del chat «Editar con IA»**: con su «Original | Modificado», el MISMO «Aceptar»
  (`aceptarPropuesta`, que ya revisaba contra la línea de tiempo de ahora con las refs de cuando se pidió) y
  «Restaurar». Aceptada o descartada, se cierra en la base. El editor las busca al abrir, al volver a la pestaña y cada
  minuto; si llega una nueva, abre el panel.
- **El id del mensaje es el de la propuesta** (`api-<id>`): volver a buscar no la repite, y si otra acción se le sumó,
  el mensaje se rearma mientras esté pendiente. Una que se resolvió en otra pestaña queda descartada con su aviso.
- **Se revisa dos veces, a propósito:** al proponer, contra la COPIA (una ref que no existe vuelve con el motivo y el
  modelo se corrige en el mismo turno); al aceptar, contra la línea de tiempo de ese momento.
- **Lo del mismo canal se junta** (el grupo de WhatsApp, la sesión, el token) por dos horas y hasta 40 cambios: un
  pedido son varias acciones y UNA propuesta, que se acepta en un paso de deshacer. La plantilla va sola y con la
  línea de tiempo vacía, como en el chat.
- **SIN HACER:** verlo de punta a punta (un pedido por WhatsApp con las migraciones 0298–0302 aplicadas, y aceptarlo
  en el editor); que el link `?propuesta=` lleve a ESA propuesta (hoy abre el panel con todas); que una propuesta
  vieja venza (hoy queda abierta hasta que alguien la resuelve); avisarle a la persona por WhatsApp cuando la acepta.

## «Entender el pedido» en el chat (16/10): lo que no es del proyecto abierto, una burbuja con su link

**Vive en:** `app/video-editor/_opencut/chat/pedidos.ts` (puro) · `PanelChat.tsx` (`pedirEdicion`, `pedirPedidos`) ·
la ruta compartida `app/api/mako/pedidos/route.ts` · el núcleo `lib/mako-pedidos.ts` · test
`tests/video-editor-pedidos-chat.test.ts` (15 roturas). El contrato: docs/diseno-mako-pedidos.md.

- **El chat pregunta ANTES de su IA**, con sus proyectos del navegador (`storageService.loadAllProjectsMetadata()`
  como `objetos`: el servidor no los tiene). Lo del proyecto abierto va a la IA con su texto; sin nada del abierto, no
  se gasta la IA. Si la ruta falla o tarda, el mensaje entero va a la IA, como antes. Las sugerencias no pasan por la
  ruta: son nuestras y de edición.
- ⚠️ **Borrar un proyecto NO se hace desde el chat**: en el editor un proyecto borrado no va a una papelera, se va con
  su material. La burbuja dice dónde se borra (el inicio) y deja el link; el abierto, igual.
- ⚠️ **«Proyecto» es palabra del Plan para el núcleo**, y en el editor es un video: «créame otro proyecto» decía «Eso se
  hace en Plan». Se arregló en el núcleo (`OBJETOS_DE_LA_TAB`, docs/hallazgos-ia.md), no acá.
- **La validación de la respuesta es la del Web Generator** (`interpretacionDe`, reexportada): una regla, un lugar.
  Los links de una burbuja se frenan dos veces si no son de adentro de la app (la validación y la burbuja), y el hilo
  guardado tampoco los acepta.
- **SIN HACER:** verlo en el navegador (un pedido doble, «el otro proyecto» con dos candidatos, un link a otra tab).

## «Faltan diseños de plantillas» era falso: el motor está bien, falla lo que se ve (29/10/2026)

- **Síntoma:** las 7 plantillas de «Nuevo video» se ven vacías.
- **El diagnóstico obvio era el equivocado:** los tiempos, las animaciones y los huecos de
  lib/editor-video/plantillas.ts están bien y tienen tests.
- **Causa:**
  - el copy es de e-commerce («ESTO LO CAMBIA TODO», «50 % DE DESCUENTO», «María López»);
  - la muestra es un PNG gris («Tu clip»);
  - Create no dibuja la plantilla: `plantillasNuevoVideo` no pasa imagen, y `MiniaturaPlantilla` solo la usa la pestaña
    Plantillas.
- **Regla:** se cambia el contenido, no el motor. La tarjeta usa la miniatura del editor (o un póster WebP, si el chunk
  arrastra el WASM).

**Vive en:** lib/editor-video/plantillas.ts · app/video-editor/plantillas-crear.ts · app/video-editor/_opencut/plantillas/

## Lo que una plantilla de Video no puede prometer (29/10/2026)

- **Es solo 9:16:** `usarPlantilla` fija la relación, y `LIENZO_REF` y `ZONA_SEGURA` son de Reels. YouTube va como
  receta del agente, no como plantilla de huecos.
- **No tiene audio:** no hay `PistaPlantilla`, y el chat no agrega música ni efectos de una biblioteca («lo que no se
  puede» de chat-catalogo.ts). Prometer música o efectos de sonido no se cumple.
- **Fuentes:** `cajaDeTexto` solo mide Anton, Montserrat y Playfair Display, e Inter no está en `FUENTES_PLANTILLAS`.
- **Textos de muestra:** como máximo 5 palabras (test 7) y `mayusculas: true` si van en mayúscula (test 9). `cierre()`
  no lleva mayúsculas. El guion largo del ejemplo va en un campo nuevo, `ejemplo.guion`.
- **Partir la pieza principal en dos piezas del mismo HuecoClip** no está medido. El quiebre lo hace el Editor con
  `dividir`.

**Vive en:** app/video-editor/_opencut/plantillas/instanciar.ts · lib/editor-video/chat-catalogo.ts · tests/video-editor-plantillas.test.ts

## Las muestras: sin caras, con su archivo en la clave, y la opcional se exporta (29/10/2026)

- **Caras:** una persona de stock en un hueco «a cámara» queda diciendo, con los subtítulos, un resultado que nunca
  dijo, y la licencia de Pexels prohíbe insinuar respaldo. Las muestras van sin caras.
- **La opcional:** una muestra opcional que no se reemplaza **se exporta tal cual** (`quedanMuestras` ignora las
  opcionales). Si lleva el rótulo dibujado, sale en el anuncio.
- **La clave:** `nombreMuestra(rotulo)` reutiliza «Muestra · Tu clip.png» entre plantillas. Con fotos distintas por
  plantilla, la clave lleva el archivo.

**Vive en:** app/video-editor/_opencut/plantillas/uso.ts · muestras.ts · huecos.ts · export/dialogo-exportar.tsx

## El resumen del Editor se corta, y no se sabe qué modelo contesta (29/10/2026)

- `editarVideo` corta el resumen a la primera línea y a 300 caracteres: la estrategia y el guion del experto necesitan
  campos propios en `FORMATO_CHAT`.
- El comentario de lib/editor-video/ia.ts dice que `video-editor-ia` va por la cascada barata, con Gemini por defecto.
  Antes de medir al experto, se verifica en /modelos-ia qué modelo responde.

**Vive en:** lib/editor-video/ia.ts · lib/editor-video/chat-prompts.ts

## Cifras de la investigación que la fuente no dice, y licencias que parecen abiertas (29/10/2026)

- **Cifras sin fuente:**
  - la música de 18 a 24 dB debajo de la voz no tiene fuente primaria (video-use dice de 12 a 15 dB);
  - claude-shorts pone el gancho en 3 s, no en 3.5 s;
  - retention-editing quita los silencios de más de 1 s, y los 0.4 s son el umbral de corte limpio de video-use.
- **Licencias que parecen abiertas:**
  - HyperFrames es Apache-2.0, pero corre sobre GSAP, cuya licencia gratuita prohíbe usarlo en herramientas de
    animación sin código;
  - Remotion cobra a las empresas de más de 3 personas, y el render de claude-shorts depende de él;
  - según la investigación (no se releyó), Coverr, Mixkit, la música de Pixabay, la API de Freesound y LottieFiles
    excluyen editores, productos que compiten o la redistribución.
- **Regla:** cada número del prompt sale de un archivo leído. De los repos con licencia se copia la lógica, nunca el
  runtime.

**Vive en:** lib/editor-video/chat-prompts.ts (`video_editor.experto`) · docs/plantillas-reales/video.md (sección 4)

## Un cierre «Escribe LLAMADA» sin quien conteste deja al lead colgado (29/10/2026)

- **Regla:** el cierre con palabra clave va solo si el negocio tiene la automatización que la contesta; si no, la
  acción es agendar o registrarse.
- **Pendiente de verificar:** una cifra de facturación propia en un anuncio se lee como promesa de ingresos (es una
  inferencia, sin verificar contra la política de Meta). Por eso la historia del fundador habla de clínicas atendidas.

**Vive en:** lib/editor-video/chat-prompts.ts · lib/editor-video/plantillas.ts

## Tests que se rompen a propósito al cambiar las plantillas (29/10/2026)

- Cambiar la duración de `testimonio` rompe la regex «Sugerida · 15 s» de tests/video-editor-nuevo-video.test.ts.
- Con la miniatura, el `rotulo` deja de dibujarse y «Sugerida» desaparece si no pasa a la `insignia`.
- Retirar `gancho-escrito` y `oferta-glitch` obliga a borrar sus filas en `ETIQUETAS_VIDEO`.
- **Regla:** se reescriben con el cambio, no se fuerzan.

**Vive en:** tests/video-editor-nuevo-video.test.ts · lib/editor-video/plantillas-etiquetas.ts

## Lo que quedó SIN hacer

**Del 28/10 (el ruido y los silencios de Leila)**
- «Borrar silencios» con ventilador fuerte (≤ 15 dB de la voz) deja alguna pausa al límite del mínimo de 0,4 s.
- La reducción corre en el hilo principal (~6 s por minuto y canal): un clip de 10 min estéreo son ~2 min de CPU con
  el editor respondiendo a saltos. Un worker (`audio/dsp/ruido.ts` es puro y lo aguanta).
- Con eco de sala largo en el canal limpio (≈1 s), las pausas del otro bajan −8 dB; y con la voz a 0 dB de su ruido en
  un canal, la imagen se corre 1,6 dB (ver la entrada: la coherencia es el compromiso medido).
- Dos roturas que la voz sintética no ve: el espejo de 1 s en vez de 3 (lo vio la voz del sistema: 18 contra 10 dB) y
  sacar el enlace del todo (la rodilla ya deja la voz igual en los dos lados; la diferencia es ≤ 0,4 dB).
- Nada se miró en un navegador: ni la vista previa ni el export con RNNoise, ni la tarjeta que muestra los silencios
  de a uno (la PC con 16 GB y otros chats; el dev server del editor no se levantó).
- Si el prompt del chat está editado en /configuraciones, no tiene la línea nueva de `borrar_silencios` (el catálogo
  sí la lleva: entra por el slot).

**Del 14/10 (barra lateral, Borrar silencios, Avatar de IA)**
- Nada de lo del 14/10 se miró en un navegador: el editor se ve en producción y la rama `video-editor`
  no se pudo pushear (typecheck bloqueado en la máquina).
- «Avatar de IA» llega de punta a punta recién cuando el puente lea el video del Flow nuevo
  (`mediaDeFlow` devuelve null con el payload posicional; memoria `puente-flow-boq-estado`). Hasta
  entonces la toma se genera en Google y la pestaña queda esperando.
- «Avatar de IA» filma todas las tomas seguidas. El Video Generator pregunta «¿esta cara es la tuya?»
  después de la toma 1, y la pestaña no (el avatar ya es una imagen aprobada). Si Martín quiere esa
  pausa, va en `_opencut/avatar/generar.ts`.
- «Crear» abre el Video Generator en otra pestaña. «Voz» muestra el acento del perfil y no se cambia
  desde el editor.
- Borrar silencios: el umbral, la ventana y el mínimo son fijos y sin controles. Las curvas de
  velocidad no se probaron en el navegador.

**Las tandas 1 y 2 se hicieron sin dev server**, y lo que se midió después en Chrome (cinco bugs del
motor, arriba) no cubre esta lista. Lo primero a probar: importar
→ dividir → texto → exportar MP4/MOV/WebM y medirlo con ffprobe (`export/`), con el reescalado de
mediabunny sobre el canvas WebGPU, HEVC, AV1 y GIF; reglas y guías (`guides/reglas.tsx`,
`guides/use-arrastre-guia.ts`); pantalla completa sobre `.ce` (`preview/hooks/use-pantalla-completa.ts`);
render a 1/2 y 1/4 con máscara y desenfoque (`canvas/escala-salida.ts`); tira de miniaturas, imán al
soltar, Portada, y si Chrome deja tomar Ctrl+Shift+C y Alt+M; los shaders en el GLSL ES real
(`effects/components/`, `services/renderer/compositor/repartir-ce.ts`); Revertir y Congelar con un MP4 de
teléfono rotado y uno VFR (`retime/revertir.ts`); Whisper con un anuncio en español de 60 s, la caída
WebGPU → WASM y las marcas por palabra en WebGPU (`services/transcription/worker.ts`,
`subtitles/generar.ts`); Texto a voz con una key real (`subtitles/components/texto-a-voz.tsx`); los
diálogos abiertos desde un menú. «Editar en el editor» (`app/video-editor/desde/ImportarDesde.tsx`) no
tiene hoy con qué probarse: 0 montajes `listo` en prod y «Anuncios terminados» sólo en el ws1, que es de
un cliente.

**Medido en producción el 13/10** (Chrome de Martín, 1-2 GB de RAM libre): importar → agregar → dividir
funcionan con la consola limpia; el inicio tarda ~20 s en pintar; y **«Agregar texto predeterminado»
congeló el renderizador más de 90 s** — con un proceso de Chrome en 5 GB no se pudo separar bug de falta
de memoria. Reproducirlo con RAM libre antes que nada: si es del editor, vive en `text/` o en el
`font-picker`. El export sigue sin medirse por eso.

**La tanda 3 (G, H, J, M) se construyó el 11-12/10 y no se vio en Chrome.** Lo primero a mirar,
reproduciendo y en el MP4 con ffprobe: las transiciones (los barridos sobre un clip reflejado o girado,
los shaders en el GLSL ES real, `transiciones/shaders.ts`); trazo, sombra y brillo del texto y las
tarjetas con hover (`text/dibujar.ts`, `animaciones/components/*`); quitar fondo con una o dos máscaras,
la GPU de MediaPipe, 1080p30, el alfa en el compositor y el cuentagotas (`fondo/segmentador.ts`,
`fondo/recorte-persona.ts`, `fondo/panel-eliminar-fondo.tsx`).

**Transiciones (G)**
- Fundido a negro y Destello blanco tiñen sólo el clip, no las barras de un vertical en 16:9
  (`transiciones/catalogo.ts` `haciaColor`, `transiciones/shaders.ts`).
- El fondo «Lienzo con desenfoque» cambia en seco en el corte y sigue con el chequeo de rango viejo
  (`resolveBlurBackgroundNode` en `services/renderer/resolve.ts`, `buildBlurBackgroundNodes` en
  `services/renderer/scene-builder.ts`).
- Transición y animación de Entrada/Salida en el mismo clip: decidir contra CapCut (`animaciones/gancho.ts`).
- Un clip con curva de velocidad dentro de la ventana, sin verificar (`resolveVideoNode`).
- Soltar una transición en un hueco no avisa (`timeline/controllers/drag-drop-controller.ts`, `onDrop`).

**Animaciones y texto (H)**
- La marca del tramo de animación sobre el clip está hecha de memoria (`animaciones/components/franjas-animacion.tsx`).
- Animaciones con desenfoque o 3D («Desenfoque», «Zoom borroso»): el gancho sólo mueve transformación y
  opacidad (`animaciones/catalogo.ts`).
- «Burbuja», fondo por carácter y alineación vertical (`text/registro.ts`, `text/components/pestana-texto.tsx`).
- Tamaño, espaciado, trazo y sombra sin ◇: el render usa el valor base (`params/extra/texto.ts`).
- La miniatura de un predefinido con curva se ve recta (`text/components/miniatura-estilo.tsx`).

**Audio (J)**
- El vúmetro junto al tiempo (un analizador en `core/managers/audio-manager.ts` y el botón en
  `preview/components/toolbar.tsx`).
- Canal, Mejorar voz, Aislar voz y voz clonada; «Voz a canción» apagada (`audio/components/basico.tsx`,
  `audio/components/modificador-voz.tsx`).
- Tono y Timbre sin ◇ (`params/extra/audio.ts`, `audio/cadena.ts`).
- Grabar no compensa la latencia, no dibuja el clip rojo que crece ni bloquea acciones (`audio/grabar.ts`).
- Ritmos: tope de 10 min y sin «Alinear con los marcadores de ritmo» (`audio/ritmos.ts`).
- Reducir el ruido no es RNNoise: no saca un ruido que varía (`audio/dsp/ruido.ts`).
- Normalizar no vuelve a medir al recortar (`audio/normalizar.ts`).
- «Recuperar audio» no saca el extraído en la mitad nueva de un video dividido ni los extraídos de antes
  de la marca `audio.extraidoDe` (`timeline/audio-separation/index.ts`, `split-elements.ts`).

**Quitar fondo (M)**
- El pincel de «Eliminación personalizada»: params `matting.*` y el dibujo sobre el reproductor
  (`fondo/panel-eliminar-fondo.tsx`).
- CapCut procesa el clip antes, con «Aplicando el recorte automático… %»; acá va cuadro a cuadro y sin
  progreso en la primera carga (`fondo/recorte-persona.ts`).
- El cuentagotas de la paleta toma el color con el croma puesto (`components/ui/color-picker.tsx`).

**Render y exportar**
- 2K y 4K interpolan desde el lienzo; la nitidez nativa exige escalar posiciones, texto, máscaras y
  desenfoques (`compositor/frame-descriptor.ts`, `services/renderer/resolve.ts`, `scene-exporter.ts`).
- 1/2 y 1/4 sólo ahorran composición: la decodificación y el texto siguen a resolución completa
  (`videoCache` / scene-builder en `services/renderer/`).
- La portada no se incrusta en el MP4, «Editar portada» está apagado y el diálogo Exportar todavía no la
  lee (`export/dialogo-exportar.tsx`, `timeline/components/portada-boton.tsx`, `timeline/components/portada.ts`).
- Del diálogo de CapCut faltan Flujo óptico, Marca de agua, revisión de derechos de autor, Superresolución,
  Exportar clips seleccionados, rango I/O y 10 bits; 8K y ProRes van apagados por imposibles
  (`export/opciones.ts`). La tasa «Recomendado» y los porcentajes de los diseños son estimados
  (`export/opciones.ts`, `components/editor/diseno-paneles.ts`).
- «Profundidad lineal» apagada en Mezcla › Modo: no está en los 17 del WASM (`properties/video/basico.tsx`,
  `MODOS_CAPCUT`).
- El fondo «Lienzo con desenfoque» usa la fuente sin recorte ni volteo (`services/renderer/resolve.ts`).

**Panel derecho**
- Máscara sin «Esquinas redondeadas» (`masks/builtin/definitions/rectangle.ts`), sin ◇ y sin seguimiento
  (`masks/components/masks-tab.tsx`); sigue apagando el imán con Shift y CapCut usa Ctrl:
  `useIgnorarGuias()` en `masks/use-mask-handles.ts`.
- Lienzo: UN fondo por proyecto (`settings.background`, `project/types.ts`), no por clip; por eso no hay
  «Aplicar a todo». «Escala uniforme» vive sólo en la sesión (`usePropertiesStore.escalaUniforme`).
- Posición Y invertida (positivo = arriba) según el borrador de CapCut/pyJianYing, de memoria: confirmar
  contra CapCut (`properties/video/basico.tsx` `FilaPosicion`, `masks/components/masks-tab.tsx`).
- Ajustar: «Curvas» y «Círculo cromático» sin registrar (`effects/registro-ce.ts`); las funciones de IA
  sin hacer («Ajuste automático» apagado en `effects/components/panel-color.tsx`); rangos −50…50 / 0…100
  y alcance de «Aplicar a todo», a confirmar contra CapCut.
- «Efectos corporales» en «Próximamente», sin Máscara de efecto ni Favoritos (`effects/components/biblioteca.tsx`).
- «Pegar atributos» aplica todo de una, sin el diálogo de categorías ni «Mantener / Estirar» de los
  fotogramas (`commands/timeline/element/atributos.ts`).
- Rótulos en inglés en las fuentes del motor (`graphics/definitions/*`, `masks/registry.ts`,
  `masks/builtin`): el panel los traduce por clave, pero otra pantalla que lea `param.label` (los carriles
  de fotogramas) los muestra en inglés.
- Básico no dibuja lo que el motor no puede (Estabilización, Reducir ruido, Parpadeos, Mejorar la calidad,
  Iluminación, Movimiento difuminado, Autoenmarcado, Movimiento de IA); Retoque, tampoco.
- `reflejo.vertical` existe y se dibuja, pero ningún botón lo alterna: el «Voltear» va en Video › Básico
  (`params/extra/reflejo.ts`, `properties/video/basico.tsx`).

**Línea de tiempo**
- Recortar un clip con curva usa la velocidad media: `getSourceSpanAtClipTime` sin `clipDuration` en
  `timeline/group-resize/compute-resize.ts` y `timeline/update-pipeline.ts`. Falta decidir qué hace CapCut.
- El reproductor todavía elige y mueve clips de pistas BLOQUEADAS (`preview/controllers/*`; filtrar con
  `estaBloqueada` / `sinBloqueados` de `timeline/components/pistas-ce.ts`).
- Sin acción en `actions/definitions.ts`: I/O, «Seleccionar por clip» (Shift+X), Agrupar (Ctrl+G), clip
  combinado (Alt+G), Ctrl+R, Shift+B, Ctrl+J y Tab.
- «Altura de la pista» (`timeline/components/layout.ts`, `timeline/timeline-store.ts`); el eje de vista
  previa no suena (`timeline/components/herramientas-ce.tsx`, `eje-vista-previa.ts`); «Reemplazar el clip»
  apagado (`timeline/components/timeline-element.tsx`); Q/W con vinculación no borra lo vinculado
  (`actions/use-editor-actions.ts`); los marcadores van en una fila propia y no sobre la regla
  (`timeline/bookmarks/components/bookmarks.tsx`).

**Reproductor y biblioteca**
- «Calidad de la vista previa» es deducida, no vista en CapCut (`preview/components/cabecera.tsx`,
  `useEscalaReproductor`). `MAX_GUIAS = 20` es arbitrario (`preview/preview-store.ts`). Los tamaños de
  5.8", 2.35:1 y 1.85:1 salen de conservar el lado corto (`canvas/sizes.ts`).
- Stickers y formas entran llenando el lienzo; CapCut los pone a ~1/3 (`params/registry.ts` o
  `executeStickerDrop` / `executeGraphicDrop` en `timeline/controllers/drag-drop-controller.ts`).
- Fuera de v1, sin dibujar: Proyectos secundarios, Tuyos, Espacios, Archivos de IA, Dreamina, Música de
  IA, Sonidos de TikTok, Música de marca, Stickers de IA, GIPHY y Favoritos. Música y Efectos de sonido
  esperan licencia (`sounds/components/assets-view.tsx`).
- Los emojis dependen de la fuente del sistema: en un Linux sin Noto Color Emoji salen monocromos
  (`stickers/providers/emojis.ts`, `pngDeEmoji`).

**Operaciones de clip**
- Revertir no invierte el audio SEPARADO del clip (`commands/timeline/element/revertir.ts`) y con más de
  2 canales toma los 2 primeros sin mezclar (`retime/revertir.ts`).
- Los medios `ephemeral` (cuadros congelados, archivos revertidos) quedan en OPFS sin recolección
  (`commands/timeline/element/{congelar,revertir}.ts`).
- Formas de curva aproximadas y, con curva, el tono no se conserva (`retime/curva.ts`, `presets.ts`); por
  encima de 10× el tono cambia siempre y a 100× el audio por streaming puede cortarse
  (`core/managers/audio-manager.ts`).
- Congelar no vincula el cuadro al clip original (`congelar.ts`); «Cámara lenta fluida» no se dibuja.

**Subtítulos y Texto a voz**
- Bilingües, palabras clave y Emojis de IA apagados (`subtitles/components/assets-view.tsx`).
- Karaoke, «Eliminar las muletillas» del video y la edición por transcripción: hechos el 15/10 (arriba, con
  lo que les falta). Sigue sin hacer resaltar palabras CLAVE. Modelo fijo whisper-small, ≈250–300 MB la
  primera vez (`transcription/models.ts`).
- Texto a voz no avisa que el plan gratis de ElevenLabs no tiene licencia comercial
  (`subtitles/components/texto-a-voz.tsx`).

**Decisiones de Martín e integración**
- Sumar `video-editor` a la capa `superadmin` o probar siempre en ws3 (`lib/capas.ts`).
- Quitar fondo usa el modelo selfie, que sirve para tomas cercanas; un cuerpo entero pediría el
  multiclase, de ~16 MB (`fondo/segmentador.ts`).
- Abrirlo a clientes: `veEditorVideo` en `app/video-editor/acceso.ts`, sacar `adminOnly` de
  `app/_components/nav.ts` y decidir las capas.
- La vuelta (el mp4 exportado → bucket del workspace → «Mis creativos» de Ads Manager), anotada en
  `app/admin/dev/video-editor/bitacora.ts`, donde el nombre del chat y la hora del prompt no están
  verificados.
- «Feature: Video Editor» no existe en `lib/plan-proyectos-catalogo.ts` (dar de alta es una decisión).
- El aviso de render degradado (sin WebGPU) quedó traducido aunque CapCut no lo tiene (`editor-page.tsx`).
- Borrar o no las superposiciones de OpenCut (cuadrícula, zonas de TikTok/Reels/Shorts) que ninguna UI
  muestra (`guides/registry.tsx`).
- Sin verificar: el debounce del `SaveManager` tras un cambio de ws (`core/managers/save-manager.ts`).

**Código muerto, inglés y lint**
- Sin uso: `components/editor/panels/assets/views/settings/` (SettingsView), `timeline/components/graph-editor/`,
  `guides/definitions/custom.tsx`, `sounds/sounds-store.ts` (con `savedSoundsAdapter` de
  `services/storage/service.ts`), `hooks/use-fullscreen.ts`,
  `components/editor/panels/properties/components/element-params-tab.tsx`, `ripple/diff.ts`,
  `ripple/apply.ts` y el estado de selección de `inicio/store.ts`.
- Toasts y errores en inglés que la UI puede mostrar: `core/managers/project-manager.ts` («Failed to
  rename project», «Project not found»…) y `core/managers/renderer-manager.ts` («Project is empty»…).
- Lint que ya estaba: `components/providers/editor-provider.tsx` (`_createErr`, `react-hooks/immutability`),
  `components/ui/font-picker.tsx:80`, `timeline/components/index.tsx` (`syncFollowers`) y
  `timeline/bookmarks/components/bookmarks.tsx:308`.

- «Encountered a script tag while rendering React component» en el inicio después de volver con «atrás»:
  sin ubicar.
- Para mirar a ojo: Espejo deja una línea de 1 px en el centro; Saturación −50 queda igual que Blanco y
  negro; Saturación +50 deja la piel muy naranja.

*Chat «Video Editor»: tanda 1 (paquetes A–E), tanda 2 (F, I, K, L) y su integración el 11/10/2026;
tanda 3 (G, H, J, M) el 12/10.*

## «Esta pantalla se rompió al dibujarse» al entrar: el editor sin GPU (17/10/2026)

**Vive en:** `app/video-editor/_opencut/preview/components/index.tsx` (el montaje del lienzo) ·
`components/providers/editor-provider.tsx` (`setDegraded`) · `services/renderer/compositor/wasm-compositor.ts`
· `editor-page.tsx` (`AvisoRenderDegradado`) · test `tests/video-editor-sin-gpu.test.ts`.

**Síntoma (tarjeta #853, llamadas del 16/10):** al entrar al editor sale el cartel de `app/error.tsx` y
«no deja entrar». A Joan le pasó después de arrastrar un video: la vista previa quedó en blanco con el
audio sonando, y al recargar ya no pudo volver a entrar.

**Causa, medida (no deducida):** el compositor del WASM necesita un contexto de GPU. Con un Chrome sin
ventana y el WASM real: con GPU, `initializeGpu()` anda (y sin WebGPU cae solo a WebGL2: también anda);
**sin WebGPU NI WebGL2** falla («Failed to create a WebGPU surface… webgl2 not available»). El
`EditorProvider` lo atrapa y marca `renderer.isDegraded`… y el reproductor llamaba igual a
`renderer.getOutputCanvas()` → `initCompositor()` **dentro de un efecto**, que tira «GPU context not
initialized. Call initializeGpu() first.». Un error en un efecto cae en `error.tsx`. A Chrome le pasa
cuando su proceso de GPU se cae varias veces —un video pesado alcanza— y queda así **hasta reiniciarlo**:
de ahí el «irrecuperable» aunque se recargue.

**⚠️ El diagnóstico obvio era el equivocado, dos veces:**
- El detalle de la tarjeta («capturar el error en el React Error Boundary», «optimizar la carga de tracks
  pesados») lo inventó el extractor: el boundary ya existía y era justo lo que se veía.
- La primera sospecha fue un DATO guardado (un video sin duración, un tiempo con decimales: el WASM tira
  con cualquier tiempo que no sea un entero de ticks — medido). Un barrido de los caminos de render no
  encontró ninguno que se alimente de lo que deja el reporte. Lo que quedaba «guardado» no era el proyecto:
  era el **estado del navegador** (la GPU caída).
- El comentario de `AvisoRenderDegradado` decía «sin WebGPU el motor dibuja por el camino lento». **Ese
  camino lento no existe**: sin GPU no hay compositor. El aviso mandaba a «abrir el editor en Chrome» a
  gente que ya estaba en Chrome.

**Regla que queda:** todo lo que llama al compositor del WASM desde React (efecto, render, selector) mira
antes `renderer.isDegraded`. Sin GPU, el editor sigue usable sin vista previa y dice qué hacer
(«reinicia el navegador»).

**Lo que quedó SIN hacer:**
- **Exportar sin GPU**: `scene-exporter.ts` también llama a `getOutputCanvas()`; falla dentro del export
  (asíncrono, no tumba la pantalla) con un error que no dice que es la GPU.
- **Una vista previa sin GPU** (dibujar el cuadro con el contexto 2D que ya tiene `CanvasRenderer`): es
  reescribir el compositor; no se hizo.
- **No se recorrió en un navegador real con la app**: se midió el WASM en un Chrome sin GPU y la guarda
  se probó por estructura. La prueba de punta a punta es abrir el editor en un Chrome con la aceleración
  de gráficos apagada (`chrome://settings/system`).

---

## El link `?propuesta=` no lo leía nadie (20/10/2026, Ops Center 1.14)

`app/video-editor/[proyecto]/page.tsx` · `app/video-editor/_opencut/chat/propuestas.ts` ·
`app/video-editor/_opencut/chat/foco.ts` · `app/video-editor/_opencut/chat/PanelChat.tsx` ·
`tests/video-editor-propuesta-link.test.ts`

**Síntoma.** Cada edición pedida por la API o por el Ops Center devuelve el link
`/video-editor/<proyecto>?propuesta=<id>` para aceptarla. La primera vez que se abría, la propuesta
llegaba nueva y el chat se abría solo. **La segunda vez** (volver a tocar el link, otra pestaña,
recargar), el editor abría con el chat CERRADO: la propuesta ya estaba en el hilo, no era «nueva»,
y nadie decía dónde estaba lo que la persona venía a aceptar.

**Causa.** El `?propuesta=` no lo leía nadie: la página sólo leía `desde` y `plantilla`, y el
editor traía todas las propuestas a los 1,5 s y abría el panel únicamente si llegaba una nueva. El
link de la API y la página no estaban atados por nada.

**Arreglo.** La página lee `propuesta` (sólo un uuid) y lo pasa hasta `EditorPage`; la primera
búsqueda se reintenta hasta que el proyecto cargó (a los 1,5 s puede no estar), abre el chat, baja
hasta esa propuesta y la resalta; si ya se aceptó, se descartó o no existe, lo dice.

**Reglas que quedan:**
- **Un link que arma un lado y lee otro va atado por un test.** El test compara el parámetro que
  escribe `lib/api-mako/areas/video.run.ts` con el que lee la página: renombrarlo en un solo lado
  lo pone rojo.
- **`chat/propuestas.ts` carga el motor (WASM) al importarse**: un test no lo puede importar. Lo
  puro que un test necesita va en un módulo aparte (`chat/foco.ts`, con `idDeMensaje`).
- **El foco va DESPUÉS del «el chat baja solo»**: los dos son efectos del panel, y si el foco corre
  primero, el scroll al final lo pisa. La primera rotura de prueba («borrar el baja-solo») pasaba,
  porque comparar posiciones con un `indexOf` de −1 da verdadero: el test ahora exige que exista.

**La tarjeta «Original | Modificado» (mismo día).** Cada edición devuelve en `extra.bloque` el G4
del marco de bloques de Ops Center 3 (`lib/editor-video/propuesta-bloque.ts`): fila por fila, el
elemento como está en la COPIA del proyecto y cómo queda, con «Aceptar en el editor». Dos cosas que
no se ven en el código:
- **«Original» no es un diff del editor**: el editor revisa contra la línea de tiempo viva con
  `revisarOperaciones` (`chat/linea.ts`), que pide su vista en memoria (Maps de refs). El server
  sólo tiene la copia en JSON, así que dice el elemento de hoy (nombre y tiempos) y lo pedido. Por
  eso el editor vuelve a revisar al aceptar.
- **El bloque se probó contra el saneador real** (`sanearBloque`, rama ola1): con un espacio en el
  nombre del proyecto sin codificar, o un link absoluto, el saneador lo DESCARTA entero y la tarjeta
  no aparece sin ningún error. El test corre contra el saneador cuando el marco está en el árbol.

**Lo que encontró la revisión adversarial (20/10, noche).** Cuatro defectos del foco y del cierre:
- **El foco usaba el proyecto ACTIVO, no el del link.** Con el proyecto en otro navegador, el editor
  creaba uno vacío y la búsqueda (de ese vacío) decía que la propuesta «ya no está abierta», que era
  falso. Ahora el foco se usa sólo si el activo es el del link, una búsqueda en vuelo no lo consume
  si el editor ya se fue, y con `?propuesta=` el editor dice «no está guardado en este navegador»
  en vez de inventar un proyecto vacío.
- **«Aceptar» cerraba en la base cambios que el editor nunca vio.** Lo del mismo canal se junta en la
  propuesta abierta: con el editor mostrando op1, op2 pedida desde el teléfono se sumaba a la MISMA,
  y aceptar op1 la cerraba entera (op2 se perdía y su link decía «ya se aceptó»). La raíz ya estaba en
  main: `resolverPropuesta` cerraba sin mirar la versión. El primer arreglo (versión y cantidad
  vistas) no aguantó la segunda revisión: ver abajo.
- **El foco quedaba pegado** si se cerraba el panel antes de 4 s: se suelta al desmontar.
- **Con más de 20 abiertas, la del link no llegaba**: se traían las 20 más viejas. Ahora las 20 más
  nuevas, y la del link siempre.

**Regla que queda:** un compare-and-set al SUMAR no alcanza si al CERRAR no se mira la misma versión.

**La segunda revisión (21/10): cerrar «los primeros N» o «hasta la versión V» se rompe con una vista
vieja.** Con dos pestañas que aceptan lo mismo, la segunda cerraba un cambio que nunca vio (el total
ya se había achicado y «vi tantos como hay» parecía «vi todo»). Y con una búsqueda en vuelo mientras
se aceptaba, op1 volvía a ofrecerse y se aplicaba dos veces. Lo que quedó:
- **El cierre va por CONTENIDO** (`restarOperaciones`, `lib/editor-video/propuestas.ts`): el editor
  manda las operaciones de ESE mensaje y el server saca exactamente ésas (claves ordenadas, porque
  jsonb reordena). Lo que ya no está no se saca dos veces; lo que llegó después queda. Si choca dos
  veces, contesta «cambió», no «ya resuelta».
- **El editor ofrece sólo lo que ningún mensaje manejó** (`queMostrar`, `chat/foco.ts`): lo aceptado,
  descartado o en curso cuenta como manejado aunque su cierre no haya llegado. No renombra mensajes
  (el renombre dejaba al viejo como «el» de la propuesta y cada apertura sumaba otro). Un cierre que
  no llegó se reintenta hasta que la base lo confirma (`propuestaApi.cerrada`).
- **«Se resolvió» sólo de lo que se preguntó por id.** El editor pide por id las propuestas de su
  hilo; una que no vino en el listado de 20 ya no se da por resuelta.

**Regla que queda:** para cerrar «lo que el cliente vio», mandar QUÉ vio, no cuánto ni cuándo.

**La tercera revisión (21/10).**
- **Lo ya cerrado no se resta.** `queMostrar` restaba lo de todo mensaje manejado, también lo que la
  base ya había sacado: una operación IGUAL pedida después («dejá la música en -12» dos veces) nunca
  se ofrecía y la propuesta quedaba abierta para siempre. Ahora resta sólo lo manejado cuyo cierre
  todavía no confirmó la base.
- **Validar dos veces tiene que dar lo mismo.** `cortar_tramo` y `recortar` comparaban la duración
  ANTES de redondear a centésimas: 2.104 → 2.155 pasaba, se guardaba 2.1 → 2.15, y al volver a
  validarlo daba 0.0499… y se tiraba. Esa operación quedaba invisible y su propuesta no cerraba nunca.
  Ahora se compara después de redondear (con un margen por el punto flotante), y al cerrar el server
  saca lo que ya no valida.

**Lo que quedó SIN hacer, y por qué** (bajas de la tercera revisión; las dos piden guardar algo en la
fila, es decir una migración):
- **Un reintento de cierre ya hecho puede sacar una igual que llegó después.** Si la respuesta del
  cierre no volvió (pestaña cerrada) y en menos de 2 h se pide la misma operación, el reintento la
  saca sin aplicarla. Arreglo: una llave de idempotencia por cierre guardada en la fila, o un id por
  operación al proponerla y cerrar por id.
- **Dos pestañas del mismo proyecto** pueden reemplazar el mismo `api-X` con contenidos distintos, y
  la unión del hilo por id se queda con uno: se pierde la tarjeta «aplicada» de una y el pendiente
  queda doble. Arreglo: que el id del mensaje dependa de lo que muestra (un hash de sus operaciones),
  o el mismo id por operación.

**Lo que quedó SIN hacer:** colgar `extra.bloque` del mensaje de MaKo en el turno y dibujarlo al
llegar (`itemsDeRespuesta` hoy sólo dibuja bloques al confirmar una tarjeta): es la 1.8 de Ops
Center 3. Mirarlo de punta a punta en el navegador con las migraciones 0298 a 0302 aplicadas.

## «0 filas en `video_editor_chats`» no era que el chat no guardaba: nadie lo había usado (22/10/2026, TB2)

Misma sospecha y misma respuesta que en el Image Editor (docs/hallazgos-editor-imagen.md): en todo MaKo había 4
proyectos (ws9 ×2, ws15, ws21) y ninguna charla. En el ws3, un pedido en «Editar con IA» dejó su fila (2 mensajes) y
recargar la trajo de vuelta. **Lo que sí estaba mal:** abrir el chat volvía a guardar lo que acababa de leer (la versión de 2 →
3 y el `updated_at`, con los mismos mensajes); ahora `cargarHilo` lo une con `guardar: false`, y lo que la pestaña tenía sin guardar se
guarda por `sucio`. Abrir el editor con un proyecto vacío bajó la RAM libre de 3,3 a 2,1 GB: con muchos chats abiertos,
mirarlo se hace con un ojo en la RAM.

Quedó en el ws3, para OC8: el proyecto `99ea7dc3-466b-41d4-b624-73561b291c44` («1022») con su charla (persona u1).

**Vive en:** app/video-editor/_opencut/chat/hilo.ts (`cargarHilo`) · tests/video-editor-chat-hilo.test.ts (13) ·
*22/10/2026, chat «Chats de las tabs».*

## El chat «Editar con IA» con las piezas del Ops Center, con los colores de CapCut (22/10/2026, TB3)

El hilo es `HiloMako` (criatura «Video Editor») y la caja `CajaChat`, con el motor de siempre (nada se aplica sin «Aceptar»).
La propuesta va en el hueco `enMensaje`, y ahí también el `data-mensaje` que busca el foco de un link `?propuesta=`.
- **Las piezas usan los tokens de la app** (`--surface`, `--ink`…): sobre el panel oscuro de CapCut salían claras. `CSS_CHAT`
  los redefine con los `--cc-*` bajo `.cc-chat` (la raíz del panel), como el Web Generator con `.gma-ag`.
- **La guarda del chat único pedía el import con comillas simples** y OpenCut escribe con dobles: ahora acepta las dos.
- El rótulo del alcance ya no va en la burbuja de la persona (sigue en los chips), y el tope del pedido lo pone `enviar`.

**Vive en:** app/video-editor/_opencut/chat/PanelChat.tsx · tests/editores-chat-piezas.test.ts · *22/10/2026, chat «Chats de las tabs».*

## «No se pudo importar» con sólo el nombre: el reporte iba SIN la causa (ticket #15, Leila, 27/10/2026)

Leila reportó «No se pudo importar. ESP_Fabi sentada_limpio.mp4» desde el aviso, y el ticket llegó sin ningún error
técnico. **La causa de SU archivo no se puede saber sin el archivo**; lo que sí estaba mal, y se arregló:

- **El «Reportar a Soporte» del Toaster (`components/ui/sonner.tsx`) manda sólo el título y la descripción del aviso.** El
  error real se iba a la consola. Un aviso que puede necesitar la causa trae su PROPIA acción con el detalle técnico
  (`avisar` en `media/processing.ts`: el error, el tipo y el peso), nunca un texto que la persona tenga que leer.
- **Una lectura fallida igual sumaba el clip a la biblioteca**, sin duración ni tamaño: roto en la línea de tiempo.
  Ahora un video que mediabunny no puede leer NO se importa, y el aviso dice por qué y qué hacer
  (`media/importar-motivo.ts`, puro y con test).
- **La miniatura (decodificar el primer cuadro) tumbaba la importación entera** aunque el resto se hubiera leído. Ahora es
  como un códec sin decodificador: se importa avisando que puede verse mal.
- **Un archivo de OneDrive / Google Drive sin descargar** se lee como `NotReadableError` (o pesa 0): el porqué lo dice y
  pide «Mantener siempre en este dispositivo». Se reconoce por el NOMBRE del error: el texto cambia con la versión y el
  idioma de Chrome.

- ⚠️ **Un .mp4 CORTADO no da error: se lee como un archivo SIN PISTAS** (28/10). El índice (`moov`) va al final y una descarga
  o una copia a medias no lo trae; mediabunny no tira, devuelve cero pistas, y eso decía «no tiene imagen, impórtalo como
  audio». Ahora: «parece incompleto». Antes del arreglo del 27/10 daba justo «No se pudo importar» con el nombre: es una
  causa PROBABLE del ticket. Medido con 21 .mp4 hechos con ffmpeg (HEVC hvc1/hev1 y Main10, H.264 High 10 y 4:2:2,
  fragmentado, QuickTime renombrado, ProRes, PCM, Opus, VP9, AV1, dos audios, timecode, nombre con espacios): la
  lectura los entiende todos; sólo el cortado y el vacío fallan, y el MPEG-4 viejo (`mp4v`) entra sin códec. El nombre
  con espacio no llega a ninguna ruta (OPFS guarda por id).
- **Lo que hace falta para saber el de Leila:** que lo vuelva a importar (el aviso de ahora dice el porqué y su «Reportar
  a Soporte» manda el error técnico, el tipo y el peso) o el resultado de abrirlo en su computadora: si no se reproduce,
  está cortado; si se reproduce, el detalle técnico del aviso nuevo.

**Vive en:** `media/importar-motivo.ts` · `media/processing.ts` · `media/mediabunny.ts` (`SinPistaDeVideo`,
`errorDecodificar`) · tests/video-editor-importar-motivo.test.ts (6 roturas; el 5, con `tests/fixtures/video-chico.mp4`) ·
*27/10/2026, chat «Motion / Imagen» (claude5); el cortado, 28/10, chat «Video Editor: el ruido y los silencios de Leila».*

## «No se pudo generar los subtítulos» por CUALQUIER causa: la función no lanza y el chat sólo mira la línea (ticket 23, Leandro, 28/10/2026)

Leandro (ws 10) aceptó «generar los subtítulos» en el chat y el reporte dijo sólo «No se aplica: no se pudo generar los
subtítulos». **El diagnóstico obvio era el equivocado:** se sospechó que su IA (sólo Claude, que no escucha audio) no podía
transcribir. Los subtítulos NO pasan por la IA del negocio: los saca Whisper en el navegador (`services/transcription/`,
WebGPU y si falla WASM; de internet sólo baja el modelo, una vez). Su configuración de IA no cambia nada.

- ⚠️ **Una función que nunca lanza y deja el error en un store pierde la causa en el chat.** `generarSubtitulos` escribía
  «No se pudo descargar» / «No se reconoció la voz» en `useTrabajoSubtitulos` y volvía sin nada; el panel lo mostraba abajo
  del botón, pero `correrLarga` (`chat/aplicar.ts`) sólo ve si la línea cambió, y sin avisos escribe el genérico «no se
  pudo …». Encima había dos `return` mudos (un trabajo ya corriendo, sin proyecto) que nadie contaba. Y «Transcribir»
  (pestaña Transcripción) no mostraba ninguno.
- **La regla:** una operación larga que el chat llama devuelve un resultado `{ ok } | { ok: false, motivo }` (como
  `quitarSilencios` y `usarPlantilla`), y el botón y el chat leen el MISMO: un texto por motivo que dice qué pasó y qué
  hacer (`subtitles/resultado.ts`). Lo que lanzó se clasifica por la fase en que iba (audio, modelo, transcribiendo,
  armando).
- **El ticket no alcanza para saber cuál fue la de Leandro:** trae Chrome 156 de escritorio en Windows, sin el error
  interno. Por probabilidad: la bajada del modelo (la primera vez) o un clip sin voz. El próximo reporte ya trae el motivo.
- **Lo que NO entra:** transcribir en el servidor (con el Groq de la plataforma) para no bajar el modelo al navegador. Es
  decisión de producto, no este arreglo (Cerebro, 28/10).
- ⚠️ **Trampa al probar rompiendo: el árbol de trabajo está en CRLF (autocrlf) y el `grep` de Git Bash no ve el `\r`.**
  Un script que rompe reemplazando un texto de varias líneas escrito con `\n` no lo encuentra; si no lo avisa, corre la
  base sin romper nada y da un verde falso. El script tiene que usar el fin de línea del archivo
  (`original.includes('\r\n')`) y decir «no encontré» cuando el texto no aparece exactamente una vez. Y `node --test` sin
  terminal no escribe `# pass`: hay que pedir `--test-reporter=tap` para leer los conteos.

**Vive en:** `subtitles/resultado.ts` (puro, lo carga el test) · `subtitles/generar.ts` · `chat/aplicar.ts` (`correrLarga`) ·
`transcripcion/components/transcripcion-view.tsx` · tests/video-editor-chat.test.ts (test 52) ·
*28/10/2026, chat «Video Editor: el ruido y los silencios de Leila».*

## «No hay silencios» cuando sobran: el chat buscó en UN clip de 0,9 s porque el ejemplo del catálogo nombraba uno (tickets 31 y 32, Leila, 29/10/2026)

Leila escribió en el chat «Quiero borrar silencios y me dice que no hay cuando sobran», aceptó, y salió «No se aplica: no hay
silencios de 0,4 s o más». **El diagnóstico obvio era el equivocado:** se sospechó del detector con su ruido de fondo (lo del
28/10). La propuesta guardada lo desmiente: el modelo mandó `{"op":"borrar_silencios","ref":"v9"}`, y v9 era un pedazo de 0,93 s
(del 23,4 al 24,3 del original) de un video que ella ya venía cortando a mano. En 0,93 s no entra una pausa de 0,4 s con sus
80 ms a cada lado. El modelo copió la `forma` del catálogo, que traía siempre `"ref":"v1"`. El #32 («dice que no hay
silencios y sí los hay», por el chat de soporte) llegó UN minuto después: es el mismo episodio contado dos veces, no una
segunda prueba de que falle el detector (en el hilo hay una sola propuesta de silencios).

- ⚠️ **El `forma` de una operación es lo que el modelo COPIA.** Un parámetro opcional que aparece en el ejemplo se vuelve
  obligatorio en la práctica. El ejemplo va sin él, y el `para` dice cuándo sí: «Con "ref" SÓLO si la persona nombra un clip».
- ⚠️ **El audio de un proyecto del Video Editor no está en la base:** vive en el navegador de quien edita (OPFS). En la base
  quedan el espejo de la línea de tiempo (`video_editor_proyectos.vista`: clips, recortes y duraciones) y el hilo del chat con
  cada propuesta (`video_editor_chats.mensajes`: `propuesta.operaciones` y `refsPorId`). Con eso se ve QUÉ se pidió y sobre
  qué clip, pero no se puede medir el detector con su audio. Si su ruido además le gana al detector no se sabe: hace falta el
  archivo original.
- ⚠️ **El chat del Video Editor no manda historial** (cada pedido llega solo a `/api/video-editor/ia`). Un aviso que pregunta
  «¿las busco más cortas?» no se puede contestar con un «sí». El aviso trae la FRASE para pedirlo.
- **El botón tenía el mismo agujero:** sin nada elegido, busca sólo en el clip bajo el cabezal, que después de cortar a mano es
  un pedazo, y decía «Sin silencios» sin decir dónde había buscado.
- **La regla:** un «no encontré» dice dónde buscó y cuánto duraba, y qué se puede pedir (`textoSinSilencios`, sin el «No se
  aplica:» delante). La pausa mínima se puede pedir de 0,2 a 2 s (`pausa_min`, también por la API).
- ⚠️ **Las pistas de una escena son un OBJETO (`overlay`, `main`, `audio`), no una lista.** El primer arreglo contaba los
  clips con `(…?.tracks ?? []).flatMap(…)`: en el navegador tiraba justo cuando no había pausas. Los tests en verde no lo
  vieron porque esa parte la miraban LEYENDO el fuente; lo vio el tsc acotado. Va
  `[...tracks.overlay, tracks.main, ...tracks.audio]` (como `media/audio.ts`), en una función pura con un test que la corre
  (`clipsConSonido`).

**Vive en:** `audio/silencios-aviso.ts` (puro) · `audio/borrar-silencios.ts` · `chat/aplicar.ts` · `chat/linea.ts` ·
`lib/editor-video/chat-catalogo.ts` · tests/video-editor-chat.test.ts (test 53) · tests/video-editor-silencios.test.ts ·
*29/10/2026, chat «Video Editor: el ruido y los silencios de Leila» (claude3).*

## Los colores de MaKo en `.ce`: un ciclo de variables CSS no tira error, deja todo transparente (29/10/2026, claude3)

Martín, 29/10: «en las tabs de Editor e Image, pongas los colores de MaKo, no esos colores». La paleta `--cc-*` pasó a apuntar
a los tokens de la app (claro y oscuro: `--cc-accent: var(--primary)`, `--cc-panel: var(--surface)`…) y el oscuro dejó de
forzarse (sin `TemaOscuro`, sin `color-scheme: dark`, `dark:` sigue a `[data-tema="oscuro"]`). Lo que costó:

- **El ciclo.** Lo obvio, `.ce { --cc-accent: var(--primary); --primary: var(--cc-accent) }`, deja las DOS inválidas y todo
  transparente, sin un error. El reemplazo automático en el `CSS_CHAT` viejo produjo exactamente `--primary:var(--primary)`.
  **Regla:** `.ce` no redefine NINGÚN token de MaKo (`--primary`, `--border`, `--bg`, `--surface`, `--ink`…); sólo los nombres
  de shadcn y `--accent` (que en MaKo es el ocre de la marca). Lo fija tests/video-editor-tema.test.ts.
- **El lienzo lee tokens RESUELTOS.** `guides/reglas.tsx` y `leerToken` leen `--cc-sunken`, `--cc-panel`, `--cc-line-2`,
  `--cc-ruler`, `--cc-text-3`, `--cc-clip-audio-wave`: tienen que ser `var()` de un color plano, nunca `color-mix()`. Sin
  verificar: si el tema cambia con el editor abierto, la regla no se redibuja hasta otro motivo.
- **Blanco clavado sobre `bg-primary`.** En oscuro `--primary` es celeste (#7FA6F8) y el blanco encima no se lee: va
  `text-primary-foreground`. El blanco y el negro ENCIMA de imagen, video o clips (tiradores, insignias, guías de recorte) se
  quedan. Los colores de los clips también (son de dato, oscuros y legibles en los dos temas).

**Quedó sin hacer:** verlo en un navegador (no hubo capturas: la guardia de RAM y la pausa del Cerebro); `ArmarPlantilla`
hace `router.replace('/video-editor/<id>')` también en el teléfono (cae en la ruta de escritorio; ya era así,
`plantilla/ArmarPlantilla.tsx`); `lib/movil-creacion.ts` no lleva `propuesta` en `querySub` de `/video-editor/*`; el menú
de CapCut del editor sigue con «Nuevo proyecto» y «Volver a la página de inicio» (lleva a «¿Qué vas a crear hoy?»);
`docs/diseno-editor-video.md` §9 y la tabla de la paleta de este documento («El tema vive en `.ce`») describen todavía la
home y la paleta de CapCut.

**Vive en:** app/video-editor/capcut-theme.css · app/video-editor/plantillas-crear.ts · app/video-editor/proyectos.ts ·
app/video-editor/VideoEditorCliente.tsx (PantallaCrear) · tests/video-editor-tema.test.ts · tests/video-editor-nuevo-video.test.ts

## «Module opencut has no exported member FrameRate»: no es el wasm instalado, es la LISTA de tsc-acotado (29/10/2026, claude3)

Un `tsc-acotado` con archivos que llegan a `_opencut` (Video, y también Image, que importa piezas compartidas) dio 14 errores
en `_opencut/wasm/*` (`FrameRate`, `parseTimecode`, `TICKS_PER_SECOND`… «no exported member», y TS7016 sobre
`opencut-wasm/opencut_wasm_bg.js`). **Lo obvio era el equivocado:** `opencut-wasm` instalado es el 0.2.10 que pide
package.json y su `.d.ts` sí trae `FrameRate`. El TS7016 deja el módulo en `any`, y el re-export se queda sin miembros.
La declaración existe en el repo y no estaba en la lista: tsc-acotado sólo ve los `.d.ts` que le pasás.

**Regla:** una lista que toque `_opencut` lleva sus cuatro declaraciones: `app/video-editor/_opencut/types/opencut-wasm-bg.d.ts`,
`types/soundtouchjs.d.ts`, `types/eyedropper.d.ts` y `export/gifenc.d.ts`. Sin ellas, también salen `soundtouchjs`, `gifenc`
(TS7016) y `EyeDropper` (TS2304). Con las cuatro: 42 archivos de Video y 43 de Image sin errores.
Y una corrida de ~200 archivos juntos murió con código 134 (memoria): en tandas de ~40 con `--heap=3000`, por con-turno.

## «Transicio…» y «Multimed…» no eran por el chat: cada pestaña medía 58 px FIJOS (29/10/2026, claude3)

Martín: «el chat a la izquierda le come lugar al editor: la barra corta "Transicio…" y "Multimed…"». El chat le quita
ancho al editor (ahora se pliega: `plegable` en PantallaCrear), pero **los rótulos se cortaban a cualquier ancho de
pantalla**: `tabbar.tsx` daba `w-[58px]` a cada pestaña y `truncate` al rótulo, y a 11 px «Transiciones» pide ~66.
Ahora `min-w-[58px]` + el rótulo entero (`whitespace-nowrap`); lo que no entra lo siguen corriendo las flechas ‹ ›.
Captura comparada (main y ahora, a 300/360/460 de panel): C:/dev/revisiones/create-qa-2910/despues-barras-1440.png.

## La fila de abajo del reproductor se encimaba de 460 px para abajo: tres columnas `1fr` y botones de texto fijos (30/10/2026, claude3)

Martín mandó una captura de un 9:16 con el reproductor a ~500 px: «00:00:00:00 / 00:00:00…», ▶, «Completa ▾», la lupa,
«Relación ▾» y pantalla completa encimados, y el total cortado debajo de «Completa». La barra era
`grid-cols-[1fr_auto_1fr]` con la derecha en `min-w-0`: la derecha (~215 px de botones de texto) no se achica ni cambia de
forma, así que con menos lugar se desborda hacia la izquierda, sobre el ▶ y el tiempo. Y el reproductor puede bajar al 18 %
del editor (`editor-page.tsx`): ~155 px a 1280 con el chat abierto, ~124 con la barra lateral fija.

- **La regla:** una barra adentro de un panel que se redimensiona decide su forma por SU ancho (un `ResizeObserver` → un
  nivel puro, `preview/barra-niveles.ts`), nunca por la ventana. Cada botón de texto tiene su forma de ícono con el valor
  en el tooltip y en el `aria-label`; lo que tampoco entra pasa a otra fila. Sin `container-type`: el tooltip del editor
  no va en portal y una contención en el ancestro le cambia el bloque contenedor.
- ⚠️ **El teléfono escondía esta barra por su CLASE de Tailwind** (`[class~="grid-cols-[1fr_auto_1fr]"]`,
  `app/m/video-editor/video-editor.css`): cambiarle las clases la habría vuelto a mostrar en el celular, encimada. Ahora la
  elige por la marca `data-barra-reproductor`; lo fija tests/m-creacion.test.ts.
- **Cómo se midió sin abrir el editor** (que en el banco no sale de «Cargando…» y en Chrome real pesa 5 GB): la barra REAL
  compilada con esbuild y el `globals.css` real con Tailwind mirando sólo `app/video-editor` (liviano), y lo que habla con
  el motor (`use-editor`, `wasm`, `wasm/opencut`, `preview-viewport`, `navegacion`, `atajos-reproductor`) reemplazado por
  un stub con datos inventados; Chrome sin ventana, una fila por ancho, de 120 a 700 px. El banco quedó en
  `C:/dev/revisiones/editor-pantalla-3010/banco/` (fuera del repo).
- ⚠️ **Medir por la caja da falsos «se pisa»:** el tiempo editable tiene `-mx-1 px-1` (el fondo del hover) y su caja se
  mete bajo la «/» sin que las letras se toquen. Se mide lo que se VE: un `Range` sobre el contenido de cada pieza.
- Medido: antes, de 460 px para abajo el ▶ pisa «Completa», de 380 para abajo el total se corta y de 230 para abajo
  «Completa» sale del panel. Después, de 120 a 700 px nada encimado, afuera ni cortado, con un video de 60 s y otro de
  1 h 02 min. Capturas en `C:/dev/revisiones/editor-pantalla-3010/`.

**Vive en:** `preview/barra-niveles.ts` (puro) · `preview/components/toolbar.tsx` · `app/m/video-editor/video-editor.css` ·
tests/video-editor-barra-reproductor.test.ts · tests/m-creacion.test.ts.

## La barra de la línea de tiempo escondía herramientas: un ScrollArea con la barra de scroll OCULTA (30/10/2026, claude3)

Lo que no entraba quedaba fuera de la vista sin aviso. Medido en el banco (la barra real con las herramientas que registran
los paquetes): ocupan 983 px; a 1366 con el chat abierto el centro mide 950 y «Acercar» no se veía; a 1280, el deslizador y
«Acercar»; a 1280 con la barra lateral fija (688), siete.

- ⚠️ **El ScrollArea de Radix no deja partir una fila:** su viewport mete el contenido en un `display: table` que crece con
  lo que tiene adentro, así que un `flex-wrap` adentro nunca parte. Para que una barra se parta, va sin ScrollArea.
- **La regla:** sin lugar, primero se esconde lo `prescindible` (una marca en la herramienta, `ce/ranuras.ts`; hoy sólo el
  deslizador del zoom, que − y + repiten), por el ancho medido de la barra (`timeline/barra-ancho.ts`); si aun así no entra,
  la barra se parte en dos filas (CSS: ninguna herramienta nueva puede volver a quedar afuera). La derecha, partida, queda
  a la derecha; cada separador va con su bloque. El alto de la barra pasó a MÍNIMO (sólo lo usaba ella).
- ⚠️ **En el banco, el `useEditor` falso tiene que comparar las listas por elemento**, como el de verdad: un selector que arma
  una lista nueva en cada lectura hace que `useSyncExternalStore` re-dibuje sin fin (React #185). Y el índice del wasm
  (`_opencut/wasm`, media-time.ts) va REAL: sólo el módulo crudo `wasm/opencut` se reemplaza (`banco/stubs/opencut-crudo.ts`).
- Después: en los siete casos nada afuera; a 950 una fila sin el deslizador, a 864 y 688 dos filas (67 px). Capturas en
  `C:/dev/revisiones/editor-pantalla-3010/barra-linea-*.png`.

**Vive en:** `timeline/barra-ancho.ts` (puro) · `timeline/components/timeline-toolbar.tsx` · `hooks/use-ancho.ts` (el ancho,
compartido con la barra del reproductor) · `ce/ranuras.ts` (`prescindible`) · tests/video-editor-barra-linea.test.ts.

## Los paneles de arriba se achicaban hasta no leerse: mínimos en % del editor (30/10/2026, claude3)

Los mínimos eran 15 % / 18 % / 15 % del ancho del editor: ~130 px con el chat abierto a 1280, ~103 con la barra lateral
fija. Medido en el banco (los paneles reales; el stub del motor con un comodín y un proyecto inventado): la biblioteca
aplasta «Importar» y la zona para arrastrar de 240 px para abajo y las corta de 160; en propiedades, de 160 para abajo no se
lee nada, y el rótulo (`max-w-[45%] truncate`) cortaba «Cuadros por segundo:» aun a 300.

- **La regla:** un panel que se redimensiona tiene un mínimo en PÍXELES, el de lo que tiene adentro. react-resizable-panels 2
  sólo entiende %: se pasan con el ancho MEDIDO del grupo (`components/editor/minimos-paneles.ts`, 280 / 160 / 280), y si no
  suman se achican parejo hasta el 96 %. La librería agranda al mínimo el panel que quedó más chico
  (`reevaluatePanelConstraints`): cambiar `minSize` con el editor abierto funciona.
- Un rótulo de una ficha de dos columnas se PARTE en renglones, no se corta (`detalles.tsx`).
- Capturas: `C:/dev/revisiones/editor-pantalla-3010/paneles-antes.png` y `paneles-despues.png` (252, 280 y 320 px).

**Vive en:** `components/editor/minimos-paneles.ts` (puro) · `editor-page.tsx` · `panels/properties/detalles.tsx` ·
tests/video-editor-paneles-minimos.test.ts.

## SIN RESOLVER: el editor no carga en un Chrome sin ventana (el banco), se queda en «Cargando…» (29/10/2026)

Para el QA visual se armó un banco (las pantallas reales compiladas con esbuild, sin `next dev`). El editor de Video crea el
proyecto y navega, pero `EditorProvider` no sale de «Cargando…» ni en 75 s, con o sin recargar. **Descartado, medido:**
ningún `fetch` pendiente; WebGPU da adaptador y `requestDevice` contesta; OPFS e IndexedDB abren; el hilo de la página no
está trabado (un `setTimeout` cada 1 s corre); con la GPU real (`--ignore-gpu-blocklist`) tampoco. La espera está adentro
de `initializeGpuRenderer()` o de `project.loadProject` (migraciones, medios, fuentes): falta poner marcas ahí para saber
cuál. Hasta entonces el editor de Video se mira en producción, o por partes (la barra se probó suelta).
Vive en: components/providers/editor-provider.tsx (`loadProject`), core/managers/project-manager.ts.

## MaKo toma la iniciativa en el chat del Video: los subtítulos primero (5/11/2026)

**Lo que se hizo (T11 de docs/mako-iniciativa/plan.md):** con voz, sin subtítulos y la charla vacía, el chat pregunta «¿Lo van a
ver sin sonido?» (lib/aperturas/video.ts) en lugar de las ocho píldoras; «Sí, en el feed» corre `generarSubtitulos` (el motor del
botón) y dice el resultado con `textoDeSubtitulos`.

**Trampas:**
- **La apertura es pura y no conoce el editor**: lo que cuenta (`subtitulosDe`, las pistas) importa el WASM y no carga en node. El
  chat cuenta y le pasa números. Y el detector es `subtitulosDe`, nunca `sinSubtitulos` (ése BORRA).
- **«No, con sonido» es por proyecto**: alcance `entidad` con el id del proyecto en la clave (`video:sin-sonido|<id>`, saneado a
  `[A-Za-z0-9_-]` para que la ruta la acepte).
- El `tsc` acotado de PanelChat da rojos de `soundtouchjs` y `EyeDropper`: son tipos globales que el acotado no ve, no del cambio.

**Vive en:** lib/aperturas/video.ts, app/video-editor/_opencut/chat/PanelChat.tsx. Lo fija tests/iniciativa-video.test.ts.


## Palabras clave automáticas y los presets de la marca: lo que pidió Leila (6/11/2026, nube)

**Lo que se hizo:** «Resaltar palabras clave automáticamente» dejó de estar en «Próximamente» (Biblioteca › Subtítulos ›
Subtítulos automáticos), el panel de un subtítulo suma «Palabras clave» (prender, color) y «Guardar como preset», y
Subtítulos › Plantillas arranca con «De tu marca». Por chat y por la API: `palabras_clave` (auto · estas · ninguna),
`usar_preset_subtitulos`, y `listar/guardar/borrar_preset_subtitulos`.

- **Qué se elige es una regla, no una IA** (`subtitles/claves.ts`): gratis, en el navegador, y se prueba. Pesan: las de la marca
  (`siempre` del preset), números y montos, palabras de venta, números dichos con letras y nombres propios (mayúscula que no
  abre la frase). La palabra de contenido sola entra desde 6 letras: un subtítulo de relleno queda SIN clave (resaltar por
  resaltar apaga a la que importa). La repetida en los dos de antes pierde 5: una de venta (7) cae debajo del mínimo; un
  número (10), no.
- **Se guardan las PALABRAS (normalizadas), no las posiciones** (`subtitulo.claves`): corregir una letra o «Dividir» no corre el
  color a otra palabra. Y no se declara en `params/extra` (lo declarado se dibuja como control) y va en `NO_ESTILO`: es de SU
  texto, como los tiempos. El color (`subtitulo.clavesColor`) sí es estilo y sí se declara.
- **El dibujo no se tocó: se generalizó el color por palabra.** `resaltadoDe` devuelve el resaltado también SIN karaoke cuando hay
  claves (modo «ninguno», nada atenuado), y `colorDePalabra` decide: la que se dice gana, después la clave, después el texto. Un
  .srt importado lleva claves (no necesitan tiempos). Sin karaoke ni claves sigue siendo `null` y el dibujo va por el camino de siempre.
- **Un preset es una PLANTILLA del editor con nombre, relativa al lienzo** (`plantillaDeParams` es la inversa de `paramsDePlantilla`).
  Guardar los params crudos del motor fallaba sin error: el `fontSize` es relativo al alto del lienzo y el relleno del fondo al
  `fontSize`, así que un preset de 16:9 salía la mitad de grande en 9:16. El relleno vuelve a «em» con
  `param × REFERENCIA / (15 × alto)` (no depende del tamaño de letra). Ida y vuelta exacta para las 16 de fábrica en los dos lienzos.
- **Los presets viven en el NEGOCIO, no en el navegador** (`app_settings` `video_editor.presets_subtitulos`, una lista; sin
  migración): los ve todo el equipo. «Por cliente» lo da que una agencia tiene un negocio por cliente; `marca` es la etiqueta
  libre dentro de uno. Se escribe con compare-and-set y reintento (`cambiarSettingSi` ya compara por `updated_at` con valores largos).
  Leer es ESTRICTO: guardar sobre una lista vacía por una base caída borraría los de la marca.
- **Un preset escribe SIEMPRE sus claves** (en ninguna si no las usa), como una plantilla escribe siempre el trazo: si no, pasar
  de uno con claves a uno sin ellas las dejaba. Y se aplica en UN paso de deshacer (`aplicarEstiloASubtitulos` con `porSubtitulo`).
- **La API busca el preset ANTES de proponer y la propuesta lleva el id** (`proponerEnElEditor`): un nombre mal escrito vuelve con
  la lista, y renombrarlo antes de aceptar no rompe la propuesta. Dos con el mismo nombre en marcas distintas: se pide la marca.
- ⚠️ **El test que fijaba «borrar_silencios_video es la ÚLTIMA del área» (test 51 del chat) se rompía con cualquier operación
  nueva**: era la regla «una nueva va al final» escrita como una foto. Ahora dice lo que cuida: va detrás de las que ya estaban.
- ⚠️ **En la nube no hay `node_modules`** (`npm ci --ignore-scripts` primero) y el `tsc-acotado` del editor muere con el heap de
  2,5 GB: va `--heap=8192`. Los rojos de `soundtouchjs` y `EyeDropper` son de la lista, no del cambio.

**Sin hacer:** agrandar o hacer rebotar la palabra clave (tipo Hormozi: necesita medir el renglón con dos tamaños, `text/dibujar.ts`);
emojis de IA; marcar o desmarcar UNA palabra a mano desde el texto del subtítulo (hoy: el chat con «estas», o prender/apagar); nada
se miró en un navegador (la nube no corre el editor).

**Vive en:** `app/video-editor/_opencut/subtitles/{claves,presets,insert,estilos,generar}.ts` · `text/resaltado.ts` · `text/dibujar.ts` ·
`subtitles/components/{assets-view,pestana-subtitulos}.tsx` · `lib/editor-video/presets-subtitulos{,-server}.ts` ·
`app/api/video-editor/presets/route.ts` · `chat/{linea,aplicar,comandos,contexto}.ts` · test `tests/video-editor-subtitulos-claves.test.ts`.

*6/11/2026, sesión en la nube (`cli_e9e561bd-9357-538e-a412-924b21532f41`).*

## B-roll y cambios de plano automáticos, al estilo de Submagic (6/11/2026, nube)

**Lo que se hizo:** Biblioteca › Multimedia › «B-roll de MaKo» (y su botón en la barra de la línea de tiempo): «Proponer» lee lo
que se dice, pone fotos de Pexels encima del video donde se dice algo que se puede mostrar y, si se pide, cambios de plano
(acercamientos al ritmo de las frases). Cada propuesta queda en la línea de tiempo con borde punteado y se deja o se saca una por
una (o todas). Por el chat del editor (`broll`) y por la API de MaKo (`proponer_broll_video`). Sumó el efecto «Acercar».

- **DÓNDE lo decide el código; QUÉ, la IA del negocio** (`lib/editor-video/broll.ts`). Los huecos arrancan donde arranca una frase,
  duran de 1,5 a 4 s, dejan libre el gancho (2 s) y el cierre, no pisan nada de lo que la persona ya puso encima y están
  separados por el aire del ritmo, así que cualquier subconjunto que elija la IA también lo está. La IA elige por NÚMERO y escribe
  la búsqueda; un número que no está, una búsqueda con una URL o repetida se descartan (`eleccionDeIA`). Sin IA, el respaldo
  busca la palabra más fuerte de la frase: el B-roll sale igual.
- **Las palabras de un subtítulo y las de una foto no son las mismas.** Las palabras clave premian números, «gratis», «importante»:
  se resaltan pero no se fotografían. El B-roll saca números (también los dichos con letras: «tres semanas»), lo abstracto y las
  formas verbales evidentes (`-aba`, `-ando`, `-aron`): «llegaba» pesaba por largo y no tiene foto.
- **La fuente es Pexels con la clave de CADA negocio** (`lib/pexels.ts`, la integración «Pexels» con sus tres registros y su
  logo de simple-icons). Su licencia deja el uso comercial sin atribución obligatoria; Openverse (el de las portadas) está
  «licencia no verificada» para anuncios. Su API pide nombrar a quien sacó la foto: va en cada fila y en el elemento. El
  navegador pide la foto por su ID; la URL la dice Pexels y sólo se baja de `images.pexels.com`, por `fetchSeguro` y con magic
  bytes. Sin la clave, el modal de Pexels se abre en el mismo panel.
- **El cambio de plano es una CAPA del efecto «Acercar», no un cambio en el clip.** Una capa de efecto cambia todo lo que tiene
  debajo, así que la pista «Planos» va ÚLTIMA (pegada a la principal): acerca sólo a quien habla, no las fotos ni los textos de
  arriba. Cortar o escalar el clip de la persona habría sido pisar lo que editó. Cortan en el borde de una frase, el primero va
  abierto, y el cerrado fuerte va donde se dice algo con peso.
- **Lo pendiente se CALCULA de la línea de tiempo, no se recuerda.** La marca `mako.propuesta` («broll» o «plano») va en los
  params del elemento (como las marcas de las plantillas): sobrevive a recargar y a un Ctrl+Z, y el panel la lee de ahí.
  «Dejar» la vacía y «Sacar» borra; ninguna de las dos toca un elemento sin la marca, y una pista de MaKo que queda vacía se va.
  Volver a proponer reemplaza sólo lo pendiente del tipo que se volvió a calcular: si Pexels falló, lo propuesto antes se queda.
- **Sin subtítulos, se transcribe acá mismo y no se ponen** (Whisper en el navegador, como «Subtítulos automáticos»): el B-roll
  no obliga a subtitular.
- **Probado con respuestas de un modelo escritas a mano** (tests/video-editor-broll.test.ts: 20 casos, 19 roturas). La IA real se
  prueba desde la PC con `scripts/probar-broll-ia.mts` (tres guiones ficticios, en el Cliente de Prueba): la nube no tiene claves.

**Sin hacer:** videos de Pexels como B-roll (sólo fotos); «Cambiar por otra foto» de una propuesta (las alternativas ya llegan de
la búsqueda y no se guardan); el acercamiento va al centro del cuadro (no sigue la cara); nada se miró en un navegador ni se
corrió con la IA real.

**Vive en:** `lib/editor-video/{broll,broll-pexels,broll-ia,broll-prompts,claves}.ts` · `lib/pexels.ts` ·
`app/api/video-editor/broll/route.ts` · `app/video-editor/_opencut/broll/` · `effects/definitions/efectos.ts` («acercar») ·
`timeline/components/timeline-element.tsx` (el borde punteado) · `chat/{linea,aplicar,comandos}.ts` · test
`tests/video-editor-broll.test.ts` · arnés `scripts/probar-broll-ia.mts`.

*6/11/2026, sesión en la nube (`cli_e9e561bd-9357-538e-a412-924b21532f41`).*

## Clips mágicos: de un video largo a varios cortos, cada uno en su proyecto (6/11/2026, nube)

**Lo que se hizo:** Biblioteca › Multimedia › «Clips mágicos»: «Buscar los mejores momentos» lista los clips (título, puntaje
de 0 a 99, lo primero que se dice y su tramo) y «Abrir» arma cada uno en un proyecto NUEVO, vertical y con subtítulos; el
original no se toca. Por el chat del editor (`clips_magicos`) y por la API de MaKo (`buscar_clips_video`). Cómo lo hacen
OpusClip y SamurAIGPT/AI-Youtube-Shorts-Generator (MIT), y qué se tomó: [investigacion-video-clips.md](investigacion-video-clips.md).

- **Un clip es un tramo de FRASES ENTERAS, y la IA nombra frases, no tiempos** (`lib/editor-video/clips.ts`). Arranca después
  de un punto o de una pausa de 0,8 s y termina igual; dura de 15 a 60 s. La IA del negocio devuelve `desde`/`hasta` por
  número; un número fuera de su pedazo, al revés, un tramo de menos de 15 s o más de 60, o sin título se descartan, y los
  tiempos los pone el código. El repo abierto le pide tiempos al modelo: acá no (un dato exacto no lo transporta un modelo).
- **El puntaje es de 0 a 99 en cuatro partes, como el de OpusClip**: GANCHO (una pregunta o un «el error…» arrancando),
  VALOR (palabras que pesan por minuto), RITMO (de 2,3 a 3,6 palabras por segundo, sin pausas largas) y CIERRE (termina en una
  idea y dura de 20 a 45 s). Sin IA decide él (`clipsDeRespaldo`); con IA, la IA pone el suyo y el código valida lo demás. El
  «Trend» de OpusClip no: sin datos de afuera no se mide.
- **Dos clips no se pisan más de la mitad** (del más corto: la regla de SamurAIGPT) y un video largo va a la IA en pedazos de
  20 minutos con un minuto de solape (la misma), hasta seis (dos horas). Si un pedazo falla y otro no, quedan los que llegaron.
- **Abrir COPIA el proyecto** («Duplicar proyecto», que copia también sus archivos) y trabaja sobre la copia: corta todo lo de
  afuera con el mismo corte de «Edición basada en la transcripción» (corre y recorta los subtítulos), con 0,15 s de aire;
  pasa el lienzo a 9:16 y agranda el principal recortándolo al centro (`principalCubriendo`, la geometría de las plantillas);
  saca los subtítulos (estaban ubicados para el horizontal) y los genera de nuevo con la plantilla y las palabras clave de
  Subtítulos automáticos; deja el historial de deshacer vacío y le pone el título del clip. Si algo falla en el medio, la copia
  se borra y vuelve el original. ⚠️ Copiar un video de una hora pesa lo mismo que el original en el navegador de la persona:
  por eso se abre de a uno, cuando se pide, y no se arman todos de una.
- **Lo que se dice sale de un solo lugar para el B-roll y los clips** (`broll/frases-del-video.ts`): los subtítulos si hay; si
  no, Whisper en el navegador, sin ponerlos.

**Sin hacer:** seguir la cara al pasar a vertical (va al centro); las pistas de arriba del horizontal (fotos, textos) quedan
como estaban; nada se miró en un navegador ni se corrió con la IA real (la nube no tiene claves): para eso está
`scripts/probar-clips-ia.mts --ws 3`, que corre lo mismo que la ruta sobre dos videos largos de ejemplo y marca un clip
fuera de 15-60 s, dos que se pisan o más de los pedidos.

**Vive en:** `lib/editor-video/{clips,clips-ia,clips-prompts}.ts` · `app/api/video-editor/clips/route.ts` ·
`app/video-editor/_opencut/clips/` · `broll/frases-del-video.ts` · `chat/{linea,aplicar,comandos}.ts` · test
`tests/video-editor-clips.test.ts` · `scripts/probar-clips-ia.mts` · [investigacion-video-clips.md](investigacion-video-clips.md).

*6/11/2026, sesión en la nube (`cli_e9e561bd-9357-538e-a412-924b21532f41`).*


## Edición automática con agentes, copiada del reel de Higgsfield (9/11/2026, nube)

**El pedido, textual:** «PARA LA EDICIÓN EN MAKO, ESTO QUIERO: https://www.instagram.com/reel/DffGz6yu565/». El reel (12,5 s, bajado
en la rama `referencias/reels-0911`) es una toma en mano de un monitor con el editor «Higgsfield Shorts»: un enjambre de agentes
(«razor-02», «caps-01», «broll-01», «mix-01», «16 agents live») edita un reel en vivo, con cursores con nombre, un registro «SWARM
ACTIVITY» con la hora del video y «52 ops/s», los subtítulos probándose uno por uno («A/B testing caption fonts…») y un «QA ✓» al final.

**Lo que se hizo:** «Edición automática» (barra de la línea de tiempo, Multimedia, chat `edicion_automatica`, API
`editar_video_automatico`): diez agentes corren en orden lo que el editor YA sabía hacer (pausas, subtítulos, estilo, muletillas,
palabras clave en lima, B-roll, planos, voz limpia, −14 LUFS, revisión), con el panel del registro, sus cursores y la pastilla «N
agentes en vivo». Tres plantillas de subtítulo nuevas, las del reel: «Lima» (minúsculas, sin caja), «Recuadro Bebas» y «Marcador».

- **El diagnóstico obvio era el equivocado: el reel no pide su propia edición.** Lo que se ve encima (los dos logos, la placa «Fable
  5.2 + Higgsfield MCP = 🔥», el cierre «Comment "Shorts"…» y la música con golpes, sin voz) es el promocional; lo que pide es el
  EDITOR que filma. Copiar las placas habría sido copiar el envoltorio.
- **Cada agente corre la función de su botón con el «Aceptar» del chat** (`aceptarPropuesta`), no una implementación propia: la misma
  revisión contra la línea de tiempo de AHORA y los mismos comandos del motor. El B-roll y los planos, con `proponerBroll` (quedan
  propuestos con su borde punteado). Antes de cada paso se vuelve a leer la línea de tiempo: el orden importa (se corta ANTES de
  transcribir, así los subtítulos nacen con los tiempos ya cortados; el B-roll lee los subtítulos).
- **«Deshacer todo» cuenta los pasos del HISTORIAL, no los pasos del plan.** Un paso puede dejar más de uno (o ninguno). El
  `CommandManager` no tenía cómo contarlos: se le sumó `profundidad()`, y la corrida guarda la diferencia y la línea de tiempo del
  principio; deshace sólo si nadie tocó nada después y verifica que volvió exactamente a la de antes (si no, rehace).
- **El «Aceptar» del chat que corre a los agentes es un `aceptarPropuesta` adentro de otro.** El del chat carga la corrida con un
  `import()` (un ciclo de módulos entre `chat/aplicar.ts` y `enjambre/correr.ts` al cargar) y suma `hecho.pasos` (no `pasos++`):
  así «Restaurar» del chat deshace todo lo de los agentes.
- **Una prueba de estilo se aplica DE VERDAD, se mide y se deshace.** Así el A/B del reel se ve en el reproductor y el historial
  queda sólo con el elegido. Se deshace sólo si el historial creció en uno y la línea de tiempo es la que dejó la prueba: si la
  persona tocó algo en esos 700 ms, la prueba queda y no se le deshace lo suyo. La medida son los renglones que dejó
  `partirYUbicar` al aplicar (más de dos no entra), no una opinión («too plain» del reel no se puede medir).
- **El estilo que eligió la persona no se toca**: subs-03 sólo prueba si los subtítulos los puso esta corrida con la plantilla por
  defecto. Con un preset de la marca, otra plantilla o subtítulos que ya estaban, se saltea y lo dice.
- ⚠️ **El saneador de los presets reconstruye el estilo campo por campo**: «minúsculas» (nueva, de «Lima») se perdía en silencio al
  guardar un preset desde un subtítulo «Lima». Se sumó en `sanearEstilo`, en el resumen y en la edición por la API.
- ⚠️ **Dos tests fijaban una FOTO**: «clips_magicos es la última operación de la API» y «el editor tiene 39 escrituras». El primero
  pasó a decir lo que cuida (va detrás de las que ya estaban); el segundo, la cuenta nueva con su porqué.
- ⚠️ **Un test de «va sola» puede pasar por otra razón**: con `eliminar_muletillas` al lado y la regla borrada, seguía verde porque
  sin transcripción las muletillas se descartaban igual. Se cambió por un volumen, que sí se resuelve solo. Lo encontró romperlo.
- ⚠️ **El zoom de la línea de tiempo vive en el estado del componente**, no en un store: los cursores lo leen de `data-ce-pps` en la
  caja que scrollea (y de `data-ce-zona` cada panel).
- ⚠️ `tests/doer-recetas-video-imagen.test.ts` da «does not provide an export named MAKO_ACCION_TOOLS» con Node 22 y pasa con Node 24:
  es del entorno (`scripts/node24.sh`), no del cambio.

**Lo que encontró la revisión adversarial (un lector que no escribió el código), y ya está arreglado con su test:**

- **Cortar las pausas DEBAJO de subtítulos que ya estaban los desfasa**: sus tiempos por palabra no se mueven con el corte. Con
  subtítulos, corte-01 se saltea y dice por qué («usa "Borrar silencios" antes de subtitular»).
- **El volumen renormalizaba a −14 un clip que la persona había puesto en TikTok** (−11). mezcla-02 sólo toca los que no tienen
  NINGÚN objetivo; la revisión dice «normalizado (con el objetivo que elegiste)» y no «sin normalizar».
- **«No había nada que hacer» se adivinaba por el prefijo «No se aplica: »**, que lleva CUALQUIER motivo de «Aceptar»: un reconocedor
  de voz que no bajó se anotaba como «salteado» y no como falla. `esNadaQueHacer` (plan.ts) reconoce sólo los textos de las
  funciones (`NO_ENCONTRE`, «Ya no hay nada que cambiar», las muletillas, `MOTIVO_SUBTITULOS['sin-voz']`).
- **Lo propuesto sin decidir no es el corte final**: la revisión marca las propuestas de B-roll y planos que nadie dejó ni sacó.
- **«Deshacer todo» después de que la persona tocó el editor deshacía lo suyo también** (los pasos del historial incluyen sus
  cambios). Si tocó algo mientras trabajaban (`vigilarToques`: un clic o una tecla fuera de la biblioteca, o la línea de tiempo
  distinta de la que dejó el último paso), no hay «Deshacer todo» y se dice. Y corrida desde el chat, tampoco: la deshace «Restaurar».
- **La prueba de estilos dejaba el estilo descartado en «Rehacer»**: Ctrl+Y lo volvía a poner. `olvidarRehacer()` en el historial.
- **El estilo elegido se guardaba como la plantilla de la persona** para todos sus proyectos: ya no; es de este proyecto.
- **El chat sin `try`**: un error de la corrida se tragaba la respuesta del chat. Ahora dice «se cortó por un error» y el resto sigue.
- El panel: el registro se pega abajo sólo si la persona no subió a leer, «ops/s» en 0 cuando no corre, el paso actual con
  `aria-live`, y «Reportar a Soporte» con el resumen de lo que falló.

**Sin hacer (lo que el reel tiene y acá no):** el medio del B-roll que se BAJÓ no se borra con «Deshacer todo» (queda en
Multimedia, sin usar); el agente de color (el reel corrige exposición, grano y sombras: hace falta MEDIR la
luz de un cuadro antes de tocarla); el «whoosh» en los cortes (no hay biblioteca de efectos de sonido con licencia elegida); los
monitores de forma de onda, vectorscopio y la lectura de LUFS integrados; el subtítulo ESCALONADO (cada renglón corrido, «Stagger
Stack»: pide medir y dibujar renglón por renglón en `text/dibujar.ts`); la tarjeta flotante con una grabación de pantalla («masked
card») y el collage de papel rasgado; los agentes en PARALELO (acá van de a uno: dos comandos sobre la misma línea de tiempo a la vez
se pisan). Nada se miró en un navegador ni se corrió con la IA real.

**Vive en:** `app/video-editor/_opencut/enjambre/{plan,estado,correr,cursores,registro}.ts` · `enjambre/components/{enjambre-view,en-vivo,cursores}.tsx` ·
`chat/{aplicar,linea,comandos}.ts` · `core/managers/commands.ts` (`profundidad`) · `subtitles/estilos.ts` · `lib/editor-video/{chat-catalogo,chat-api,presets-subtitulos}.ts` ·
test `tests/video-editor-enjambre.test.ts` · relevo `docs/relevo/edicion-reel-nube.md`.

*9/11/2026, sesión en la nube (`cli_cae9a776-2d98-55b4-aef5-3102e4b201b5`).*

