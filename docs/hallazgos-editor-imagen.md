# Hallazgos — Image Editor (el Canva de MaKo sobre Doory)

El plano está en [diseno-editor-imagen.md](diseno-editor-imagen.md) y los relevamientos en
[editor-imagen/](editor-imagen/). Acá va lo que costó: síntoma → causa → dónde vive → la regla.

---

## La licencia de Doory obliga a mostrar el crédito, y modificar el código no la saca

**Vive en:** `app/image-editor/_doory/LICENSE-DOORY` · `app/image-editor/editor/CreditoDoory.tsx`

Doory (`shaongitbd/doory`) es la «Attribution Assurance License»: servir su JS al navegador es
redistribuirlo, y pide «a prominent display (e.g., splash screen or banner text)» con el nombre del
autor, su identificación y la URL **cada vez que se abre**. «In whole or part, with or without
modification»: un archivo adaptado ya alcanza. Martín eligió el 14/10 portarlo igual y transformarlo
después («Copia a Doory, y luego lo modificamos completamente»).

- **Diagnóstico obvio equivocado:** «si lo cambiamos todo, ya es nuestro». Lo derivado sigue siendo
  derivado; el cartel se va sólo con permiso escrito del autor o con un editor reescrito sin su código.
- Su propio `NOTICE` dice «the rest is MIT, like the code» y contradice el `LICENSE`: no sirve de
  respaldo, sí de argumento para pedirle una licencia MIT.
- El «GPG-signed text» que exige no existe (ni el archivo ni commits firmados).
- Regla: el cartel no se saca y el editor no se abre a clientes hasta resolver esto
  (`tests/image-editor-integracion.test.ts` frena si falta el crédito).

## Instalar dependencias en el `node_modules` compartido sin `npm install`

**Vive en:** `C:/dev/canva-deps` (fuera del repo) · `package.json` / `package-lock.json`

El `node_modules` del clon tenía paquetes «sueltos» de otra sesión (`@simplewebauthn/*`, `@peculiar/*`,
WIP de passkeys sin commitear): un `npm install <pkg>` normal reconcilia el árbol contra el lock y los
habría BORRADO. Se instaló en una carpeta aparte (`npm install --prefix`), se copió sólo lo que faltaba
(sin pisar versiones distintas: `fflate` 0.8 y `pako` 2 quedaron anidados bajo `jspdf` y `fast-png`), y
el `package.json`/lock se actualizó con `npm install --package-lock-only`, que no toca `node_modules`.

- Antes de instalar algo en el clon: `npm ls --depth=0 | grep extraneous`. Si hay, no se corre `npm install`.
- ⚠️ **`fflate` local quedó en 0.4.9** (la de `rrweb`) y el `package.json` pide ^0.8.3: en Vercel se
  instala la 0.8 arriba. El ZIP de varias páginas de Doory usa `zipSync`, que la 0.4.9 ya tiene; sin probar.

## jsPDF importa en caliente tres opcionales, y Turbopack las exige igual

**Vive en:** `node_modules/jspdf/dist/jspdf.es.min.js`

`/image-editor` dio 500 con «Module not found: Can't resolve 'canvg' / 'dompurify' / 'html2canvas'»:
el build ES de jsPDF hace `import("canvg")` etc. sólo si se usan, Vite lo tolera y Turbopack resuelve
TODO import dinámico al compilar. Son `optionalDependencies` de jsPDF: el lock las trae y Vercel las
instala; local faltaban porque la instalación aparte se hizo con `--omit=optional`.

- Regla: al portar código que usa jsPDF (o cualquier paquete con imports dinámicos opcionales), se
  instalan sus opcionales también local.

## Un worktree nace sin `next-env.d.ts`, y el typecheck da 135 errores de CSS modules

**Vive en:** la raíz del worktree (archivo ignorado)

