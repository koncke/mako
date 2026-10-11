# Hallazgos — el Video Editor (la copia de CapCut)

La tab Video Editor (`app/video-editor/`) es una copia de CapCut Desktop 9.3 armada sobre el motor de
OpenCut classic portado (MIT). El plano —decisiones, arquitectura, ranuras, reglas y paquetes— está en
[diseno-editor-video.md](diseno-editor-video.md); los relevamientos que lo sostienen, en
[editor-video/](editor-video/). Lo que se hizo está en el commit; acá va lo que hay que saber **antes**
de tocarlo: el síntoma, la causa, dónde vive y la regla que queda.

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
sin el efecto y el error queda sólo en la consola. Tres formas de llegar ahí:

- **Un uniform con un nombre de la cabecera.** El «Giro» del Remolino se mapeaba a `u_giro`, que la
  cabecera ya declara: «redefinition», y el Remolino no hacía nada. Los nombres reservados están en la
  cabecera de `pases-ce.ts`; los frena `tests/video-editor-color.test.ts`.
- **Un `sampler3D` sin unidad propia.** En WebGL2 dos samplers de tipos distintos no pueden apuntar a la
  misma unidad, y uno sin asignar apunta a la 0, donde está la imagen: sin LUT elegida, `INVALID_OPERATION`
  en el draw. `ce-ajuste` manda `u_lut` siempre (0 = identidad 2³) y `pases-ce` lo enlaza en la unidad 2.
- **Un uniform que no se manda HEREDA el valor de la vuelta anterior** (quedan guardados en el
  programa). Lo que un pase no manda tiene que poder heredar sin daño, o `pases-ce` lo resetea.

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
horizontal; se calcula desde el lado corto, en px, y se convierte (`subtitles/estilos.ts`).

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

## Decodificar fuera del reproductor: nunca el `videoCache`

**Vive en:** `services/video-cache/service.ts` · `timeline/components/miniaturas.ts` · `recorte/cuadro.ts` ·
`retime/revertir.ts`

El `videoCache` es del reproductor: UN decodificador por medio, con los pedidos numerados por
«generación». Un pedido de la línea de tiempo (miniaturas) o de un comando (Congelar, el diálogo de
Recortar) invalida el cuadro que espera el reproductor o le salta el decodificador: la reproducción
tartamudea o la imagen salta. Los cuadros fuera del reproductor salen de un `Input` y un `CanvasSink`
de mediabunny PROPIOS, que se cierran con `dispose`. Y tres trampas de `CanvasSink`:

- **Con `poolSize` recicla sus lienzos en anillo**: guardar cuadros para codificarlos después
  (Revertir) da N veces el último. Para guardar, `poolSize: 0`, con la ventana calculada por memoria
  (~200 MB): a 1080p son 8 MB por cuadro, unos 15 GB por minuto.
- **`canvasesAtTimestamps` devuelve `null` antes del primer cuadro**, y muchos videos empiezan en
  0,033 s. Cada `null` dejaba el pedido sin caché, el aviso de «llegaron cuadros» redibujaba y se volvía
  a pedir: decodificación en bucle. Se pide con `max(t, getFirstTimestamp())` y se recuerdan los pedidos
  sin cuadro o con error.
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
- **`decodeAudioToFloat32` deja un `AudioContext` vivo por llamada**, y Chrome topea los contextos
  vivos. Para decodificar o remuestrear, `OfflineAudioContext` (los subtítulos ya lo usan; la función de
  `media/audio.ts` es de J y sigue igual).

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

**Vive en:** `params/extra/` · `components/editor/panels/properties/respaldo-contenido.tsx`,
`hooks/use-params-con-fotogramas.ts` · `timeline/animation-targets.ts` · `services/renderer/resolve.ts` ·
`subtitles/build-subtitle-text-element.ts`

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
  `grep "hsl(var"`; queda uno (ver «sin hacer»).
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
- Los `.mp4` de `/anuncios/` y `/formatos/` (medido con curl contra `hola-mako.com/anuncios/anuncio-1.mp4`).
  Al bajar un medio se valida el `content-type` (`video/*`), no el status.

Es la familia de `hallazgos-infra.md` → «El manifest de la app estaba detrás del login».

## Subtítulos con Whisper en el navegador

**Vive en:** `services/transcription/worker.ts` (`detectarIdioma`) · `transcription/models.ts`,
`transcription/audio.ts` (`trocearAudio`), `transcription/caption.ts` (`quitarNoVoz`) ·
`subtitles/build-subtitle-text-element.ts` (`partirYUbicar`) · `services/renderer/nodes/text-node.ts`

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
- **El motor de texto no parte líneas ni dibuja contorno ni sombra**: un subtítulo largo se salía del
  lienzo. Quien cambie fuente o tamaño vuelve a partir con `partirYUbicar`; hasta que haya contorno, la
  legibilidad la da el FONDO.
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

## Los textos de CapCut: el `.po` manda, con sus erratas

