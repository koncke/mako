# Relevo — Motion graphics, Image Editor e imágenes con IA (26/10/2026, SUSPENDIDO)

Chat: «motion-imagen» (cuenta claude5), lanzado por el Cerebro. Rama `motion-imagen-2610`, worktree `C:/dev/wt-motion-imagen`,
desde `origin/main` c8f1c4a57. **No se pusheó nada.** El commit de este relevo es WIP: junta lo hecho por mí y por tres
agentes que se cortaron a mitad de camino.

## Lo que pidió Martín (punto 5 de la noche del 26/10, textual)

> «implementa esto de punta a punta: https://github.com/iart-ai/motion-skills que se puedan hacer motions graphics en la web
> y en el editor. Y también revisa el diseño y funcionalidades del editor e imagen, que se parezcan un poco mas a MaKo en el
> diseño, que tengan el chat de mako siempre abierto, como web generator y otras... Que tengan la misma infraestructura, pero
> que no pierdan su funcionalidad, que queden bien. Y que funcione todo, que se pueda editar o crear una imagen a raiz de
> prompts y chatear con mako.»

Y la suspensión, la misma noche: «Suspende y deja para despues lo de Motion, el editor e imagenes, dejalo registrado para
seguirlo con otra cuenta y concentrate en que esto realmente funcione bien» («esto» es el Web Generator, que pasó al chat
Landings).

## Para retomar

`Leé docs/relevo/motion-imagen.md, docs/hallazgos-motion.md y el final de docs/hallazgos-editor-imagen.md y
docs/hallazgos-video-editor.md, y seguimos en la rama motion-imagen-2610.`

Antes de tocar: mezclar `origin/main` (la rama nació en c8f1c4a57) y **coordinar con el chat Landings los archivos del Web
Generator** (lista abajo): ellos trabajan ahí desde el 26/10.

## Lo que quedó HECHO (y cómo se probó)

### 1. El motor de motion graphics — `lib/motion/` (terminado, probado)

- **motion-skills es un índice** de 19 packs; se leyeron los 8 útiles. Los ocho son MIT de iart.ai: se pueden usar en un
  SaaS con el aviso, que viaja en `lib/motion/LICENSE-IART`. Lo que se tomó son números y recetas, no código.
- 9 plantillas (`titular`, `palabras`, `cifra`, `tercio`, `logo`, `barras`, `testimonio`, `oferta`, `cierre`), 4 tonos
  (premium, corporativo, enérgico, juguetón), 3 proporciones (16:9, 9:16, 1:1).
- `plantillas.ts` (catálogo y `normalizarMotion`, la única puerta del spec) · `escena.ts` (la coreografía) · `evaluar.ts`
  (el estado de cada pedazo en t) · `canvas.ts` (el dibujante del lienzo) · `html.ts` + `css.ts` (el HTML y los
  `@keyframes` fijos de la landing) · `fuentes.ts` (cargar las fuentes antes de dibujar) · `curvas.ts`.
- **tests/motion.test.ts: 14 tests**, probados rompiendo el código 12 veces (una invirtiendo una condición). Todas dieron
  rojo. Las roturas, en la cabecera del test y en docs/hallazgos-motion.md.
  - ⚠️ El último cambio (`recorteBase` en `html.ts` + su test de `clip-path`) se escribió cuando la guardia de RAM no
    dejaba correr tests: **no se corrió**. Lo primero al retomar: `node --import tsx --test tests/motion.test.ts`.
- **Banco visual** (sin la app): esbuild + Chrome sin ventana, el lienzo y el HTML lado a lado en el mismo instante, en
  16:9 y 9:16. Coinciden cuadro por cuadro. Capturas en la carpeta de notas de la sesión (`motion-imagen-2610/banco-motion/`).
  La receta: `entrada.ts` importa lib/motion y `htmlDeArbol`, esbuild lo arma IIFE, y la página busca el tiempo t con
  `getAnimations()` + `pause()` + `currentTime = t`.

