# Video Editor — diseño (copia de CapCut sobre el motor de OpenCut)

> **El pedido, textual (Martín, 11/10/2026):** «Quiero que implementes un editor de vídeo
> end-to-end replicando a Capcut... Que sea identico con todas sus funcionalidades... Puedes
> investigarlo o incluso ayudarte de repositorios para ahorrate trabajo, como este:
> https://github.com/opencut-app/opencut»

Vive en `app/video-editor/` (tab «Video Editor», Content Machine › Ads, junto a Video
Generator). Este documento es el plano: qué se decidió, cómo está armado y dónde se enchufa
cada función. Los relevamientos que lo sostienen están en `docs/editor-video/`:

| Archivo | Qué tiene |
|---|---|
| `relevamiento-capcut-armazon.md` | Paleta MEDIDA, proporciones, barra superior, biblioteca, reproductor, barra y pistas de la línea de tiempo, inicio, diálogo Exportar, atajos (preset «CapCut» de Windows) |
| `relevamiento-capcut-funciones.md` | La checklist de funciones del panel derecho (Video, Audio, Texto), subtítulos, stickers, efectos, filtros, transiciones, IA, audio y licencias, fotogramas clave, modelo de datos del borrador |
| `relevamiento-opencut.md` | Qué trae OpenCut classic y qué le falta respecto de CapCut (tabla SÍ/PARCIAL/NO) |
| `relevamiento-integracion-mako.md` | Checklist de una tab nueva, choques de tokens, proxy, datos, Video Generator, reglas de AGENTS.md que pegan |
| `inventario-copia-capcut.md` | Las 158 funciones de CapCut del relevamiento contra lo hecho (15/10): hecho, a medias, falta y fuera con su motivo, por familia; y de dónde salen los subtítulos |
| `relevamiento-plantillas.md` | Las plantillas PROPIAS (decisión de Martín del 15/10): qué se copia de CapCut, de Shotstack/Creatomate y de las 81 de Remotion, con la licencia verificada de cada fuente (LottieFiles no sirve para un catálogo) |

Los textos en español de CapCut salen de SU instalación (`es-LA.po` de CapCut 9.3.0.3970), no de
la web (las páginas `capcut.com/es-es` están traducidas a máquina y no coinciden con la app).
La tabla en/es cruzada por clave está en el scratchpad de la sesión del 11/10
(`research/capcut-strings/en-es.tsv`, buscador `look.py`) y **no se versiona**: es un archivo de
ByteDance. Se copian a mano sólo los rótulos que se usan.

---

## 1. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Referencia: CapCut Desktop 9.3 (Windows), tema oscuro**, no CapCut Web | Es la que Martín tiene instalada, de la que hay textos exactos y la más completa. La Web tiene otra distribución (barra lateral vertical) |
| 2 | **Se copia TAL CUAL**: estructura, proporciones, nombres en español y colores medidos. **No** se copian binarios de ByteDance: íconos, logos, la fuente CapCut Sans, miniaturas de filtros/efectos, música | Regla de la casa «Copiar una app tal cual»; lo binario es propiedad de ByteDance. Íconos: hugeicons/lucide con la forma equivalente. Fuente: Geist |
| 3 | **Motor: OpenCut classic portado** (MIT, archivado en `cf5e79e9`, ~90k líneas, Next 16 + React 19 como MaKo) a `app/video-editor/_opencut/`. Se re-viste su UI en vez de reescribirla | Trae timeline, keyframes, máscaras, render WebGPU, export con WebCodecs, Whisper local. Lo que se porta pasa a ser nuestro (no hay parches de arriba) |
| 4 | **Sin Rust en el build.** Filtros, «Ajustar», croma, efectos nuevos y transiciones con shader corren en **WebGL2 desde TypeScript** (`services/renderer/pases-ce.ts`) | El compositor de OpenCut es Rust→WASM con UN shader registrado a mano (blur). Sumar shaders ahí exige `wasm-pack` en el build y un fork del paquete |
| 5 | **Proyectos y medios: locales (IndexedDB + OPFS), separados por workspace** (`espacio.ts`). Nada de material crudo en Supabase en v1. Exportar = descargar el archivo | El storage de Supabase no tiene el tope medido (5 GiB vs 100 GB según quién lo midió) y el video crudo pesa. El super admin mira varios clientes en el mismo navegador: sin el prefijo por workspace se mezclarían |
| 6 | **IA sin costo por default**: subtítulos automáticos con Whisper en el navegador (transformers.js); quitar fondo con un modelo de segmentación en el navegador. **Texto a voz** sólo con la key de ElevenLabs DEL CLIENTE (BYOK), con botón explícito y sin reintento | «Un default que cobra es un cobro silencioso»; «el Plan NUNCA paga IA»; Groq prohíbe exponer transcripción como servicio |
| 7 | **Sin la API de Freesound** (su ToS prohíbe el uso «service bureau») y **biblioteca de música vacía** hasta tener licencia (Epidemic Connect o pack CC0 propio). Audio propio sí: Importar, Grabar, Extraer audio | Una pista sin licencia es un reclamo de copyright sobre la campaña del cliente (`lib/musica-catalogo.ts`) |
| 8 | **Textos de pantalla en español NEUTRO (tú)**, como CapCut | AGENTS.md: el texto que ve el cliente no va en voseo; `tests/puente-panel-copy.test.ts` barre el port entero |
| 9 | **Inicio** (`/video-editor`) y **editor** (`/video-editor/<id>`) adentro de MaKo, con la barra lateral y la de secciones; el editor llena el alto bajo las secciones y la pantalla completa es a pedido (botón del reproductor). ~~A pantalla completa sin chrome~~ hasta el 13/10 | Pedido de Martín del 12/10 (reunión 858545195 @96:17, validado el 13/10): «que la barra lateral no desaparezca del todo mientras se edita». Gana sobre «CapCut es una ventana entera» |
| 10 | **Onboarding = estado vacío** («Crear proyecto»), sin entrada en el catálogo | La tab ES la herramienta (regla del 05/10, como /api-mako y el Dashboard) |