El primer typecheck acotado del port dio 137 errores; 135 eran `Cannot find module './x.module.css'`.
No era el port: `next-env.d.ts` (que trae los tipos de `*.module.css`) lo genera Next y está en
`.gitignore`, así que un worktree recién creado no lo tiene. Se copia del clon.

## El `?url` de Vite y el `import.meta.env` no existen en Next

**Vive en:** `_doory/editor/engine/bgRemoval/bundled.ts` y `session.ts` · `_doory/editor/collab/testHook.ts`

Doory importaba el `.wasm` de onnxruntime con `?url`; Turbopack no lo entiende y un `.wasm` del build da
404 en Vercel. El worker ahora lo baja de jsDelivr con la versión EXACTA del runtime instalado
(`ort.env.versions.web`). El onnxruntime-web instalado es el 1.22.0-dev que trae `@huggingface/transformers`
y no tipa el subpath `./wasm`: hay un `.d.ts` que lo apunta a `onnxruntime-common`.

- ⚠️ **Quitar fondo está APAGADO**: Doory lo prende sólo si su backend le manda la descripción del modelo
  (`configureBackgroundRemoval`). Falta alojar el modelo (U²-Net u2netp, Apache-2.0, o BiRefNet_lite MIT
  para objetos) y llamar a esa función desde la cáscara.

## El dev server local no aguanta compilar el editor con la máquina llena

**Vive en:** el entorno (`~/.claude/guardia/vigia.ps1`)

El 14/10 el inicio (`/image-editor`) se dibujó bien en un `next dev` local (worktree hermano del clon,
`turbopack.root` subido sólo en esa copia), y al abrir un diseño el proceso pasó los 5,4 GB y el vigía de
RAM lo mató por «fuga next dev». Es lo mismo que le pasó al Video Editor (que se verificó en producción).
Además, la extensión Claude in Chrome **no tiene acceso a `localhost`**: la captura falla con «Chrome
blocked the extension». Para mirar local va Playwright headless de la caché de npx, con `--mute-audio`.

- Con la máquina llena, el editor se verifica en producción (está detrás del guard del super admin).

## Un typecheck ACOTADO no ve dos `declare module` del mismo paquete en dos áreas

**Vive en:** `app/video-editor/_opencut/export/gifenc.d.ts` · `app/image-editor/_doory/editor/engine/export/video/gifenc.d.ts`

`gifenc` no trae tipos y los dos editores lo declaran por su cuenta. TypeScript FUSIONA las dos declaraciones y gana la del Video Editor, que no tenía la opción `first` de `writeFrame`: el typecheck acotado del Image Editor (sólo `app/image-editor`) dio limpio, y el completo del pre-push frenó el push con «`first` does not exist». Se le sumó `first?` (una opción real de gifenc) a la declaración del Video Editor.

- Regla: un paquete sin tipos se declara UNA vez; si ya hay un `declare module` en otra área, se amplía ése en vez de escribir otro.


## Lo que el relevamiento de integración midió y cambia el plan

**Vive en:** `docs/editor-imagen/relevamiento-integracion-mako.md`

- **La capa `superadmin` NO restringe ninguna tab** (`userNavKeys: null` en `lib/capas.ts`), y el
  comentario de `lib/capas.ts:283-286` y la regla de AGENTS.md dicen lo contrario. Diagnóstico obvio
  equivocado.
- **`adminOnly` es cosmético**: `/carousels` abre por URL a cualquier admin de cliente. Por eso el
  editor lleva guard por PERSONA (`acceso.ts`, molde `b112e5b7`).
- **«Generar imagen con IA» por Flow NO existe** en el Landing Generator: falta parchear la extensión.
- **Una foto de afuera no se puede dibujar en el lienzo sin copiarla antes al bucket**: Openverse y
  Picsum no mandan CORS y el export a PNG/PDF falla con el canvas «sucio».

## Un `import './x'` a un módulo que no existe pasa el typecheck y da 500