### 2. Motion en el Video Editor (hecho; el chat lo hacía un agente: ver «A MEDIAS»)

- Un motion graphic es un `graphic` con `definitionId` = `motion-<plantilla>`: `app/video-editor/_opencut/graphics/definitions/motion.ts`.
- El nodo se dibuja en cada cuadro con su tiempo, del tamaño del lienzo: `graphics/types.ts` (`animado`, `preparar`),
  `graphics/index.ts` (`tamanoFuenteGrafico`), `services/renderer/nodes/graphic-node.ts` (`versionFuente`),
  `compositor/frame-descriptor.ts`, `resolve.ts` y `preview/element-bounds.ts`.
- Biblioteca › Plantillas › «Motion» (`_opencut/motion/`, importado en `ce/extensiones.ts`). Pestaña «Motion» en el panel
  derecho (`properties/registry.tsx`, `graphic-tab.tsx` → `MotionTab`).
- **NO probado en el navegador.** Tipos sin chequear (`node scripts/tsc-acotado.mjs <archivos>`).

### 3. Image Editor con el chat de MaKo fijo y los colores de MaKo (hecho, sin ver en el navegador)

- El chat es `chatLateral` de `EditorApp` (`_doory/types/adapter.ts`, `_doory/editor/EditorApp.tsx` → `ChatFijo`,
  `EditorApp.module.css` → `.marco/.columna/.chat`), montado desde `editor/PantallaEditor.tsx`. Es el panel único
  (`PanelDeChat`, la estrella de MaKo, «Discutir | Editar»): `mako/chat/PanelMakoIA.tsx` + `chat.module.css` (`.columna`).
  Copiado de la tarjeta del agente del Web Generator (`.gma-izq`, 340 px).
- En la pantalla chica sigue siendo la hoja de la tira: `mako/registro.ts` (`PANEL_IA` sólo con `ui.compact`).
- Colores y letra de MaKo por TOKENS: `_doory/styles/tokens.css`, `TopBar.module.css`, `chrome/RielCanva.module.css`.
- Tests actualizados: tests/chat-unico.test.ts (el Image Editor pasa a «panel único») y tests/editores-chat-piezas.test.ts
  (la estrella, el panel, el selector y la intención que llega al motor). **NO corridos después del último cambio** (la
  guardia de RAM). `chat-unico` dio 7/0 y rompiéndolo 6/1 antes del cierre.
- **Capturas del ANTES** (producción, Cliente de Prueba) en la carpeta de notas (`motion-imagen-2610/antes/`), con la lista
  de funciones que no se pueden perder (`funciones-que-no-se-pierden.md`). **Falta el DESPUÉS** (computadora y teléfono)
  y tildar esa lista en el navegador.

## Lo que quedó A MEDIAS (de los agentes, cortados el 26/10)

### 4. El chat del Video Editor con motion (casi terminado)

- `lib/editor-video/chat-catalogo.ts`: `agregar_motion` y `editar_motion` al final del catálogo, validados con
  `normalizarMotion` ESTRICTO (`valoresMotionValidos`, `valoresAlAgregar`, `catalogoMotionCompacto`). `NO_SE_PUEDE_CHAT` ya
  no dice que no se puede.
- `app/video-editor/_opencut/chat/linea.ts` (la vista muestra cada motion como `"tipo":"motion"` con su plantilla y sus
  valores), `chat/comandos.ts` (agregar = `buildGraphicElement` + `InsertElementCommand`, como la biblioteca),
  `lib/editor-video/propuestas.ts`, `propuesta-bloque.ts`.
- API: `lib/editor-video/chat-api.ts` → `agregar_motion_video` y `editar_motion_video` (proponen; se aceptan en el editor),
  runners en `lib/api-mako/areas/video.run.ts`.
- Tests: tests/video-editor-chat-motion.test.ts (M1–M13) dio 13/13 ANTES de reescribir las descripciones; **M10 está en
  rojo** (su regex busca «nunca los inventes» y quedó «nunca se inventan»). Sin probar rompiéndolo. Sin tipos.
