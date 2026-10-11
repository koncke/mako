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
| 9 | **Inicio** (`/video-editor`) adentro de MaKo, con la barra lateral; **editor** (`/video-editor/<id>`) a pantalla completa, sin chrome (`esVistaSinChrome`), con su propia salida que conserva el `?ws=` | CapCut es una ventana entera; el inicio es una tab más |
| 10 | **Onboarding = estado vacío** («Crear proyecto»), sin entrada en el catálogo | La tab ES la herramienta (regla del 05/10, como /api-mako y el Dashboard) |

**Fuera de alcance de v1** (no se dibujan, o se dibujan apagados con «Próximamente»):
Plantillas (no hay catálogo), Avatar de IA, Dreamina, Archivos multimedia de IA, Retoque
(belleza facial), Estabilización, Flujo óptico, Seguimiento de movimiento, Subtítulos
bilingües, Música y Efectos de sonido de biblioteca (licencia), Compartir, todo lo «Pro» (el
diamante no se copia). Si Martín quiere una, se reabre.

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
- ⚠️ Los efectos de **capa** (elemento `effect` en una pista de efectos = «Filtros»/«Ajuste» como
  capa en CapCut) los aplica el WASM sobre el cuadro compuesto (`sceneEffect`). Un pase `ce-*` ahí
  NO corre solo: hay que repartirlo a las capas visuales que tiene debajo en ese instante.

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
| Efecto `croma` (pase `ce-croma`), params `color` (hex), `intensidad`, `sombra`, `borde`, `limpiarBorde` (0–100) | F | M (la UI del Chroma key) |
| Efecto `ajuste` (pase `ce-ajuste`), params `brillo`, `contraste`, `saturacion`, `exposicion`, `nitidez`, `resaltados`, `sombras`, `temperatura`, `matiz`, `desvanecer`, `vineta`, `grano` (−100…100 o 0…100) | F | C (no dibuja Ajustar: lo registra F) |
| Params de audio `audio.fundidoEntrada` / `audio.fundidoSalida` (segundos) | J | D (dibuja los círculos de fundido en el clip y los arrastra) |
| `commands/timeline/element/atributos.ts`: `cortarSeleccion(editor)`, `copiarAtributos(editor)`, `pegarAtributos(editor)` | I | D (atajos Ctrl+X, Ctrl+Shift+C/V y menú contextual) |
| Param `transicion.id` / `transicion.duracion` en el clip de la IZQUIERDA del corte | G | D (dibuja el marcador ⧓ sobre el corte si existe) |
| Param `subtitulo` (booleano) en los textos que son subtítulos | K | D (pista «Subtítulos»), H (estilos) |
| Pestañas del panel derecho: Video›Básico/Máscara + «Detalles» (C) · Velocidad (I) · Animación y Texto (H) · Ajustar (F) · Audio (J) · Video›Eliminar fondo (M) · Texto a voz y Subtítulos (K) · Transición (G) | cada uno | C dibuja la cáscara |