**Fuera de alcance de v1** (no se dibujan, o se dibujan apagados con «Próximamente»):
Plantillas (no hay catálogo), Dreamina, Archivos multimedia de IA, Retoque
(belleza facial), Estabilización, Flujo óptico, Seguimiento de movimiento, Subtítulos
bilingües, Música y Efectos de sonido de biblioteca (licencia), Compartir, todo lo «Pro» (el
diamante no se copia). Si Martín quiere una, se reabre.

**Reabiertas:** «Avatar de IA» (14/10, pedido de Martín): sólo «Biblioteca de avatares», generando con el
Video Generator (`app/video-editor/avatar/`). Un avatar es un escenario confirmado de su historial.

**Regla desde el 14/10 (Martín):** antes de construir una función se busca en la fuente —el relevamiento de
CapCut y el de OpenCut (`docs/editor-video/`)— y se copia. Si no está para copiar ni para inspirarse, se le
avisa a Martín ANTES de crearla.

---

## 2. Cómo está armado

```
app/video-editor/
  page.tsx                 /video-editor — guard (nav 'video-editor') + inicio
  [proyecto]/page.tsx      /video-editor/<id> — guard + editor a pantalla completa
  VideoEditorCliente.tsx   raíz `.ce` (tema), #ce-portal, monta el motor sin SSR
  capcut-theme.css         paleta medida de CapCut + tokens shadcn, limitados a `.ce`
  espacio.ts               prefijo de IndexedDB/OPFS por workspace
  portal.ts                contenedor de los portales de radix adentro de `.ce`
  ruta.ts                  rutas internas con el `?ws=`
  ce/ranuras.ts            las RANURAS (panel derecho, biblioteca, barra de la línea de tiempo)
  ce/extensiones.ts        importa todos los registros antes del primer dibujo
  _opencut/                el motor portado (MIT, LICENSE-OPENCUT)
    params/extra/          parámetros de elemento que suma cada función
    services/renderer/ganchos-ce.ts   ganchos del render (visual y de fuente)
    services/renderer/pases-ce.ts     pases de shader WebGL2 (`ce-*`)
public/ve/                 recursos estáticos (atlas de fuentes, banderas, formas), exentos del proxy por ruta
```

### 2.1 Las ranuras (`ce/ranuras.ts`)

La cáscara dibuja; las funciones se registran. Tres ranuras:

- **`pestanasInspector` / `subpestanasInspector`** — el panel derecho. Una pestaña declara
  `aplica(ctx)` (para qué elemento), `orden` y su `Contenido`. Las sub-pestañas cuelgan de una
  pestaña (Video → Básico · Eliminar fondo · Máscara · Retoque).
- **`seccionesBiblioteca`** — la columna de subcategorías de cada pestaña de la biblioteca
  (`multimedia | audio | texto | stickers | efectos | transiciones | subtitulos | filtros | ajuste`).