**Vive en:** `app/image-editor/editor/PantallaEditor.tsx` → `mako/registro.ts`

En la tanda 2 la pantalla importó `'../mako/registro'` (sin nombres, sólo para que registre «Proyectos») antes de
que otro agente lo creara. Con TS 5.9 sin `noUncheckedSideEffectImports`, tsc NO marca un import de efecto a un
archivo que falta; Turbopack sí, y la página da 500.

- Regla: un módulo que se importa por su efecto se importa con un nombre (`import { registrarProyectos } from …`)
  y se usa; así tsc lo ve. Hoy la pantalla llama `registrarProyectos(ws)` con el workspace del server.

## «Proyectos» con el `?ws=` de la URL abría la base del workspace 0

**Vive en:** `app/image-editor/mako/ProyectosPanel.tsx` · `mako/registro.ts`

La consigna pedía elegir la base local por el `?ws=`. En la cuenta propia ese parámetro NO está, así que se abría
la base del workspace 0 y la lista salía vacía sin error. Diagnóstico obvio equivocado: «el `?ws=` dice el
workspace». Quien lo sabe es el server (`getWorkspaceActual`, prop de la página): la pantalla lo pasa con
`registrarProyectos(ws)`, y si falta, el panel busca en qué base del navegador está el diseño abierto.

- **Ya no aplica desde la tanda 3 (14/10):** el panel lee `/api/image-editor/disenos`, y el workspace lo decide el
  server con el `?ws=` que `WsFetch` le pone al pedido. No hay base local que elegir.

## Las trampas de `.cv` (la raíz con los estilos base de Doory)

**Vive en:** `app/image-editor/_doory/styles/global.css` · `ImageEditorCliente.tsx`

- `.cv :where(a)` tiene la MISMA especificidad que una clase de módulo: gana el que cargue después. El link
  «Inicio» de la barra va colgado de `.editor` para ganar siempre.
- `.cv :focus-visible` les pone radio de 8 px a todos los que tienen foco: un botón redondo vuelve a declarar su
  radio con más especificidad o pierde la forma al tabular.
- `.cv` lleva `isolation: isolate`: un overlay `fixed` adentro queda DEBAJO de la barra lateral de MaKo. Un diálogo
  fuera del `EditorProvider` (el «Crear un diseño» del Inicio) va por portal a `<body>`, envuelto en `.cv` y con
  `useCapaModal`.
- Dentro del editor: un `Popover` (z 200) abierto desde un `Dialog` (z 300) queda detrás del velo; para eso está
  el prop `overModal`. `ui/Menu` no lo tiene, y tampoco se da vuelta hacia arriba: abierto desde la barra inferior
  tapa su botón (la lista del zoom usa `Popover placement="top"`).

## La barra del objeto flota SOBRE el lienzo: el lienzo le reserva la franja

**Vive en:** `_doory/editor/workspace/Workspace.tsx` (`TOOLBAR_BAND`) · `toolbar/parts.module.css`

En Canva la barra del objeto flota arriba del área del lienzo (8 px del borde, 48 de alto). Sin reservarle lugar,
tapaba el encabezado «Página 1 - Agregar título de página» y el salto a una página lo dejaba debajo.
`TOOLBAR_BAND = 64` sube el aire de arriba a 72 px, el `scrollTo` de una página deja esa franja libre y «Ajustar»
la descuenta.

- Regla: si cambia el alto o la posición de la barra, cambia `TOOLBAR_BAND` en el mismo commit.

## La selección de Canva vive en TRES lugares

**Vive en:** `_doory/editor/engine/objects/controls.ts` · `engine/objects/theme.ts`

Los tiradores (círculos blancos de 12 px con borde gris y sombra, píldoras laterales, rotación abajo) se dibujan en
`controls.ts`. Pero `theme.ts` vuelve a aplicar `selectionStyle` a TODOS los objetos al re-tematizar y a la
selección de varios: con su 1,5 de Doory, el marco volvía de 2 px a 1,5. Ahora `theme.ts` dice 2 y 12.