**Vive en:** la tabla en/es del scratchpad (no se versiona, ver el diseño) ·
`components/editor/panels/properties/video/basico.tsx` · `effects/definitions/{ajuste,efectos}.ts` ·
`commands/timeline/element/{split,duplicate}-elements.ts`

- **El relevamiento no es la fuente**: «Tamaño: aprox. 82 MB» es traducción propia; el `.po` dice
  «Duración: %1 | Tamaño: alrededor de %2» (`pc_new_size`). El texto sale de `look.py`.
- **Erratas del `.po` que se corrigen y se anotan en el comentario**: «Alinar al centro» y «Alinar arriba»
  (`pc_align_title_center`, `pc_align_title_up`), «Amplia» sin tilde.
- **Rótulos que no son los que uno adivina**: Highlights = «Iluminar», Sharpen = «Enfocar», Brilliance =
  «Luminosidad», Lightness (HSL) y Clarity = «Claridad» las dos, Glow = «Brillo» igual que Brightness. Los
  nombres de efectos y filtros vienen del servidor de CapCut y no están en el `.po`: son nuestros.
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
- **El verde de `tsc-ve` no cubre `app/api` ni `lib/`**: un paquete del editor que los toca los
  typechequea aparte.
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
- **Write convirtió el escape de U+0300 en el carácter combinante LITERAL** (en una regex para sacar
  tildes): sigue andando, pero no se lee y el acento se dibuja sobre el corchete. Pasó en
  `biblioteca-ui.tsx`, `emojis.ts`, `shapes.ts` y `flags.ts`, corregidos con un Python que arma la barra
  con `chr(92)`. Después de escribir un escape, `grep -n 'u0300'` u `od -c`. Y en un heredoc, `\p{…}`
  llega como `p{…}`.
- **El árbol de OpenCut sale con CRLF** (`core.autocrlf`) y una regex con `\n` no matchea. Se edita
  normalizando a LF y se devuelve el fin de línea original.
- **Falsa alarma, medida el 11/10:** «`\p{Extended_Pictographic}` en una regex literal es candidato a
  error con `target: ES2017`». No: con TypeScript 5.9.3 compila a ES2017 (falla recién a ES5), y el repo
  ya tiene literales así (`app/conocimientos/PortadaModulo.tsx:344`). El `new RegExp(…)` de
  `stickers/providers/emojis.ts` no hacía falta.

## Lo que quedó SIN hacer

**Nada se vio en un navegador.** La corrida prohibió levantar el dev server. Lo primero a probar: importar
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

**Paquetes sin construir: G (transiciones), H (animaciones y estilos de texto), J (audio) y M (Eliminar
fondo).** Sus contratos están en el diseño §4.1. Lo que hoy se nota: los círculos de fundido se dibujan y
se arrastran pero no se oyen (J: `params/extra` + `media/audio.ts` + `core/managers/audio-manager.ts`);
el texto sin contorno ni sombra (H: `services/renderer/nodes/text-node.ts`, y sumar las claves en
`subtitles/estilos.ts`); el vúmetro junto al tiempo (`preview/components/toolbar.tsx`, `TimecodeDisplay`);
`reflejo.vertical` existe y se dibuja pero ningún botón lo alterna (el «Voltear» va en Video › Básico).

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
- Debajo de «No se pudo exportar» va el `error.message` crudo del motor, que puede venir en inglés
  (`export/dialogo-exportar.tsx`, `export/exportar.ts:202`).

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
- Queda un `hsl(var(--primary))`, el anillo de selección invisible (`selection/selectable-item.tsx:57`).

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
- El borde `rounded-sm border` de cada panel sobra (el marco lo pone `editor-page.tsx`): queda en
  `preview/components/index.tsx:102`.

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
- Bilingües, palabras clave y Emojis de IA apagados (`subtitles/components/assets-view.tsx`); dividir y
  combinar con Enter / Retroceso y «Buscar y reemplazar» (`subtitles/components/pestana-subtitulos.tsx`).
- Los tiempos por palabra no se guardan: sin resaltado tipo karaoke (`subtitles/generar.ts`,
  `params/extra/subtitulos.ts`). Modelo fijo whisper-small, ≈250–300 MB la primera vez
  (`transcription/models.ts`).
- Texto a voz no avisa que el plan gratis de ElevenLabs no tiene licencia comercial
  (`subtitles/components/texto-a-voz.tsx`).

**Decisiones de Martín e integración**
- Sumar `video-editor` a la capa `superadmin` o probar siempre en ws3 (`lib/capas.ts`).
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

- Botón dentro de botón en `timeline/components/timeline-element.tsx` (el «Efectos» ~l.1216 vive adentro
  del botón que cubre el clip ~l.626): React lo marca como error en cuanto un clip tiene efectos.
- «Encountered a script tag while rendering React component» en el inicio después de volver con «atrás»:
  sin ubicar.
- Para mirar a ojo: Espejo deja una línea de 1 px en el centro; Saturación −50 queda igual que Blanco y
  negro; Saturación +50 deja la piel muy naranja.

*11/10/2026, chat «Video Editor»: tanda 1 (paquetes A–E), tanda 2 (F, I, K, L) y la integración.*