- **`herramientasLinea`** — la barra de la línea de tiempo (izquierda/derecha, `grupo` para los ◢).

Cada archivo de registro se suma a `ce/extensiones.ts` (una línea). Un registro que nadie
importa no existe.

### 2.2 Los parámetros (`_opencut/params/extra/`)

`element.params` es un `Record<string, number|string|boolean>` keyframeable que se guarda con
el proyecto. Una función nueva declara sus claves en `params/extra/<funcion>.ts`
(`Partial<Record<ElementType, ElementParamDefinition[]>>`) y lo suma a `FUENTES` en
`params/extra/index.ts`. Convención de claves: prefijo por función, en español
(`anim.entrada.id`, `transicion.id`, `recorte.izquierda`, `reflejo.horizontal`, `audio.fundidoEntrada`).

### 2.3 Los ganchos del render (`services/renderer/ganchos-ce.ts`)

- **Gancho visual** (`registrarGanchoVisual`): corre en `resolve.ts` después de los keyframes,
  para clips Y texto. Recibe `{transform, opacity}` y `{params, localTime, duration (segundos),
  lienzo}`; devuelve el estado modificado. Animaciones de entrada/salida/combo, reflejo (escala
  negativa → flip en el compositor), la parte geométrica de las transiciones.
- **Gancho de fuente** (`registrarGanchoFuente`): corre en `frame-descriptor.ts` antes de subir el
  cuadro decodificado; puede devolver otra imagen y otro tamaño. Recorte, quitar fondo.
- **Pases `ce-*`**: un `EffectDefinition` cuyos pases usan un shader registrado con
  `registrarPase({ id: 'ce-…', fragment })` se aplica solo, en el mismo punto, antes del WASM.
  Contrato del fragment shader en la cabecera de `pases-ce.ts`.
- Los efectos de **capa** (elemento `effect` en una pista de efectos = «Filtros»/«Ajuste»/«Efectos»
  como capa en CapCut) el WASM los aplica sobre el cuadro compuesto (`sceneEffect`), pero un pase
  `ce-*` ahí no corre: `compositor/repartir-ce.ts` lo reparte a las capas que tiene debajo en ese
  instante, en el **espacio del lienzo** (`u_capa`/`u_giro`/`u_lienzo`, ver `effects/glsl.ts`), así
  una viñeta o una sacudida quedan una sola vez sobre el cuadro. Un shader `ce-*` nuevo arranca con
  `CABECERA` de `effects/glsl.ts` y no declara uniforms con esos nombres (lo frena
  `tests/video-editor-color.test.ts`). El tiempo local llega en `params.__tiempo` (segundos).

### 2.4 Tiempos

El motor mide en **ticks** enteros (`MediaTime`, `TICKS_PER_SECOND` de `_opencut/wasm`). Los
ganchos reciben segundos.

---

## 3. Reglas para el código nuevo del editor

1. **Texto de pantalla**: el rótulo de CapCut del `es-LA.po`, literal, en tú. Corto (AGENTS.md
   «La pantalla dice QUÉ pasó»). Errores evidentes de traducción de CapCut se corrigen y se anotan.
2. **Colores**: los `--cc-*` de `capcut-theme.css`. Nada de hex sueltos en componentes.
3. **Navegación**: `Link`/`useRouter` de `@/app/_ui/Link`, o `rutaEditor()` desde managers.
4. **Portales**: `container={portalCe()}`.
5. **Atajos**: preset «CapCut» de Windows por `event.code` (teclados latinos). Ctrl+N/Ctrl+W no
   se pueden tomar en Chrome: sin atajo. Ctrl+rueda con `{passive:false}`.
6. **Nada que cobre por default**; nada que reintente lo que gasta plata ajena.
7. **Typecheck**: `node C:/dev/tsc-ve.mjs` (sólo el editor, ~40 s, se turna con los demás por el
   lock de la máquina). El completo lo corre el pre-push.
8. **Borrar** = el tacho de la casa (`tests/borrar-tacho-casa.test.ts` barre el port).

---

## 4. Paquetes de trabajo (11/10/2026)

Cada paquete es dueño de sus archivos; los compartidos se tocan con ediciones chicas y releyendo
antes. Verificación final: typecheck, `npm test`, build y una prueba en el navegador (importar,
dividir, texto, exportar MP4 y medir el archivo con ffprobe).