- **Falta medir el presupuesto del turno** (`scripts/presupuesto-turno-app.mts`). Antes de la última versión, «agregá un
  texto amarillo…» perdía `cambiar_estilo_texto_video` y «cambiá el título del motion…» perdía `editar_motion_video`.

### 5. El bloque motion del Web Generator (hecho, sin ver en el navegador) — ⚠️ AHORA ES TERRITORIO DEL CHAT LANDINGS

- El nodo `motion` está registrado en los mismos lugares que el gráfico:
  - `lib/editor-landing/`: `doc.ts`, `especificacion.ts`, `validar.ts`, `css.ts`, `pagina-publica.ts`, `publicar.ts`,
    `exportar-pptx.ts`, `diagnostico.ts`, `ia-bloques.ts`, `ia-reglas.ts`, `catalogo-bloques.ts`, y `motion.ts` (nuevo);
  - `app/web-generator/editor/`: `insertar.ts`, `extensiones/nodos.ts`, `extensiones/esquema.ts`, `extensiones/index.ts`, y
    `nodos/MotionVista.tsx` (nuevo: Editar / Plantilla / Reproducir / Eliminar).
- La publicada: `CSS_MOTION` en la hoja y `motionAlEntrar` en el script de la página, que pone y saca `gm-mo-espera`.
  También carga las fuentes del motion. PNG y PDF lo dibujan quieto en su estado final; el PPTX lleva su texto.
- La IA del editor lo escribe y lo lee, en modo estricto. El control de «inventado» saca un bloque cifra, testimonio o barras
  si sus números o su cita no están en el material.
- API:
  - `agregar_bloque_landing` acepta `bloque: "motion"`;
  - operación nueva `configurar_motion_landing`, al final del área, con `confirmacion: 'chat'` y REST
    `PATCH …/secciones/{seccion}/motion`;
  - `ver_secciones_landing` devuelve la plantilla, los valores y los topes de cada bloque motion;
  - archivos: `lib/api-mako/areas/landing-editor.{def,run}.ts`, `landing-contenido.helpers.ts`,
    `landing-listas.helpers.ts`, `lib/api-mako/rest.ts`.
- Tests:
  - en verde: tests/landing-motion.test.ts 14/0, render 18/0, validar 14/0, insertar 15/0, menús 13/0, temas 19/0,
    ia-bloques 16/0;
  - **sin correr:** editor-landing-publica, ia, exportar, diagnostico, completar, api-mako-registro, rest,
    landing-contenido, landing-editor, mako-intencion-landing, frontera-use-client, minificador-templates;
  - sin probar rompiéndolo y sin tipos.
- ⚠️ **El clasificador del Ops Center dio 2 de 48 en rojo, y la batería perdió una frase de web/ads.** Son frases de landing
  que `configurar_motion_landing` y el bloque `motion` dejan sin su herramienta. Hay que achicar la descripción o subir la
  relevancia de la que se perdió (AGENTS.md, «Una operación nueva deja AFUERA a otra»).
- ⚠️ **Un editor viejo tira el nodo que no conoce, y el autoguardado lo borra.** Este deploy tiene que salir ANTES de que
  cualquier landing tenga un bloque motion.

### 6. Crear y editar imágenes con IA en el Image Editor (a medias)

