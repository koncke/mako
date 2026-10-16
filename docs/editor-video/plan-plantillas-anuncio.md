# Plan: las cinco plantillas de anuncios verticales del Video Editor

*15/10/2026, chat «Video Editor», cuenta claude3. Lo armó un agente de sólo lectura (relevamiento del código +
web) y lo revisó el chat. Orden aprobado por Martín vía «Estrategia 3 cuentas»: «Cinco plantillas para anuncios
verticales con lo que el editor ya tiene: gancho, testimonio, antes y después, beneficios, oferta con cuenta
regresiva». Música: no hay con licencia → sin música (o la que ponga la persona). El porqué de cada plantilla y
las fuentes: [relevamiento-plantillas.md](relevamiento-plantillas.md).*

**Resumen.** Las cinco se arman con lo que el editor ya tiene. Una plantilla es una línea de tiempo con **huecos
con nombre** (como las `modifications` de Creatomate). Un hueco de clip es una **imagen de muestra** guardada como
medio oculto (`ephemeral`) que se rellena con «Reemplazar el clip» (hoy apagado; se prende acá). Los ids usados
se verificaron cargándolos en node (18 de 18). **Lo que decide Martín: nada** (no hay plata, clientes, accesos ni
seguridad en juego); cómo se decidió cada punto, al final.

## 0. Lo que el relevamiento encontró y cambia cosas

1. **La máquina de escribir y el glitch SÍ existen** (`relevamiento-plantillas.md` decía que no):
   `maquina-escribir` es una entrada de texto (`animaciones/catalogo.ts:160`, revela por letra en `:300`); `glitch`
   es transición (`transiciones/catalogo.ts:269`) y efecto (`effects/definitions/efectos.ts:338`). Sólo falta el
   comparador deslizante. La orden («esas esperan») se respeta igual.
2. **Soltar un archivo de Multimedia encima de un clip visual no hace nada, y no avisa**: `views/assets.tsx:461-463`
   pide `MASKABLE_ELEMENT_TYPES`, `timeline/components/drop-target.ts:200-216` encuentra el clip y
   `drag-drop-controller.ts:463-466` vuelve sin hacer nada (el stub de OpenCut «Replace media source — not yet
   implemented»). Leído en el código, no visto en pantalla.