| Paquete | Qué | Dueño de |
|---|---|---|
| A | Barra superior, distribución de paneles, Inicio, diálogo Exportar | `editor-page.tsx`, `components/editor/*` (salvo panels), `export/`, `services/renderer/scene-exporter.ts`, `inicio/`, `project/components/` |
| B | Biblioteca (11 pestañas, columna de subcategorías, Multimedia/Audio/Texto/Stickers) | `components/editor/panels/assets/`, `media` UI, `sounds/components`, `stickers/components`, `text/components` |
| C | Panel derecho (pestañas por tipo, «Detalles», Básico de video/audio/texto, Máscara) | `components/editor/panels/properties/`, rótulos de `params/registry.ts`, `masks/components`, `graphics/components` |
| D | Línea de tiempo (barra, pistas, cabeceras, clips, regla, imán, atajos) | `timeline/components/`, `actions/`, `timeline/placement`, `ripple/` |
| E | Reproductor (cabecera, tiempo, Relación, resolución, zoom, pantalla completa) | `preview/`, `canvas/` |
| F | Color: Filtros, Ajustar, Croma, Efectos de video | `effects/`, `services/renderer/pases-ce.ts` |
| G | Transiciones | `transiciones/` (nuevo) + su gancho |
| H | Animaciones (Entrada/Salida/Combo) de clips y de texto, estilos de texto | `animaciones/` (nuevo), `text/` |
| I | Operaciones de clip: Congelar, Revertir, Reflejar, Recortar, Velocidad (normal y curva), Cortar, atributos | `commands/timeline/element/` nuevos, `retime/`, `speed/` |
| J | Audio: fundidos, Grabar, Normalizar, Marcar ritmos, Modificador de voz | `media/` audio, `core/managers/audio-manager.ts`, `audio/` (nuevo) |
| K | Subtítulos automáticos (por palabra), estilos, edición; Texto a voz BYOK | `subtitles/`, `transcription/`, `services/transcription/` |
| L | Integración MaKo: registro /admin/dev, visibilidad, Video Generator → «Editar en el editor», guardas de tests | `app/admin/dev/`, `app/video-generator/` (botón), `tests/` |
| M | Video › Eliminar fondo: automática (segmentación de personas en el navegador, MediaPipe, Apache-2.0) y la UI del Chroma key | `fondo/` (nuevo) + su gancho de fuente |

### 4.1 Contratos entre paquetes (para que trabajen en paralelo)