- Hecho y completo (sin tipos ni tests nuevos):
  - `lib/image-editor/imagen-ia-reglas.ts`, puro: qué proveedor, qué tamaño, leer la imagen del cuerpo de la respuesta,
    mensajes de error con el proveedor primero, sin reintento;
  - `lib/image-editor/imagen-ia.ts`: `generarImagen`, server-only, con la clave DEL NEGOCIO (OpenAI primero, Gemini
    después);
  - `app/api/image-editor/imagen/route.ts`: la puerta literal, el tope por minuto y `runWithWorkspace`;
  - `lib/image-editor/server.ts` → `guardarImagenGenerada`, que la guarda en «Subidos».
  - El chat:
    - `lib/image-editor/chat/catalogo.ts`: `crear_imagen`, `editar_imagen` y dos internas para aplicar; `salidaDeDiscutir`;
    - `lib/image-editor/chat/`: `aplicar.ts`, `hilo.ts`, `ia.ts`, `prompts.ts`;
    - `app/api/image-editor/ia/route.ts` y `lib/prompt-registry.ts` (el prompt `image_editor.chat.discutir`);
    - `app/image-editor/mako/chat/acciones.ts` y `hilo.ts` (`Hilo.progreso`: «Creando la imagen…»).
  - Firmas:
    - `pedirEdicion(editor, instruccion, alcance, intencion: 'editar' | 'discutir' = 'editar')`;
    - `CambioImagen` trae `imagen?` e `imagenAntes?`: la miniatura que dibuja `PanelMakoIA`;
    - un error de imagen deja el mensaje con `error: true` y `links` (`/integraciones?abrir=openai`).
- **Falta:**
  - Dibujar `Hilo.progreso` en `PanelMakoIA.tsx`. Dibujar el link de integración del error con `LinkIntegracion` +
    `ReportarASoporte`.
  - La operación de la API `generar_ilustracion_ia` (redactada, no escrita):
    - `costo: 'dinero'`, `confirmacion: 'pantalla'`, `pantalla: '/mako/revisar'`, admin, al final del área;
    - va en `lib/api-mako/areas/imagen.def.ts` y `imagen.run.ts`;
    - también en `NO_EN_FLUJOS` (`lib/api-mako/flujo.ts`), su fila REST (`lib/api-mako/rest.ts`) y `ESCRITURAS_IMAGEN`
      (`lib/doer-recetas.ts`);
    - hay que regenerar la foto de la API.
  - Tipos y tests: catálogo, elección de proveedor con `fetch` simulado, Discutir sin operaciones, probados rompiéndolos.
    Después, image-editor-chat y los dos del Ops Center, de a uno.
  - Antes del cambio corrían: image-editor-chat 25/25, ops-center-clasificador-app 48/48, ops-center-bateria 3 pasan y
    1 salteado.

### 7. Lo que NO se empezó

- **El Video Editor «como MaKo» con el chat siempre abierto** (el «si aplica» del pedido).
  - Hoy el chat «Editar con IA» abre cerrado (`app/video-editor/_opencut/chat/estado.ts`, `abierto: false`) y no usa el
    panel único.
  - Para hacerlo, copiar lo del Image Editor: `PanelDeChat` en `chat/PanelChat.tsx`, `abierto: true`, y pasarlo a «panel
    único» en tests/chat-unico.test.ts.
- Las capturas del DESPUÉS, y tildar la lista de funciones en el navegador.
- El sha para el tren: nada de esto pasó por Integración.

## Cómo se prueba

1. Tests: `node --import tsx --test tests/motion.test.ts tests/chat-unico.test.ts tests/editores-chat-piezas.test.ts
   tests/video-editor-chat-motion.test.ts tests/landing-motion.test.ts` y los de la API que tocaron los agentes
   (tests/api-mako-registro.test.ts, tests/api-mako-rest.test.ts, la foto tests/api-mako-http.snapshot.txt) y, cada uno SOLO,
   tests/ops-center-clasificador-app.test.ts y tests/ops-center-bateria.test.ts (una operación nueva puede dejar a otra
   afuera del tope de 12.000 caracteres).