- ⚠️ Frágil: `controls.ts` cambia `ActiveSelection.createControls` al cargar el módulo (una subida de fabric puede
  romperlo sin aviso).

## El catálogo de Iconify: tres APIs que fallan en silencio

**Vive en:** `app/image-editor/mako/elementos.ts` · `elementos-lista.ts` (generado por `scripts/image-editor/genera-elementos.mjs`)

- `GET /collection` **banea una hora** tras ~6 pedidos seguidos: 429 «error code: 1015», `Retry-After: 3595`, sin
  CORS. Por eso los destacados de cada set quedan guardados en el repo y el editor sólo busca en vivo.
- La búsqueda es **sólo en inglés**: «casa» devuelve 0 resultados, sin error. La consulta pasa por un diccionario
  español → inglés («corazón» → «heart») antes de ir a la API.
- `start=` contesta «Bad request»: se pide una vez con `limit=999` y se pagina en el editor.

## Las fuentes de jsDelivr: el primer pedido tarda más que el corte del motor

**Vive en:** `app/image-editor/mako/fuentes.ts` (generado por `scripts/image-editor/genera-fuentes.mjs`) · `_doory/editor/engine/fonts.ts` (`LOAD_TIMEOUT_MS`)

Un archivo «frío» de jsDelivr tardó 12,6 s y el motor corta la carga a los 8 s: la primera vez el texto puede caer
a la fuente del sistema. **Diagnóstico obvio equivocado:** al verificar las 499 variantes con 15 s de tope dieron
16 «404» que no eran tales; al repetir, todas 200 (hubo además un 503 pasajero en latin-ext).

- Regla: una verificación de URLs de CDN reintenta antes de declarar un 404. Alojar las fuentes nosotros (tanda 4)
  saca el problema de raíz.

## Detalles del motor que confunden

- **Degradados de Doory:** el ángulo 0 apunta a la DERECHA (el CSS usa ángulo + 90). `_doory/editor/engine/objects/fills.ts`.
- **Quitar tildes con una regex:** la herramienta de escritura cambia `̀` por el carácter invisible; se escribe
  `/\p{M}/gu`. (`dialogs/resizeSizes.ts` e `inicio/tamanos.ts` tienen el rango ya convertido: funciona, pero no se ve.)
- **`next/font` entra por primera vez en el repo** (Noto Sans como `--cv-font-ui`, `ImageEditorCliente.tsx`): el
  build la baja de Google al compilar.
- **Un diseño viejo puede tener un `meta.presetId` en kebab-case** (`instagram-post`): desde la tanda 2 hay UNA lista
  de tamaños (`dialogs/resizeSizes.ts`, ids camelCase) para Redimensionar, el popover de la página y el Inicio. El
  `presetId` es sólo un dato; nadie lo busca.

## Un paquete «instalado en la máquina» no es un paquete del proyecto: el deploy de main murió por `qrcode`

**Vive en:** `package.json` · `tests/image-editor-dependencias.test.ts`

El primer deploy con el editor (`353c81a8`) quedó en Error: «Module not found: Can't resolve 'qrcode'». El QR de Doory lo importa y en el `node_modules` del clon estaba instalado SUELTO por otra sesión (extraneous): local compilaba, el typecheck pasaba y Vercel, que instala desde el lock, no lo tenía. Mientras no entró el arreglo (`fac319092`, del orquestador), todo deploy de main fallaba para todos los chats.

- Al portar código, la lista de dependencias sale de BARRER sus imports contra `package.json`, no de lo que compila en la máquina: un paquete suelto de otra sesión tapa el faltante.
- Lo fija `tests/image-editor-dependencias.test.ts` (probado: sin `qrcode` en package.json falla nombrándolo).

## Sumar ~65 mil líneas al repo subió el piso de RAM de CADA push