| Contrato | Lo define | Lo usa |
|---|---|---|
| Efecto `croma` (pase `ce-croma`), params `color` (hex), `intensidad`, `sombra`, `borde`, `limpiarBorde` (0–100, intensidad 0 por defecto como CapCut); uno por clip y corre PRIMERO en la cadena. Filas listas: `origenEfecto` (`effects/capas.ts`) + `FilaParam` (`effects/components/panel-color.tsx`) | F | M (la UI del Chroma key) |
| Efecto `ajuste` (pase `ce-ajuste`), params `temperatura` (Temp), `matiz` (Tinte), `saturacion`, `brillo`, `contraste`, `exposicion`, `luminosidad`, `resaltados` (Iluminar), `sombras`, `blancos`, `negros`, `claridad` en −50…50; `nitidez` (Enfocar), `grano`, `desvanecer`, `vineta` en 0…100; `lut` (id de la biblioteca) + `lutIntensidad`; `hsl.<color>.<matiz\|saturacion\|claridad>` en −100…100. Todo en 0 = sin pase | F | C (no dibuja Ajustar: lo registra F) |
| Params de audio `audio.fundidoEntrada` / `audio.fundidoSalida` (segundos), leídos SIEMPRE con `audio/claves.ts → leerFundidos` (no se pisan). Todo lo de audio de un clip lleva el prefijo `audio.`; lo que es del archivo (`audio.normalizar` + `audio.intensidad`, `audio.ritmos*`, `audio.extraidoDe`) no se declara, así «Pegar atributos» no lo lleva. Ritmos: `audio/ritmos.ts → ritmosEnClip(element)` en segundos del clip (ya imantan, `timeline/element-snap-source.ts`, tipo `"ritmo"`) . Al dividir, la izquierda se queda con la aparición y la derecha con la desaparición (`sinFundidoSalida`/`sinFundidoEntrada`). «Extraer audio» marca `audio.extraidoDe` y «Recuperar audio» lo borra con `sinAudioExtraido` (`timeline/audio-separation`). «Normalizar» va DENTRO de `resolveEffectiveAudioGain` (reproducción, export y forma de onda la oyen igual) | J | D (dibuja los círculos de fundido en el clip y los arrastra), I (Pegar atributos y dividir) |
| `commands/timeline/element/atributos.ts`: `cortarSeleccion(editor)`, `copiarAtributos(editor)`, `pegarAtributos(editor)` | I | D (atajos Ctrl+X, Ctrl+Shift+C/V y menú contextual) |
| Param `transicion.id` / `transicion.duracion` en el clip de la IZQUIERDA del corte. Rige sólo si el siguiente de la misma pista empieza justo ahí (±1 tick) y el id está en el catálogo: `transiciones/reglas.ts → transicionVigente` + `catalogo.ts → transicionPorId`. Se dibuja en una ventana CENTRADA en el corte sin cambiar la duración total (`transiciones/escena.ts`). Dividir, borrar el vecino y Pegar atributos/Congelar ya la sacan o no la llevan | G | D (dibuja el marcador ⧓ sobre el corte si existe; el clic llama a `abrirTransicion`) |
| Param `subtitulo` (booleano) en los textos que son subtítulos. El motor no parte líneas: si Texto › Básico/Efectos cambia fuente, tamaño o espaciado de un subtítulo, se vuelve a partir con el borde de abajo donde estaba (`subtitles/repartir.ts → useRepartirSubtitulo`, ya enchufado en `text/components/pestana-texto.tsx`). Desde el 15/10: `subtitulo.palabras` (los tiempos por palabra, JSON) NO es estilo y no viaja con «Aplicar en todos»; `subtitulo.resaltar` / `.resaltarColor` / `.noDichasOpacidad` (el karaoke) SÍ son estilo | K | D (pista «Subtítulos»), H (estilos) |
| Marcas `plantilla.*` en los elementos que pone una plantilla de anuncio (`plantilla.id`, `.hueco`, `.muestra`, `.opcional`, `.silenciar`, `.ancla`; `_opencut/plantillas/huecos.ts`). NO se declaran (como `tts` y `audio.extraidoDe`): no son controles, «Pegar atributos» y Congelar no las llevan; Dividir y Duplicar sí (las dos mitades son el mismo hueco). Desde el 15/10 | Plantillas | Reemplazar el clip, chat |
| Pestañas del panel derecho: Video›Básico/Máscara + «Detalles» (C) · Velocidad (I) · Animación y Texto (H) · Ajustar (F) · Audio (J) · Video›Eliminar fondo (M) · Texto a voz y Subtítulos (K) · Transición (G). Ids (únicos en pestañas Y sub-pestañas, porque `activeTabPerType` guarda la vista más interna): `texto` (`texto-basico`, `texto-efectos`), `animacion` (`animacion-entrada/salida/combo/bucle`), `audio-basico` y `audio-voz` (clip de audio), `audio` (`audio-video-basico`, `audio-video-voz`) en el video, `video-eliminar-fondo`, `transicion` | cada uno | C dibuja la cáscara |
| `media/importar.ts`: `importarArchivos({ editor, files, onProgress })` (procesa y guarda en el proyecto activo) | B | L («Editar en el editor»: el anuncio de Video Generator entra por el MISMO camino que «Importar») |
| `app/video-editor/acceso.ts`: `requireEditorVideo()` en TODA page del editor (hoy sólo el super admin) · nada en `app/video-editor` navega sin el `?ws=` · ningún módulo del server importa de `_opencut/` ni `ce/` (`tests/video-editor-integracion.test.ts` barre el árbol entero) | L | todos |
| `RetimeConfig` (`timeline/types.ts`): `mode: 'curve'` + `curva {preset, puntos x 0–1 / y 0,1–10}`; con curva, `rate` es la velocidad MEDIA. Las funciones de `retime/` (`getSourceTimeAtClipTime`, `getClipTimeAtSourceTime`, `getSourceSpanAtClipTime`, `splitRetimeAtClipTime`…) piden `clipDuration` en la misma unidad que el instante: sin ella la curva se lee como constante. Velocidad 0,1×–100× | I | G (transiciones), J (audio), K (subtítulos), D (rótulo «2.0x»/curva sobre el clip, ya dibujado) |
| Ganchos: recorte = gancho de FUENTE orden 10 (quien venga después recibe el cuadro recortado); reflejo = gancho VISUAL orden 1000 (un gancho que toque la escala conserva el signo de `scaleX/scaleY`); después sólo va el de las transiciones (G, orden 1100), que necesita el signo FINAL para orientar los barridos y sólo multiplica la escala por positivos. Un gancho de fuente no devuelve el MISMO lienzo en cuadros seguidos de un video: el compositor no re-sube una textura si el objeto es el mismo. `recorte/geometria.ts → dimensionesRecortadas` da el tamaño de la fuente recortada | I | M (quitar fondo, orden > 10), G y H (ganchos visuales), E |
| Quitar fondo = gancho de FUENTE orden 20 (`fondo/recorte-persona.ts`), param `fondo.automatico` (video e imagen). Un gancho de fuente puede declarar `preparar(ctx)`: el render (`frame-descriptor.ts`) ESPERA su promesa antes de aplicar, así el primer cuadro del export ya sale con el modelo cargado. Devuelve `undefined` si no hay nada que esperar (corre por capa y por cuadro) y nunca rechaza. Sub-pestaña `video-eliminar-fondo` (`SUBPESTANA_ELIMINAR_FONDO`, `abrirEliminarFondo` en `fondo/registro.tsx`) | M | D (el ✦ de un clip con sólo croma abre esa sub-pestaña), quien sume un gancho que cargue algo |
| Animación: params `anim.{entrada,salida,combo,bucle}.{id,duracion}` (video/imagen: Combinado; texto/sticker/forma: Bucle), declarados (viajan con Pegar atributos; Congelar no los pasa). Gancho VISUAL `ce-animacion` orden 100; `animaciones/calcular.ts → tramosAnimacion(params, D)` da los tramos. Al dividir, la izquierda pierde la Salida y la derecha la Entrada (`animaciones/reglas.ts → sinSalida/sinEntrada`) | H | D (`FranjasAnimacion` sobre el clip), I (dividir, Pegar atributos, Congelar) |
| Texto: params `texto.mayusculas`, `trazo.*`, `sombra.*`, `texto.fondoOpacidad`, `brillo.*`, `curva.*` (`params/extra/texto.ts → TEXTO`); May./min. se aplica sólo al MEDIR (`measure-element.ts`), nunca a `content`. `TextDragData.params?` lleva el estilo de la tarjeta al soltar. Una plantilla escribe TODOS los interruptores de apariencia (apagados si no los usa) | H | K (plantillas de subtítulos con trazo, `subtitles/estilos.ts`), D (arrastre) |
| Transiciones en el render: el gancho visual puede sumar pases (`EstadoVisual.pases`, van después de los del clip) y quien rearma el estado los conserva (`{ ...estado, … }`); `ContextoVisual.tiempoClip` = instante sin acotar. Todo chequeo de «fuera del clip» nuevo usa `transiciones/escena.ts → fueraDeVentana` (el clip se dibuja también en la ventana). Dos clips del mismo medio en una transición piden cuadros a `claveDecodificadorTransicion(mediaId)`: quien suelte los decodificadores de un medio suelta también ése. Arrastre: `TransicionDragData` (`type: "transicion"`) cae sólo sobre un clip (`soltarTransicion`) | G | E (render), D (arrastre), H (ganchos visuales) |
| Quitar fondo: el modelo es `public/ve/modelos/selfie_segmenter.tflite` (binario de Google, Apache-2.0, servido por nosotros) y el JS de MediaPipe va fijo al wasm del CDN (`tests/video-editor-fondo.test.ts` vigila que no se separen). Si alguien suma `script-src` a la CSP de `next.config.ts`, quitar fondo se rompe callado | M | quien toque la CSP o suba `@mediapipe/tasks-vision` |
| `params.tts = true` en el audio de Texto a voz (`PARAM_TTS`, `subtitles/texto-a-voz.ts`); sin declarar, no es un control | K | D (vinculación, `ripple/iman.ts`) |
| Arrastrar efectos: `EffectDragData.params?` (una LUT, un predefinido) viaja en el arrastre; `editor.timeline.addClipEffect({ …, params? })` los aplica sobre los de la definición, y al soltar un FILTRO sobre un clip avisa «Filtro agregado» / «Se reemplazó el filtro» | F + D | — |
| Respaldos del panel derecho (`properties/registry.tsx`): van en el MISMO orden que la pestaña que reemplazan (Texto 10, Básico del audio 10, Audio del video 20), porque la primera de la fila es la que se abre al elegir. Se ocultan solos cuando el dueño registra una pestaña con ese rótulo | C | H (Texto), J (Básico/Audio) |
