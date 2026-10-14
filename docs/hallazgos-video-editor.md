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
- Los `.mp4` de `/anuncios/` y `/formatos/` (medido con curl contra `hola-mako.com/anuncios/anuncio-1.mp4`).
  Al bajar un medio se valida el `content-type` (`video/*`), no el status.

Es la familia de `hallazgos-infra.md` → «El manifest de la app estaba detrás del login».

## Subtítulos con Whisper en el navegador

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

## El DSP de audio propio: cada fórmula de libro se midió, y estaba corrida

**Vive en:** `audio/dsp/{ruido,intensidad,ritmos,tono}.ts` · `tests/video-editor-audio.test.ts`

- ⚠️ **«El percentil bajo de la magnitud es el piso del ruido» era falso**: subestima la potencia del
  ruido unas 5 veces, y la pausa bajaba sólo 3,6 dB. La magnitud de un ruido en una banda sigue una
  Rayleigh, y el percentil se corrige con esa distribución (`ruido.ts`).
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

## Lo que quedó SIN hacer

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
- Bilingües, palabras clave y Emojis de IA apagados (`subtitles/components/assets-view.tsx`); dividir y
  combinar con Enter / Retroceso y «Buscar y reemplazar» (`subtitles/components/pestana-subtitulos.tsx`).
- Los tiempos por palabra no se guardan: sin resaltado tipo karaoke (`subtitles/generar.ts`,
  `params/extra/subtitulos.ts`). Modelo fijo whisper-small, ≈250–300 MB la primera vez
  (`transcription/models.ts`).
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