**Vive en:** `scripts/typecheck-lock.mjs` (`CAP_HEAP_MB`) · AGENTS.md

El 14/10 el typecheck completo del pre-push con el Image Editor adentro murió a los 285 s por «heap out of memory» (Mark-Compact 4083 → 4079 MB), sin un solo error de tipos. El orquestador subió `CAP_HEAP_MB` de 4096 a 5120 (`96e66c4b`) y con eso entró (`353c81a8`). Con más heap, el piso de RAM libre que pide el lock también sube: cada push de cualquier chat paga el port.

- Diagnóstico obvio equivocado: «el push falla por tipos». El síntoma de un heap corto es un exit sin errores impresos o el mensaje de V8, no un `error TS`.
- Si el editor sigue creciendo, la salida no es subir el tope otra vez: es sacar del typecheck completo lo que no cambia (el port de Doory podría ir con su propio tsconfig y un chequeo acotado), decisión de infra a tomar con Martín.

## «No veo la tab»: los dos diagnósticos obvios estaban equivocados

**Vive en:** `lib/nav-visibilidad.ts` (`puedeVerItem`, `resolverTab`) · `lib/capas.ts` (`tabEnCapa`) · AGENTS.md ·
`tests/image-editor-integracion.test.ts` 1c

Martín, 14/10: «No veo la tab en la sidebar principal, debería estar en la sección de Content Machine».

- ⚠️ **Falso 1: «`adminOnly` se apaga mirando un cliente; que la fila pregunte por la persona».** Se hizo (una marca
  `soloSuperAdmin`) y se descartó sin pushear: mirando un cliente la barra es la del cliente, sin lo que es sólo del
  super admin, y es una regla de Martín (01/08: «tampoco las tabs que no están disponibles en los usuarios y solo en
  super admin»; docs/hallazgos-seguridad.md). Quedó en la rama `opcion-image-en-clientes` por si él la quiere.
- ⚠️ **Falso 2: «la capa `superadmin` no trae la key en `navKeys`».** Así lo decía AGENTS.md, pero `tabEnCapa` une
  `navKeys` con `userNavKeys`, y en esa capa `userNavKeys` es `null`: deja pasar CUALQUIER key. Ya lo habían anotado
  Customer Success y Ads; la regla vieja de AGENTS.md lo seguía sembrando, y se corrigió.
- **Lo medido:** con `resolverTab`, en su barra (capa `superadmin`) la tab lleva a `/image-editor`; mirando un
  cliente, `null`. El deploy con el editor (13:33) estaba Ready en hola-mako.com. O sea: o miraba un cliente con
  `?ws=`, o tenía abierta una pestaña de antes del deploy (el JS viejo no se recarga solo al navegar).

## Verificar el editor sin el dev server: un banco con esbuild y Chrome sin ventana

**Vive en:** fuera del repo (el scratchpad de la sesión del 14/10) · la receta, acá

`next dev` pasa los 5 GB al compilar el editor y el vigía lo mata, y la extensión de Chrome no llega a localhost.
Lo que sí anduvo (14/10, tarde): **compilar sólo la cáscara del editor con esbuild** (`node_modules/esbuild`, 40 s
con la máquina tranquila, 185 s llena) y abrirla en el Chrome del sistema sin ventana (`--headless=new
--mute-audio`, perfil propio, CDP crudo con el `WebSocket` de Node 24). Cuatro stubs reemplazan a Next:
`next/dynamic` (un `lazy`), `next/font/google` (un objeto con `variable`), `next/navigation` y `@/app/_ui/Link` (la
ruta va en el hash); `@/` se resuelve contra el worktree con un plugin y los `.module.css` los entiende esbuild solo.
Con eso se verificó TODO lo que hace el navegador: crear, texto, plantilla, imagen soltada, guardar y reabrir, PNG
y PDF, la vista del presentador en una segunda ventana y, con la API de la entrada siguiente, la base.