2. Tipos: `node scripts/tsc-acotado.mjs --rama`.
3. La app: `next dev` de los editores pasa los 5 GB y el vigía lo mata. Lo que anda: `next build --debug-build-paths
   "app/image-editor/**,app/video-editor/**,app/web-generator/**,app/l/**,app/api/image-editor/**,app/api/video-editor/**,app/api/landing-generator/**,app/api/mako/pedidos/**,app/api/auth/**,app/api/hilo-de-tab/**"`
   + `next start -H 127.0.0.1` (docs/hallazgos-infra.md, «Verificar una tab NUEVA en local»). Ya hay una copia REAL de
   `node_modules` en `C:/dev/nm-motion-imagen` (el junction de un worktree hace morir a Turbopack): sacar el junction de
   `C:/dev/wt-motion-imagen/node_modules` y poner esa carpeta en su lugar.
   - Sin `/api/mako/chat` en el build, la caja del chat no se bloquea por la app de escritorio (contesta 404 y eso cuenta
     como «tiene»): sirve para probar, no es cómo anda en producción.
   - La sesión: `crearToken` (lib/auth-session.ts) con `mfa`, en un script, escrita a un archivo sin imprimirla, corta (unas
     horas): el secreto es el de producción. El ws3 (Cliente de Prueba) no tiene IA conectada: para ver una respuesta de
     verdad hace falta un negocio con su IA.
   - El script del Chrome sin ventana y mudo quedó en el scratchpad de la sesión (`cdp.mjs`); la regla es `--headless=new
     --mute-audio`.

## Las trampas (lo que no da error)

Las del motor están en docs/hallazgos-motion.md. Las que aparecieron con las piezas:

- **`gpt-image-1` se apagó el 23/10/2026.** Lo midió el agente de imágenes en la página de deprecaciones de OpenAI.
  - Quedaron `gpt-image-2.5-flare` para crear y `gpt-image-2.5-sunburst` para editar, en calidad `medium` (`auto` puede
    elegir `max`).
  - Precios de ese día, por millón de tokens: texto 5, imagen de entrada 8, imagen de salida 30 USD. Están en `PRICING` de
    `lib/anthropic-usage.ts`.
  - **Verificarlo de nuevo antes de subir**: un modelo de imagen cambia de nombre seguido.
- **`gemini-2.5-flash-image` es un riesgo.**
  - No tiene capa gratis.
  - Google da dos fechas de apagado distintas: 2/10/2026 en precios, 15/3/2027 en deprecaciones.
  - Según la página de modelos, sólo anda con claves que ya usaron los 2.5. El reemplazo recomendado es
    `gemini-3.1-flash-lite-image`.
- **El costo de una imagen de Gemini se anota en $0.** `costFor` toma todo `gemini` como gratis, y una imagen cuesta unos
  $0,039.
- **Vercel corta el cuerpo de un pedido en ~4,5 MB.** Por eso la referencia para editar una imagen sale del navegador con
  3,5 MB de data URL como mucho (el server acepta hasta 8).
- **La descripción de una operación nueva puntúa contra el pedido palabra por palabra, por subcadena**: «titul» también
  calza en «subtitulos». Una lista de plantillas, o la palabra «textos», en la descripción le sacaba el presupuesto a la
  operación que el pedido necesitaba. Los catálogos van en la descripción de un PARÁMETRO, que no puntúa.
- **Los textos de ejemplo de una plantilla son datos inventados si el chat los deja**: «Ana Pérez», «+1250», 5 estrellas.
  `valoresAlAgregar` los vacía cuando el chat agrega un motion.
- **Bug del motor sin arreglar:** en la plantilla `cifra`, el campo `numero` tiene paso 1, así que 4,5 se redondea a 5
  aunque `decimales` deje hasta 2 (`lib/motion/plantillas.ts`). El paso tiene que ser 0,01, o salir de `decimales`.
- **El generador de la referencia de la API lee el registro ENTERO del disco.** La foto `tests/api-mako-http.snapshot.txt`
  y `docs/api-mako.md` de esta rama traen juntas las operaciones de las tres piezas. Si se separan en commits distintos, se
  regeneran.
- **En el Bash de esta máquina, las barras invertidas adentro de un heredoc se pierden.** Una barra seguida de «b» terminó
  como un retroceso (el byte 0x08) adentro de un test. Para editar código con barras, la herramienta Edit, no un heredoc.
- **Sacar el junction de `node_modules` de un worktree mientras otro proceso corre tests ahí los rompe.** La copia real va a
  otra carpeta y se cambia con todo quieto.