3. **Zona segura de Meta, verificada en la guía oficial** ([Instagram Reels, Ads Guide](https://www.facebook.com/business/ads-guide/update/video/instagram-reels),
   15/10): dejar libre el 14 % de arriba, el 35 % de abajo y el 6 % de cada lado → en 1080x1920 el contenido va
   en **x 65–1015, y 269–1248**. Los subtítulos verticales hoy quedan con el borde de abajo al 22 %
   (`subtitles/estilos.ts:282-283`), adentro de la franja que tapa Meta.
4. **Formas y stickers miden `min(ancho, alto)` del lienzo a escala 1** (fuente de 512, `graphic-node.ts:52` +
   `resolve.ts:192-201`): un rectángulo de W×H px en 1080x1920 lleva `scaleX = W/1080`, `scaleY = H/1080`.
   `MIN_TRANSFORM_SCALE = 0.01` (`animation/transform.ts:1`) pone el piso en 11 px.
5. **El relleno del fondo de un texto, en param, es `em × alto_del_lienzo / 6`**, sin importar el tamaño de letra
   (`primitives.ts:81-88`; 0,35 em da 112 en 1920 de alto). Los efectos con recuadro no fijan el relleno: en 9:16
   con letra chica la tarjeta queda con ~9–10 px (cuenta, no visto).
6. **`letterSpacing` va en px crudos**: no escala con el lienzo.
7. **`params/registry.ts` y `timeline/element-utils.ts` NO cargan en node** (pasan por `timeline/defaults →
   creation → wasm`): el código puro de plantillas recibe por parámetro los params por defecto, `tps`, `fps` y la
   función que mide.
8. **remotion-templates no tiene licencia en archivo** (`main/LICENSE` da 404 y la API de GitHub devuelve
   `"license": null`, 15/10): se toman la idea y los tiempos, no el código.
9. **Meta, Health & Wellness** (cambio del 22/07/2026, [fuente](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/)):
   el antes y después de cosmética o cirugía se permite apuntando a mayores de 18; en productos para bajar de
   peso hay que decir en cuánto tiempo se ven los resultados.
10. **Rótulos de CapCut** (es-LA.po): `use_template_pc` «Utilizar plantilla» · `pc_replace_fragment` «Reemplazar el
    clip» · `pc_template_editor_replace` «Sustituir» · `pc_template_editor_video_for_signal_replace` «Video de
    muestra» · `pc_replacement_succeeded` «Sustituido» · `pc_replace_clip_failed` «No se pudo reemplazar» ·
    `pc_loading_fail_comma` «No se pudo cargar la plantilla.». CapCut **rechaza** un video más corto que el clip
    original (`pc_the_current_video_is_shorter_than_the_original_clip`) y **conserva la velocidad** al reemplazar
    (`velocity_speed_replace_will_process`).

## 1. El formato

### 1.1 El catálogo: `lib/editor-video/plantillas.ts` (nuevo)

Puro: sin `_opencut` y sin `server-only` (lo importan la ruta del chat, la page y los tests, como `chat-catalogo.ts`).

```ts
export const LIENZO_REF = { ancho: 1080, alto: 1920 } as const;
/** Meta Ads Guide «Instagram Reels» (15/10/2026): 14 % arriba, 35 % abajo, 6 % por lado. */
export const ZONA_SEGURA = { arriba: 269, abajo: 1248, izquierda: 65, derecha: 1015 } as const;
/** Margen lateral de un texto (proporción del ancho): el 6 % + el relleno de una tarjeta (119 px). */
export const MARGEN_TEXTO = 0.11;

type Anim = { entrada?: [id: string, s: number]; salida?: [string, number]; bucle?: [string, number] };
export type HuecoClip = { nombre: string; rotulo: string; acepta: 'video' | 'imagen' | 'ambos'; opcional?: boolean };
export type Celda = { x: number; y: number; ancho: number; alto: number };  // px de LIENZO_REF, desde arriba-izquierda
export type PiezaClip = { tipo: 'clip'; hueco: HuecoClip; pista: 'principal' | 'video-1';
  inicio: number; fin: number; celda?: Celda; animacion?: Pick<Anim, 'entrada' | 'salida'>;
  transicion?: { id: string; duracion: number }; silenciar?: boolean };
export type PiezaTexto = { tipo: 'texto'; hueco?: { nombre: string; maxCaracteres: number }; muestra: string;
  pista: 'texto-1' | 'texto-2' | 'texto-3' | 'texto-4'; inicio: number; fin: number;
  estilo: { efecto: string; fuente: string; px: number; negrita?: boolean; cursiva?: boolean; mayusculas?: boolean;
            alineacion?: 'centro' | 'izquierda'; relleno?: [em_x: number, em_y: number]; opacidad?: number };
  ancla: { borde: 'arriba' | 'centro' | 'abajo'; y: number }; animacion?: Anim };
export type PiezaForma = { tipo: 'forma'; forma: 'rectangle'; pista: 'forma-1'; inicio: number; fin: number;
  celda: Celda; relleno: string; animacion?: Anim };
export type Plantilla = { id: string; nombre: string; descripcion: string; duracion: number; portada: number;
  subtitulos?: string; ideaDe: string[]; piezas: Array<PiezaClip | PiezaTexto | PiezaForma> };
export const PLANTILLAS: readonly Plantilla[];
export function plantillaPorId(id: unknown): Plantilla | null;
export function huecosDe(p: Plantilla): Array<{ nombre: string; tipo: 'clip' | 'texto'; acepta?; opcional?; maxCaracteres?; muestra?; segundos: number }>;
/** Como las `modifications` de Creatomate: nombre del hueco → texto, o medio para un clip. */
export type Valores = Record<string, string | { medio: string }>;
export function validarValores(p: Plantilla, v: unknown): { ok: true; valores: Valores } | { ok: false; motivo: string };
```

Reglas: tiempos en segundos absolutos de la línea de tiempo; posiciones en px de 1080x1920, todo escalado con
`f = lienzo.width / 1080`; pistas siempre de arriba hacia abajo (`texto-1…4`, `forma-1`, `video-1`, la principal);
el MISMO objeto `HuecoClip` en varias piezas es un solo hueco (llenarlo llena todas); los huecos de texto son el
texto que trae la plantilla; los de clip, una imagen de muestra.

### 1.2 Las marcas en el elemento: `_opencut/plantillas/huecos.ts` (nuevo, puro)

`plantilla.id`, `plantilla.hueco`, `plantilla.muestra`, `plantilla.opcional`, `plantilla.silenciar` y
`plantilla.ancla` (en los textos, JSON `{"b":"arriba","y":300,"m":0.11}`). **No se declaran** (precedentes: `tts` en
`subtitles/texto-a-voz.ts:36`, `audio.extraidoDe` en `audio/claves.ts:43`): no aparecen como control, «Pegar
atributos» no las lleva, Congelar tampoco; Dividir y Duplicar sí las copian (las dos mitades son el mismo hueco).
Funciones: `huecosEnLinea(tracks)`, `quedanMuestras(tracks)` (ignora los opcionales). Va como contrato en
`diseno-editor-video.md` §4.1.

### 1.3 Cómo se arma: `_opencut/plantillas/armar.ts` (nuevo, puro, con el motor inyectado)

```ts
export function armarLinea(a: { plantilla: Plantilla; lienzo: { width: number; height: number }; fps: number; tps: number;
  principal: VideoTrack; muestras: Record<string /* rótulo */, { mediaId: string; width: number; height: number }>;
  medios?: Record<string /* hueco */, { mediaId: string; type: 'video' | 'image'; width: number; height: number; duracion?: number; nombre: string }>;
  textos?: Record<string /* hueco */, string>; base: (tipo: ElementType) => ParamValues;
  medir: (params: ParamValues, ancla: { borde: string; y: number; margen: number }) => { content: string; 'transform.positionX': number; 'transform.positionY': number };
  nuevoId: () => string }): { tracks: SceneTracks; descartes: string[] }
```

| Qué | Cómo se calcula |
|---|---|
| Tiempo | `ticks = round(round(s·fps)/fps · tps)` (cae en un cuadro) |
| Letra | `fontSize = round1(px·f·90/H)` |
| Relleno | `background.paddingX/Y = round(em·H/6)` |
| Ancla | `arriba` → `{vertical:'top', margenPx: y·f}`; `abajo` → `{bordeInferior: y·f − H/2}`; `centro` → `{vertical:'middle'}` y después `positionY += y·f − H/2` (todas con margen izquierdo y derecho 0,11) |
| Animación | `cambiosAlElegir` (`animaciones/elegir.ts:57`) y después `cambiosDeDuracion` (`:83`) |
| Transición | `transicion.id` / `transicion.duracion` (`transiciones/claves.ts:14-15`) en la pieza de la IZQUIERDA |
| Forma | `scaleX = w·f/min(W,H)`, `scaleY = h·f/min(W,H)`; posición = centro − lienzo/2 (la Y del motor va hacia ABAJO) |
| Clip | `cubrirCelda` (`plantillas/geometria.ts`, nuevo y puro): recorta la fuente a la proporción de la celda (`recorte.*`, `params/extra/recorte.ts:14-18`); el motor encaja lo recortado en el lienzo (`recorte/ganchos.ts`); escala = `celda.ancho / ancho mostrado`. Sin celda = el lienzo entero (cubre) |
| Texto | `base('text')` + `EFECTOS_TEXTO[efecto].params` (`text/estilos-predefinidos.ts:83`, ya trae `SIN_EFECTO`) + fuente, tamaño, peso, cursiva, alineación, `texto.mayusculas`, `opacity`, relleno, animación y marcas; después `medir` |

En el navegador `medir` es `partirYUbicar` (`subtitles/build-subtitle-text-element.ts:123`; `Ubicacion` en `:107`); en
los tests, un falso.

### 1.4 Dónde se usa: `_opencut/plantillas/instanciar.ts` (nuevo, navegador)

`usarPlantilla(editor, plantilla, { textos?, medios? })`:
1. `cargarFuentes` (`subtitles/insert.ts:62`): un texto medido con la fuente de respaldo queda así para siempre.
2. `prepararMuestras` (`plantillas/muestras.ts`): un PNG de 1080x1920 por rótulo en un OffscreenCanvas (fondo
   `#2b2b2b`, borde punteado, el rótulo al centro; para «final», `#111111` liso sin rótulo); se guarda con
   `processMediaAssets` + `addMediaAsset({ …, ephemeral: true })` (molde `congelar.ts:183-193`); si ya está, se reusa.
3. `armarLinea` con `principal = escena.tracks.main` (sin cambiarle el id).
4. **Un solo paso de deshacer**: `BatchCommand([UpdateProjectSettingsCommand({ relacion: '9:16', canvasSize:
   tamanoDeRelacion({ id: '9:16', settings }) }), TracksSnapshotCommand({ before, after })])`
   (`commands/project/update-project-settings.ts:5`, `canvas/sizes.ts:91`). Fijar `relacion` evita que el primer
   clip pise el lienzo (`insert-element.ts:83-111`). El imán no mueve nada: la principal ya va pegada desde 0.
5. Si trae `subtitulos`: `usePreferenciasSubtitulos.getState().fijar({ plantilla })`.
6. Toast «Sustituye los clips de muestra».

**Proyecto vacío → ahí; con contenido → proyecto nuevo** (copia de «Utilizar plantilla» de CapCut, que abre un
borrador nuevo): `router.push(rutaEditor('/video-editor/nuevo?plantilla=<id>'))`; `[proyecto]/page.tsx` valida con
`plantillaPorId` y le pasa `plantilla` a `VideoEditorCliente`, que dibuja `app/video-editor/plantilla/ArmarPlantilla.tsx`
(copia del molde `desde/ImportarDesde.tsx:59-125`, con el mismo pestillo por ref y el mapa `enVuelo`):
`createNewProject({ name })` → `usarPlantilla` → `saveCurrentProject` → `router.replace` sin el query.

**El hueco sin llenar** es una imagen en la pista (con transición, animación y recorte, como un clip más) con
`plantilla.muestra = true`; en la línea de tiempo lleva el botón «Sustituir».

## 2. Reemplazar el clip (todos los huecos de clip se llenan así)

`_opencut/reemplazo/`:
- **`puro.ts`**: `rectoMostrado` (dónde se ve hoy, con recorte, encaje, escala y posición) y
  `elementoReemplazado({ elemento, medio, tps, lienzo, fuenteActual, base })` → `{ ok, elemento } | { ok: false, motivo: 'corto' }`:
  conserva **id**, `startTime` y `duration` (video: `trimStart 0`, `trimEnd = src − dur`, `sourceDuration`,
  `isSourceAudioEnabled`); puede cambiar de imagen a video o al revés; copia los params declarados del tipo nuevo
  (las claves de `base(tipo)`) salvo `audio.normalizar` y `revertir.*`; conserva `transicion.*`, `anim.*`, efectos,
  máscaras, fotogramas y la velocidad (CapCut la conserva). Si es hueco: recalcula `recorte.*`, escala y posición
  para **cubrir el mismo rectángulo** (`cubrirCelda`), saca la marca de muestra y aplica `muted` si tiene
  `plantilla.silenciar`. Si no es hueco: conserva transform y recorte. Un video más corto que `duration ×
  velocidad` se rechaza. `objetivosDelReemplazo(tracks, ref)`: el elemento y, si es muestra, las otras muestras del
  mismo hueco.
- **`comando.ts`**: `ReemplazarClipCommand` cambia los elementos por id desde las pistas del momento de ejecutar
  (sirve en un lote del chat); deshacer vuelve a lo de antes.
- **`reemplazar.ts`**: `reemplazarClip(editor, ref, mediaId)`, la ÚNICA entrada (menú, botón, soltar y chat).
- **`estado.ts` + `dialogo-reemplazar.tsx`**: store `{ objetivo, abrir, cerrar }`; diálogo «Reemplazar el clip» con
  la grilla de Multimedia sin los ocultos, filtrada por `acepta`, con «Importar» (`useImportarArchivos`); los
  videos más cortos que el hueco, apagados con «Muy corto»; toast «Sustituido» / «No se pudo reemplazar». Montado
  una vez en `editor-page.tsx:104`, al lado de `<MigrationDialog/>`, en el portal de `.ce`.
- Se tocan `timeline/components/timeline-element.tsx:536-543` (se prende «Reemplazar el clip», abierto con
  `setTimeout(…, 0)` por la trampa de radix; en un clip con `plantilla.muestra`, el botón «Sustituir» con el molde
  de `MarcadorTransicion`, `:549`) y `timeline/controllers/drag-drop-controller.ts:463` (si el destino es una
  muestra, `reemplazarClip`; si no, no se toca).

## 3. La pantalla

| Archivo | Cambio |
|---|---|
| `ce/ranuras.ts:78-80` | `'plantillas'` en `CategoriaBiblioteca` |
| `assets-panel-store.tsx:21-33` | `"plantillas"` entre `"ajuste"` y `"avatar"` (pestaña 10 de CapCut, `relevamiento-capcut-armazon.md:123`). **Sin subir la versión del persist** (borra lo guardado) |
| `assets/tabbar.tsx:41-56` | `plantillas: { etiqueta: "Plantillas", Icono: icono(DashboardSquare01Icon) }` |
| `_opencut/plantillas/registro.ts` (nuevo) + `ce/extensiones.ts` | sección `plantillas.anuncios` «Anuncios», molde `avatar/registro.ts` |
| `plantillas/components/biblioteca-plantillas.tsx` (nuevo) | `ContenidoBiblioteca` + `GrillaBiblioteca minimo={92}`; tarjeta 9:16 con la duración arriba a la derecha y el nombre abajo; al pasar el mouse, «Utilizar plantilla» (el clic en la tarjeta no la usa); carga las fuentes al montar (como `biblioteca-estilos.tsx:189`) |
| `plantillas/components/miniatura-plantilla.tsx` (nuevo) | canvas 2D, molde `transiciones/components/miniatura.tsx`; quieta en `plantilla.portada`, en bucle con el mouse, quieta con «reducir movimiento»; dibuja `escenaEn` |
| `plantillas/escena.ts` (nuevo, puro) | `escenaEn(plantilla, t)`: piezas visibles con su rectángulo y su pose de `poseEn` (`animaciones/calcular.ts:64`) |
| `[proyecto]/page.tsx:24-38`, `VideoEditorCliente.tsx:35-60` | `?plantilla=` → `ArmarPlantilla` |
| `export/dialogo-exportar.tsx` | si `quedanMuestras`, una línea «Quedan clips de muestra» (no bloquea) |

Textos: «Plantillas» / «Anuncios» · «Utilizar plantilla» · rótulos «Tu clip», «Antes», «Después», «Tu producto» ·
«Reemplazar el clip» / «Sustituir» / «Muy corto» · «Sustituido», «No se pudo reemplazar», «Sustituye los clips de
muestra», «No se pudo cargar la plantilla.» · «Cargando plantilla…».

## 4. Las cinco

Lienzo 1080x1920, 30 fps. y en px desde arriba; todos los textos entre 269 y 1248, margen lateral 0,11. Una
«tarjeta» es un efecto con fondo más su relleno en em.

**Ids verificados:** efectos de texto (`text/estilos-predefinidos.ts`) `blanco-trazo-negro` :84,
`amarillo-trazo-negro` :85, `sombra-suave` :88, `sombra-dura` :89, `recuadro-negro` :127, `recuadro-blanco` :128,
`recuadro-amarillo` :129, `etiqueta-roja` :130, `translucido` :132 · entradas (`animaciones/catalogo.ts`)
`aparecer-gradualmente` :113, `acercar` :114, `deslizar-izquierda` :116 (entra desde la derecha), `deslizar-derecha`
:120 (entra desde la izquierda), `rebote` :137, `subir` :147 · salidas `desaparecer-gradualmente` :171,
`deslizar-izquierda` :175 · bucles `pulso` :246, `latido` :253 · transiciones (`transiciones/catalogo.ts`) `mezclar`
:198, `destello-blanco` :212, `barrido-derecha` :302 · subtítulos (`subtitles/estilos.ts`) `predeterminado` :76,
`palabra-resaltada` :187 · fuentes Anton, Montserrat y Playfair Display (las de `PLANTILLAS_TEXTO`).

**El cierre común («final»)**: la pieza principal del final, hueco `final`, rótulo vacío, `acepta: 'ambos'`,
**opcional**, muestra lisa `#111111`; encima `titulo-final` (Montserrat negrita 72, `sombra-suave`, centro y=620,
entrada `acercar` 0,6) y `cta` (Montserrat negrita 64, `recuadro-amarillo`, relleno [0,6; 0,3], centro y=840,
entrada `aparecer-gradualmente` 0,5, bucle `pulso` 1,0, empieza 0,6 s después). Idea de End Card: la tarjeta escala
en ~35 cuadros y el botón entra en el cuadro 20 (≈0,67 s → 0,6 s). Va en la principal porque la vinculación ancla
por el INICIO (`iman.ts`): si la persona alarga su clip, el cierre y sus textos se corren juntos.

### 4.1 `gancho` «Anuncio con gancho», 15 s — Popping Scale Text + End Card; subtítulos `palabra-resaltada`

| Pieza | Pista | s | Detalle |
|---|---|---|---|
| hueco `clip` «Tu clip», ambos | principal | 0–12 | transición `mezclar` 0,5 |
| hueco `final` | principal | 12–15 | cierre |
| `gancho` «ESTO LO CAMBIA TODO» (28) | texto-1 | 0–2,5 | Anton 104, `amarillo-trazo-negro`, mayúsculas, arriba y=300; `rebote` 0,5 / `desaparecer-gradualmente` 0,3 |
| `titulo-final` «¿Listo para empezar?» (32) | texto-1 | 12–15 | cierre |
| `cta` «Escríbenos hoy» (20) | texto-2 | 12,6–15 | cierre |

### 4.2 `testimonio` «Testimonio», 15 s — Quote Card + Lower Third; subtítulos `predeterminado`

| Pieza | Pista | s | Detalle |
|---|---|---|---|
| `clip` | principal | 0–12 | `mezclar` 0,5 |
| `final` | principal | 12–15 | |
| `cita` «“Lo recomiendo a todos”» (48) | texto-1 | 0–3,5 | Playfair Display cursiva 72, `recuadro-blanco` [0,45; 0,25], arriba y=300; `subir` 0,6 / `desaparecer` 0,3 |
| `nombre` «María López» (28) | texto-2 | 1,0–6,0 | Montserrat negrita 56, `translucido` [0,4; 0,2], izquierda, abajo y=1010; `deslizar-derecha` 0,5 / `deslizar-izquierda` 0,4 |
| `detalle` «Clienta desde 2024» (32) | texto-3 | 1,3–6,0 | Montserrat 40, `sombra-suave`, opacidad 0,8, izquierda, arriba y=1030; `aparecer` 0,4 / `desaparecer` 0,3 |
| `titulo-final` «Únete a nuestros clientes» · `cta` «Pide el tuyo» | texto-1 / texto-2 | 12–15 / 12,6–15 | cierre |

### 4.3 `antes-despues` «Antes y después», 14 s — Split Screen + Image Comparison (→ `barrido-derecha`)

Celdas APILADAS: arriba {0,0,1080,960} y abajo {0,960,1080,960} (en 9:16 una partición a lo ancho deja columnas de 540 px).

| Pieza | Pista | s | Detalle |
|---|---|---|---|
| `antes` «Antes», ambos | principal | 0–3 | transición `barrido-derecha` 0,5 |
| `despues` «Después», ambos | principal | 3–6 | |
| `antes` (mismo hueco) | principal | 6–11 | celda arriba, silenciar; `deslizar-derecha` 0,5 / `desaparecer` 0,4 |
| `final` | principal | 11–14 | |
| `despues` (mismo hueco) | video-1 | 6,2–11 | celda abajo, silenciar; `deslizar-izquierda` 0,5 / `desaparecer` 0,4 |
| divisor (rectangle `#ffffff`) | forma-1 | 6,6–11 | celda {0,954,1080,12}; `aparecer` 0,3 / `desaparecer` 0,4 |
| `rotulo-antes` «ANTES» (12) | texto-1 | 0,2–3,0 | Anton 96, `recuadro-negro` [0,4; 0,15], arriba y=300; `rebote` 0,4 |
| `rotulo-despues` «DESPUÉS» (12) | texto-1 | 3,2–6,0 | Anton 96, `recuadro-amarillo`, igual |
| `rotulo-antes` (mismo hueco) | texto-1 | 6,6–11 | Anton 64, `recuadro-negro`, izquierda, arriba y=300; `aparecer` 0,3 / `desaparecer` 0,4 |
| `rotulo-despues` (mismo hueco) | texto-2 | 6,8–11 | Anton 64, `recuadro-amarillo`, izquierda, arriba y=990; igual |
| `titulo-final` «Tu cambio empieza hoy» · `cta` «Reserva tu cita» | texto-1 / texto-2 | 11–14 / 11,6–14 | cierre |

Un video para este hueco tiene que durar al menos 5 s («Muy corto»); una foto sirve siempre. `descripcion` (la leen
el chat y la API): «Para cosmética o cirugía, Meta pide mostrarlo a mayores de 18; para bajar de peso, decir en
cuánto tiempo.»

### 4.4 `beneficios` «Beneficios», 15 s — Animated List (1,5 s entre ítems para que se lean); sin subtítulos

| Pieza | Pista | s | Detalle |
|---|---|---|---|
| `clip` | principal | 0–12 | `mezclar` 0,5 |
| `final` | principal | 12–15 | |
| `titulo` «3 RAZONES PARA PROBARLO» (28) | texto-1 | 0–12 | Anton 88, `blanco-trazo-negro`, mayúsculas, arriba y=300; `rebote` 0,5 / `desaparecer` 0,3 |
| `beneficio-1` «Fácil de usar» (24) | texto-2 | 2,0–12 | Montserrat negrita 60, `recuadro-blanco` [0,45; 0,22], izquierda, arriba y=560; `deslizar-derecha` 0,5 / `desaparecer` 0,3 |
| `beneficio-2` «Envío gratis» | texto-3 | 3,5–12 | igual, y=720 |
| `beneficio-3` «Garantía de 30 días» | texto-4 | 5,0–12 | igual, y=880 |
| `cta` «Pruébalo hoy» (20) | texto-1 | 12,4–15 | Montserrat negrita 72, `recuadro-amarillo` [0,6; 0,3], centro y=760; `rebote` 0,5, bucle `pulso` 1,0 |

### 4.5 `oferta` «Oferta con cuenta regresiva», 15 s — Countdown Timer (0,8 s por número) + End Card

| Pieza | Pista | s | Detalle |
|---|---|---|---|
| `producto` «Tu producto», ambos | principal | 0–9 | transición `destello-blanco` 0,4 |
| `final` | principal | 9–15 | |
| `gancho` «SOLO POR 48 HORAS» (28) | texto-1 | 0–3 | Anton 104, `etiqueta-roja` [0,4; 0,15], arriba y=300; `rebote` 0,5 / `desaparecer` 0,3 |
| `oferta` «50 % DE DESCUENTO» (22) | texto-1 | 3–9 | Anton 112, `amarillo-trazo-negro`, arriba y=300; `acercar` 0,5, bucle `latido` 1,2, `desaparecer` 0,3 |
| «3» · «2» · «1» (decoración, sin hueco) | texto-1 | 9,0–9,8 · 9,8–10,6 · 10,6–11,4 | Anton 300, `sombra-dura`, centro y=760; `rebote` 0,3 / `desaparecer` 0,3 |
| `cta` «¡COMPRA AHORA!» (20) | texto-1 | 11,4–15 | Montserrat negrita 80, `etiqueta-roja` [0,6; 0,3], centro y=700; `rebote` 0,5, bucle `pulso` 1,0 |
| `detalle` «Envío gratis incluido» (28) | texto-2 | 11,8–15 | Montserrat 48, `sombra-suave`, arriba y=830; `aparecer` 0,5 |

## 5. El chat y la API

- **Vista** (`chat/linea.ts`): cada elemento lleva `hueco` y `muestra: true`; la vista suma `medios: [{ ref: 'm1',
  nombre, tipo, duracion }]` (Multimedia de video o imagen, sin los ocultos; sale de `contexto.ts`).
- **`usar_plantilla`** `{"op":"usar_plantilla","id":"testimonio","textos":{"cita":"…"},"clips":{"clip":"m1"}}`: su
  `para` se arma desde `PLANTILLAS` (ids, duración, huecos, máximo de caracteres); sólo SOLA y con la línea de tiempo
  vacía (si no, descarte «se usa en un proyecto vacío»); es operación larga (`LARGAS` en `comandos.ts`, la corre
  `correrLarga` con `usarPlantilla`).
- **`reemplazar_clip`** `{"op":"reemplazar_clip","ref":"v1","medio":"m2"}`: en el lote como `Diferido` →
  `ReemplazarClipCommand`; la revisión descarta un video corto o de un tipo que el hueco no acepta. Un texto de hueco
  se llena con `cambiar_texto` (con `plantilla.ancla`, se vuelve a partir y ubicar con `paramsDeTextoDeHueco`, como
  `paramsConTexto` con los subtítulos).
- `NO_SE_PUEDE_CHAT`: queda «agregar» medios; «cambiar» medios pasa a `reemplazar_clip`.
- **API de MaKo**: `listar_plantillas_video` en `lib/api-mako/areas/video.{def,run}.ts` (lectura del catálogo, molde
  `listar_lugares_grabacion`; gating `{ tab: 'video-editor' }`, gratis). «Usar una plantilla» por la API espera la
  decisión de dónde vive el proyecto.

## 6. Tests puros (cada uno se prueba rompiéndolo; la rotura y el número van en el comentario)

**`tests/video-editor-plantillas.test.ts`** (tanda 1): 1 cada id existe (`presetAnimacion` + `presetsPara`,
`transicionPorId`, `EFECTOS_TEXTO`, `PLANTILLAS_SUBTITULO`, fuentes ⊆ las conocidas) · 2 la principal pegada de 0 a
`duracion` · 3 nada se pisa en una pista · 4 todo cae en cuadros de 30 fps · 5 lo de encima empieza y termina dentro
de la pieza principal que acompaña · 6 zona segura (ancla + alto estimado entre 269 y 1248; margen − relleno ≥ 65
px; celdas dentro del lienzo) · 7 muestras ≤ 5 palabras y ≤ `maxCaracteres` ≤ `TOPES_CHAT.texto` · 8 entrada +
salida ≤ duración; transición dentro de su mínimo y máximo y sólo con una pieza pegada a la derecha · 9 un hueco con
varias piezas tiene el mismo tipo, `acepta` y rótulo; cada plantilla ≥ 1 hueco de clip no opcional · 10 `armarLinea`
con falsos (principal pegada, orden de pistas, marcas, animaciones = `cambiosAlElegir`, transición en la izquierda,
`fontSize = px·90/1920`, relleno = em·1920/6) · 11 en 2160x3840 posiciones y escalas ×2, `fontSize` igual, relleno ×2
· 12 `cubrirCelda` (1080x1920 a la celda de arriba → arriba/abajo 0,25, escala 1, y −480; 1920x1080 → izq/der
0,1836; 1080x1080 → arriba/abajo 0,0556) · 13 `escenaEn` (t=0 con `rebote` escala 0,3 y opacidad 0; identidad al
terminar la entrada; t=13 el cierre) · 14 `validarValores` (hueco que no existe, texto largo, medio en un hueco de texto).

**`tests/video-editor-reemplazo.test.ts`** (tanda 2): conserva id, inicio y duración; `trimEnd` (hueco de 12 s con
video de 10 s → «corto»; con 12 s exactos, sirve); a 2× hacen falta 12 s de fuente para 6 s; conserva `transicion.*`,
`anim.*` y efectos; saca `audio.normalizar` y `revertir.*`; `silenciar` da `muted`; un hueco cubre la misma celda; un
clip que no es hueco conserva el transform; un hueco con hermanos llena todas las muestras; leyendo el fuente, el ítem
ya no está `disabled` y el soltar llama a `reemplazarClip`.

**`tests/video-editor-chat.test.ts`** (tanda 4): validación de las dos operaciones; la vista con `hueco`, `muestra` y
`medios`; `usar_plantilla` descartada con la línea de tiempo no vacía o junto con otras; `catalogoParaPrompt` nombra
cada plantilla y cada hueco. **API**: el def existe y el runner devuelve 5 plantillas con sus huecos.

## 7. Orden de trabajo (de a un agente, por la RAM)

| Tanda | Es dueña de | Depende de |
|---|---|---|
| 1. Catálogo y armado, puros | `lib/editor-video/plantillas.ts`, `_opencut/plantillas/{huecos,armar,escena,geometria}.ts`, `tests/video-editor-plantillas.test.ts` | — |
| 2. Reemplazar el clip | `_opencut/reemplazo/*`, `timeline-element.tsx`, `drag-drop-controller.ts`, `editor-page.tsx`, `tests/video-editor-reemplazo.test.ts` | 1 |
| 3. Pestaña y uso | `_opencut/plantillas/{muestras,instanciar,registro}.ts`, `plantillas/components/*`, `app/video-editor/plantilla/ArmarPlantilla.tsx`, `ranuras.ts`, `assets-panel-store.tsx`, `tabbar.tsx`, `extensiones.ts`, `[proyecto]/page.tsx`, `VideoEditorCliente.tsx`, `dialogo-exportar.tsx` | 1 |
| 4. Chat y API | `chat-catalogo.ts`, `chat/*`, `video.{def,run}.ts`, sus tests | 1, 2, 3 |
| 5. Verificar y cosechar | en el navegador: armar las cinco, sustituir con video e imagen (corto y justo), Ctrl+Z, alargar el clip (el cierre se corre), exportar y medir con ffprobe; docs | 1–4 |

Después de cada tanda: `node C:/dev/tsc-ve.mjs` y los tests de a uno.

## 8. Lo que no entra, y por qué

Plantillas con máquina de escribir, glitch o comparador (la orden; ver 0.1) · música (no hay con licencia) · una
muestra en video real al pasar el mouse (no hay material con licencia; va la miniatura dibujada) · elegir qué parte
del clip nuevo se usa al reemplazar (se usa el principio y se recorta después) · el «Sustituir» sobre el reproductor
· el pop letra por letra y el resaltado palabra por palabra fuera de los subtítulos (el motor anima el texto entero)
· volver a partir las líneas al editar a mano un texto de hueco (el chat sí) · usar una plantilla por la API o
WhatsApp (el proyecto vive en el navegador; la API sólo lista) · «Mis plantillas» · soltar un archivo sobre un clip
que no es hueco (0.2; aparte, confirmando contra CapCut) · subir los subtítulos verticales al 35 % (cambia todos los
proyectos; aparte) · plantillas en 16:9 o 1:1.

## 9. Riesgos

Nada se vio en el navegador (el armado depende de medir con la fuente cargada) · «Superposición» no se vincula por
defecto (`timeline-store.ts:35-45`): en Antes y después, estirar a mano las dos primeras piezas desfasa la celda de
abajo · las muestras quedan en OPFS sin recolección · rechazar un video corto puede frustrar (lo compensan «Muy
corto» y que las fotos sirven siempre) · la política de Meta sobre antes y después va en la descripción, no en
pantalla · un texto escrito a mano puede salirse de la zona segura · los subtítulos a 22 % caen en la franja de Meta
· al reemplazar, el elemento puede cambiar de tipo (imagen ↔ video) con el mismo id: mirar el decodificador y la
pestaña abierta del panel derecho.

## 10. Cómo se decidió (sin Martín)

Proyecto vacío → ahí; con contenido → proyecto nuevo: copia de CapCut · duración fija del hueco y rechazo de un video
corto: copia de CapCut · huecos por nombre, uno a varios elementos: copia de Creatomate · celdas apiladas: 9:16 y la
zona segura · el cierre en la principal: así lo arrastra la vinculación · sin música: orden de Martín · la API sólo
lista: el proyecto vive en el navegador.

**Fuentes:** [remotion-templates](https://github.com/reactvideoeditor/remotion-templates) (tiempos de
`templates/{popping-text,end-card,quote-card,lower-third,split-screen,animated-list,text-highlight,countdown-timer}.tsx`) ·
[Meta, zona segura de Reels](https://www.facebook.com/business/ads-guide/update/video/instagram-reels) ·
[Meta, Health & Wellness](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/) ·
[CapCut, plantillas en escritorio](https://www.capcut.com/resource/ai-capcut-template) ·
[CapCut, clips reemplazables](https://www.capcut.com/help/how-to-set-replaceable-material-clips) ·
[Creatomate, template modifications](https://creatomate.com/docs/fundamentals/getting-started/template-modifications) ·
[Billo, zonas seguras](https://billo.app/blog/meta-ads-safe-zones)