- No ve la cáscara de MaKo (barra lateral, guard, `?ws=`): eso se mira en producción con la sesión de Martín.
- Una imagen se «suelta» con un `DragEvent` armado en la página (un `DataTransfer` con un `File`): el selector de
  archivos de Doory es un `<input>` suelto que CDP no alcanza sin interceptar el diálogo.

## Probar un módulo `server-only` sin Next: el diagnóstico obvio rompía React

**Vive en:** `lib/image-editor/server.ts` · la receta, acá

Para probar las funciones del server contra la base sin `next dev`: `runWithWorkspace(ws, fn)` (lib/workspace.ts)
fija el workspace sin request (`getWorkspaceActual` lee primero ese contexto) y `dotenv` carga el `.env.local`.
Lo que frenaba era `import 'server-only'`, que tira fuera de un server component.

- ⚠️ **Diagnóstico obvio equivocado: `node --conditions=react-server`.** Resuelve `server-only` a vacío, pero
  también cambia el React que se carga, y `next/navigation` (que entra por `acceso.ts`) muere con
  «`createContext` is not a function».
- ⚠️ Un hook ESM (`module.register` con `resolve`) **no lo ve**: tsx compila el `.ts` del repo a CommonJS y el
  `require('server-only')` no pasa por ahí.
- Lo que anda: `--require` de un `.cjs` que parchea `Module._resolveFilename` para que `server-only` dé un módulo
  vacío, y `--import tsx`. Así corrió la prueba de 23 pasos de la tanda 3 (ws 3, borrando todo al final), y el
  mismo truco le dio al banco una API que llama a `lib/image-editor/server.ts` sin Next.
- `after()` de `next/server` tira fuera de un request: `firmarSubida` lo envuelve y barre sin esperar.

## «Vista de presentador» abría un 404: era una página del build de Vite

**Vive en:** `app/image-editor/_doory/editor/presenter/channel.ts` (`presenterViewUrl`) · `app/image-editor/presentador/`

Doory abre las notas del presentador en una segunda ventana en `presenter-view.html`, otra entrada de su build de
Vite (`presenter/view/main.tsx`). Al portar sólo el editor, esa página no existía y el botón daba 404. Ahora es la
ruta `/image-editor/presentador` (mismo guard, sin la cáscara de MaKo, como `/integraciones/escuchando`); la vista
habla con el editor por `BroadcastChannel`, así que no necesita server.

- Regla: al portar una app de Vite, buscar sus OTRAS entradas (`*.html` del build, `main.tsx` sueltos): lo que el
  editor abre con `window.open` no lo ve el typecheck. Lo fija el test 5 de `tests/image-editor-integracion.test.ts`.

## La tanda 3 (los diseños en la base): lo que costó

**Vive en:** `supabase/migrations/0278_image_editor_disenos.sql` · `lib/image-editor/` · `app/api/image-editor/` ·
`app/image-editor/mako/{nube,adaptadorNube,mudanza}.ts`

- **El id es un uuid, no un identity**: el motor nombra los diseños con uuid y un diseño que estaba en el navegador
  sube con SU id. Así el alta es **idempotente por id** (si ya está, contesta el que hay sin pisarlo): una mudanza
  cortada se reintenta sin duplicar, y recién con el alta confirmada se borra la copia local.
- **El server rechaza un documento con `idb://` o `blob:` (422)**: en otra máquina sería un hueco. El adaptador
  sube esos `src` antes de guardar y recuerda lo subido (el documento en memoria sigue diciendo `idb://` hasta
  reabrir). Una imagen local que ya no está sale del documento con un aviso (la función es la de Doory,
  `removeMissingAssetReferences`).
- **El bucket público de Supabase manda `Access-Control-Allow-Origin: *`** (medido): el lienzo carga las imágenes
  con `crossOrigin: 'anonymous'` y el PNG sale con la imagen remota adentro. Una URL firmada habría vencido y
  matado el caché.
- **SVG y AVIF no entran al bucket** (un SVG es un documento activo bajo el dominio de Supabase): el adaptador los
  dibuja a PNG en el navegador antes de subir. Canva conserva el SVG vectorial; acá se pierde (pendiente abajo).
- **La miniatura pisa siempre el mismo archivo** y la URL guardada lleva `?v=<ms>`: sin eso el CDN sirve la vieja.
  Sube cada 15 s como mucho (lo del Doory original); no frena el guardado si falla.
- **Un MP4 y un M4A comparten firma (`ftyp`)**: `sniffArchivo` los trata como `audio/mp4`; un HEIC también tiene
  `ftyp` pero no está en la lista del bucket, así que no se puede firmar.

## ESLint de `ColorPicker`: no frena nada

**Vive en:** `_doory/editor/ui/ColorPicker.tsx:46` · `.git/hooks/pre-push`

Quedó anotado como riesgo («si el pre-push pasa ESLint por `_doory/`, frena ahí»). Medido el 14/10: el pre-push
corre tipos, el contrato de las skills y el snapshot de la API, **no ESLint**, y `next build` 16 tampoco lintea.
El `setState` en el efecto es el patrón de Doory para resetear el selector cuando cambia el objeto; se deja.

## Lo que quedó SIN hacer (con el archivo donde vive)

- **Mirarlo en producción con la sesión de Martín** (la cáscara: la tab, la barra lateral, el `?ws=`): el banco ve
  el editor, no MaKo alrededor. El Chrome conectado a Claude in Chrome no estaba disponible para la cuenta claude1.
- **Lo de Canva que Doory no trae** (tanda 5): notas adhesivas, dibujo y tablas (`drawers/ToolsPanel.tsx`), copiar
  estilo, líneas en codo/curva, texto alternativo, descargar la selección, bloquear/ocultar página, «Ir a la página».
- **Del armazón:** la vista rápida al pasar el mouse por el riel y la pestaña «Estilos» de Diseño
  (`chrome/RielCanva.tsx`); la mini-barra pegada a la selección (falta la posición en pantalla del objeto); las marcas
  de la regla con la posición del elemento (`workspace/Rulers.tsx`); el «⋯» por mosaico de la cuadrícula
  (`workspace/PageGrid.tsx`); «Editando ▾» y el avatar (no hay modos ni co-edición); en Proyectos, «Carpetas».
- **El texto del lienzo de las 10 plantillas sigue en inglés** (`mako/plantillas/*.json`): traducirlo pide volver a
  dibujar las miniaturas (`public/cv/plantillas/*.webp`); el banco de arriba ya sirve para eso.
- **Las fuentes salen de jsDelivr**, no de un almacenamiento propio (tanda 4).
- **Marca, versiones, compartir y comentarios**: en `null` (`mako/adaptadorNube.ts`); piden tablas propias.
- **Un SVG subido se guarda como PNG** (`mako/nube.ts` → `aRaster`): para conservarlo vectorial hay que sanearlo
  en el server y servirlo desde un origen sin cookies.
- **El relevamiento de FUNCIONES de Canva no se escribió**: el agente se cortó con la caída de la app
  del 14/10 09:10. Falta `docs/editor-imagen/relevamiento-canva-funciones.md`.
- **API de MaKo y Estrellas `formato_imagen`**: esperan a Martín (con el editor sólo suyo, declararla con
  `gating.tab` la abre por token a todo cliente completo/agencia; relevamiento-integracion-mako.md §6.2 y §13.7).
- **Una pestaña de Canva** («Diseño sin título - Presentación», `canva.com/design/DAHX-ICTUd4`) quedó
  abierta en el grupo de pestañas de los agentes: la abrió el relevamiento de funciones antes de cortarse.
  Si lo creó en la cuenta de Martín, hay que mandarlo a la papelera a mano.
